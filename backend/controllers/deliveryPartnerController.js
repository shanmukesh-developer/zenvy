const { getDeliveryPartnerModel } = require('../models/DeliveryPartner');
const { getOrderModel } = require('../models/Order');
const { getUserModel } = require('../models/User');
const { getRestaurantModel } = require('../models/Restaurant');
const { sendPushToTokens } = require('../utils/push');
const { creditCustomerForDelivery } = require('../services/BadgeService');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { sendWhatsAppMessage } = require('../utils/whatsappUtil');

const { normalizePhone } = require('../utils/phoneUtils');

// ── Constants ────────────────────────────────────────────────────────────
const BASE_DELIVERY_FEE = 30; // Flat ₹30 per delivery
const MAX_PIN_ATTEMPTS = 5; // wrong delivery PINs before the handover is locked for support

// What the rider earns for an order: its stored delivery fee (₹30 for old orders without one).
const riderPayout = (order) => (Number(order?.deliveryFee) > 0 ? Number(order.deliveryFee) : BASE_DELIVERY_FEE);

const normalizeItems = (items) => {
  if (typeof items === 'string') {
    try {
      return JSON.parse(items);
    } catch {
      return [];
    }
  }
  return Array.isArray(items) ? items : [];
};

// ── Rider order payload (pending / active / accept) ──────────────────────────
// Real values only: anything we do not know is null (the rider app hides it), never a placeholder.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
// Start of the current IST day as a UTC Date (Render runs in UTC; "today" for riders is IST).
const istStartOfDay = (now = new Date()) => {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS);
};
const istDayKey = (d) => new Date(new Date(d).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
const deliveredAtOf = (order) => order.deliveredAt || order.updatedAt;

const parseInstructions = (raw) => {
  let v = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = [v]; } }
  if (!Array.isArray(v)) return null;
  const list = v.map(s => String(s || '').trim()).filter(Boolean);
  return list.length ? list : null;
};

const dropText = (order, customer) => {
  if (order.deliveryAddress) return order.deliveryAddress;
  if (customer?.hostelBlock) return `${customer.hostelBlock} (${order.hostelGateDelivery ? 'Gate' : 'Room'})`;
  return null;
};

const paymentFields = (order) => {
  const method = order.paymentMethod || null;
  const finalPrice = Number(order.finalPrice);
  return {
    paymentMethod: method,
    paymentStatus: order.paymentStatus || null,
    amountToCollect: method === 'COD' && order.paymentStatus !== 'Completed' && Number.isFinite(finalPrice) ? finalPrice : 0,
  };
};

const riderOrderPayload = (order, restaurant, customer, { revealCustomer }) => {
  const restLat = restaurant ? Number(restaurant.lat) : NaN;
  const restLon = restaurant ? Number(restaurant.lon) : NaN;
  const distance = Number(order.distance);
  return {
    id: order.id,
    restaurant: restaurant?.name || null,
    restaurantAddress: restaurant?.location || null,
    restaurantPhone: restaurant?.whatsappNumber || null,
    pickupCoords: restaurant && restaurant.lat != null && restaurant.lon != null && Number.isFinite(restLat) && Number.isFinite(restLon)
      ? { lat: restLat, lng: restLon } : null,
    customerName: customer?.name ? (revealCustomer ? String(customer.name).trim() : String(customer.name).trim().split(/\s+/)[0]) : null,
    // Unclaimed orders are visible to every online rider: the phone is shared only after a rider claims it.
    customerPhone: revealCustomer ? (customer?.phone || null) : null,
    drop: dropText(order, customer),
    deliveryInstructions: parseInstructions(order.deliveryInstructions),
    items: normalizeItems(order.items),
    totalPrice: order.totalPrice,
    finalPrice: order.finalPrice,
    ...paymentFields(order),
    riderEarning: riderPayout(order),
    earnings: `₹${riderPayout(order)}`,
    distance: Number.isFinite(distance) && distance > 0 ? distance : null,
    status: order.status,
    createdAt: order.createdAt,
    deliverySlot: order.deliverySlot || null,
  };
};

const notApproved = (res) => res.status(403).json({
  code: 'RIDER_NOT_APPROVED',
  message: 'Your account is pending verification by the logistics admin.'
});
const serverError = (res, tag, error) => {
  console.error(tag, error);
  if (!res.headersSent) res.status(500).json({ message: 'Something went wrong on our side. Please try again in a moment.' });
};

const generateToken = (id) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[AUTH_FATAL] JWT_SECRET is not configured.');
    return null; // The calling logic should handle this gracefully
  }
  return jwt.sign({ id, role: 'rider' }, secret, { expiresIn: '30d' });
};

