const { getOrderModel } = require('../models/Order');
const { getUserModel } = require('../models/User');
const { getRestaurantModel } = require('../models/Restaurant');
const { getDeliveryPartnerModel } = require('../models/DeliveryPartner');
const { sendPushToTokens } = require('../utils/push');
const { updateStreak } = require('../middleware/rewardEngine');
const { getMenuItemModel } = require('../models/MenuItem');
const { sendWhatsAppMessage, formatOrderMessage } = require('../utils/whatsappUtil');
const { Op } = require('sequelize');
const crypto = require('crypto');
const { computeOrderQuote, PricingError, activeCouponWhere, normalizePaymentMethod, PAYMENT_UNAVAILABLE_MESSAGE, money } = require('../utils/orderPricing');
const { getCampusServiceability } = require('../utils/storeHours');
const { getHaversineDistance } = require('../utils/distance');

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

const broadcastOrderStatus = (req, orderOrId, payload) => {
  try {
    const io = req.app.get('io');
    if (!io) return;
    const isObj = orderOrId && typeof orderOrId === 'object';
    const room = String(isObj ? orderOrId.id : orderOrId);
    io.to(room).emit('statusUpdated', payload);
    io.to('admin-room').emit('statusUpdated', payload);
    require('../utils/realtime').notifyAdmin('order', 'updated', room);
    // The restaurant portal joins `restaurant_<id>`; no global broadcast of other people's orders.
    if (isObj && orderOrId.restaurantId) io.to(`restaurant_${orderOrId.restaurantId}`).emit('statusUpdated', payload);
  } catch (err) {
    console.warn('[SOCKET_BROADCAST_WARN]', err.message);
  }
};

const isAdminUser = (user) => !!(user && user.role && String(user.role).toLowerCase() === 'admin');

// ── Campus / address resolution ─────────────────────────────────
const CAMPUS_KEYS = { srmap: 'SRM AP', srm: 'SRM AP', vitap: 'VIT AP', vit: 'VIT AP', amrita: 'Amrita' };
const resolveCampus = (campus, address) => {
  const key = String(campus || '').toLowerCase().replace(/[^a-z]/g, '');
  if (CAMPUS_KEYS[key]) return CAMPUS_KEYS[key];
  const a = String(address || '').toLowerCase();
  if (a.includes('srm ap') || a.startsWith('srm')) return 'SRM AP';
  if (a.includes('vit ap') || a.startsWith('vit')) return 'VIT AP';
  if (a.includes('amrita')) return 'Amrita';
  return null;
};
const HUB = { lat: 16.4632, lng: 80.5064 }; // SRM AP central hub
const MAX_RADIUS_KM = 40;

// ── Double-tap protection (per user + client idempotency key, 2 minutes) ──
const IDEMPOTENCY_TTL_MS = 2 * 60 * 1000;
const recentOrderKeys = new Map(); // `${userId}:${key}` -> { at, orderId }
const sweepIdempotencyKeys = () => {
  const now = Date.now();
  for (const [k, v] of recentOrderKeys) if (now - v.at > IDEMPOTENCY_TTL_MS) recentOrderKeys.delete(k);
};

const sendPricingError = (res, err) => res.status(err.status || 400).json(err.toBody());

// @desc    Price a basket without placing it (the bill the customer sees = the bill we charge)
// @route   POST /api/orders/quote
const quoteOrder = async (req, res) => {
  try {
    const User = getUserModel();
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(401).json({ message: 'Your session has expired. Please log in again.', code: 'ACCOUNT_NOT_FOUND' });
    const quote = await computeOrderQuote({ user, items: (req.body || {}).items, couponCode: (req.body || {}).couponCode });
    const walletBalance = money(user.walletBalance);
    res.json({
      ...quote,
      serviceability: getCampusServiceability(),
      paymentMethods: ['COD', 'Wallet'],
      walletBalance,
      canPayWithWallet: walletBalance >= quote.finalPrice
    });
  } catch (err) {
    if (err instanceof PricingError) return sendPricingError(res, err);
    console.error('[ORDER_QUOTE_ERROR]', err);
    res.status(500).json({ message: 'We could not calculate your bill right now. Please try again.' });
  }
};

// @desc    Is campus ordering open right now?
// @route   GET /api/orders/serviceability
const getServiceability = async (req, res) => {
  res.json({ ...getCampusServiceability(), paymentMethods: ['COD', 'Wallet'] });
};

