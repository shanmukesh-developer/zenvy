const express = require('express');
const router = express.Router();
const { getServiceBookingModel } = require('../models/ServiceBooking');
const { getUserModel } = require('../models/User');
const { protect, admin } = require('../middleware/authMiddleware');

const { getMenuItemModel } = require('../models/MenuItem');
const { getRestaurantModel } = require('../models/Restaurant');

// Store types whose products are services (booked here, never ordered). A product in one of these
// stores is bookable even if it was added without specs.bookingOnly (admin-added / older rows).
const SERVICE_VENDOR_TYPES = ['REPAIRS', 'PRINT', 'LAUNDRY', 'TAILORING'];
// Laundry is priced per kg / per piece: the student's quantity multiplies the card price.
const MAX_SERVICE_QTY = 50;
const cleanText = (v, max) => (typeof v === 'string' ? v.replace(/[<>]/g, '').trim().slice(0, max) : '');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toInt = (v, min, max, dflt) => {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
};
const specsOf = (item) => {
  let specs = item && item.specs;
  if (typeof specs === 'string') { try { specs = JSON.parse(specs); } catch { specs = {}; } }
  return specs && typeof specs === 'object' ? specs : {};
};

// Server-side price of a service booking, from the same catalogue rows the app shows (M11 / ordering-n15).
// Print: per-page rate (B&W or colour) × pages × copies + binding, exactly like the print sheet.
// Others: the service card price. Returns { amount, item } or { error }.
const priceServiceBooking = async (specifications) => {
  const spec = specifications && typeof specifications === 'object' ? specifications : {};
  const itemId = String(spec.catalogueItemId || '');
  if (!UUID_RE.test(itemId)) return { amount: 0, item: null }; // older app: the partner sends a quote
  const MenuItem = getMenuItemModel();
  const item = await MenuItem.findByPk(itemId);
  const Restaurant = getRestaurantModel();
  const store = item && Restaurant ? await Restaurant.findByPk(item.restaurantId) : null;
  const isServiceStore = !!store && SERVICE_VENDOR_TYPES.includes(String(store.vendorType || '').toUpperCase());
  if (!item || !(specsOf(item).bookingOnly || isServiceStore) || (store && store.isActive === false)) {
    return { error: 'This service is no longer available. Please pick another one.' };
  }
  const inStock = item.isAvailable !== false || !!(item.outOfStockUntil && new Date(item.outOfStockUntil) <= new Date());
  if (!inStock) return { error: `${item.name} is not taking bookings right now.` };

  const isPrint = String(spec.category || '').toLowerCase() === 'print';
  if (!isPrint) {
    // Laundry (per kg / per piece): price x quantity. Other services: the card price.
    const qty = String(spec.category || '').toLowerCase() === 'laundry' ? toInt(spec.quantity, 1, MAX_SERVICE_QTY, 1) : 1;
    return { amount: Math.round((Number(item.price) || 0) * qty * 100) / 100, item, quantity: qty };
  }

  const storeItems = await MenuItem.findAll({ where: { restaurantId: item.restaurantId } });
  const rate = (re) => {
    const hit = storeItems.find((i) => re.test(String(i.name || '')));
    return hit ? Number(hit.price) || 0 : null;
  };
  const rates = {
    bw: rate(/black|b\s*&\s*w|b\/w/i),
    color: rate(/colou?r/i),
    spiral: rate(/spiral/i),
    hardbound: rate(/hard\s*bound|thesis/i),
  };
  const pages = toInt(spec.pageCount, 1, 5000, 1);
  const copies = toInt(spec.copies, 1, 500, 1);
  const perPage = (spec.printColor === 'color' ? rates.color : rates.bw) ?? (Number(item.price) || 0);
  const binding = spec.bindingType === 'spiral' ? (rates.spiral ?? 0) : spec.bindingType === 'hardbound' ? (rates.hardbound ?? 0) : 0;
  const amount = Math.round((pages * perPage * copies + binding) * 100) / 100;
  if (amount > 100000) return { error: 'That print job is too large to book in the app. Please contact support.' };
  return { amount, item };
};