// @desc    Register a new delivery partner.
//          Admin (dashboard Fleet page): created approved.
//          Self sign-up: must prove the phone (firebaseToken or SMS otp) and waits for admin approval.
const registerPartner = async (req, res) => {
  const { name, phone, password, vehicleType, firebaseToken, otp } = req.body;

  try {
    const cleanPhone = normalizePhone(phone);
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ message: 'Enter a valid 10-digit mobile number.' });
    }

    // Check if request is made by an Admin (also avoids overwriting their session cookie)
    let skipCookie = false;
    let authHeader = req.headers.authorization;
    let tokenToCheck = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      tokenToCheck = authHeader.split(' ')[1].replace(/['"]+/g, '').trim();
    } else if (req.cookies?.token) {
      tokenToCheck = req.cookies.token.replace(/['"]+/g, '').trim();
    }

    if (tokenToCheck) {
      try {
        const decoded = jwt.verify(tokenToCheck, process.env.JWT_SECRET);
        if (decoded.role === 'admin') {
          skipCookie = true;
        } else {
          const { getUserModel } = require('../models/User');
          const User = getUserModel();
          if (User) {
            const dbUser = await User.findByPk(decoded.id);
            if (dbUser && dbUser.role && dbUser.role.toLowerCase() === 'admin') {
              skipCookie = true;
            }
          }
        }
      } catch (err) {
        console.warn('[DELIVERY_PARTNER_AUTH_CHECK_WARN] Token verify failed:', err.message);
      }
    }
    const isAdminRequest = skipCookie;

    const DeliveryPartner = getDeliveryPartnerModel();
    const partnerExists = await DeliveryPartner.findOne({ where: { phone: cleanPhone } });
    if (partnerExists) return res.status(400).json({ message: 'Partner already exists' });

    if (!isAdminRequest) {
      const { verifyPhoneProof } = require('./userController');
      const proof = await verifyPhoneProof({ phone: cleanPhone, firebaseToken, otp, purpose: 'auth' });
      if (!proof.ok) return res.status(proof.status).json(proof.body);
    }

    // ── Create partner ───────────────────────────────────────────────────
    const partner = await DeliveryPartner.create({
      name,
      phone: cleanPhone,
      password,
      vehicleType,
      isApproved: isAdminRequest
    });
    const token = generateToken(partner.id);

    if (!skipCookie) {
      res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 30 * 24 * 60 * 60 * 1000 });
    }
    res.status(201).json({ _id: partner.id, name: partner.name, isApproved: partner.isApproved, token });
  } catch (error) {
    console.error('[PARTNER_REGISTER_ERROR]', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// @desc    Auth partner & get token
const authPartner = async (req, res) => {
  const rawInput = req.body.phone || req.body.email || '';
  const { password } = req.body;

  try {
    const DeliveryPartner = getDeliveryPartnerModel();
    const cleanPhone = normalizePhone(rawInput);
    console.log(`[AUTH_PATH] Attempting login for identifier: "${rawInput}" -> cleaned: "${cleanPhone}"`);

    const partner = await DeliveryPartner.findOne({ where: { phone: cleanPhone } });
    if (!partner) {
      console.log(`[AUTH_PATH] No partner found with phone: ${cleanPhone}`);
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    const isMatch = await partner.comparePassword(password);
    console.log(`[AUTH_PATH] Partner found. Password match: ${isMatch}`);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    // ── 3. Return partner data and JWT token ────────────────────────────────
    const token = generateToken(partner.id);
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 30 * 24 * 60 * 60 * 1000 });

    // ── Streak Computation (IST) ───────────────────────────────────────
    const nowUtc = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const todayIST = new Date(nowUtc.getTime() + istOffset).toISOString().slice(0, 10);
    const lastLogin = partner.lastLoginDate ? String(partner.lastLoginDate) : null;

    if (lastLogin !== todayIST) {
      const yesterdayIST = new Date(nowUtc.getTime() + istOffset - 86400000).toISOString().slice(0, 10);
      if (lastLogin === yesterdayIST) {
        partner.loginStreak = (partner.loginStreak || 0) + 1;
      } else if (lastLogin === null || lastLogin < yesterdayIST) {
        partner.loginStreak = 1; // reset — missed a day
      }
      partner.lastLoginDate = todayIST;
      await partner.save();
    }
    // ─────────────────────────────────────────────────────────────────

    res.json({ 
      _id: partner.id, 
      name: partner.name, 
      phone: partner.phone,
      vehicleType: partner.vehicleType,
      vehicleNumber: partner.vehicleNumber,
      emergencyContact: partner.emergencyContact,
      isApproved: partner.isApproved,
      isAvailable: partner.isAvailable,
      walletBalance: partner.walletBalance,
      zenPoints: partner.zenPoints || 0,
      completedDeliveries: partner.completedDeliveries || 0,
      rating: partner.averageRating ?? null, // null = no ratings yet
      averageRating: partner.averageRating ?? null,
      loginStreak: partner.loginStreak || 0,
      token
    });
  } catch (error) {
    serverError(res, '[PARTNER_AUTH_ERROR]', error);
  }
};

// @desc    Accept an order
const acceptOrder = async (req, res) => {
  try {
    const DeliveryPartner = getDeliveryPartnerModel();
    const Order = getOrderModel();
    const partner = await DeliveryPartner.findByPk(req.user.id);
    if (!partner) return res.status(401).json({ message: 'Rider account not found' });
    if (!partner.isApproved) return notApproved(res);

    // 2. Atomic Claim: Only orders already accepted by restaurant/system can be claimed
    const [updatedRows] = await Order.update(
      { deliveryPartnerId: req.user.id },
      { where: { id: req.params.orderId, deliveryPartnerId: null, status: { [Op.in]: ['Accepted', 'Preparing', 'ReadyForPickup'] } } }
    );

    if (updatedRows === 0) {
      return res.status(400).json({ message: 'Order was already claimed by another rider or is not yet accepted by the merchant.' });
    }

    // Since we successfully updated, we fetch the updated order object
    const updatedOrder = await Order.findByPk(req.params.orderId);
    
    // (Status advancement is strictly controlled by the Restaurant Portal until picked up)
    
    if (partner) { 
      partner.currentOrderId = updatedOrder.id; 
      await partner.save(); 
    }

    const io = req.app.get('io');
    if (io) {
      // Claiming does not change the order status: report the real one (it may already be Preparing/Ready).
      const claimPayload = { id: updatedOrder.id, status: updatedOrder.status, riderAssigned: true };
      io.to(updatedOrder.id.toString()).emit('statusUpdated', claimPayload);
      io.to('admin-room').emit('statusUpdated', claimPayload);
      if (updatedOrder.restaurantId) io.to(`restaurant_${updatedOrder.restaurantId}`).emit('statusUpdated', claimPayload);
      io.to('admin-room').emit('admin_order_accepted', { orderId: updatedOrder.id, riderName: partner?.name || 'Rider' });
    }

    try {
      const User = getUserModel();
      const Restaurant = getRestaurantModel();
      const customer = await User.findByPk(updatedOrder.userId);
      const restaurant = await Restaurant.findByPk(updatedOrder.restaurantId);

      res.json({
        ...riderOrderPayload(updatedOrder, restaurant, customer, { revealCustomer: true }),
        hasDeliveryPin: !!updatedOrder.deliveryPin,
      });

      const rawCustomerTokens = Array.isArray(customer?.fcmTokens) ? customer.fcmTokens : [];
      const customerTokenList = rawCustomerTokens.map(t => typeof t === 'string' ? t : t?.token).filter(Boolean);
      if (customer) {
        await sendPushToTokens(customerTokenList, 'Order Accepted! 🛵', 'Your Zenvy rider is on the way.', { orderId: updatedOrder.id, type: 'ORDER_UPDATE' }, { recipients: [customer.id] });
      }
    } catch (e) {
      console.error('[ACCEPT_ORDER_ERROR]', e);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Something went wrong on our side. Please try again in a moment.' });
      }
    }
  } catch (error) {
    serverError(res, '[ACCEPT_ORDER_ERROR]', error);
  }
};