// @desc    Create a new order
// @route   POST /api/orders
const createOrder = async (req, res) => {
  const body = req.body || {};
  const { items, deliverySlot, deliveryAddress, coordinates, couponCode } = body;
  const rawKey = req.get('Idempotency-Key') || body.idempotencyKey;
  const idemKey = rawKey ? `${req.user.id}:${String(rawKey).slice(0, 100)}` : null;
  let idemClaimed = false;

  try {
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Your basket is empty. Add something tasty first!', code: 'EMPTY_BASKET' });
    }

    // ── Payment: Cash on Delivery or Wallet only ──
    if (body.paymentMethod === undefined || body.paymentMethod === null || body.paymentMethod === '') {
      return res.status(400).json({ message: 'Please choose Cash on Delivery or Wallet to pay.', code: 'PAYMENT_METHOD_REQUIRED' });
    }
    const paymentMethod = normalizePaymentMethod(body.paymentMethod);
    if (!paymentMethod) {
      return res.status(400).json({ message: PAYMENT_UNAVAILABLE_MESSAGE, code: 'PAYMENT_METHOD_UNAVAILABLE', allowed: ['COD', 'Wallet'] });
    }

    // ── Campus ordering hours (9 PM – 6 AM IST closed) ──
    const serviceability = getCampusServiceability();
    if (!serviceability.open) {
      return res.status(403).json({ message: serviceability.message, code: 'ORDERING_CLOSED', reopensAt: serviceability.reopensAt });
    }

    // ── Delivery location ──
    const address = String(deliveryAddress || '').replace(/[<>]/g, '').trim().slice(0, 500);
    if (address.length < 3) {
      return res.status(400).json({ message: 'Please add your delivery address (hostel block and room) so the rider can find you.', code: 'ADDRESS_REQUIRED' });
    }
    const campus = resolveCampus(body.campus, address);
    // Structured delivery notes: up to 6 short strings.
    const deliveryInstructions = (Array.isArray(body.deliveryInstructions) ? body.deliveryInstructions : [])
      .filter((n) => typeof n === 'string')
      .map((n) => n.replace(/[<>]/g, '').trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 6);
    const lat = coordinates ? Number(coordinates.lat) : NaN;
    const lng = coordinates ? Number(coordinates.lng) : NaN;
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
    if (!campus && !hasCoords) {
      return res.status(400).json({ message: 'We need your location pin to deliver outside campus. Please allow location access, or pick your campus.', code: 'LOCATION_REQUIRED' });
    }
    if (hasCoords) {
      const km = getHaversineDistance(HUB.lat, HUB.lng, lat, lng);
      if (km > MAX_RADIUS_KM) {
        return res.status(400).json({ message: `Sorry, that location is ${km.toFixed(1)} km away — we deliver within ${MAX_RADIUS_KM} km of campus.`, code: 'OUT_OF_RANGE' });
      }
    }

    // ── Double tap → same order, never two ──
    if (idemKey) {
      sweepIdempotencyKeys();
      const seen = recentOrderKeys.get(idemKey);
      if (seen && seen.orderId) {
        const Order = getOrderModel();
        const existing = await Order.findByPk(seen.orderId);
        if (existing) return res.status(200).json({ ...existing.toJSON(), _id: existing.id, duplicate: true });
      } else if (seen) {
        return res.status(409).json({ message: 'Your order is already being placed — hang tight!', code: 'ORDER_IN_PROGRESS' });
      }
      recentOrderKeys.set(idemKey, { at: Date.now(), orderId: null });
      idemClaimed = true;
    }

    const User = getUserModel();
    const Order = getOrderModel();
    const currentUser = await User.findByPk(req.user.id);
    if (!currentUser) {
      if (idemClaimed) recentOrderKeys.delete(idemKey);
      return res.status(401).json({ message: 'Your session has expired. Please log in again.', code: 'ACCOUNT_NOT_FOUND' });
    }

    // ── Server prices everything from the DB ──
    let quote;
    try {
      quote = await computeOrderQuote({ user: currentUser, items, couponCode });
    } catch (err) {
      if (idemClaimed) recentOrderKeys.delete(idemKey);
      if (err instanceof PricingError) return sendPricingError(res, err);
      throw err;
    }

    const Restaurant = getRestaurantModel();
    const restaurant = await Restaurant.findByPk(quote.store.id);

    let isSurge = false;
    try {
      const serverModule = require('../server');
      if (typeof serverModule.isSurgeActive === 'function') isSurge = !!serverModule.isSurgeActive(restaurant.zone);
    } catch { /* server module not ready — skip surge */ }

    // Real distance only when both ends have real coordinates; never a simulated number.
    let distanceKm = null;
    if (hasCoords && restaurant.lat != null && restaurant.lon != null) {
      distanceKm = Number(getHaversineDistance(Number(restaurant.lat), Number(restaurant.lon), lat, lng).toFixed(2));
    }

    // ── Coupon claim + wallet debit + order row: all or nothing ──
    const { getSequelize } = require('../config/db');
    const sequelize = getSequelize();
    let createdOrder;
    try {
      createdOrder = await sequelize.transaction(async (t) => {
        if (quote.coupon) {
          const { getCouponModel } = require('../models/Coupon');
          const Coupon = getCouponModel();
          const [claimed] = await Coupon.update({ isUsed: true }, { where: activeCouponWhere(quote.coupon.code, currentUser.id), transaction: t });
          if (claimed === 0) throw new PricingError(400, 'COUPON_INVALID', 'That coupon was just used or has expired. Remove it to continue.');
        }
        if (paymentMethod === 'Wallet' && quote.finalPrice > 0) {
          const amount = Number(quote.finalPrice);
          const [debited] = await User.update(
            { walletBalance: sequelize.literal(`"walletBalance" - ${amount}`) },
            { where: { id: currentUser.id, walletBalance: { [Op.gte]: amount } }, transaction: t }
          );
          if (debited === 0) {
            throw new PricingError(400, 'INSUFFICIENT_WALLET',
              `Not enough Wallet balance — this order needs ₹${amount} and you have ₹${money(currentUser.walletBalance)}. Choose Cash on Delivery or add money to your Wallet.`,
              { needed: amount, walletBalance: money(currentUser.walletBalance) });
          }
        }
        return Order.create({
          userId: currentUser.id,
          restaurantId: quote.store.id,
          items: quote.lines,
          totalPrice: quote.subtotal,
          deliveryFee: quote.deliveryFee,
          batchDiscount: quote.batchDiscount,
          gateDiscount: quote.perkDiscount, // badge / ZenPoints perks
          finalPrice: quote.finalPrice,
          priceBreakdown: {
            subtotal: quote.subtotal,
            deliveryFee: quote.deliveryFee,
            packagingFee: quote.packagingFee,
            taxes: quote.taxes,
            discounts: quote.discounts,
            totalDiscount: quote.totalDiscount,
            finalPrice: quote.finalPrice,
            couponCode: quote.coupon ? quote.coupon.code : null
          },
          distance: distanceKm,
          estDuration: null, // set by the restaurant when it accepts
          deliverySlot: String(deliverySlot || 'ASAP').replace(/[<>]/g, '').slice(0, 80),
          deliveryAddress: address,
          deliveryInstructions: deliveryInstructions.length ? deliveryInstructions : null,
          hostelGateDelivery: false,
          isSurge,
          paymentMethod,
          // Wallet money is taken above inside this transaction; cash is collected at the door.
          paymentStatus: paymentMethod === 'Wallet' ? 'Completed' : 'Pending',
          upiUTR: null,
          upiScreenshot: null,
          upiStatus: null,
          category: (restaurant.vendorType || 'RESTAURANT').toUpperCase() === 'RESTAURANT' ? 'Food' : restaurant.vendorType,
          status: restaurant.isOffline ? 'Accepted' : 'Pending',
          deliveryPin: String(crypto.randomInt(1000, 10000))
        }, { transaction: t });
      });
    } catch (err) {
      if (idemClaimed) recentOrderKeys.delete(idemKey);
      if (err instanceof PricingError) return sendPricingError(res, err);
      throw err;
    }
    if (idemClaimed) recentOrderKeys.set(idemKey, { at: Date.now(), orderId: createdOrder.id });

    try {
      await updateStreak(currentUser.id);
      await User.increment('totalOrders', { by: 1, where: { id: currentUser.id } });
    } catch (statsErr) {
      console.warn('[ORDER_STATS] stats update skipped:', statsErr.message);
    }

    const io = req.app.get('io');
    try {
      const { checkSurgeState } = require('../server');
      if (typeof checkSurgeState === 'function') checkSurgeState(io, restaurant.zone || 'Amaravathi_Central');
    } catch { /* surge check not critical */ }

    try {
      if (io && currentUser.hostelBlock) io.emit('blockOrderPulse', { blockName: currentUser.hostelBlock });
    } catch (e) {
      console.warn('[BLOCK_PULSE_WARN] Socket emit failed:', e.message);
    }

    res.status(201).json({ ...createdOrder.toJSON(), _id: createdOrder.id, bill: quote });

    // ── After the response: notifications & dispatch (never affect the order) ──
    try {
      if (currentUser.phone) {
        const orderForMsg = await Order.findByPk(createdOrder.id, {
          include: [{ model: Restaurant, as: 'restaurant', attributes: ['name'] }]
        });
        await sendWhatsAppMessage(currentUser.phone, formatOrderMessage(orderForMsg, 'CUSTOMER_CONFIRMATION'), 'CONFIRMATION');
      }
    } catch (waErr) {
      console.error('[WHATSAPP_ERROR] Customer alert failed:', waErr.message);
    }

    if (!io) return;
    const riderPayload = {
      id: createdOrder.id,
      restaurant: restaurant.name,
      restaurantAddress: restaurant.location,
      drop: createdOrder.deliveryAddress,
      items: normalizeItems(createdOrder.items),
      totalPrice: createdOrder.totalPrice,
      finalPrice: createdOrder.finalPrice,
      paymentMethod: createdOrder.paymentMethod,
      earnings: `₹${createdOrder.deliveryFee}`,
      distance: createdOrder.distance,
      createdAt: createdOrder.createdAt,
      deliverySlot: createdOrder.deliverySlot
    };
    io.to('admin-room').emit('admin_newOrder', {
      id: createdOrder.id.toString(),
      restaurant: restaurant.name,
      customer: currentUser.name || 'Customer',
      drop: createdOrder.deliveryAddress,
      totalPrice: createdOrder.totalPrice,
      finalPrice: createdOrder.finalPrice,
      paymentMethod: createdOrder.paymentMethod,
      paymentStatus: createdOrder.paymentStatus,
      createdAt: createdOrder.createdAt
    });
    require('../utils/realtime').notifyAdmin('order', 'created', createdOrder.id, { storeId: createdOrder.restaurantId });

    if (restaurant.isOffline || createdOrder.status === 'Accepted') {
      // Shops without a vendor app go straight to riders.
      io.to('admin-room').emit('newOrder', riderPayload);
      try {
        const DeliveryPartner = getDeliveryPartnerModel();
        const onlineRiders = await DeliveryPartner.findAll({ where: { isOnline: true, isApproved: true } });
        const riderTokens = [];
        onlineRiders.slice(0, 20).forEach((rider) => {
          const tokens = Array.isArray(rider.fcmTokens) ? rider.fcmTokens : [];
          tokens.forEach(tk => {
            const tokenStr = typeof tk === 'string' ? tk : tk?.token;
            if (tokenStr) riderTokens.push(tokenStr);
          });
        });
        if (riderTokens.length > 0) {
          await sendPushToTokens(
            riderTokens,
            restaurant.isOffline ? '🛒 New pickup order!' : '🛵 New order ready!',
            restaurant.isOffline ? `Pick up and deliver an order from ${restaurant.name}.` : `New order from ${restaurant.name} is ready for pickup!`,
            { orderId: createdOrder.id.toString(), type: 'NEW_ORDER' },
            { persist: false }
          );
        }
      } catch (dispatchErr) {
        console.error('[DISPATCH_ERROR]', dispatchErr.message);
      }
    } else {
      io.to(`restaurant_${restaurant.id}`).emit('restaurant_newOrder', {
        id: createdOrder.id,
        items: normalizeItems(createdOrder.items),
        totalPrice: createdOrder.totalPrice,
        address: createdOrder.deliveryAddress,
        // Same field names as GET /api/restaurants/:id/orders so the kitchen can render the card at once.
        _id: createdOrder.id,
        status: createdOrder.status,
        createdAt: createdOrder.createdAt,
        finalPrice: createdOrder.finalPrice,
        deliveryFee: createdOrder.deliveryFee,
        paymentMethod: createdOrder.paymentMethod,
        paymentStatus: createdOrder.paymentStatus,
        deliveryAddress: createdOrder.deliveryAddress,
        deliveryInstructions: createdOrder.deliveryInstructions || null,
        estDuration: createdOrder.estDuration || null,
      });
    }
  } catch (error) {
    // Once the order row exists the key must keep pointing at it (a retry returns the same order).
    if (idemClaimed && !(recentOrderKeys.get(idemKey) || {}).orderId) recentOrderKeys.delete(idemKey);
    console.error('[ORDER_CREATE_ERROR]', error && (error.stack || error));
    if (!res.headersSent) {
      res.status(500).json({ message: "We couldn't place your order right now. Nothing was charged — please try again in a moment.", code: 'ORDER_FAILED' });
    }
  }
};