const isAdminUser = (user) => !!(user && typeof user.role === 'string' && user.role.toLowerCase() === 'admin');
// Only the customer who booked, the assigned partner, or an admin may see a booking.
const canViewBooking = (booking, user) => !!user && (
  booking.userId === user.id || isAdminUser(user) || (booking.assignedPartnerId && booking.assignedPartnerId === user.id)
);

// Non-UUID ids would make Postgres throw: answer 404 instead of a 500.
router.param('id', (req, res, next, id) => {
  if (!UUID_RE.test(String(id || ''))) return res.status(404).json({ success: false, message: 'Booking not found' });
  next();
});

const BOOKING_STATUSES = ['REQUESTED', 'DIAGNOSED_QUOTED', 'CONFIRMED', 'IN_PROGRESS', 'READY_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'];

// Create a new Service Booking (Laptop Repair, Printout, Laundry, Auto Ride, Room Shift)
router.post('/book', protect, async (req, res) => {
  try {
    const ServiceBooking = getServiceBookingModel();
    if (!ServiceBooking) {
      return res.status(500).json({ success: false, message: 'ServiceBooking model not initialized' });
    }

    const {
      serviceType,
      title,
      description,
      specifications,
      attachmentUrl,
      quotedAmount,
      pickupSlot,
      hostelBlock,
      roomNumber,
      deliveryAddress,
      contactPhone,
      paymentMethod,
    } = req.body;

    const VALID_SERVICE_TYPES = [
      'LAPTOP_REPAIR', 'PHONE_REPAIR', 'TAILORING', 'PRINTOUT', 'LAUNDRY', 'ROOM_SHIFTING',
      'AUTO_RIDE', 'BIKE_TAXI', 'STATION_CAB', 'PG_BOOKING', 'MATTRESS_DELIVERY',
      'ELECTRONICS_DELIVERY', 'GROCERY_DELIVERY', 'PHARMACY_DELIVERY', 'GENERAL',
    ];

    if (!serviceType || !title) {
      return res.status(400).json({ success: false, message: 'serviceType and title are required' });
    }

    if (!VALID_SERVICE_TYPES.includes(serviceType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid serviceType. Valid types: ${VALID_SERVICE_TYPES.join(', ')}`,
      });
    }

    if (title.length > 200) {
      return res.status(400).json({ success: false, message: 'Title must be under 200 characters' });
    }

    if (description && description.length > 2000) {
      return res.status(400).json({ success: false, message: 'Description must be under 2000 characters' });
    }

    // The client's quotedAmount is ignored: the price comes from the catalogue (see priceServiceBooking).
    const priced = await priceServiceBooking(specifications);
    if (priced.error) {
      return res.status(400).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: priced.error });
    }

    const sanitizedPhone = String(contactPhone || req.user.phone || '').replace(/[^\d+]/g, '').slice(0, 15);
    if (sanitizedPhone && sanitizedPhone.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number so the partner can call you.' });
    }

    // Store the quantity the server actually priced (not whatever the client sent).
    const specs = specifications && typeof specifications === 'object' && !Array.isArray(specifications) ? { ...specifications } : {};
    if (priced.quantity) specs.quantity = priced.quantity;
    if (specs.unit !== undefined && !['kg', 'pcs'].includes(specs.unit)) delete specs.unit;
    if (priced.item) specs.serviceName = priced.item.name;
    const block = cleanText(hostelBlock, 100) || cleanText(req.user.hostelBlock, 100);
    const room = cleanText(roomNumber, 30) || cleanText(req.user.roomNumber, 30);

    const initialTracking = [
      {
        stage: 'REQUESTED',
        timestamp: new Date().toISOString(),
        note: `Service request received for ${title}. Partner assignment in progress.`,
      }
    ];

    const finalAmt = priced.amount || 0;

    const booking = await ServiceBooking.create({
      userId: req.user.id,
      serviceType,
      title: cleanText(title, 200) || title,
      description: typeof description === 'string' ? description.replace(/[<>]/g, '') : description,
      specifications: specs,
      attachmentUrl: typeof attachmentUrl === 'string' && attachmentUrl ? attachmentUrl : null,
      status: 'REQUESTED',
      quotedAmount: finalAmt,
      finalAmount: finalAmt,
      paymentStatus: 'Pending',
      paymentMethod: 'COD', // services are paid in cash when the job is done

      pickupSlot: cleanText(pickupSlot, 100) || 'Immediate / 30 Mins',
      hostelBlock: block,
      roomNumber: room,
      deliveryAddress: cleanText(deliveryAddress, 300) || [block, room ? `Room ${room}` : ''].filter(Boolean).join(', '),
      contactPhone: sanitizedPhone,
      trackingHistory: initialTracking,
    });

    // If socket.io is available, broadcast new service notification to admins/partners
    if (req.app.get('io')) {
      const io = req.app.get('io');
      // Admins only: the payload includes the customer's room.
      io.to('admin-room').emit('newServiceBooking', {
        id: booking.id,
        serviceType: booking.serviceType,
        title: booking.title,
        hostelBlock: booking.hostelBlock,
        roomNumber: booking.roomNumber,
      });
    }
    require('../utils/realtime').notifyAdmin('service_booking', 'created', booking.id);

    return res.status(201).json({
      success: true,
      message: 'Service booked successfully! Our executive will connect with you.',
      booking,
    });
  } catch (error) {
    console.error('Error creating service booking:', error);
    return res.status(500).json({ success: false, message: 'We could not book this service right now. Please try again.' });
  }
});

// Get all service bookings for the authenticated user
router.get('/my-bookings', protect, async (req, res) => {
  try {
    const ServiceBooking = getServiceBookingModel();
    if (!ServiceBooking) {
      return res.status(500).json({ success: false, message: 'ServiceBooking model not initialized' });
    }

    const bookings = await ServiceBooking.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
    });

    return res.json({ success: true, count: bookings.length, bookings });
  } catch (error) {
    console.error('Error fetching user service bookings:', error);
    return res.status(500).json({ success: false, message: 'We could not load your bookings right now. Please try again.' });
  }
});

// Get a single booking by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const ServiceBooking = getServiceBookingModel();
    const booking = await ServiceBooking.findByPk(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (!canViewBooking(booking, req.user)) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    return res.json({ success: true, booking });
  } catch (error) {
    console.error('Error fetching service booking:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// Update quotation or diagnostic confirmation by user
router.post('/:id/confirm-quote', protect, async (req, res) => {
  try {
    const ServiceBooking = getServiceBookingModel();
    const booking = await ServiceBooking.findByPk(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // A quote can only be answered while the booking is still waiting on the student.
    if (!['REQUESTED', 'DIAGNOSED_QUOTED'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: booking.status === 'CANCELLED' ? 'This booking was cancelled.' : 'This quote was already answered.',
        booking,
      });
    }

    const { acceptQuote } = req.body || {};
    const history = Array.isArray(booking.trackingHistory) ? [...booking.trackingHistory] : [];

    if (acceptQuote) {
      booking.status = 'CONFIRMED';
      history.push({
        stage: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        note: `Student accepted estimated quotation of ₹${booking.quotedAmount}. Repair/Service scheduled.`,
      });
    } else {
      booking.status = 'CANCELLED';
      history.push({
        stage: 'CANCELLED',
        timestamp: new Date().toISOString(),
        note: 'Student declined quotation. Device returned/Booking closed.',
      });
    }

    booking.trackingHistory = history;
    await booking.save();

    if (req.app.get('io')) {
      req.app.get('io').to('admin-room').emit(acceptQuote ? 'serviceQuoteAccepted' : 'serviceCancelled', { id: booking.id, serviceType: booking.serviceType });
    }
    require('../utils/realtime').notifyAdmin('service_booking', acceptQuote ? 'updated' : 'cancelled', booking.id);

    return res.json({ success: true, message: acceptQuote ? 'Quotation approved' : 'Booking cancelled', booking });
  } catch (error) {
    console.error('Error confirming quote:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// Update booking status (Admin / Partner / Driver)
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const ServiceBooking = getServiceBookingModel();
    const booking = await ServiceBooking.findByPk(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Only an admin or the partner assigned to this booking may change its status or price.
    const isAdmin = isAdminUser(req.user);
    const isAssignedPartner = !!(booking.assignedPartnerId && booking.assignedPartnerId === req.user.id);
    if (!isAdmin && !isAssignedPartner) {
      return res.status(403).json({ success: false, message: 'Only the Zenvy team or the assigned partner can update this booking.' });
    }

    const { status, quotedAmount, finalAmount, driverDetails, assignedPartnerId } = req.body || {};
    const note = cleanText((req.body || {}).note, 300);
    const badAmount = (v) => v !== undefined && v !== null && (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 100000);
    if (badAmount(quotedAmount) || badAmount(finalAmount)) {
      return res.status(400).json({ success: false, message: 'Amounts must be between ₹0 and ₹100000.' });
    }

    if (status && !BOOKING_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${BOOKING_STATUSES.join(', ')}` });
    }

    if (status) booking.status = status;
    if (quotedAmount !== undefined && quotedAmount !== null) {
      booking.quotedAmount = Number(quotedAmount);
      // A new quote replaces the booking-time estimate, unless a final amount is set in the same update.
      if (finalAmount === undefined || finalAmount === null) booking.finalAmount = Number(quotedAmount);
    }
    if (finalAmount !== undefined && finalAmount !== null) booking.finalAmount = Number(finalAmount);
    if (driverDetails) booking.driverDetails = driverDetails;
    if (assignedPartnerId && isAdmin) booking.assignedPartnerId = assignedPartnerId;

    const history = Array.isArray(booking.trackingHistory) ? [...booking.trackingHistory] : [];
    if (status || note) {
      history.push({
        stage: status || booking.status,
        timestamp: new Date().toISOString(),
        note: note || `Status updated to ${status || booking.status}`,
      });
      booking.trackingHistory = history;
    }

    await booking.save();

    // Socket notification
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.to(`user_${booking.userId}`).emit('serviceStatusUpdate', {
        id: booking.id,
        status: booking.status,
        quotedAmount: booking.quotedAmount,
        finalAmount: booking.finalAmount,
        note: note || `Status updated to ${booking.status}`,
      });
    }

    return res.json({ success: true, message: 'Booking updated successfully', booking });
  } catch (error) {
    console.error('Error updating service booking:', error);
    return res.status(500).json({ success: false, message: 'Could not update the booking right now. Please try again.' });
  }
});