// @desc    Get all pending orders
const getPendingOrders = async (req, res) => {
  try {
    const DeliveryPartner = getDeliveryPartnerModel();
    const partner = await DeliveryPartner.findByPk(req.user.id);
    if (!partner) return res.status(401).json({ message: 'Rider account not found' });
    if (!partner.isApproved) return notApproved(res);

    const Order = getOrderModel();
    const User = getUserModel();
    const Restaurant = getRestaurantModel();
    const orders = await Order.findAll({
      where: { 
        status: { [Op.in]: ['Accepted', 'Preparing', 'ReadyForPickup'] },
        deliveryPartnerId: null
      }, 
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    const userIds = [...new Set(orders.map(o => o.userId))];
    const restIds = [...new Set(orders.map(o => o.restaurantId))];
    
    const [users, restaurants] = await Promise.all([
      User.findAll({ where: { id: userIds } }),
      Restaurant.findAll({ where: { id: restIds } })
    ]);

    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    const restMap = Object.fromEntries(restaurants.map(r => [r.id, r]));

    // Pool cards: first name only and no phone until the rider claims the order.
    const enrichedOrders = orders.map(order => riderOrderPayload(order, restMap[order.restaurantId], userMap[order.userId], { revealCustomer: false }));

    res.json(enrichedOrders);
  } catch (error) {
    serverError(res, '[RIDER_PENDING_ERROR]', error);
  }
};

// @desc    Get order history
const getOrderHistory = async (req, res) => {
  try {
    const Order = getOrderModel();
    const Restaurant = getRestaurantModel();
    // Remove 24-hour filter to allow full history visibility across sessions
    const orders = await Order.findAll({
      where: { deliveryPartnerId: req.user.id, status: 'Delivered' },
      order: [['updatedAt', 'DESC']],
      limit: 100 // Increased limit for better history visibility
    });

    const restIds = [...new Set(orders.map(o => o.restaurantId))];
    const restaurants = await Restaurant.findAll({ where: { id: restIds } });
    const restMap = Object.fromEntries(restaurants.map(r => [r.id, r]));

    const enrichedOrders = orders.map(order => {
      const restaurant = restMap[order.restaurantId];
      return {
        id: order.id,
        restaurant: restaurant?.name || null,
        restaurantAddress: restaurant?.location || null,
        drop: order.deliveryAddress || null,
        items: normalizeItems(order.items),
        totalPrice: order.totalPrice,
        finalPrice: order.finalPrice,
        paymentMethod: order.paymentMethod || null,
        paymentStatus: order.paymentStatus || null,
        riderEarning: riderPayout(order),
        earnings: `₹${riderPayout(order)}`,
        status: order.status,
        createdAt: order.createdAt,
        // Real handover time for orders delivered after deliveredAt was added; older rows fall back to updatedAt.
        deliveredAt: deliveredAtOf(order)
      };
    }).sort((a, b) => new Date(b.deliveredAt) - new Date(a.deliveredAt));

    res.json(enrichedOrders);
  } catch (error) {
    serverError(res, '[RIDER_HISTORY_ERROR]', error);
  }
};

// @desc    Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Picking', 'PickedUp', 'ArrivedAtGate', 'Delivered'];
    if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status' });

    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.deliveryPartnerId !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });

    if (status === 'Picking' && !['Pending', 'Accepted', 'Preparing', 'ReadyForPickup'].includes(order.status)) {
      return res.status(400).json({ message: 'Order must be Accepted or Ready by restaurant first' });
    }
    if (status === 'PickedUp' && !['Pending', 'Accepted', 'Preparing', 'ReadyForPickup', 'Picking'].includes(order.status)) {
      return res.status(400).json({ message: 'Order must be in Picking, Accepted, or Ready stage first' });
    }
    if (status === 'ArrivedAtGate' && !['PickedUp', 'ArrivedAtGate'].includes(order.status)) {
      return res.status(400).json({ message: 'Pick up the order before marking that you have arrived.' });
    }
    if (status === 'Delivered' && order.status === 'Delivered') {
      // Double tap / retry after a lost response: tell the app it is already done.
      return res.status(409).json({ code: 'ALREADY_DELIVERED', message: 'This order is already marked delivered.' });
    }
    if (status === 'Delivered' && !['PickedUp', 'ArrivedAtGate'].includes(order.status)) {
      return res.status(400).json({ message: order.status === 'Cancelled' ? 'This order was cancelled.' : 'Must be PickedUp or ArrivedAtGate first' });
    }

    // ── Delivery PIN Validation ──────────────────────
    if (status === 'Delivered') {
      const pin = String(req.body?.pin ?? '').trim();
      // Every order placed through the app has a PIN (only very old orders may not).
      if (order.deliveryPin && order.deliveryPin.length > 0) {
        const attempts = Number(order.deliveryPinAttempts) || 0;
        if (attempts >= MAX_PIN_ATTEMPTS) {
          return res.status(429).json({
            code: 'PIN_LOCKED',
            message: 'Too many wrong PINs for this order. Please contact Zenvy support to complete the handover.'
          });
        }
        if (!pin || pin !== order.deliveryPin) {
          const used = attempts + 1;
          await Order.update({ deliveryPinAttempts: used }, { where: { id: order.id } });
          if (used >= MAX_PIN_ATTEMPTS) {
            const io = req.app.get('io');
            if (io) io.to('admin-room').emit('admin_issue_reported', {
              orderId: order.id, senderRole: 'System', senderId: req.user.id,
              issueType: 'Delivery PIN locked', details: `${MAX_PIN_ATTEMPTS} wrong delivery PIN attempts by the rider.`,
              timestamp: new Date()
            });
          }
          const left = Math.max(0, MAX_PIN_ATTEMPTS - used);
          return res.status(400).json({
            code: 'INVALID_PIN',
            attemptsLeft: left,
            message: left > 0
              ? `That PIN doesn't match. Ask the customer for the 4-digit PIN shown in their Zenvy app (${left} ${left === 1 ? 'try' : 'tries'} left).`
              : 'Too many wrong PINs for this order. Please contact Zenvy support to complete the handover.'
          });
        }
      }
    }

    if (status === 'Delivered') {
      // Exactly-once: only the request that flips the order to Delivered credits anyone
      // (a double tap or an offline-queue replay must not pay the rider twice).
      const { Op } = require('sequelize');
      const [flipped] = await Order.update(
        { status: 'Delivered', deliveredAt: new Date(), ...(order.paymentMethod === 'COD' ? { paymentStatus: 'Completed' } : {}) },
        { where: { id: order.id, deliveryPartnerId: req.user.id, status: { [Op.in]: ['PickedUp', 'ArrivedAtGate'] } } }
      );
      if (flipped === 0) {
        const now = await Order.findByPk(order.id, { attributes: ['status'] });
        if (now && now.status === 'Delivered') return res.status(409).json({ code: 'ALREADY_DELIVERED', message: 'This order is already marked delivered.' });
        return res.status(409).json({ code: 'ORDER_CHANGED', message: 'This order was just cancelled or updated. Please refresh.' });
      }
      order.status = 'Delivered';
    } else {
      // Conditional flip: never resurrect an order the customer cancelled (and was refunded for)
      // after we read it.
      const prev = { Picking: ['Pending', 'Accepted', 'Preparing', 'ReadyForPickup'], PickedUp: ['Pending', 'Accepted', 'Preparing', 'ReadyForPickup', 'Picking'], ArrivedAtGate: ['PickedUp', 'ArrivedAtGate'] }[status];
      const [moved] = await Order.update({ status }, { where: { id: order.id, deliveryPartnerId: req.user.id, status: { [Op.in]: prev } } });
      if (moved === 0) return res.status(409).json({ message: 'This order was just cancelled or updated. Please refresh.' });
      order.status = status;
    }

    if (status === 'Delivered') {
      // Rider earns the order's delivery fee (₹30 for orders created before fees were stored).
      const earnings = riderPayout(order);
      const DeliveryPartner = getDeliveryPartnerModel();
      const User = getUserModel();
      await DeliveryPartner.increment({ totalEarnings: earnings, zenPoints: 5 }, { where: { id: req.user.id } });
      await DeliveryPartner.update({ currentOrderId: null }, { where: { id: req.user.id } });
      // Atomic increments: a stale read-modify-save here used to overwrite concurrent spin/redeem points.
      let customer = null;
      try {
        const credit = await creditCustomerForDelivery(User, order);
        customer = credit.customer;
        order.newBadges = credit.newBadges;
      } catch (creditErr) {
        console.error('[DELIVERY_CREDIT_ERROR]', order.id, creditErr.message);
      }
      if (customer) {
        try {
          for (const badge of order.newBadges || []) {
            await sendPushToTokens(
              customer.fcmTokens,
              'New Achievement Unlocked! 🏆',
              `Congratulations! You've earned the "${badge}" badge.`,
              { type: 'BADGE' },
              { recipients: [customer.id] }
            );
          }
          // --- Milestone Notifications ---
          if (customer.completedOrders % 2 === 0) {
            await sendPushToTokens(
              customer.fcmTokens,
              'Milestone Reached! 🎡',
              `You just completed your ${customer.completedOrders}th order! A Lucky Spin is waiting for you in the Vault.`,
              { type: 'SPIN_EARNED' },
              { recipients: [customer.id] }
            );
          }
        } catch (pushErr) {
          console.warn('[DELIVERY_PUSH_WARN]', pushErr.message);
        }
      }
    }

    const io = req.app.get('io');
    if (io) {
      const payload = { 
        id: order.id,
        status: status,
        newBadges: status === 'Delivered' ? (order.newBadges || []) : [] 
      };
      io.to(order.id.toString()).emit('statusUpdated', payload);
      io.to('admin-room').emit('statusUpdated', payload);
      if (order.restaurantId) io.to(`restaurant_${order.restaurantId}`).emit('statusUpdated', payload);
      if (status === 'Delivered') {
        io.to('admin-room').emit('admin_delivery_complete', { orderId: order.id });
      }
    }
    {
      // Never hand the customer's delivery PIN to the rider.
      const { deliveryPin, deliveryPinAttempts, ...safeOrder } = order.toJSON();
      res.json({ ...safeOrder, _id: order.id, riderEarning: riderPayout(order) });
    }

    try {
      const User = getUserModel();
      const customer = await User.findByPk(order.userId);
      const rawTokens = Array.isArray(customer?.fcmTokens) ? customer.fcmTokens : [];
      const customerTokenList = rawTokens.map(t => typeof t === 'string' ? t : t?.token).filter(Boolean);
      if (customer) {
        const titles = {
          Picking: 'Rider Arrived at Store 🏪',
          PickedUp: 'Order Picked Up! 🛵',
          ArrivedAtGate: 'Rider Arrived at Gate 🚪',
          Delivered: 'Order Delivered! 🎉'
        };
        const bodies = {
          Picking: 'Your rider is at the store picking up your items.',
          PickedUp: 'Rider is on the way!',
          ArrivedAtGate: 'Rider is waiting at your gate.',
          Delivered: 'Enjoy your meal!'
        };
        if (titles[status]) {
          await sendPushToTokens(customerTokenList, titles[status], bodies[status], { orderId: order.id, type: 'ORDER_UPDATE' }, { recipients: [customer.id] });
        }
      }
    } catch (e) {
      console.warn('[PUSH_NOTIFY_WARN] Failed to send update:', e.message);
    }
  } catch (error) {
    serverError(res, '[DELIVERY_UPDATE_ERROR]', error);
  }
};

