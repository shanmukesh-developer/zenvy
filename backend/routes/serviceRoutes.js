const express = require('express');
const router = express.Router();
const { getServiceBookingModel } = require('../models/ServiceBooking');
const { getUserModel } = require('../models/User');
const { protect, admin } = require('../middleware/authMiddleware');

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

    if (quotedAmount && (isNaN(quotedAmount) || quotedAmount < 0 || quotedAmount > 100000)) {
      return res.status(400).json({ success: false, message: 'quotedAmount must be between 0 and 100000' });
    }

    const sanitizedPhone = (contactPhone || req.user.phone || '').replace(/[^\d+]/g, '');
    if (sanitizedPhone && sanitizedPhone.length < 10) {
      return res.status(400).json({ success: false, message: 'Invalid contact phone number' });
    }

    const initialTracking = [
      {
        stage: 'REQUESTED',
        timestamp: new Date().toISOString(),
        note: `Service request received for ${title}. Partner assignment in progress.`,
      }
    ];

    // Default amount for fixed service estimates
    const finalAmt = quotedAmount || 0;

    const booking = await ServiceBooking.create({
      userId: req.user.id,
      serviceType,
      title,
      description,
      specifications: specifications || {},
      attachmentUrl: attachmentUrl || null,
      status: 'REQUESTED',
      quotedAmount: finalAmt,
      finalAmount: finalAmt,
      paymentStatus: 'Pending',
      paymentMethod: paymentMethod || 'COD',
      pickupSlot: pickupSlot || 'Immediate / 30 Mins',
      hostelBlock: hostelBlock || req.user.hostelBlock || '',
      roomNumber: roomNumber || req.user.roomNumber || '',
      deliveryAddress: deliveryAddress || `${hostelBlock || ''} Room ${roomNumber || ''}`,
      contactPhone: contactPhone || req.user.phone || '',
      trackingHistory: initialTracking,
    });

    // If socket.io is available, broadcast new service notification to admins/partners
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.emit('newServiceBooking', {
        id: booking.id,
        serviceType: booking.serviceType,
        title: booking.title,
        hostelBlock: booking.hostelBlock,
        roomNumber: booking.roomNumber,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Service booked successfully! Our executive will connect with you.',
      booking,
    });
  } catch (error) {
    console.error('Error creating service booking:', error);
    return res.status(500).json({ success: false, message: 'Server error creating booking', error: error.message });
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
    return res.status(500).json({ success: false, message: 'Server error fetching bookings', error: error.message });
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

    return res.json({ success: true, booking });
  } catch (error) {
    console.error('Error fetching service booking:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
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

    const { acceptQuote } = req.body;
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

    return res.json({ success: true, message: acceptQuote ? 'Quotation approved' : 'Booking cancelled', booking });
  } catch (error) {
    console.error('Error confirming quote:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
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

    const { status, quotedAmount, finalAmount, note, driverDetails, assignedPartnerId } = req.body;

    if (status) booking.status = status;
    if (quotedAmount !== undefined) booking.quotedAmount = quotedAmount;
    if (finalAmount !== undefined) booking.finalAmount = finalAmount;
    if (driverDetails) booking.driverDetails = driverDetails;
    if (assignedPartnerId) booking.assignedPartnerId = assignedPartnerId;

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
        note: note || `Status updated to ${booking.status}`,
      });
    }

    return res.json({ success: true, message: 'Booking updated successfully', booking });
  } catch (error) {
    console.error('Error updating service booking:', error);
    return res.status(500).json({ success: false, message: 'Server error updating booking', error: error.message });
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
        message: `Cannot cancel a booking with status: ${booking.status}`,
      });
    }

    const history = Array.isArray(booking.trackingHistory) ? [...booking.trackingHistory] : [];
    history.push({
      stage: 'CANCELLED',
      timestamp: new Date().toISOString(),
      note: req.body.reason || 'Cancelled by user',
    });

    booking.status = 'CANCELLED';
    booking.trackingHistory = history;
    await booking.save();

    // Notify partner/admin via socket
    if (req.app.get('io')) {
      req.app.get('io').emit('serviceCancelled', { id: booking.id, serviceType: booking.serviceType });
    }

    return res.json({ success: true, message: 'Booking cancelled successfully', booking });
  } catch (error) {
    console.error('Error cancelling service booking:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
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

    const { rating, review } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    // Store rating in specifications JSON
    const specs = booking.specifications || {};
    specs.userRating = rating;
    specs.userReview = (review || '').substring(0, 500);
    specs.ratedAt = new Date().toISOString();
    booking.specifications = specs;

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
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
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
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
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
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;