// Cancel a booking (by the user)
router.post('/:id/cancel', protect, async (req, res) => {
  try {
    const ServiceBooking = getServiceBookingModel();
    const booking = await ServiceBooking.findByPk(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const NON_CANCELLABLE = ['COMPLETED', 'DELIVERED', 'CANCELLED'];
    if (NON_CANCELLABLE.includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: booking.status === 'CANCELLED' ? 'This booking is already cancelled.' : 'This booking is already completed, so it can no longer be cancelled.',
        booking,
      });
    }
    // Once picked up, the partner has the student's things (clothes, laptop…): support handles it.
    if (['IN_PROGRESS', 'READY_FOR_DELIVERY'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        code: 'ALREADY_PICKED_UP',
        message: 'The partner already has your items, so this booking can no longer be cancelled in the app. Please contact support.',
        booking,
      });
    }

    const history = Array.isArray(booking.trackingHistory) ? [...booking.trackingHistory] : [];
    history.push({
      stage: 'CANCELLED',
      timestamp: new Date().toISOString(),
      note: (typeof (req.body || {}).reason === 'string' && req.body.reason.trim()) ? req.body.reason.replace(/[<>]/g, '').trim().slice(0, 250) : 'Cancelled by user',
    });

    booking.status = 'CANCELLED';
    booking.trackingHistory = history;
    await booking.save();

    // Notify partner/admin via socket
    if (req.app.get('io')) {
      // Admins (and the assigned partner) only — not a broadcast to every connected socket.
      const io = req.app.get('io');
      io.to('admin-room').emit('serviceCancelled', { id: booking.id, serviceType: booking.serviceType });
      if (booking.assignedPartnerId) io.to(`rider_${booking.assignedPartnerId}`).emit('serviceCancelled', { id: booking.id, serviceType: booking.serviceType });
    }
    require('../utils/realtime').notifyAdmin('service_booking', 'cancelled', booking.id);

    return res.json({ success: true, message: 'Booking cancelled successfully', booking });
  } catch (error) {
    console.error('Error cancelling service booking:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// Rate a completed booking
router.post('/:id/rate', protect, async (req, res) => {
  try {
    const ServiceBooking = getServiceBookingModel();
    const booking = await ServiceBooking.findByPk(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (!['COMPLETED', 'DELIVERED'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Can only rate completed bookings' });
    }

    const rating = Number((req.body || {}).rating);
    const review = typeof (req.body || {}).review === 'string' ? req.body.review.replace(/[<>]/g, '').trim().substring(0, 500) : '';
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Please pick a rating from 1 to 5 stars.' });
    }
    if ((booking.specifications || {}).userRating) {
      return res.status(409).json({ success: false, code: 'ALREADY_RATED', message: 'You have already rated this booking. Thank you!' });
    }

    // Store rating in specifications JSON (a NEW object: mutating the stored one in place is
    // not detected as a change on Postgres, so the rating would silently never save).
    booking.specifications = {
      ...(booking.specifications || {}),
      userRating: rating,
      userReview: review,
      ratedAt: new Date().toISOString(),
    };

    const history = Array.isArray(booking.trackingHistory) ? [...booking.trackingHistory] : [];
    history.push({
      stage: 'RATED',
      timestamp: new Date().toISOString(),
      note: `User rated ${rating}/5 stars. ${review ? `Review: ${review}` : ''}`,
    });
    booking.trackingHistory = history;
    await booking.save();

    return res.json({ success: true, message: 'Thank you for your feedback!', booking });
  } catch (error) {
    console.error('Error rating service booking:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// Get service stats for the dashboard
router.get('/stats/overview', protect, async (req, res) => {
  try {
    const ServiceBooking = getServiceBookingModel();
    if (!ServiceBooking) {
      return res.status(500).json({ success: false, message: 'ServiceBooking model not initialized' });
    }

    const { Op } = require('sequelize');
    const userId = req.user.id;

    const totalBookings = await ServiceBooking.count({ where: { userId } });
    const activeBookings = await ServiceBooking.count({
      where: { userId, status: { [Op.notIn]: ['COMPLETED', 'DELIVERED', 'CANCELLED'] } },
    });
    const completedBookings = await ServiceBooking.count({
      where: { userId, status: { [Op.in]: ['COMPLETED', 'DELIVERED'] } },
    });

    return res.json({
      success: true,
      stats: {
        total: totalBookings,
        active: activeBookings,
        completed: completedBookings,
      },
    });
  } catch (error) {
    console.error('Error fetching service stats:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// Admin: Get all service bookings with optional filtering
router.get('/admin/all', protect, admin, async (req, res) => {
  try {
    const ServiceBooking = getServiceBookingModel();
    if (!ServiceBooking) {
      return res.status(500).json({ success: false, message: 'ServiceBooking model not initialized' });
    }

    const { status, serviceType, hostelBlock } = req.query;
    const where = {};
    if (status) where.status = status;
    if (serviceType) where.serviceType = serviceType;
    if (hostelBlock) where.hostelBlock = hostelBlock;

    const bookings = await ServiceBooking.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    return res.json({ success: true, count: bookings.length, bookings });
  } catch (error) {
    console.error('Error fetching admin service bookings:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