// @desc    Rider emergency-cancels an assigned order
const cancelOrderByRider = async (req, res) => {
  try {
    const Order = getOrderModel();
    const DeliveryPartner = getDeliveryPartnerModel();

    const order = await Order.findByPk(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.deliveryPartnerId !== req.user.id) return res.status(403).json({ message: 'Not your order' });
    const RELEASABLE = ['Accepted', 'Preparing', 'ReadyForPickup', 'Picking'];
    if (!RELEASABLE.includes(order.status)) {
      return res.status(400).json({ message: 'Cannot cancel order after food has been picked up. Please contact support.' });
    }

    // Unassign rider so another rider can claim it. The kitchen's progress is kept: only the
    // rider-set 'Picking' step is undone (back to 'Preparing', which the store can still mark Ready).
    // Conditional so a customer cancel that landed after our read is never turned back into a live order.
    const nextStatus = order.status === 'Picking' ? 'Preparing' : order.status;
    const [released] = await Order.update(
      { deliveryPartnerId: null, status: nextStatus },
      { where: { id: order.id, deliveryPartnerId: req.user.id, status: order.status } }
    );
    if (released === 0) return res.status(409).json({ message: 'This order was just cancelled or updated. Please refresh.' });
    order.deliveryPartnerId = null;
    order.status = nextStatus;

    // Clear rider's current task
    const partner = await DeliveryPartner.findByPk(req.user.id);
    if (partner) {
      partner.currentOrderId = null;
      await partner.save();
    }

    const io = req.app.get('io');
    if (io) {
      const payload = { id: order.id, status: order.status };
      // Notify customer tracking page
      io.to(order.id.toString()).emit('statusUpdated', payload);
      // Notify admin
      io.to('admin-room').emit('statusUpdated', payload);
      if (order.restaurantId) io.to(`restaurant_${order.restaurantId}`).emit('statusUpdated', payload);
      io.to('admin-room').emit('order_unassigned', { orderId: order.id, reason: 'Rider emergency cancel' });
      // Re-list for dispatch (riders poll the available-orders list; admins see it live)
      io.to('admin-room').emit('newOrder', { ...order.toJSON(), id: order.id, _id: order.id });
    }

    // Push notify the customer about reassignment
    try {
      const User = getUserModel();
      const customer = await User.findByPk(order.userId);
      if (customer) {
        await sendPushToTokens(
          customer.fcmTokens,
          'Rider Reassigning 🔄',
          'Your previous rider had to cancel. We\'re assigning a new rider shortly.',
          { orderId: order.id, type: 'ORDER_UPDATE' },
          { recipients: [customer.id] }
        );
      }
    } catch (pushErr) {
      console.warn('[PUSH_NOTIFY_WARN] Failed to notify customer on rider cancel:', pushErr.message);
    }

    res.json({ message: 'Order released. Another rider will pick it up.', status: order.status });
  } catch (error) {
    serverError(res, '[RIDER_CANCEL_ERROR]', error);
  }
};