// @desc    Restaurant/Admin accepts order & dispatches to Rider
const restaurantAcceptOrder = async (req, res) => {
  try {
    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    
    // ── IDOR Protection ──────────────────────
    const isAdmin = req.user && req.user.role && req.user.role.toLowerCase() === 'admin';
    const isVendor = req.user && req.user.role && req.user.role.toLowerCase() === 'restaurant';
    const isOwner = order.restaurantId === req.user.id;
    
    if (!isAdmin && !(isVendor && isOwner)) {
      return res.status(403).json({ message: 'Not authorized to accept this order' });
    }

    if (order.status !== 'Pending') return res.status(400).json({ message: 'Order is not pending' });

    const est = parseInt((req.body || {}).estDuration, 10);
    const acceptFields = { status: 'Accepted', acceptedAt: new Date(), ...(Number.isFinite(est) && est > 0 && est <= 240 ? { estDuration: est } : {}) };
    // Conditional flip: a customer cancel (with Wallet refund) or the auto-cancel job may have
    // won the race since we read the order; never resurrect a cancelled order.
    const [accepted] = await Order.update(acceptFields, { where: { id: order.id, status: 'Pending' } });
    if (accepted === 0) return res.status(400).json({ message: 'This order is no longer pending (it may have been cancelled by the customer).' });
    Object.assign(order, acceptFields);

    const statusPayload = { 
      id: order.id, 
      status: 'Accepted' 
    };
    broadcastOrderStatus(req, order, statusPayload);

    // Fetch Restaurant to broadcast details to riders
    const Restaurant = getRestaurantModel();
    let restaurant = await Restaurant.findByPk(order.restaurantId);

    // ── Smart Proximity Dispatch ──────────────────────
    try {
      const { getCoordsForAddress, getHaversineDistance } = require('../utils/distance');
      const DeliveryPartner = getDeliveryPartnerModel();
      const onlineRiders = await DeliveryPartner.findAll({ where: { isOnline: true, isApproved: true } });
      
      const restCoords = getCoordsForAddress(restaurant ? restaurant.location : '');
      const ridersWithDist = onlineRiders.map(rider => {
        const loc = rider.liveLocation || rider.lastLocation || {};
        const riderLat = loc.lat != null ? Number(loc.lat) : NaN;
        const riderLon = loc.lng != null ? Number(loc.lng) : (loc.lon != null ? Number(loc.lon) : NaN);
        // Riders without a known position are ranked last instead of being placed at a made-up spot.
        const dist = Number.isFinite(riderLat) && Number.isFinite(riderLon)
          ? getHaversineDistance(restCoords.lat, restCoords.lon, riderLat, riderLon)
          : Infinity;
        return { rider, dist };
      }).sort((a, b) => a.dist - b.dist);

      // Notify ALL via socket for real-time race
      const io = req.app.get('io');
      if (io) {
        io.to('admin-room').emit('newOrder', {
          id: order.id,
          restaurant: restaurant ? restaurant.name : 'Unknown',
          restaurantAddress: restaurant ? restaurant.location : '',
          drop: order.deliveryAddress,
          items: normalizeItems(order.items),
          totalPrice: order.totalPrice,
          finalPrice: order.finalPrice,
          earnings: `₹${order.deliveryFee || 30}`,
          distance: order.distance
        });
      }

      // Target closest 5 for Push Notifications
      const targetRiders = ridersWithDist.slice(0, 5);
      const riderTokens = [];
      targetRiders.forEach(({ rider }) => {
        if (rider.fcmTokens) {
          const tokens = Array.isArray(rider.fcmTokens) ? rider.fcmTokens : [];
          tokens.forEach(t => {
            const tokenStr = typeof t === 'string' ? t : t?.token;
            if (tokenStr) riderTokens.push(tokenStr);
          });
        }
      });

      if (riderTokens.length > 0) {
        await sendPushToTokens(
          riderTokens, 
          '🛵 New Order Ready!', 
          `${restaurant?.name || 'Restaurant'} is ready for pickup. Closest to you!`, 
          { orderId: order.id, distance: order.distance, type: 'NEW_ORDER' },
          { persist: false }
        );
      }
    } catch (dispatchErr) {
      console.error('[SMART_DISPATCH_ERROR]', dispatchErr.message);
    }

    res.json({ message: 'Order picked up/accepted by restaurant', orderId: order.id });
  } catch (error) {
    console.error('[RESTAURANT_ACCEPT_ERROR]', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// @desc    Get order by ID
// Rider-facing order payloads never carry the customer's delivery PIN.
const withoutPin = (order) => {
  const json = order && typeof order.toJSON === 'function' ? order.toJSON() : { ...order };
  delete json.deliveryPin;
  delete json.deliveryPinAttempts;
  return json;
};

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    // Safe check for UUID format to prevent PostgreSQL 500 errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    

    if (!uuidRegex.test(id)) {
       return res.status(404).json({ message: 'Invalid Order ID format' });
    }

    const Order = getOrderModel();
    const Restaurant = getRestaurantModel();
    const DeliveryPartner = getDeliveryPartnerModel();

    const order = await Order.findByPk(id, {
      include: [
        { model: Restaurant, as: 'restaurant', attributes: ['name', 'location', 'imageUrl'] },
        { 
          model: DeliveryPartner, 
          as: 'deliveryPartner', 
          attributes: ['id', 'name', 'phone', 'photoUrl', 'averageRating', 'totalRatings', 'vehicleType', 'vehicleNumber', 'bio', 'isApproved'] 
        }
      ]
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // ── IDOR Protection (Access Control Guard) ──────────────────────
    // Ensure the requester is either the owner of the order, an Admin, or the assigned Rider
    const isOwner = order.userId === req.user.id;
    const isAdmin = req.user.role && req.user.role.toLowerCase() === 'admin';
    const isAssignedRider = req.user.role && req.user.role.toLowerCase() === 'rider' && order.deliveryPartnerId === req.user.id;
    
    if (!isOwner && !isAdmin && !isAssignedRider) {
      console.warn(`[SECURITY_WARN] User ${req.user.id} attempted to access Order ${id} without permission.`);
      return res.status(403).json({ message: 'Access denied: You do not have permission to view this order.' });
    }

    const orderData = order.toJSON();
    delete orderData.deliveryPinAttempts;
    // The delivery PIN is the customer's secret: the rider asks for it at the door.
    if (!isOwner && !isAdmin) delete orderData.deliveryPin;
    // Map associations for legacy frontend compatibility (+ _id)
    if (orderData.deliveryPartner) {
        orderData.deliveryPartner._id = orderData.deliveryPartner.id;
        // Real track record only: no rating until someone has rated this rider.
        if (!(Number(orderData.deliveryPartner.totalRatings) > 0)) orderData.deliveryPartner.averageRating = null;
        orderData.deliveryPartner.completedDeliveries = await Order.count({
          where: { deliveryPartnerId: order.deliveryPartnerId, status: 'Delivered' }
        });
    }

    
    // ── Rider Batching Transparency ──────────────────────
    if (order.deliveryPartnerId) {
      const otherOrders = await Order.count({
        where: {
          deliveryPartnerId: order.deliveryPartnerId,
          status: ['Accepted', 'PickedUp', 'Preparing'],
          id: { [Op.ne]: order.id }
        }
      });
      orderData.riderOtherOrders = otherOrders;
    }

    res.json({ ...orderData, _id: order.id });
  } catch (error) {
    console.error('[GET_ORDER_ERROR]', error);
    res.status(500).json({ message: 'We could not load this order right now. Please try again.' });
  }
};

// @desc    Get logged in user orders
const getMyOrders = async (req, res) => {
  try {
    const Order = getOrderModel();
    const Restaurant = getRestaurantModel();
    const orders = await Order.findAll({
      where: { userId: req.user.id },
      include: [{ model: Restaurant, as: 'restaurant', attributes: ['id', 'name', 'imageUrl', 'vendorType'] }],
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json(orders.map(o => {
      const json = o.toJSON();
      return {
        ...json,
        _id: o.id,
        restaurantName: json.restaurant ? json.restaurant.name : null,
        restaurantImage: json.restaurant ? json.restaurant.imageUrl : null
      };
    }));
  } catch (error) {
    console.error('[MY_ORDERS_ERROR]', error);
    res.status(500).json({ message: 'We could not load your orders right now. Please pull to refresh.' });
  }
};

const MAX_TIP = 500;

// @desc    Rate an order (once), optionally tip the rider from the Wallet
// @route   PUT /api/orders/:id/rate
const rateOrder = async (req, res) => {
  const { rating: rawRating, review: rawReview, tipAmount } = req.body || {};
  try {
    const rating = Number(rawRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Please pick a rating from 1 to 5 stars.', code: 'INVALID_RATING' });
    }
    const tip = tipAmount === undefined || tipAmount === null || tipAmount === '' ? 0 : Number(tipAmount);
    if (!Number.isFinite(tip) || tip < 0 || tip > MAX_TIP) {
      return res.status(400).json({ message: `Tips can be from ₹0 to ₹${MAX_TIP}.`, code: 'INVALID_TIP' });
    }
    const review = typeof rawReview === 'string' && rawReview.trim() ? rawReview.trim().replace(/[<>]/g, '').slice(0, 1000) : null;

    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.userId !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    if (order.status !== 'Delivered') return res.status(400).json({ message: 'You can rate an order once it has been delivered.', code: 'NOT_DELIVERED' });

    // Rate exactly once: only the request that flips rating from NULL wins (no points farming).
    const [rated] = await Order.update(
      { rating, review },
      { where: { id: order.id, userId: req.user.id, status: 'Delivered', rating: null } }
    );
    if (rated === 0) {
      return res.status(409).json({ message: 'You have already rated this order. Thank you!', code: 'ALREADY_RATED' });
    }

    const User = getUserModel();
    const user = await User.findByPk(req.user.id);

    // ── Reviews for the ordered items (real text only; nothing invented) ──
    try {
      const { getProductReviewModel } = require('../models/ProductReview');
      const ProductReview = getProductReviewModel();
      const MenuItem = getMenuItemModel();
      const firstName = user && user.name ? String(user.name).trim().split(/\s+/)[0] : 'Zenvy customer';
      const seen = new Set();
      for (const item of normalizeItems(order.items)) {
        const pId = item.menuItemId || item.id || item._id;
        if (!pId || seen.has(String(pId)) || item.isAddOn) continue;
        seen.add(String(pId));
        await ProductReview.create({
          productId: String(pId),
          productName: item.name || null,
          orderId: String(order.id),
          userId: String(req.user.id),
          userName: firstName,
          userBlock: null,
          rating,
          comment: review,
          verified: true, // tied to this delivered order
          helpfulCount: 0
        });
        // Item rating = average of its real reviews.
        if (MenuItem && /^[0-9a-f-]{36}$/i.test(String(pId))) {
          const menuItem = await MenuItem.findByPk(String(pId));
          if (menuItem) {
            const [agg] = await ProductReview.findAll({
              where: { productId: String(pId) },
              attributes: [
                [ProductReview.sequelize.fn('AVG', ProductReview.sequelize.col('rating')), 'avg'],
                [ProductReview.sequelize.fn('COUNT', ProductReview.sequelize.col('id')), 'count']
              ],
              raw: true
            });
            const count = Number(agg && agg.count) || 0;
            const avg = count ? parseFloat(Number(agg.avg).toFixed(1)) : null;
            menuItem.specs = { ...(menuItem.specs || {}), rating: avg, ratingCount: count };
            await menuItem.save();
          }
        }
      }
    } catch (revPropErr) {
      console.warn('[REVIEW_PROPAGATION_WARN]', revPropErr.message);
    }

    // ── +10 ZenPoints for rating (once per order, guaranteed by the update above) ──
    try {
      await User.increment('zenPoints', { by: 10, where: { id: req.user.id } });
    } catch (zpErr) {
      console.warn('[RATING_ZP] ZenPoints award skipped:', zpErr.message);
    }

    // ── Rider rating + optional tip ──
    let tipApplied = false;
    let tipError = null;
    if (order.deliveryPartnerId) {
      const DeliveryPartner = getDeliveryPartnerModel();
      const partner = await DeliveryPartner.findByPk(order.deliveryPartnerId);
      if (partner) {
        const prevCount = partner.totalRatings || 0;
        const prevAvg = prevCount > 0 ? (partner.averageRating || 0) : 0;
        partner.totalRatings = prevCount + 1;
        partner.averageRating = parseFloat(((prevAvg * prevCount + rating) / (prevCount + 1)).toFixed(1));
        await partner.save();

        if (tip > 0) {
          try {
            const { getSequelize } = require('../config/db');
            const sequelize = getSequelize();
            await sequelize.transaction(async (t) => {
              const [debited] = await User.update(
                { walletBalance: sequelize.literal(`"walletBalance" - ${Number(tip)}`) },
                { where: { id: req.user.id, walletBalance: { [Op.gte]: tip } }, transaction: t }
              );
              if (debited === 0) {
                const err = new Error(`Not enough Wallet balance for a ₹${tip} tip.`);
                err.userFacing = true;
                throw err;
              }
              await DeliveryPartner.increment('walletBalance', { by: tip, where: { id: partner.id }, transaction: t });
            });
            tipApplied = true;
            const io = req.app.get('io');
            if (io) {
              io.to(`rider_${partner.id}`).emit('rider_tip_received', {
                amount: tip,
                from: user && user.name ? String(user.name).split(' ')[0] : 'A customer',
                orderId: order.id
              });
            }
          } catch (tipErr) {
            tipError = tipErr.userFacing ? tipErr.message : 'Your tip could not be sent. You were not charged.';
            console.warn('[TIP_ERROR]', tipErr.message);
          }
        }
      }
    } else if (tip > 0) {
      tipError = 'No rider was assigned to this order, so no tip was sent.';
    }

    res.json({
      message: tipApplied ? `Thanks for rating! Your ₹${tip} tip is on its way to your rider.` : 'Thanks for rating!',
      rating,
      zenPointsEarned: 10,
      tipApplied,
      tipAmount: tipApplied ? tip : 0,
      tipError
    });
  } catch (error) {
    console.error('[RATE_ORDER_ERROR]', error);
    res.status(500).json({ message: 'We could not save your rating. Please try again.' });
  }
};

// @desc    Get all orders (Admin)
const getAllOrders = async (req, res) => {
  try {
    const Order = getOrderModel();
    const User = getUserModel();
    const Restaurant = getRestaurantModel();
    const { page = 1, limit = 50, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status && status !== 'All') where.status = status;

    const { count, rows: orders } = await Order.findAndCountAll({ 
      where,
      attributes: { exclude: ['deliveryPin'] }, // the customer's handover PIN is never shown to admins
      order: [['createdAt', 'DESC']], 
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: User, as: 'user', attributes: ['name', 'phone'] },
        { model: Restaurant, as: 'restaurant', attributes: ['name'] }
      ]
    });

    res.json({
      orders: orders.map(o => {
        const oJson = o.toJSON();
        return { 
          ...oJson, 
          _id: o.id, 
          userId: oJson.userId || oJson.user?.id || oJson.user,
          user: oJson.user
        };
      }),
      total: count,
      pages: Math.ceil(count / limit)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Cancel an order
// @route   PUT /api/orders/:id/cancel
// Cancels an order and refunds it exactly once (Wallet amount back, coupon restored).
// `onlyFromStatuses` limits the cancel to orders still in one of those statuses (used by the auto-cancel job).
// Returns { cancelled, refunded }.
const cancelAndRefund = async (order, { reason = null, onlyFromStatuses = null } = {}) => {
  const Order = getOrderModel();
  const { getSequelize } = require('../config/db');
  const sequelize = getSequelize();
  let refunded = 0;

  // Status flip + refund in one transaction. The conditional update means two parallel
  // cancels can never both pass, so the Wallet is refunded exactly once.
  const cancelled = await sequelize.transaction(async (t) => {
    const statusWhere = Array.isArray(onlyFromStatuses)
      ? { [Op.in]: onlyFromStatuses }
      : { [Op.notIn]: ['Cancelled', 'Delivered'] };
    const [n] = await Order.update(
      { status: 'Cancelled', ...(reason ? { cancellationReason: reason } : {}) },
      { where: { id: order.id, status: statusWhere }, transaction: t }
    );
    if (n === 0) return false;
    if (order.paymentMethod === 'Wallet') {
      const amount = money(order.finalPrice != null ? order.finalPrice : order.totalPrice);
      if (amount > 0) {
        const User = getUserModel();
        await User.increment('walletBalance', { by: amount, where: { id: order.userId }, transaction: t });
        refunded = amount;
      }
    }
    // Give back a coupon that was used on this order (if it has not expired).
    let breakdown = order.priceBreakdown;
    if (typeof breakdown === 'string') { try { breakdown = JSON.parse(breakdown); } catch { breakdown = null; } }
    if (breakdown && breakdown.couponCode) {
      const { getCouponModel } = require('../models/Coupon');
      await getCouponModel().update(
        { isUsed: false },
        { where: { code: breakdown.couponCode, userId: order.userId, isUsed: true, [Op.or]: [{ expiryDate: null }, { expiryDate: { [Op.gt]: new Date() } }] }, transaction: t }
      );
    }
    return true;
  });
  if (cancelled && refunded > 0) console.log(`[REFUND] ₹${refunded} refunded to wallet for user ${order.userId} (order ${order.id})`);
  return { cancelled, refunded };
};

// Orders the store never accepted are cancelled automatically, so a customer is never left waiting
// (orders-n12). Runs from server.js every 2 minutes. Only 'Pending' orders with no rider are touched.
const PENDING_TIMEOUT_MINUTES = Math.max(5, parseInt(process.env.PENDING_ORDER_TIMEOUT_MINUTES, 10) || 15);
const autoCancelStalePendingOrders = async (io) => {
  const Order = getOrderModel();
  const cutoff = new Date(Date.now() - PENDING_TIMEOUT_MINUTES * 60 * 1000);
  const stale = await Order.findAll({
    where: { status: 'Pending', deliveryPartnerId: null, createdAt: { [Op.lt]: cutoff } },
    order: [['createdAt', 'ASC']],
    limit: 50,
  });
  let count = 0;
  for (const order of stale) {
    try {
      const { cancelled, refunded } = await cancelAndRefund(order, {
        reason: 'The store did not accept the order in time',
        onlyFromStatuses: ['Pending'],
      });
      if (!cancelled) continue;
      count++;
      const payload = { id: order.id, status: 'Cancelled', reason: 'STORE_TIMEOUT', refundedToWallet: refunded };
      if (io) {
        io.to(String(order.id)).emit('statusUpdated', payload);
        io.to('admin-room').emit('statusUpdated', payload);
        if (order.restaurantId) io.to(`restaurant_${order.restaurantId}`).emit('statusUpdated', payload);
        io.to(String(order.id)).emit('orderCancelled', { orderId: order.id, reason: 'STORE_TIMEOUT' });
        io.to('admin-room').emit('orderCancelled', { orderId: order.id, reason: 'STORE_TIMEOUT' });
      }
      try {
        const customer = await getUserModel().findByPk(order.userId, { attributes: ['id', 'fcmTokens'] });
        if (customer) {
          await sendPushToTokens(
            customer.fcmTokens,
            'Order cancelled',
            refunded > 0
              ? `The store did not accept your order in time. ₹${refunded} is back in your Wallet.`
              : 'The store did not accept your order in time. You have not been charged.',
            { orderId: order.id, type: 'ORDER_UPDATE' },
            { recipients: [customer.id] }
          );
        }
      } catch (pushErr) {
        console.warn('[AUTO_CANCEL_PUSH_WARN]', pushErr.message);
      }
    } catch (e) {
      console.error('[AUTO_CANCEL_ERROR]', order.id, e.message);
    }
  }
  if (count) console.log(`[AUTO_CANCEL] Cancelled ${count} order(s) not accepted within ${PENDING_TIMEOUT_MINUTES} min`);
  return count;
};

const cancelOrder = async (req, res) => {
  try {
    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const isOwner = order.userId === req.user.id;
    const isAdmin = isAdminUser(req.user);
    if (!isOwner && !isAdmin) {
      console.warn(`[SECURITY_WARN] User ${req.user.id} attempted to cancel Order ${order.id} owned by ${order.userId}`);
      return res.status(403).json({ message: 'Not authorized to cancel this order' });
    }
    if (order.status === 'Cancelled') {
      return res.status(400).json({ message: 'This order is already cancelled.', code: 'ALREADY_CANCELLED' });
    }
    if (order.status === 'Delivered') {
      return res.status(400).json({ message: 'This order has already been delivered. Need help? Contact support from the order page.', code: 'ALREADY_DELIVERED' });
    }
    // Customers can cancel while the order is Pending, or within 2 minutes of placing it.
    if (isOwner && !isAdmin && order.status !== 'Pending') {
      const elapsed = (Date.now() - new Date(order.createdAt).getTime()) / 1000;
      if (elapsed > 120) {
        return res.status(400).json({ message: 'The store has already started on this order, so it can no longer be cancelled. Need help? Contact support from the order page.', code: 'CANCEL_WINDOW_CLOSED' });
      }
    }

    const reason = typeof (req.body || {}).reason === 'string' ? req.body.reason.replace(/[<>]/g, '').slice(0, 250) : null;
    const { cancelled, refunded } = await cancelAndRefund(order, { reason });

    if (!cancelled) {
      return res.status(400).json({ message: 'This order is already cancelled.', code: 'ALREADY_CANCELLED' });
    }
    const statusPayload = { id: order.id, status: 'Cancelled' };
    broadcastOrderStatus(req, order, statusPayload);
    const io = req.app.get('io');
    if (io) {
      io.to(String(order.id)).emit('orderCancelled', { orderId: order.id });
      io.to('admin-room').emit('orderCancelled', { orderId: order.id });
      // The assigned rider must stop (they may not be in the order room right now).
      if (order.deliveryPartnerId) io.to(`rider_${order.deliveryPartnerId}`).emit('orderCancelled', { orderId: order.id });
    }
    if (order.deliveryPartnerId) {
      try {
        await getDeliveryPartnerModel().update({ currentOrderId: null }, { where: { id: order.deliveryPartnerId, currentOrderId: order.id } });
      } catch (riderErr) { console.warn('[CANCEL_RIDER_RELEASE_WARN]', riderErr.message); }
    }

    res.json({
      message: refunded > 0 ? `Order cancelled. ₹${refunded} is back in your Wallet.` : 'Order cancelled.',
      orderId: order.id,
      refundedToWallet: refunded
    });
  } catch (error) {
    console.error('[CANCEL_ORDER_ERROR]', error);
    res.status(500).json({ message: 'We could not cancel the order right now. Please try again.' });
  }
};

// @desc    Update order status (Admin)
// @route   PUT /api/orders/:id/status
const updateOrderStatus = async (req, res) => {
  try {
    let { status } = req.body;
    if (status === 'Ready for Pickup') status = 'ReadyForPickup';
    const allowedStatuses = ['Pending', 'Accepted', 'Preparing', 'ReadyForPickup', 'Picking', 'PickedUp', 'ArrivedAtGate', 'Delivered', 'Cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
    }

    // Cancelling goes through the same path as a customer cancel (exactly-once Wallet refund).
    if (status === 'Cancelled') return cancelOrder(req, res);

    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.status === 'Cancelled') {
      return res.status(400).json({ message: 'This order was cancelled (and refunded if paid by Wallet). It cannot be reopened — ask the customer to order again.' });
    }

    let justDelivered = false;
    if (status === 'Delivered') {
      // Only the request that actually flips the order to Delivered awards points (no double credit).
      const [n] = await Order.update(
        { status: 'Delivered', deliveredAt: new Date(), ...(order.paymentMethod === 'COD' ? { paymentStatus: 'Completed' } : {}) },
        { where: { id: order.id, status: { [Op.notIn]: ['Delivered', 'Cancelled'] } } }
      );
      justDelivered = n === 1;
      if (!justDelivered) {
        // Lost the race: either already delivered (no second push / credit) or cancelled meanwhile.
        const fresh = await Order.findByPk(order.id, { attributes: ['id', 'status'] });
        if (fresh && fresh.status === 'Cancelled') {
          return res.status(400).json({ message: 'This order was cancelled and cannot be marked delivered.' });
        }
        return res.json({ message: 'Order is already delivered', orderId: order.id, status: 'Delivered' });
      }
    }

    if (justDelivered) {
      // Atomic increments (a stale read-modify-save here used to overwrite concurrent spin/redeem points).
      const { creditCustomerForDelivery } = require('../services/BadgeService');
      try {
        const { newBadges } = await creditCustomerForDelivery(getUserModel(), order);
        order.newBadges = newBadges;
      } catch (creditErr) {
        console.error('[DELIVERY_CREDIT_ERROR]', order.id, creditErr.message);
      }
    }

    if (status !== 'Delivered') {
      // Conditional write: never overwrite a cancel (and its refund) that landed after we read the order.
      const [n] = await Order.update({ status }, { where: { id: order.id, status: { [Op.notIn]: ['Cancelled'] } } });
      if (n === 0) return res.status(400).json({ message: 'This order was cancelled and cannot be updated.' });
      order.status = status;
    } else {
      order.status = 'Delivered';
    }

    const statusPayload = { 
      id: order.id, 
      status,
      newBadges: status === 'Delivered' ? (order.newBadges || []) : []
    };
    broadcastOrderStatus(req, order, statusPayload);
    if (status === 'Delivered') {
      const io = req.app.get('io');
      if (io) io.to('admin-room').emit('admin_delivery_complete', { orderId: order.id });
    }

    // 🟢 Push Notification: Status Update to Customer
    try {
      const User = getUserModel();
      const customer = await User.findByPk(order.userId);
      if (customer) {
        const titles = {
          'Accepted': 'Order Confirmed! 👍',
          'Preparing': 'Kitchen is cooking! 🍳',
          'ReadyForPickup': 'Order ready! 📦',
          'PickedUp': 'Out for Delivery! 🛵',
          'Delivered': 'Enjoy your meal! 🎉',
          'Cancelled': 'Order Cancelled 🛑'
        };
        const bodies = {
          'Accepted': 'Your order was accepted by the merchant.',
          'Preparing': 'Your order has been sent to the kitchen.',
          'ReadyForPickup': 'The merchant prepared your order and is waiting for a rider.',
          'PickedUp': 'Rider has picked up your order and is heading your way.',
          'Delivered': 'Your order has been delivered successfully.',
          'Cancelled': 'Your order was cancelled by the store/system.'
        };
        if (titles[status]) {
          await sendPushToTokens(
            customer.fcmTokens,
            titles[status],
            bodies[status],
            { orderId: order.id, type: 'ORDER_UPDATE' },
            { recipients: [customer.id] }
          );
        }
      }
    } catch (pushStatusErr) {
      console.error('[PUSH_ERROR] Status update notification failed:', pushStatusErr.message);
    }

    // 🟢 WhatsApp Integration: Status Update to Customer
    try {
      const User = getUserModel();
      const user = await User.findByPk(order.userId);
      if (user && user.phone) {
        const orderWithRest = await Order.findByPk(order.id, { 
          include: [{ model: getRestaurantModel(), as: 'restaurant', attributes: ['name'] }] 
        });
        const msg = formatOrderMessage(orderWithRest, 'STATUS_UPDATE');
        await sendWhatsAppMessage(user.phone, msg, 'STATUS_UPDATE');
      }
    } catch (waStatusErr) {
      console.error('[WHATSAPP_ERROR] Status update alert failed:', waStatusErr.message);
    }

    res.json({ message: 'Order status updated', orderId: order.id, status });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getSurgeStatus = async (req, res) => {
  try {
    const { isSurgeActive, SURGE_MULTIPLIER } = require('../server');
    const zone = typeof req.query.zone === 'string' && req.query.zone ? req.query.zone : 'Amaravathi_Central';
    res.json({ isSurge: typeof isSurgeActive === 'function' ? !!isSurgeActive(zone) : false, zone, multiplier: SURGE_MULTIPLIER });
  } catch {
    res.json({ isSurge: false });
  }
};
    // @desc    Get spending stats for logged-in user (F12 - Spending Dashboard)
// @route   GET /api/orders/stats
const getOrderStats = async (req, res) => {
  try {
    const Order = getOrderModel();
    const User = getUserModel();
    const Restaurant = getRestaurantModel();
    const { Op } = require('sequelize');

    const orders = await Order.findAll({
      where: { 
        userId: req.user.id,
        status: { [Op.notIn]: ['Cancelled', 'cancelled', 'Rejected', 'rejected'] }
      },
      order: [['createdAt', 'DESC']],
      limit: 200
    });

    const user = await User.findByPk(req.user.id, {
      attributes: ['streakCount', 'completedOrders', 'totalOrders', 'zenPoints']
    });

    // Monthly spend (last 6 months)
    const monthlyMap = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      monthlyMap[key] = 0;
    }
    orders.forEach(o => {
      const d = new Date(o.createdAt);
      const key = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      if (monthlyMap[key] !== undefined) {
        monthlyMap[key] += (o.finalPrice || o.totalPrice || 0);
      }
    });
    const monthlySpend = Object.entries(monthlyMap).map(([month, total]) => ({ month, total: Math.round(total) }));

    // Top items
    const itemMap = {};
    orders.forEach(o => {
      let itemsList = o.items;
      if (typeof itemsList === 'string') {
        try {
          itemsList = JSON.parse(itemsList);
        } catch {
          itemsList = [];
        }
      }
      const items = Array.isArray(itemsList) ? itemsList : [];
      items.forEach(item => {
        const name = item.name || 'Unknown';
        if (!itemMap[name]) itemMap[name] = { name, count: 0, spend: 0 };
        itemMap[name].count += (item.quantity || 1);
        itemMap[name].spend += (item.priceAtOrder || item.price || 0) * (item.quantity || 1);
      });
    });
    const topItems = Object.values(itemMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(i => ({ ...i, spend: Math.round(i.spend) }));

    const totalSpend = orders.reduce((s, o) => s + (o.finalPrice || o.totalPrice || 0), 0);
    const avgOrderValue = orders.length > 0 ? Math.round(totalSpend / orders.length) : 0;

    // Favourite restaurant by order count
    const restMap = {};
    orders.forEach(o => {
      if (o.restaurantId) {
        restMap[o.restaurantId] = (restMap[o.restaurantId] || 0) + 1;
      }
    });

    const topRestId = Object.entries(restMap).sort((a, b) => b[1] - a[1])[0]?.[0];
    let favoriteRestaurant = '';
    if (topRestId && Restaurant) {
      const rest = await Restaurant.findByPk(topRestId, { attributes: ['id', 'name'] });
      if (rest) favoriteRestaurant = rest.name;
    }

    const calculatedStreak = user?.streakCount || (orders.length > 0 ? 1 : 0);

    res.json({
      monthlySpend,
      topItems,
      avgOrderValue,
      totalOrders: orders.length || user?.completedOrders || user?.totalOrders || 0,
      favoriteRestaurant: favoriteRestaurant || 'N/A',
      currentStreak: calculatedStreak,
      zenPoints: user?.zenPoints || 0
    });
  } catch (error) {
    console.error('[ORDER_STATS_ERROR]', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// @desc    LEGACY ONLY: resolve UPI orders placed before online payments were switched off.
//          New orders can only be COD or Wallet (createOrder rejects UPI), so nothing new reaches this.
const verifyUPIPayment = async (req, res) => {
  const { isVerified } = req.body; // boolean
  try {
    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.paymentMethod !== 'UPI') return res.status(400).json({ message: 'Not a UPI order' });
    if (order.upiStatus !== 'Pending') return res.status(400).json({ message: `This UPI payment is already ${String(order.upiStatus || 'resolved').toLowerCase()}.` });

    if (isVerified) {
      order.upiStatus = 'Verified';
      order.paymentStatus = 'Completed';
      // Auto-accept if it was pending
      if (order.status === 'Pending') {
        order.status = 'Accepted';
      }
    } else {
      order.upiStatus = 'Rejected';
      order.status = 'Cancelled';
    }
    
    await order.save();
    
    const statusPayload = { id: order.id, status: order.status };
    broadcastOrderStatus(req, order, statusPayload);

    res.json({ message: `Payment ${isVerified ? 'Verified' : 'Rejected'}`, orderId: order.id, status: order.status });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Restaurant marks food as ready for pickup
const restaurantReadyOrder = async (req, res) => {
  try {
    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    
    // ── IDOR Protection ──────────────────────
    const isAdmin = req.user && req.user.role && req.user.role.toLowerCase() === 'admin';
    const isVendor = req.user && req.user.role && req.user.role.toLowerCase() === 'restaurant';
    const isOwner = order.restaurantId === req.user.id;
    
    if (!isAdmin && !(isVendor && isOwner)) {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }

    // B7: a rider may already be at the counter ('Picking') while the kitchen is still cooking.
    // Record the ready time and ping the rider, but keep the rider's step.
    if (order.status === 'Picking') {
      if (!order.readyAt) await Order.update({ readyAt: new Date() }, { where: { id: order.id, status: 'Picking' } });
      const pio = req.app.get('io');
      if (pio && order.deliveryPartnerId) pio.to(`rider_${order.deliveryPartnerId}`).emit('orderReady', { orderId: order.id });
      return res.json({ message: 'Rider notified that the food is packed', orderId: order.id, status: 'Picking' });
    }

    if (order.status !== 'Accepted' && order.status !== 'Preparing') {
       return res.status(400).json({ message: 'Order must be Accepted or Preparing to mark as Ready' });
    }

    // Conditional flip so a concurrent customer cancel is never overwritten.
    const [ready] = await Order.update({ status: 'ReadyForPickup', readyAt: new Date() }, { where: { id: order.id, status: { [Op.in]: ['Accepted', 'Preparing'] } } });
    if (ready === 0) return res.status(400).json({ message: 'This order was just cancelled or updated. Please refresh.' });
    order.status = 'ReadyForPickup';

    const statusPayload = { id: order.id, status: 'ReadyForPickup' };
    broadcastOrderStatus(req, order, statusPayload);

    const io = req.app.get('io');

    // Also notify the delivery partner if assigned
    if (io && order.deliveryPartnerId) {
      io.to(`rider_${order.deliveryPartnerId}`).emit('orderReady', { orderId: order.id });
    }

    res.json({ message: 'Order marked as Ready for Pickup', orderId: order.id });
  } catch (error) {
    console.error('[RESTAURANT_READY_ERROR]', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Status changes sent by the restaurant partner app to PUT /api/orders/:id/status.
//          Admins keep the full updateOrderStatus; a restaurant may only move ITS OWN orders
//          through the kitchen steps (accept → preparing → ready) or decline a new order.
const restaurantUpdateOrderStatus = async (req, res) => {
  let status = String((req.body || {}).status || '');
  if (status === 'Ready for Pickup' || status === 'Ready') status = 'ReadyForPickup';
  if (status === 'Rejected' || status === 'Declined') status = 'Cancelled';
  if (status === 'Accepted') return restaurantAcceptOrder(req, res);
  if (status === 'ReadyForPickup') return restaurantReadyOrder(req, res);
  try {
    if (!['Preparing', 'Cancelled'].includes(status)) {
      return res.status(400).json({ message: 'A store can accept, start preparing, mark ready or decline an order.' });
    }
    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.restaurantId !== req.user.id) return res.status(403).json({ message: 'Not authorized to update this order' });

    if (status === 'Preparing') {
      const [n] = await Order.update({ status: 'Preparing' }, { where: { id: order.id, status: { [Op.in]: ['Pending', 'Accepted'] } } });
      if (n === 0) return res.status(400).json({ message: 'This order was just cancelled or updated. Please refresh.' });
      order.status = 'Preparing';
      broadcastOrderStatus(req, order, { id: order.id, status: 'Preparing' });
      try {
        const customer = await getUserModel().findByPk(order.userId, { attributes: ['id', 'fcmTokens'] });
        if (customer) {
          await sendPushToTokens(customer.fcmTokens, 'Kitchen is cooking! 🍳', 'Your order is being prepared.', { orderId: order.id, type: 'ORDER_UPDATE' }, { recipients: [customer.id] });
        }
      } catch (pushErr) { console.warn('[REST_STATUS_PUSH_WARN]', pushErr.message); }
      return res.json({ message: 'Order marked as Preparing', orderId: order.id, status: 'Preparing' });
    }

    // Decline: only before a rider has picked it up; refunds the Wallet exactly once.
    const reason = typeof (req.body || {}).reason === 'string' && req.body.reason.trim()
      ? req.body.reason.replace(/[<>]/g, '').trim().slice(0, 250)
      : 'The store could not take this order';
    const { cancelled, refunded } = await cancelAndRefund(order, { reason, onlyFromStatuses: ['Pending', 'Accepted', 'Preparing'] });
    if (!cancelled) return res.status(400).json({ message: 'This order can no longer be declined (it is already cancelled or out for delivery).' });
    const payload = { id: order.id, status: 'Cancelled', reason: 'STORE_DECLINED', refundedToWallet: refunded };
    broadcastOrderStatus(req, order, payload);
    const io = req.app.get('io');
    if (io) {
      io.to(String(order.id)).emit('orderCancelled', { orderId: order.id, reason: 'STORE_DECLINED' });
      io.to('admin-room').emit('orderCancelled', { orderId: order.id, reason: 'STORE_DECLINED' });
      if (order.deliveryPartnerId) io.to(`rider_${order.deliveryPartnerId}`).emit('orderCancelled', { orderId: order.id, reason: 'STORE_DECLINED' });
    }
    if (order.deliveryPartnerId) {
      try { await getDeliveryPartnerModel().update({ currentOrderId: null }, { where: { id: order.deliveryPartnerId, currentOrderId: order.id } }); } catch { /* best effort */ }
    }
    try {
      const customer = await getUserModel().findByPk(order.userId, { attributes: ['id', 'fcmTokens'] });
      if (customer) {
        await sendPushToTokens(customer.fcmTokens, 'Order cancelled',
          refunded > 0 ? `The store could not take your order. ₹${refunded} is back in your Wallet.` : 'The store could not take your order. You have not been charged.',
          { orderId: order.id, type: 'ORDER_UPDATE' }, { recipients: [customer.id] });
      }
    } catch (pushErr) { console.warn('[REST_DECLINE_PUSH_WARN]', pushErr.message); }
    return res.json({ message: 'Order declined', orderId: order.id, status: 'Cancelled', refundedToWallet: refunded });
  } catch (error) {
    console.error('[REST_STATUS_ERROR]', error);
    res.status(500).json({ message: 'Could not update the order right now. Please try again.' });
  }
};

// ── Kirana pre-purchase / bill approval on an Order ────────────────
// Upload endpoints: the assigned rider (or admin). Approve endpoints: the customer who owns it.
const loadOrderFor = async (req, res, who) => {
  const Order = getOrderModel();
  const order = await Order.findByPk(req.params.id);
  if (!order) { res.status(404).json({ message: 'Order not found' }); return null; }
  const isAdmin = isAdminUser(req.user);
  const allowed = who === 'rider'
    ? (isAdmin || (order.deliveryPartnerId && order.deliveryPartnerId === req.user.id))
    : (isAdmin || order.userId === req.user.id);
  if (!allowed) { res.status(403).json({ message: 'Not authorized for this order' }); return null; }
  if (['Cancelled', 'Delivered'].includes(order.status)) {
    res.status(400).json({ message: `This order is already ${order.status.toLowerCase()}.` });
    return null;
  }
  return order;
};

// @desc    Rider uploads pre-purchase item photo / estimate for Mega Basket
const uploadItemPhoto = async (req, res) => {
  try {
    const { itemPhotoUrl } = req.body || {};
    if (!itemPhotoUrl || typeof itemPhotoUrl !== 'string') return res.status(400).json({ message: 'Please attach the item photo.' });
    const order = await loadOrderFor(req, res, 'rider');
    if (!order) return;
    order.itemPhotoUrl = itemPhotoUrl;
    await order.save(); // status is unchanged ('Shopping' is not an order status)

    broadcastOrderStatus(req, order, {
      id: order.id,
      status: order.status,
      itemPhotoUrl,
      isPurchasingApprovedByCustomer: order.isPurchasingApprovedByCustomer
    });
    res.json({ message: 'Item photo uploaded successfully', order: withoutPin(order) });
  } catch (error) {
    console.error('[UPLOAD_ITEM_PHOTO_ERROR]', error);
    res.status(500).json({ message: 'Could not upload the photo. Please try again.' });
  }
};

// @desc    Customer approves pre-purchase photo & estimate to proceed with purchasing
const approvePurchase = async (req, res) => {
  try {
    const order = await loadOrderFor(req, res, 'customer');
    if (!order) return;
    order.isPurchasingApprovedByCustomer = true;
    await order.save();
    broadcastOrderStatus(req, order, { id: order.id, status: order.status, isPurchasingApprovedByCustomer: true });
    res.json({ message: 'Purchase approved', order });
  } catch (error) {
    console.error('[APPROVE_PURCHASE_ERROR]', error);
    res.status(500).json({ message: 'Could not approve right now. Please try again.' });
  }
};

// @desc    Rider uploads final store bill receipt & bill amount
const uploadBillProof = async (req, res) => {
  try {
    const { billProofUrl } = req.body || {};
    const billAmount = Number((req.body || {}).billAmount);
    if (!billProofUrl || typeof billProofUrl !== 'string') return res.status(400).json({ message: 'Please attach a photo of the bill.' });
    if (!Number.isFinite(billAmount) || billAmount <= 0 || billAmount > 100000) return res.status(400).json({ message: 'Please enter the bill amount.' });
    const order = await loadOrderFor(req, res, 'rider');
    if (!order) return;
    if (order.isBillApproved) return res.status(400).json({ message: 'The customer has already approved this bill.' });
    order.billProofUrl = billProofUrl;
    order.billAmount = money(billAmount);
    await order.save();

    broadcastOrderStatus(req, order, {
      id: order.id,
      status: order.status,
      billProofUrl,
      billAmount: order.billAmount,
      isBillApproved: order.isBillApproved
    });
    res.json({ message: 'Bill proof uploaded successfully', order: withoutPin(order) });
  } catch (error) {
    console.error('[UPLOAD_BILL_ERROR]', error);
    res.status(500).json({ message: 'Could not upload the bill. Please try again.' });
  }
};

// @desc    Customer approves the final store bill; the order total becomes bill + delivery.
//          Wallet orders are charged/refunded the difference atomically; COD collects it at the door.
const approveBill = async (req, res) => {
  try {
    const order = await loadOrderFor(req, res, 'customer');
    if (!order) return;
    if (!(Number(order.billAmount) > 0)) return res.status(400).json({ message: 'The rider has not uploaded the bill yet.' });
    if (order.isBillApproved) return res.json({ message: 'Bill already approved', order, amountPayable: order.finalPrice });

    const newFinal = money(Math.max(0, Number(order.billAmount) + Number(order.deliveryFee || 0) - Number(order.batchDiscount || 0) - Number(order.gateDiscount || 0)));
    const diff = money(newFinal - Number(order.finalPrice || 0));
    const Order = getOrderModel();
    const User = getUserModel();
    const { getSequelize } = require('../config/db');
    const sequelize = getSequelize();

    try {
      await sequelize.transaction(async (t) => {
        const [n] = await Order.update(
          { isBillApproved: true, finalPrice: newFinal },
          { where: { id: order.id, isBillApproved: { [Op.not]: true } }, transaction: t } // older rows may hold NULL
        );
        if (n === 0) throw new PricingError(409, 'ALREADY_APPROVED', 'Bill already approved.');
        if (order.paymentMethod === 'Wallet' && diff > 0) {
          const [debited] = await User.update(
            { walletBalance: sequelize.literal(`"walletBalance" - ${Number(diff)}`) },
            { where: { id: order.userId, walletBalance: { [Op.gte]: diff } }, transaction: t }
          );
          if (debited === 0) throw new PricingError(400, 'INSUFFICIENT_WALLET', `The bill is ₹${diff} more than you paid and your Wallet doesn't have enough. Please add money to your Wallet and approve again.`, { needed: diff });
        } else if (order.paymentMethod === 'Wallet' && diff < 0) {
          await User.increment('walletBalance', { by: -diff, where: { id: order.userId }, transaction: t });
        }
      });
    } catch (err) {
      if (err instanceof PricingError) return sendPricingError(res, err);
      throw err;
    }

    order.isBillApproved = true;
    order.finalPrice = newFinal;
    broadcastOrderStatus(req, order, { id: order.id, status: order.status, isBillApproved: true, finalPrice: newFinal });
    const msg = order.paymentMethod === 'Wallet'
      ? (diff > 0 ? `Bill approved. ₹${diff} was taken from your Wallet.` : diff < 0 ? `Bill approved. ₹${-diff} was returned to your Wallet.` : 'Bill approved.')
      : `Bill approved. Pay ₹${newFinal} in cash when your order arrives.`;
    res.json({ message: msg, order, amountPayable: newFinal });
  } catch (error) {
    console.error('[APPROVE_BILL_ERROR]', error);
    res.status(500).json({ message: 'Could not approve the bill right now. Please try again.' });
  }
};

module.exports = { restaurantUpdateOrderStatus, autoCancelStalePendingOrders, cancelAndRefund, createOrder, quoteOrder, getServiceability, getOrderById, getMyOrders, rateOrder, getAllOrders, cancelOrder, updateOrderStatus, getSurgeStatus, restaurantAcceptOrder, verifyUPIPayment, restaurantReadyOrder, getOrderStats, uploadItemPhoto, approvePurchase, uploadBillProof, approveBill };