// @desc    Toggle online status
const toggleOnline = async (req, res) => {
  try {
    const DeliveryPartner = getDeliveryPartnerModel();
    const partner = await DeliveryPartner.findByPk(req.user.id);
    if (!partner) return res.status(401).json({ message: 'Rider account not found' });
    const wantOnline = req.body.isOnline === true || req.body.isOnline === 'true';
    // Going offline is always allowed (also for unapproved riders logging out).
    if (wantOnline && !partner.isApproved) return notApproved(res);
    partner.isOnline = wantOnline;
    await partner.save();
    res.json({ isOnline: wantOnline });
  } catch (error) {
    serverError(res, '[RIDER_ONLINE_ERROR]', error);
  }
};

// @desc    Save FCM Token for partner
const saveFcmToken = async (req, res) => {
  const fcmToken = req.body.fcmToken || req.body.token;
  const appVersion = req.body.appVersion || 'native-1.0.0';
  if (!fcmToken) {
    return res.status(400).json({ message: 'Token is required' });
  }
  try {
    const DeliveryPartner = getDeliveryPartnerModel();
    const partner = await DeliveryPartner.findByPk(req.user.id);
    if (partner) {
      // One entry per device token (an app update with a new appVersion must not leave a duplicate
      // of the same token behind, or the phone gets every order alert twice).
      const tokens = (Array.isArray(partner.fcmTokens) ? partner.fcmTokens : [])
        .filter(t => t && (typeof t === 'string' ? t : t.token) !== fcmToken);
      const idx = tokens.findIndex(t => t && t.appVersion === appVersion);
      if (idx > -1) tokens[idx] = { token: fcmToken, appVersion }; else tokens.push({ token: fcmToken, appVersion });
      partner.fcmTokens = tokens;
      partner.changed('fcmTokens', true);
      await partner.save();
      // A shared / handed-over phone: detach this device token from every other rider account,
      // so the previous rider's order alerts stop ringing on this phone.
      try {
        const others = await DeliveryPartner.findAll({
          where: { id: { [Op.ne]: partner.id }, fcmTokens: { [Op.like]: `%${fcmToken}%` } },
          attributes: ['id', 'fcmTokens']
        });
        for (const other of others) {
          other.fcmTokens = (Array.isArray(other.fcmTokens) ? other.fcmTokens : []).filter(t => (typeof t === 'string' ? t : t?.token) !== fcmToken);
          other.changed('fcmTokens', true);
          await other.save();
        }
      } catch (dedupeErr) {
        console.warn('[RIDER_FCM_DEDUPE_WARN]', dedupeErr.message);
      }
      res.json({ message: 'FCM Token saved' });
    } else {
      res.status(404).json({ message: 'Partner not found' });
    }
  } catch {
    res.status(500).json({ message: 'Failed to save token' });
  }
};

// @desc    Get all active orders for the logged in partner
const getActiveOrders = async (req, res) => {
  try {
    const DeliveryPartner = getDeliveryPartnerModel();
    const partner = await DeliveryPartner.findByPk(req.user.id);
    if (!partner) return res.status(401).json({ message: 'Rider account not found' });
    if (!partner.isApproved) return notApproved(res);

    const Order = getOrderModel();
    const User = getUserModel();
    const Restaurant = getRestaurantModel();

    const orders = await Order.findAll({
      where: { 
        deliveryPartnerId: req.user.id,
        status: { [Op.notIn]: ['Delivered', 'Cancelled'] }
      },
      order: [['createdAt', 'ASC']]
    });

    const userIds = [...new Set(orders.map(o => o.userId))];
    const restIds = [...new Set(orders.map(o => o.restaurantId))];
    
    const [users, restaurants] = await Promise.all([
      User.findAll({ where: { id: userIds } }),
      Restaurant.findAll({ where: { id: restIds } })
    ]);

    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    const restMap = Object.fromEntries(restaurants.map(r => [r.id, r]));

    const enrichedOrders = orders.map(order => ({
      ...riderOrderPayload(order, restMap[order.restaurantId], userMap[order.userId], { revealCustomer: true }),
      // The delivery PIN is never sent to riders: they ask the customer for it at handover.
      hasDeliveryPin: !!order.deliveryPin,
      pinLocked: (Number(order.deliveryPinAttempts) || 0) >= MAX_PIN_ATTEMPTS,
    }));

    // ── Task Sequencing Logic ──────────────────────
    const tasks = [];
    // 1. Pickups first (every pre-pickup state)
    enrichedOrders.filter(o => ['Accepted', 'Preparing', 'ReadyForPickup', 'Picking'].includes(o.status)).forEach(o => {
      tasks.push({ type: 'PICKUP', orderId: o.id, location: o.restaurant, address: o.restaurantAddress });
    });
    // 2. Deliveries next
    enrichedOrders.filter(o => ['PickedUp', 'ArrivedAtGate'].includes(o.status)).forEach(o => {
      tasks.push({ type: 'DELIVERY', orderId: o.id, location: o.customerName, address: o.drop });
    });

    res.json({ orders: enrichedOrders, taskSequence: tasks });
  } catch (error) {
    serverError(res, '[RIDER_ACTIVE_ERROR]', error);
  }
};

// @desc    Get today's leaderboard (top riders by earnings)
const getLeaderboard = async (req, res) => {
  try {
    const DeliveryPartner = getDeliveryPartnerModel();
    const Order = getOrderModel();
    const startOfDay = istStartOfDay();

    const deliveries = await Order.findAll({
      where: {
        status: 'Delivered',
        deliveryPartnerId: { [Op.ne]: null },
        [Op.or]: [
          { deliveredAt: { [Op.gte]: startOfDay } },
          { deliveredAt: null, updatedAt: { [Op.gte]: startOfDay } }
        ]
      },
      attributes: ['deliveryPartnerId', 'finalPrice', 'totalPrice', 'deliveryFee']
    });

    const earningsMap = {};
    const countMap = {};
    for (const d of deliveries) {
      const pid = d.deliveryPartnerId;
      const e = riderPayout(d);
      earningsMap[pid] = (earningsMap[pid] || 0) + e;
      countMap[pid] = (countMap[pid] || 0) + 1;
    }

    const partnerIds = Object.keys(earningsMap);
    if (partnerIds.length === 0) return res.json([]);

    const partners = await DeliveryPartner.findAll({
      where: { id: partnerIds },
      attributes: ['id', 'name']
    });

    const board = partners.map(p => ({
      id: p.id,
      name: p.name,
      earnings: earningsMap[p.id] || 0,
      orders: countMap[p.id] || 0,
      isMe: p.id === req.user.id
    })).sort((a, b) => b.earnings - a.earnings).slice(0, 10);

    res.json(board);
  } catch (error) {
    serverError(res, '[RIDER_LEADERBOARD_ERROR]', error);
  }
};

const getRiderProfile = async (req, res) => {
  try {
    const DeliveryPartner = getDeliveryPartnerModel();
    const Order = getOrderModel();
    const partner = await DeliveryPartner.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'fcmTokens'] }
    });
    if (!partner) return res.status(401).json({ message: 'Rider account not found (Session Expired)' });

    const completedCount = Order ? await Order.count({
      where: { deliveryPartnerId: req.user.id, status: 'Delivered' }
    }).catch(() => 0) : 0;

    res.json({
      ...partner.toJSON(),
      _id: partner.id,
      completedCount,
      completedDeliveries: completedCount,
      averageRating: partner.averageRating ?? null,
      rating: partner.averageRating ?? null, // null = no ratings yet (never an invented 5.0)
      totalRatings: partner.totalRatings || 0,
      totalEarnings: partner.totalEarnings || 0
    });
  } catch (error) {
    serverError(res, '[RIDER_PROFILE_ERROR]', error);
  }
};

// Delivered orders of this rider since `since` (deliveredAt, or updatedAt for rows older than that column).
const deliveredSince = (riderId, since) => getOrderModel().findAll({
  where: {
    deliveryPartnerId: riderId,
    status: 'Delivered',
    [Op.or]: [
      { deliveredAt: { [Op.gte]: since } },
      { deliveredAt: null, updatedAt: { [Op.gte]: since } }
    ]
  },
  attributes: ['id', 'deliveryFee', 'finalPrice', 'paymentMethod', 'deliveredAt', 'updatedAt']
});

// @desc    Get today's stats for current rider ("today" = IST calendar day)
const getTodayStats = async (req, res) => {
  try {
    const orders = await deliveredSince(req.user.id, istStartOfDay());

    const earnings = orders.reduce((sum, o) => sum + riderPayout(o), 0);
    const count = orders.length;
    // Cash the rider collected at the door today (COD orders they delivered).
    const codCollected = orders.filter(o => o.paymentMethod === 'COD').reduce((sum, o) => sum + (Number(o.finalPrice) || 0), 0);
    const DeliveryPartner = getDeliveryPartnerModel();
    const partner = await DeliveryPartner.findByPk(req.user.id, { attributes: ['loginStreak'] });
    res.json({ earnings, orders: count, zenPoints: count * 5, streak: partner?.loginStreak || 0, codCollected });
  } catch (error) {
    serverError(res, '[RIDER_TODAY_ERROR]', error);
  }
};

// @desc    Earnings for the last 7 IST days (today included), one bucket per day.
// @route   GET /api/delivery/stats/week
const getWeekStats = async (req, res) => {
  try {
    const DAY = 24 * 60 * 60 * 1000;
    const todayStart = istStartOfDay();
    const since = new Date(todayStart.getTime() - 6 * DAY);
    const orders = await deliveredSince(req.user.id, since);
    const days = [];
    for (let i = 6; i >= 0; i--) {
      days.push({ date: istDayKey(new Date(todayStart.getTime() - i * DAY + 60 * 1000)), earnings: 0, orders: 0, codCollected: 0 });
    }
    const byDate = Object.fromEntries(days.map(d => [d.date, d]));
    for (const o of orders) {
      const bucket = byDate[istDayKey(deliveredAtOf(o))];
      if (!bucket) continue;
      bucket.earnings += riderPayout(o);
      bucket.orders += 1;
      if (o.paymentMethod === 'COD') bucket.codCollected += Number(o.finalPrice) || 0;
    }
    res.json({
      days,
      totalEarnings: days.reduce((s, d) => s + d.earnings, 0),
      totalOrders: days.reduce((s, d) => s + d.orders, 0),
      timezone: 'Asia/Kolkata'
    });
  } catch (error) {
    serverError(res, '[RIDER_WEEK_ERROR]', error);
  }
};

// @desc    Update rider's own profile
const updateRiderProfile = async (req, res) => {
  try {
    const { name, vehicleType, vehicleNumber, bio, emergencyContact, photoUrl } = req.body;
    const DeliveryPartner = getDeliveryPartnerModel();
    const partner = await DeliveryPartner.findByPk(req.user.id);
    if (!partner) return res.status(401).json({ message: 'Rider account not found (Session Expired)' });

    const clean = (v, max) => (v === null ? '' : String(v).trim().slice(0, max));
    if (name !== undefined) {
      const n = clean(name, 60);
      if (n.length < 2) return res.status(400).json({ code: 'INVALID_NAME', message: 'Enter your name (at least 2 letters).' });
      partner.name = n;
    }
    if (vehicleType !== undefined) partner.vehicleType = clean(vehicleType, 30) || null;
    if (vehicleNumber !== undefined) partner.vehicleNumber = clean(vehicleNumber, 20).toUpperCase() || null;
    if (bio !== undefined) partner.bio = clean(bio, 160) || null;
    if (emergencyContact !== undefined) {
      const ec = emergencyContact ? normalizePhone(emergencyContact) : '';
      if (ec && !/^\d{10}$/.test(ec)) return res.status(400).json({ code: 'INVALID_PHONE', message: 'Enter a 10-digit emergency contact number.' });
      partner.emergencyContact = ec || null;
    }
    if (photoUrl !== undefined) partner.photoUrl = photoUrl;

    await partner.save();

    // Broadcast updated profile to admin room for monitoring
    const io = req.app.get('io');
    const updatePayload = {
      riderId: partner.id,
      name: partner.name,
      photoUrl: partner.photoUrl,
      vehicleType: partner.vehicleType,
      vehicleNumber: partner.vehicleNumber,
      averageRating: partner.averageRating
    };
    if (io) {
      io.to('admin-room').emit('rider_profile_updated', updatePayload);

      // Also broadcast to all active orders for this rider so customers see live updates
      const Order = getOrderModel();
      const activeOrders = await Order.findAll({
        where: {
          deliveryPartnerId: partner.id,
          status: ['Accepted', 'Preparing', 'ReadyForPickup', 'Picking', 'PickedUp', 'ArrivedAtGate']
        },
        attributes: ['id']
      });
      activeOrders.forEach(order => {
        io.to(order.id.toString()).emit('rider_profile_updated', updatePayload);
      });
    }

    const { password, fcmTokens, ...safe } = partner.toJSON();
    res.json({ ...safe, _id: partner.id, averageRating: partner.averageRating ?? null, rating: partner.averageRating ?? null });
  } catch (error) {
    serverError(res, '[RIDER_PROFILE_UPDATE_ERROR]', error);
  }
};

// @desc    Rider support tickets (riders are DeliveryPartner rows, not Users, so /api/tickets cannot store them)
// @route   POST /api/delivery/support  { subject, description, priority? }
const createRiderTicket = async (req, res) => {
  try {
    const subject = String(req.body?.subject || '').trim().slice(0, 120);
    const description = String(req.body?.description || '').trim().slice(0, 2000);
    if (!subject || !description) return res.status(400).json({ message: 'Pick a topic and describe the problem.' });
    const priority = ['Low', 'Medium', 'High', 'Critical'].includes(req.body?.priority) ? req.body.priority : 'Medium';
    const slaHours = { Critical: 2, High: 4, Medium: 12, Low: 24 }[priority];
    const { getTicketModel } = require('../models/Ticket');
    const ticket = await getTicketModel().create({
      userId: null,
      riderId: req.user.id,
      orderId: null,
      subject,
      description,
      priority,
      status: 'Open',
      slaBreachAt: new Date(Date.now() + slaHours * 60 * 60 * 1000)
    });
    const io = req.app.get('io');
    if (io) io.to('admin-room').emit('admin_issue_reported', {
      ticketId: ticket.id, senderRole: 'Rider', senderId: req.user.id,
      issueType: subject, details: description.slice(0, 200), timestamp: new Date()
    });
    res.status(201).json(ticket);
  } catch (error) {
    serverError(res, '[RIDER_TICKET_CREATE_ERROR]', error);
  }
};

// @route   GET /api/delivery/support
const getRiderTickets = async (req, res) => {
  try {
    const { getTicketModel } = require('../models/Ticket');
    const tickets = await getTicketModel().findAll({
      where: { riderId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json(tickets);
  } catch (error) {
    serverError(res, '[RIDER_TICKET_LIST_ERROR]', error);
  }
};


// @desc    Get public profile of a rider (customer tracking page, no auth)
const getPublicRiderProfile = async (req, res) => {
  try {
    const DeliveryPartner = getDeliveryPartnerModel();
    const partner = await DeliveryPartner.findByPk(req.params.id, {
      attributes: ['id', 'name', 'photoUrl', 'vehicleType', 'vehicleNumber', 'averageRating', 'totalRatings', 'bio']
    });
    if (!partner) return res.status(404).json({ message: 'Rider not found' });
    res.json({ ...partner.toJSON(), _id: partner.id });
  } catch (error) {
    serverError(res, '[RIDER_ERROR]', error);
  }
};

// @desc    Change rider's own password
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    const DeliveryPartner = getDeliveryPartnerModel();
    const partner = await DeliveryPartner.findByPk(req.user.id);
    if (!partner) {
      return res.status(404).json({ message: 'Rider account not found' });
    }
    const isMatch = await partner.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid current password' });
    }
    partner.password = newPassword;
    await partner.save();
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    serverError(res, '[RIDER_ERROR]', error);
  }
};

// @desc    Notify arrival at gate
const notifyArrivalAtGate = async (req, res) => {
  try {
    const Order = getOrderModel();
    const User = getUserModel();
    const order = await Order.findByPk(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.deliveryPartnerId !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });
    if (!['PickedUp', 'ArrivedAtGate'].includes(order.status)) {
      return res.status(400).json({ message: order.status === 'Delivered' ? 'This order is already delivered.' : order.status === 'Cancelled' ? 'This order was cancelled.' : 'Mark the order as picked up before you arrive at the gate.' });
    }

    // Conditional flip FIRST: never overwrite a Delivered / Cancelled that landed after our read.
    const [arrived] = await Order.update(
      { status: 'ArrivedAtGate' },
      { where: { id: order.id, deliveryPartnerId: req.user.id, status: { [Op.in]: ['PickedUp', 'ArrivedAtGate'] } } }
    );
    if (arrived === 0) return res.status(409).json({ message: 'This order was just updated. Please refresh.' });

    // Send push notification to the customer
    try {
      const customer = await User.findByPk(order.userId);
      if (customer) {
        await sendPushToTokens(
          customer.fcmTokens,
          'Rider Arrived at Gate! 🛎️',
          'Your rider is waiting at the hostel gate. Please collect your order.',
          { orderId: order.id, type: 'GATE_ARRIVAL' },
          { recipients: [customer.id] }
        );
      }
    } catch (e) {
      console.warn('[PUSH_NOTIFY_WARN] Failed to send gate arrival update:', e.message);
    }

    // Send WhatsApp notification
    try {
      const customer = await User.findByPk(order.userId);
      if (customer && customer.phone) {
        await sendWhatsAppMessage(
          customer.phone,
          `🛎️ *Rider Arrived at Gate!*\n\nYour Zenvy rider is waiting at your hostel gate. Please collect your order.\n\n📍 *Tracking:* ${process.env.FRONTEND_URL || 'https://zenvy.app'}/orders/${order.id}`,
          'GATE_ARRIVAL'
        );
      }
    } catch (e) {
      console.warn('[WHATSAPP_NOTIFY_WARN] Failed to send WhatsApp gate arrival update:', e.message);
    }

    order.status = 'ArrivedAtGate';

    // Emit socket event to the order room
    const io = req.app.get('io');
    if (io) {
      io.to(order.id.toString()).emit('driverAtGate', {
        message: 'Your rider is waiting at the hostel gate!'
      });
      const gatePayload = {
        id: order.id,
        status: 'ArrivedAtGate'
      };
      io.to(order.id.toString()).emit('statusUpdated', gatePayload);
      io.to('admin-room').emit('statusUpdated', gatePayload);
      if (order.restaurantId) io.to(`restaurant_${order.restaurantId}`).emit('statusUpdated', gatePayload);
    }

    res.json({ message: 'Gate arrival notification sent successfully', status: 'ArrivedAtGate' });
  } catch (error) {
    console.error('[GATE_ARRIVAL_ERROR]', error);
    serverError(res, '[RIDER_ERROR]', error);
  }
};

module.exports = { 
  registerPartner, authPartner, acceptOrder, getPendingOrders, getActiveOrders, 
  updateOrderStatus, toggleOnline, getOrderHistory, saveFcmToken, getLeaderboard,
  getRiderProfile, updateRiderProfile, getPublicRiderProfile, getTodayStats,
  cancelOrderByRider, changePassword, notifyArrivalAtGate,
  getWeekStats, createRiderTicket, getRiderTickets
};
