const { getOrderModel } = require('../models/Order');
const { getUserModel } = require('../models/User');
const { getRestaurantModel } = require('../models/Restaurant');
const { getDeliveryPartnerModel } = require('../models/DeliveryPartner');
const { sendPushToTokens } = require('../utils/push');
const { getMenuItemModel } = require('../models/MenuItem');
const { sendWhatsAppMessage, formatOrderMessage } = require('../utils/whatsappUtil');
const { Op } = require('sequelize');
const crypto = require('crypto');
const { computeOrderQuote, PricingError, activeCouponWhere, normalizePaymentMethod, PAYMENT_UNAVAILABLE_MESSAGE, money } = require('../utils/orderPricing');
const { getCampusServiceability } = require('../utils/storeHours');
const { getHaversineDistance } = require('../utils/distance');
const realtime = require('../utils/realtime');
const { pushNearestRiders, riderPayout } = require('../utils/riderDispatch');

// An order just entered the rider pool by a path other than restaurant-accept: push the nearest riders too.
// Fire-and-forget; never throws.
const pushPoolOrder = (order) => {
  (async () => {
    const restaurant = await getRestaurantModel().findByPk(order.restaurantId);
    await pushNearestRiders({
      restaurant,
      orderId: order.id,
      limit: 5,
      title: '🛵 New Order Ready!',
      body: `${restaurant?.name || 'Restaurant'} has a new order for pickup. Closest to you!`,
      data: { distance: order.distance },
    });
  })().catch((err) => console.error('[POOL_PUSH_ERROR]', err.message));
};
const { sendServerError } = require('../utils/httpErrors');

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

const isVendorFulfilled = (order) => !!order && order.fulfilment === 'VENDOR';

// Stall (VENDOR) orders are marked Delivered by the stall itself, with no PIN and no customer
// confirmation, and they are COD. To stop a colluding stall + customer farming ZenPoints,
// completedOrders (spins) and badges with fake orders, loyalty for stall orders needs the order
// to have lived a few minutes and is capped per customer per IST day.
const STALL_LOYALTY_DAILY = Math.max(0, parseInt(process.env.STALL_LOYALTY_DAILY, 10) || 2);
const STALL_LOYALTY_MIN_AGE_MS = 5 * 60 * 1000;
const stallLoyaltyAllowed = async (order) => {
  if (!isVendorFulfilled(order)) return true;
  try {
    const created = new Date(order.createdAt).getTime();
    if (!Number.isFinite(created) || Date.now() - created < STALL_LOYALTY_MIN_AGE_MS) return false;
    // The IST day the order was delivered (rating later still counts against that day's cap).
    const delivered = new Date(order.deliveredAt || Date.now()).getTime();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const dayStart = new Date(Math.floor((delivered + istOffset) / 86400000) * 86400000 - istOffset);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const sameDayStallOrders = await getOrderModel().findAll({
      where: { userId: order.userId, fulfilment: 'VENDOR', status: 'Delivered', deliveredAt: { [Op.gte]: dayStart, [Op.lt]: dayEnd } },
      attributes: ['id'],
      order: [['deliveredAt', 'ASC'], ['id', 'ASC']],
      limit: STALL_LOYALTY_DAILY,
    });
    // Only the first STALL_LOYALTY_DAILY stall orders of that day earn loyalty.
    return sameDayStallOrders.some((o) => String(o.id) === String(order.id));
  } catch {
    return false;
  }
};

// Push to the store's partner/vendor app devices (works while the app is closed). Never throws.
// Item count + amount only: no customer name / phone / address in a lock-screen notification.
const pushStoreNewOrder = async (restaurant, order) => {
  try {
    const { pushToStore } = require('../utils/storePush');
    const items = normalizeItems(order.items);
    const count = items.reduce((s, i) => s + (Number(i.quantity) || 1), 0);
    await pushToStore(restaurant, 'New order 🔔', `${count} item${count === 1 ? '' : 's'} · ₹${money(order.finalPrice)}${order.paymentMethod === 'COD' ? ' (cash)' : ''}`, { orderId: order.id, type: 'NEW_ORDER' });
  } catch (err) {
    console.warn('[STORE_PUSH_WARN]', err.message);
  }
};
const pushStoreCancelled = async (restaurantId, order, text) => {
  try {
    const { pushToStore } = require('../utils/storePush');
    await pushToStore(restaurantId, 'Order cancelled', text || 'An order was cancelled.', { orderId: order.id, type: 'ORDER_CANCELLED' });
  } catch (err) {
    console.warn('[STORE_PUSH_WARN]', err.message);
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
const IDEMPOTENCY_TTL_MS = 2 * 60 * 1000; // in-flight guard (same process)
const IDEMPOTENCY_DB_WINDOW_MS = 24 * 60 * 60 * 1000; // stored key on the order (any process, 24 h)
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
      paymentMethods: quote.paymentMethods || ['COD', 'Wallet'],
      walletBalance,
      canPayWithWallet: quote.fulfilment !== 'VENDOR' && walletBalance >= quote.finalPrice
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
  const idemRaw = rawKey ? String(rawKey).trim().slice(0, 100) : '';
  const idemKey = idemRaw ? `${req.user.id}:${idemRaw}` : null;
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
      // Survives restarts / redeploys and lasts 24 h: the key is stored on the order itself.
      const stored = await getOrderModel().findOne({
        where: { userId: req.user.id, idempotencyKey: idemRaw, createdAt: { [Op.gt]: new Date(Date.now() - IDEMPOTENCY_DB_WINDOW_MS) } },
      });
      if (stored) return res.status(200).json({ ...stored.toJSON(), _id: stored.id, duplicate: true });
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
      // Same key raced in from another process: the transaction rolled back, return the winner.
      if (idemRaw && err && err.name === 'SequelizeUniqueConstraintError') {
        const winner = await Order.findOne({ where: { userId: req.user.id, idempotencyKey: idemRaw } });
        if (winner) return res.status(200).json({ ...winner.toJSON(), _id: winner.id, duplicate: true });
      }
      throw err;
    }

    const Restaurant = getRestaurantModel();
    const restaurant = await Restaurant.findByPk(quote.store.id);
    // Rider-purchase store: marked offline, or has no partner login (nobody can tap Accept), so the
    // rider goes there, buys the items and delivers. Its orders skip store acceptance and go to riders.
    const riderBuys = !!restaurant && (!!restaurant.isOffline || !restaurant.password);
    // CampusBites stall: cash to the vendor on delivery, the vendor delivers (no rider, no PIN).
    const isVendorOrder = quote.fulfilment === 'VENDOR';
    if (isVendorOrder && paymentMethod !== 'COD') {
      if (idemClaimed) recentOrderKeys.delete(idemKey);
      return res.status(400).json({ code: 'STALL_COD_ONLY', message: `${restaurant.name} takes cash on delivery only.`, allowed: ['COD'] });
    }

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
          // Customer's pin for rider navigation (dropCoords, assigned rider only). Null when not sent.
          dropLat: hasCoords ? lat : null,
          dropLng: hasCoords ? lng : null,
          deliveryInstructions: deliveryInstructions.length ? deliveryInstructions : null,
          hostelGateDelivery: false,
          isSurge,
          paymentMethod,
          // Wallet money is taken above inside this transaction; cash is collected at the door.
          paymentStatus: paymentMethod === 'Wallet' ? 'Completed' : 'Pending',
          upiUTR: null,
          upiScreenshot: null,
          upiStatus: null,
          category: isVendorOrder ? 'LOCAL_VENDOR' : ((restaurant.vendorType || 'RESTAURANT').toUpperCase() === 'RESTAURANT' ? 'Food' : restaurant.vendorType),
          // A stall never skips its own acceptance (no rider fallback); an isOffline stall is closed (quote).
          status: !isVendorOrder && riderBuys ? 'Accepted' : 'Pending',
          ...(!isVendorOrder && riderBuys ? { acceptedAt: new Date() } : {}),
          fulfilment: isVendorOrder ? 'VENDOR' : 'ZENVY',
          idempotencyKey: idemRaw || null,
          // The stall hands the order over itself: no delivery PIN.
          deliveryPin: isVendorOrder ? null : String(crypto.randomInt(1000, 10000))
        }, { transaction: t });
      });
    } catch (err) {
      if (idemClaimed) recentOrderKeys.delete(idemKey);
      if (err instanceof PricingError) return sendPricingError(res, err);
      // Same Idempotency-Key raced in from another tab / device / process: this transaction rolled
      // back (nothing charged here) and the first order exists, so return it instead of a 500.
      if (idemRaw && err && err.name === 'SequelizeUniqueConstraintError') {
        const winner = await Order.findOne({ where: { userId: req.user.id, idempotencyKey: idemRaw } });
        if (winner) return res.status(200).json({ ...winner.toJSON(), _id: winner.id, duplicate: true }); // owner: keeps the PIN
      }
      throw err;
    }
    if (idemClaimed) recentOrderKeys.set(idemKey, { at: Date.now(), orderId: createdOrder.id });

    try {
      // The daily streak is credited on delivery (services/BadgeService creditCustomerForDelivery).
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

    const storeOrderPayload = {
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
    };

    if (isVendorOrder) {
      // Stall order: ONLY the owning stall's room gets the customer's contact details. Never riders.
      io.to(`restaurant_${restaurant.id}`).emit('restaurant_newOrder', {
        ...storeOrderPayload,
        fulfilment: 'VENDOR',
        customer: {
          name: currentUser.name || 'Customer',
          phone: currentUser.phone || null,
          hostelBlock: currentUser.hostelBlock || null,
          roomNumber: currentUser.roomNumber || null,
        },
      });
      await pushStoreNewOrder(restaurant, createdOrder);
      return;
    }

    if (riderBuys || createdOrder.status === 'Accepted') {
      // Shops without a vendor app go straight to riders.
      io.to('admin-room').emit('newOrder', riderPayload);
      realtime.deliveryRequest(createdOrder.id);
      // Riders with a recent GPS fix first (riders who left the app hours ago go last).
      await pushNearestRiders({
        restaurant,
        orderId: createdOrder.id,
        limit: 20,
        title: riderBuys ? '🛒 Buy & deliver order!' : '🛵 New order ready!',
        body: riderBuys ? `Go to ${restaurant.name}, purchase the items at the counter and deliver.` : `New order from ${restaurant.name} is ready for pickup!`,
      });
    } else {
      // Rider delivers: the kitchen gets the campus label, never the room address (same as the list).
      const { campusLabel, customerFirstName } = require('../utils/publicFields');
      const label = campusLabel(createdOrder.deliveryAddress);
      io.to(`restaurant_${restaurant.id}`).emit('restaurant_newOrder', { ...storeOrderPayload, address: label, deliveryAddress: label, user: { name: customerFirstName(currentUser.name) } });
      await pushStoreNewOrder(restaurant, createdOrder);
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
    if (isVendorFulfilled(order)) {
      req.body = { ...(req.body || {}), status: 'Accepted' };
      return vendorUpdateOrderStatus(req, res, order);
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
    if (!order.deliveryPartnerId) realtime.deliveryRequest(order.id); // live pool for online riders

    // Fetch Restaurant to broadcast details to riders
    const Restaurant = getRestaurantModel();
    let restaurant = await Restaurant.findByPk(order.restaurantId);

    // ── Smart Proximity Dispatch ──────────────────────
    try {
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

      // Push the 5 closest riders that have a recent GPS fix (stale / unknown positions rank last).
      await pushNearestRiders({
        restaurant,
        orderId: order.id,
        limit: 5,
        title: '🛵 New Order Ready!',
        body: `${restaurant?.name || 'Restaurant'} is ready for pickup. Closest to you!`,
        data: { distance: order.distance },
      });
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
        { model: Restaurant, as: 'restaurant', attributes: ['id', 'name', 'location', 'imageUrl', 'vendorType', 'whatsappNumber'] },
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
    // Stall orders follow the same daily loyalty cap as their delivery credit.
    try {
      if (await stallLoyaltyAllowed(order)) await User.increment('zenPoints', { by: 10, where: { id: req.user.id } });
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
    const { status } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;

    const where = {};
    if (status && status !== 'All') where.status = status;
    // ?restaurantId=<uuid>&from=<ISO>&to=<ISO>&fulfilment=VENDOR|ZENVY
    if (req.query.restaurantId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(req.query.restaurantId))) {
        return res.json({ orders: [], total: 0, pages: 0 });
      }
      where.restaurantId = String(req.query.restaurantId);
    }
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      return res.status(400).json({ message: "'from' and 'to' must be dates (ISO format)." });
    }
    if (from || to) where.createdAt = { ...(from ? { [Op.gte]: from } : {}), ...(to ? { [Op.lt]: to } : {}) };
    if (req.query.fulfilment === 'VENDOR') where.fulfilment = 'VENDOR';
    else if (req.query.fulfilment === 'ZENVY') where[Op.and] = [{ [Op.or]: [{ fulfilment: null }, { fulfilment: { [Op.ne]: 'VENDOR' } }] }];

    const { count, rows: orders } = await Order.findAndCountAll({ 
      where,
      // The customer's handover PIN is never shown to admins; legacy inline base64 photos are
      // returned as null (media URLs pass through) so a 500-row page stays small.
      attributes: {
        exclude: ['deliveryPin', 'proofImage', 'itemPhotoUrl', 'billProofUrl', 'upiScreenshot'],
        include: require('../utils/imageStore').dataUrlSafeColumns('Order', ['proofImage', 'itemPhotoUrl', 'billProofUrl']),
      },
      order: [['createdAt', 'DESC']], 
      limit,
      offset,
      include: [
        { model: User, as: 'user', attributes: ['name', 'phone'] },
        { model: Restaurant, as: 'restaurant', attributes: ['id', 'name', 'vendorType', 'whatsappNumber'] } // admin only: stall contact for VENDOR orders
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
    sendServerError(res, error, '[ORDERCONTROLLER_ERROR]');
  }
};

// @desc    Cancel an order
// @route   PUT /api/orders/:id/cancel
// Cancels an order and refunds it exactly once (Wallet amount back, coupon restored).
// `onlyFromStatuses` limits the cancel to orders still in one of those statuses (used by the auto-cancel job).
// Returns { cancelled, refunded }.
const cancelAndRefund = async (order, { reason = null, onlyFromStatuses = null, requireUnclaimed = false } = {}) => {
  const Order = getOrderModel();
  const { getSequelize } = require('../config/db');
  const sequelize = getSequelize();
  let refunded = 0;

  // Status flip + refund in one transaction. The conditional update means two parallel
  // cancels can never both pass, so the Wallet is refunded exactly once.
  const cancelled = await sequelize.transaction(async (t) => {
    // Lock and re-read the row: the refund must use the price at cancel time (a bill approval
    // may have changed finalPrice after the caller loaded `order`).
    const fresh = await Order.findByPk(order.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!fresh) return false;
    const statusWhere = Array.isArray(onlyFromStatuses)
      ? { [Op.in]: onlyFromStatuses }
      : { [Op.notIn]: ['Cancelled', 'Delivered'] };
    const [n] = await Order.update(
      { status: 'Cancelled', ...(reason ? { cancellationReason: reason } : {}) },
      { where: { id: order.id, status: statusWhere, ...(requireUnclaimed ? { deliveryPartnerId: null } : {}) }, transaction: t }
    );
    if (n === 0) return false;
    if (fresh.paymentMethod === 'Wallet') {
      const amount = money(fresh.finalPrice != null ? fresh.finalPrice : fresh.totalPrice);
      if (amount > 0) {
        const User = getUserModel();
        await User.increment('walletBalance', { by: amount, where: { id: order.userId }, transaction: t });
        refunded = amount;
      }
    }
    // Give back a coupon that was used on this order (if it has not expired).
    let breakdown = fresh.priceBreakdown;
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
  // An unclaimed order leaves every online rider's pool (ids only; harmless if it was never listed).
  if (cancelled && !order.deliveryPartnerId && !isVendorFulfilled(order)) realtime.deliveryRequestGone(order.id);
  if (cancelled && refunded > 0) console.log(`[REFUND] ₹${refunded} refunded to wallet for user ${order.userId} (order ${order.id})`);
  return { cancelled, refunded };
};

// Orders nobody moves forward are cancelled (and Wallet-refunded) automatically, so a customer is
// never left waiting (orders-n12). Runs from server.js every 2 minutes. Two cases, rider never set:
//  • 'Pending' for PENDING_ORDER_TIMEOUT_MINUTES (default 15): the store never accepted it.
//  • 'Accepted'/'Preparing'/'ReadyForPickup' for UNCLAIMED_ORDER_TIMEOUT_MINUTES (default 30) since
//    acceptance: no rider claimed it. App-less (catalogue) stores start orders at 'Accepted', so
//    without this an unclaimed order waited forever with the Wallet already debited.
const PENDING_TIMEOUT_MINUTES = Math.max(5, parseInt(process.env.PENDING_ORDER_TIMEOUT_MINUTES, 10) || 15);
const UNCLAIMED_TIMEOUT_MINUTES = Math.max(10, parseInt(process.env.UNCLAIMED_ORDER_TIMEOUT_MINUTES, 10) || 30);
const UNCLAIMED_STATUSES = ['Accepted', 'Preparing', 'ReadyForPickup'];
const autoCancelStalePendingOrders = async (io) => {
  const Order = getOrderModel();
  const pendingCutoff = new Date(Date.now() - PENDING_TIMEOUT_MINUTES * 60 * 1000);
  const unclaimedCutoff = new Date(Date.now() - UNCLAIMED_TIMEOUT_MINUTES * 60 * 1000);
  const stalePending = await Order.findAll({
    where: { status: 'Pending', deliveryPartnerId: null, createdAt: { [Op.lt]: pendingCutoff } },
    order: [['createdAt', 'ASC']],
    limit: 50,
  });
  const staleUnclaimed = await Order.findAll({
    where: {
      status: { [Op.in]: UNCLAIMED_STATUSES },
      deliveryPartnerId: null,
      // Stall orders are delivered by the stall itself: never "no rider" cancelled.
      [Op.and]: [{ [Op.or]: [{ fulfilment: null }, { fulfilment: { [Op.ne]: 'VENDOR' } }] }],
      createdAt: { [Op.lt]: unclaimedCutoff },
      [Op.or]: [{ acceptedAt: null }, { acceptedAt: { [Op.lt]: unclaimedCutoff } }],
    },
    order: [['createdAt', 'ASC']],
    limit: 50,
  });
  const jobs = [
    ...stalePending.map((order) => ({ order, from: ['Pending'], code: 'STORE_TIMEOUT', why: 'The store did not accept the order in time', text: 'The store did not accept your order in time.' })),
    ...staleUnclaimed.map((order) => ({ order, from: UNCLAIMED_STATUSES, code: 'NO_RIDER_TIMEOUT', why: 'No delivery partner was available in time', text: 'No delivery partner could pick up your order in time.' })),
  ];
  let count = 0;
  for (const { order, from, code, why, text } of jobs) {
    try {
      // onlyFromStatuses + rider check inside the conditional update: a rider claim that lands now wins.
      const { cancelled, refunded } = await cancelAndRefund(order, { reason: why, onlyFromStatuses: from, requireUnclaimed: true });
      if (!cancelled) continue;
      count++;
      const payload = { id: order.id, status: 'Cancelled', reason: code, refundedToWallet: refunded };
      if (io) {
        io.to(String(order.id)).emit('statusUpdated', payload);
        io.to('admin-room').emit('statusUpdated', payload);
        if (order.restaurantId) io.to(`restaurant_${order.restaurantId}`).emit('statusUpdated', payload);
        if (order.restaurantId) io.to(`restaurant_${order.restaurantId}`).emit('orderCancelled', { orderId: order.id, reason: code });
        io.to(String(order.id)).emit('orderCancelled', { orderId: order.id, reason: code });
        io.to('admin-room').emit('orderCancelled', { orderId: order.id, reason: code });
      }
      try {
        const customer = await getUserModel().findByPk(order.userId, { attributes: ['id', 'fcmTokens'] });
        if (customer) {
          await sendPushToTokens(
            customer.fcmTokens,
            'Order cancelled',
            refunded > 0
              ? `${text} ₹${refunded} is back in your Wallet.`
              : `${text} You have not been charged.`,
            { orderId: order.id, type: 'ORDER_UPDATE' },
            { recipients: [customer.id] }
          );
        }
      } catch (pushErr) {
        console.warn('[AUTO_CANCEL_PUSH_WARN]', pushErr.message);
      }
      if (order.restaurantId) pushStoreCancelled(order.restaurantId, order, code === 'STORE_TIMEOUT' ? 'An order was cancelled because it was not accepted in time.' : 'An order was cancelled: no delivery partner was available.');
    } catch (e) {
      console.error('[AUTO_CANCEL_ERROR]', order.id, e.message);
    }
  }
  if (count) console.log(`[AUTO_CANCEL] Cancelled ${count} stale order(s) (store ${PENDING_TIMEOUT_MINUTES} min / rider ${UNCLAIMED_TIMEOUT_MINUTES} min)`);
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
    // Customers can cancel while the order is Pending, or within 2 minutes of placing it while it is
    // still at the store (never once a rider is picking it up or carrying it). Orders no rider
    // claims are cancelled and refunded by autoCancelStalePendingOrders.
    const OWNER_CANCELLABLE = ['Pending', 'Accepted', 'Preparing'];
    if (isOwner && !isAdmin && order.status !== 'Pending') {
      const elapsed = (Date.now() - new Date(order.createdAt).getTime()) / 1000;
      if (!OWNER_CANCELLABLE.includes(order.status) || elapsed > 120) {
        return res.status(400).json({ message: 'The store has already started on this order, so it can no longer be cancelled. Need help? Contact support from the order page.', code: 'CANCEL_WINDOW_CLOSED' });
      }
    }

    const reason = typeof (req.body || {}).reason === 'string' ? req.body.reason.replace(/[<>]/g, '').slice(0, 250) : null;
    // The status guard is part of the conditional update, so a pickup that lands between our read
    // and the cancel wins (the customer cannot cancel food the rider is already carrying).
    const ownerCancel = isOwner && !isAdmin;
    const { cancelled, refunded } = await cancelAndRefund(order, { reason, ...(ownerCancel ? { onlyFromStatuses: OWNER_CANCELLABLE } : {}) });

    if (!cancelled) {
      const fresh = await Order.findByPk(order.id, { attributes: ['id', 'status'] });
      if (fresh && fresh.status !== 'Cancelled') {
        return res.status(400).json({ message: 'Your order is already on its way, so it can no longer be cancelled. Need help? Contact support from the order page.', code: 'CANCEL_WINDOW_CLOSED' });
      }
      return res.status(400).json({ message: 'This order is already cancelled.', code: 'ALREADY_CANCELLED' });
    }
    const cancelCode = ownerCancel ? 'CUSTOMER_CANCELLED' : 'ADMIN_CANCELLED';
    const statusPayload = { id: order.id, status: 'Cancelled', reason: cancelCode };
    broadcastOrderStatus(req, order, statusPayload);
    const io = req.app.get('io');
    if (io) {
      io.to(String(order.id)).emit('orderCancelled', { orderId: order.id, reason: cancelCode });
      io.to('admin-room').emit('orderCancelled', { orderId: order.id, reason: cancelCode });
      // The store / stall app drops the card (and stops ringing) at once.
      if (order.restaurantId) io.to(`restaurant_${order.restaurantId}`).emit('orderCancelled', { orderId: order.id, reason: cancelCode });
      // The assigned rider must stop (they may not be in the order room right now).
      if (order.deliveryPartnerId) io.to(`rider_${order.deliveryPartnerId}`).emit('orderCancelled', { orderId: order.id });
    }
    if (order.deliveryPartnerId) {
      try {
        await getDeliveryPartnerModel().update({ currentOrderId: null }, { where: { id: order.deliveryPartnerId, currentOrderId: order.id } });
      } catch (riderErr) { console.warn('[CANCEL_RIDER_RELEASE_WARN]', riderErr.message); }
    }

    if (order.restaurantId) pushStoreCancelled(order.restaurantId, order, ownerCancel ? 'The customer cancelled an order.' : 'An order was cancelled by Zenvy support.');

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

// Forward order of statuses for the admin endpoint (equal rank = alternative steps).
const ADMIN_STATUS_RANK = {
  Pending: 0, Accepted: 1, Preparing: 2, ReadyForPickup: 3, Picking: 4,
  PickedUp: 5, OutForDelivery: 5, ArrivedAtGate: 6, Delivered: 7,
};

// @desc    Update order status (Admin)
// @route   PUT /api/orders/:id/status
const updateOrderStatus = async (req, res) => {
  try {
    let { status } = req.body;
    if (status === 'Ready for Pickup') status = 'ReadyForPickup';
    const allowedStatuses = ['Pending', 'Accepted', 'Preparing', 'ReadyForPickup', 'Picking', 'PickedUp', 'ArrivedAtGate', 'OutForDelivery', 'Delivered', 'Cancelled'];
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
    // Stall orders never take rider steps; rider orders never take the stall's OutForDelivery step.
    const RIDER_STEPS = ['Picking', 'PickedUp', 'ArrivedAtGate'];
    if (isVendorFulfilled(order) && RIDER_STEPS.includes(status)) {
      return res.status(400).json({ message: 'This order is delivered by the stall (no rider). Use Accepted, OutForDelivery or Delivered.' });
    }
    if (!isVendorFulfilled(order) && status === 'OutForDelivery') {
      return res.status(400).json({ message: 'OutForDelivery is only for stall-delivered orders. Use PickedUp for rider orders.' });
    }

    // Forward-only: a Delivered order is final, and no step may go backwards (re-delivering a
    // regressed order used to credit points and rider earnings a second time).
    if (order.status === 'Delivered' && status !== 'Delivered') {
      return res.status(400).json({ code: 'ORDER_FINAL', message: 'This order is already delivered and cannot be moved back.' });
    }
    const targetRank = ADMIN_STATUS_RANK[status];
    const currentRank = ADMIN_STATUS_RANK[order.status];
    if (targetRank !== undefined && currentRank !== undefined && targetRank < currentRank) {
      return res.status(400).json({ code: 'STATUS_REGRESSION', message: `This order is already ${order.status}; it cannot go back to ${status}.` });
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
        const { newBadges } = (await stallLoyaltyAllowed(order)) ? await creditCustomerForDelivery(getUserModel(), order) : { newBadges: [] };
        order.newBadges = newBadges;
      } catch (creditErr) {
        console.error('[DELIVERY_CREDIT_ERROR]', order.id, creditErr.message);
      }
    }

    if (justDelivered && order.deliveryPartnerId) {
      // Support / admin completion counts as a real delivery for the rider too (same credit as
      // the rider app path): lifetime earnings, points, and the rider is free for the next order.
      try {
        const DeliveryPartner = getDeliveryPartnerModel();
        await DeliveryPartner.increment({ totalEarnings: riderPayout(order), zenPoints: 5 }, { where: { id: order.deliveryPartnerId } });
        await DeliveryPartner.update({ currentOrderId: null }, { where: { id: order.deliveryPartnerId, currentOrderId: order.id } });
      } catch (riderErr) {
        console.error('[DELIVERY_RIDER_CREDIT_ERROR]', order.id, riderErr.message);
      }
    }

    const prevStatus = order.status;
    if (status !== 'Delivered') {
      // Conditional write: never overwrite a cancel (and its refund) that landed after we read the order.
      const extra = status === 'OutForDelivery' ? { outForDeliveryAt: new Date() } : {};
      const allowedFrom = Object.keys(ADMIN_STATUS_RANK).filter((s) => s !== 'Delivered' && ADMIN_STATUS_RANK[s] <= targetRank);
      const [n] = await Order.update({ status, ...extra }, { where: { id: order.id, status: { [Op.in]: allowedFrom } } });
      if (n === 0) return res.status(409).json({ message: 'This order was just updated (cancelled, delivered or moved on). Please refresh.' });
      order.status = status;
    } else {
      order.status = 'Delivered';
    }
    if (!order.deliveryPartnerId && !isVendorFulfilled(order)) {
      const wasClaimable = realtime.CLAIMABLE_STATUSES.includes(prevStatus);
      const isClaimable = realtime.CLAIMABLE_STATUSES.includes(order.status);
      if (isClaimable && !wasClaimable) { realtime.deliveryRequest(order.id); pushPoolOrder(order); }
      else if (!isClaimable && wasClaimable) realtime.deliveryRequestGone(order.id);
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
          'OutForDelivery': 'On the way 🛵',
          'Delivered': 'Enjoy your meal! 🎉',
          'Cancelled': 'Order Cancelled 🛑'
        };
        const bodies = {
          'Accepted': 'Your order was accepted by the merchant.',
          'Preparing': 'Your order has been sent to the kitchen.',
          'ReadyForPickup': 'The merchant prepared your order and is waiting for a rider.',
          'PickedUp': 'Rider has picked up your order and is heading your way.',
          'OutForDelivery': 'The stall is bringing your order. Keep the cash ready.',
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
    sendServerError(res, error, '[ORDERCONTROLLER_ERROR]');
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
    sendServerError(res, error, '[ORDERCONTROLLER_ERROR]');
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

    const prevStatus = order.status;
    if (isVerified) {
      // Conditional: only a still-pending UPI order that is not closed can be verified.
      const nextStatus = order.status === 'Pending' ? 'Accepted' : order.status;
      const [n] = await Order.update(
        { upiStatus: 'Verified', paymentStatus: 'Completed', status: nextStatus, ...(nextStatus !== prevStatus ? { acceptedAt: new Date() } : {}) },
        { where: { id: order.id, upiStatus: 'Pending', status: prevStatus } }
      );
      if (!n) return res.status(409).json({ message: 'This order was just updated. Please refresh.' });
      order.upiStatus = 'Verified';
      order.paymentStatus = 'Completed';
      order.status = nextStatus;
    } else {
      // Rejected payment: cancel through the shared path (exactly once, coupon restored).
      const [n] = await Order.update(
        { upiStatus: 'Rejected' },
        { where: { id: order.id, upiStatus: 'Pending', status: { [Op.notIn]: ['Delivered', 'Cancelled'] } } }
      );
      if (!n) return res.status(409).json({ message: 'This order was just updated. Please refresh.' });
      order.upiStatus = 'Rejected';
      const { cancelled } = await cancelAndRefund(order, { reason: 'UPI payment rejected' });
      order.status = cancelled ? 'Cancelled' : order.status;
    }

    if (!order.deliveryPartnerId) {
      if (order.status === 'Accepted' && prevStatus === 'Pending') { realtime.deliveryRequest(order.id); pushPoolOrder(order); }
      else if (order.status === 'Cancelled' && realtime.CLAIMABLE_STATUSES.includes(prevStatus)) realtime.deliveryRequestGone(order.id);
    }

    const statusPayload = { id: order.id, status: order.status };
    broadcastOrderStatus(req, order, statusPayload);

    res.json({ message: `Payment ${isVerified ? 'Verified' : 'Rejected'}`, orderId: order.id, status: order.status });
  } catch (error) {
    sendServerError(res, error, '[ORDERCONTROLLER_ERROR]');
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
    if (isVendorFulfilled(order)) {
      return res.status(400).json({ message: 'Stall orders go Accepted, then Out for delivery, then Delivered. Tap "Out for delivery" when you leave with it.' });
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
  // Stall (fulfilment VENDOR) orders have their own flow: Pending -> Accepted -> OutForDelivery -> Delivered.
  try {
    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.restaurantId !== req.user.id) return res.status(403).json({ message: 'Not authorized to update this order' });
    if (isVendorFulfilled(order)) return vendorUpdateOrderStatus(req, res, order);
  } catch (error) {
    console.error('[REST_STATUS_ERROR]', error);
    return res.status(500).json({ message: 'Could not update the order right now. Please try again.' });
  }
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
      const prevStatus = order.status;
      const [n] = await Order.update({ status: 'Preparing' }, { where: { id: order.id, status: { [Op.in]: ['Pending', 'Accepted'] } } });
      if (n === 0) return res.status(400).json({ message: 'This order was just cancelled or updated. Please refresh.' });
      order.status = 'Preparing';
      if (prevStatus === 'Pending' && !order.deliveryPartnerId) { realtime.deliveryRequest(order.id); pushPoolOrder(order); }
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


// @desc    Zenvy Vendor app (CampusBites stall) moves ITS OWN fulfilment='VENDOR' order.
//          Pending -> Accepted -> OutForDelivery -> Delivered, or Cancelled/Rejected with a reason.
//          No rider, no PIN, no rider pool events. Every write is conditional on the current status.
const VENDOR_FLOW = {
  Accepted: { from: ['Pending'], stamp: 'acceptedAt' },
  OutForDelivery: { from: ['Accepted', 'Preparing', 'ReadyForPickup'], stamp: 'outForDeliveryAt' },
  Delivered: { from: ['OutForDelivery', 'Accepted', 'Preparing', 'ReadyForPickup', 'PickedUp', 'ArrivedAtGate'], stamp: 'deliveredAt' },
};
const VENDOR_CANCELLABLE = ['Pending', 'Accepted', 'Preparing', 'ReadyForPickup', 'OutForDelivery'];
const VENDOR_STALE_MSG = 'This order was just cancelled or updated. Please refresh.';

const vendorUpdateOrderStatus = async (req, res, order) => {
  try {
    const Order = getOrderModel();
    let status = String((req.body || {}).status || '').trim();
    if (status === 'Rejected' || status === 'Declined') status = 'Cancelled';
    if (status === 'Out for delivery' || status === 'OnTheWay') status = 'OutForDelivery';
    const store = await getRestaurantModel().findByPk(order.restaurantId, { attributes: ['id', 'name'] });
    const stall = (store && store.name) || 'The stall';
    const notifyCustomer = async (title, body) => {
      try {
        const customer = await getUserModel().findByPk(order.userId, { attributes: ['id', 'fcmTokens'] });
        if (customer) await sendPushToTokens(customer.fcmTokens, title, body, { orderId: order.id, type: 'ORDER_UPDATE' }, { recipients: [customer.id] });
      } catch (pushErr) { console.warn('[VENDOR_STATUS_PUSH_WARN]', pushErr.message); }
    };

    if (status === 'Cancelled') {
      const reason = typeof (req.body || {}).reason === 'string' ? req.body.reason.replace(/[<>]/g, '').trim().slice(0, 250) : '';
      if (!reason) return res.status(400).json({ message: 'Please tell the customer why you are cancelling.' });
      const { cancelled } = await cancelAndRefund(order, { reason, onlyFromStatuses: VENDOR_CANCELLABLE });
      if (!cancelled) return res.status(400).json({ message: VENDOR_STALE_MSG });
      broadcastOrderStatus(req, order, { id: order.id, status: 'Cancelled', reason });
      const io = req.app.get('io');
      if (io) {
        io.to(String(order.id)).emit('orderCancelled', { orderId: order.id, reason: 'STORE_DECLINED' });
        io.to('admin-room').emit('orderCancelled', { orderId: order.id, reason: 'STORE_DECLINED' });
      }
      await notifyCustomer('Order cancelled', `${stall} cancelled: ${reason}`);
      return res.json({ message: 'Order cancelled', orderId: order.id, status: 'Cancelled' });
    }

    const step = VENDOR_FLOW[status];
    if (!step) return res.status(400).json({ message: 'A stall can accept an order, mark it out for delivery, mark it delivered or cancel it.' });
    const fields = { status, [step.stamp]: new Date(), ...(status === 'Delivered' && order.paymentMethod === 'COD' ? { paymentStatus: 'Completed' } : {}) };
    const [n] = await Order.update(fields, { where: { id: order.id, status: { [Op.in]: step.from } } });
    if (n === 0) {
      const fresh = await Order.findByPk(order.id, { attributes: ['id', 'status'] });
      if (fresh && fresh.status === status) {
        return res.json({ message: `Order is already ${status === 'OutForDelivery' ? 'out for delivery' : status.toLowerCase()}`, orderId: order.id, status });
      }
      return res.status(400).json({ message: VENDOR_STALE_MSG });
    }
    Object.assign(order, fields);

    let newBadges = [];
    if (status === 'Delivered') {
      // Exactly once: only the request whose conditional update flipped the order gets here.
      try {
        const { creditCustomerForDelivery } = require('../services/BadgeService');
        const result = (await stallLoyaltyAllowed(order)) ? await creditCustomerForDelivery(getUserModel(), order) : null;
        newBadges = (result && result.newBadges) || [];
      } catch (creditErr) {
        console.error('[DELIVERY_CREDIT_ERROR]', order.id, creditErr.message);
      }
    }
    broadcastOrderStatus(req, order, { id: order.id, status, ...(status === 'Delivered' ? { newBadges } : {}) });
    if (status === 'Delivered') {
      const io = req.app.get('io');
      if (io) io.to('admin-room').emit('admin_delivery_complete', { orderId: order.id });
    }

    if (status === 'Accepted') await notifyCustomer('Order accepted 👍', `${stall} accepted your order.`);
    else if (status === 'OutForDelivery') await notifyCustomer('On the way 🛵', `${stall} is bringing your order. Keep ₹${money(order.finalPrice)} cash ready.`);
    else await notifyCustomer('Delivered 🎉', `Delivered by ${stall}. Enjoy!`);

    const labels = { Accepted: 'Order accepted', OutForDelivery: 'Order is out for delivery', Delivered: 'Order delivered' };
    return res.json({ message: labels[status], orderId: order.id, status });
  } catch (error) {
    console.error('[VENDOR_STATUS_ERROR]', error);
    return res.status(500).json({ message: 'Could not update the order right now. Please try again.' });
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

// Bill / pre-purchase photo flow exists only for buy-for-me orders (the rider shops with cash and
// the bill decides the price). On a normal food / store order the price is fixed by the menu, so
// a rider + customer pair must never be able to "approve" a tiny bill and refund the Wallet.
const BUY_FOR_ME_CATEGORIES = ['mega basket', 'mega_basket', 'megabasket', 'kirana', 'buy_for_me'];
const isBuyForMeOrder = (order) => BUY_FOR_ME_CATEGORIES.includes(String((order && order.category) || '').trim().toLowerCase());
const notBuyForMe = (res) => res.status(400).json({ code: 'NOT_BUY_FOR_ME', message: 'Bills can only be added to Mega Basket orders.' });

// @desc    Rider uploads pre-purchase item photo / estimate for Mega Basket
const uploadItemPhoto = async (req, res) => {
  try {
    const { itemPhotoUrl: rawPhoto } = req.body || {};
    if (!rawPhoto || typeof rawPhoto !== 'string') return res.status(400).json({ message: 'Please attach the item photo.' });
    const order = await loadOrderFor(req, res, 'rider');
    if (!order) return;
    if (!isBuyForMeOrder(order)) return notBuyForMe(res);
    const { storeImageRef, sendImageError } = require('../utils/imageStore');
    const img = await storeImageRef(rawPhoto, { req, ownerId: req.user.id, purpose: 'basket' });
    if (!img.ok || !img.value) return sendImageError(res, img.ok ? { status: 400, message: 'Please attach the item photo.' } : img);
    const itemPhotoUrl = img.value;
    const [saved] = await getOrderModel().update({ itemPhotoUrl }, { where: { id: order.id, status: { [Op.notIn]: ['Cancelled', 'Delivered'] } } });
    if (!saved) return res.status(409).json({ message: 'This order was just updated. Please refresh.' });
    order.itemPhotoUrl = itemPhotoUrl; // status is unchanged ('Shopping' is not an order status)

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
    const { billProofUrl: rawBill } = req.body || {};
    const billAmount = Number((req.body || {}).billAmount);
    if (!rawBill || typeof rawBill !== 'string') return res.status(400).json({ message: 'Please attach a photo of the bill.' });
    if (!Number.isFinite(billAmount) || billAmount <= 0 || billAmount > 100000) return res.status(400).json({ message: 'Please enter the bill amount.' });
    const order = await loadOrderFor(req, res, 'rider');
    if (!order) return;
    if (!isBuyForMeOrder(order)) return notBuyForMe(res);
    if (order.isBillApproved) return res.status(400).json({ message: 'The customer has already approved this bill.' });
    // A bill far below what the customer ordered needs support to review it (refund abuse guard).
    const subtotal = Number(order.totalPrice) || 0;
    if (subtotal > 0 && billAmount < subtotal * 0.5) {
      return res.status(400).json({ code: 'BILL_TOO_LOW', message: 'This bill is much lower than the order. Please contact Zenvy support to adjust it.' });
    }
    const { storeImageRef, sendImageError } = require('../utils/imageStore');
    const img = await storeImageRef(rawBill, { req, ownerId: req.user.id, purpose: 'bill' });
    if (!img.ok || !img.value) return sendImageError(res, img.ok ? { status: 400, message: 'Please attach a photo of the bill.' } : img);
    const billProofUrl = img.value;
    const [saved] = await getOrderModel().update(
      { billProofUrl, billAmount: money(billAmount) },
      { where: { id: order.id, status: { [Op.notIn]: ['Cancelled', 'Delivered'] }, isBillApproved: { [Op.not]: true } } }
    );
    if (!saved) return res.status(409).json({ message: 'This order was just updated. Please refresh.' });
    order.billProofUrl = billProofUrl;
    order.billAmount = money(billAmount);

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
    if (!isBuyForMeOrder(order)) return notBuyForMe(res);
    if (!(Number(order.billAmount) > 0)) return res.status(400).json({ message: 'The rider has not uploaded the bill yet.' });
    if (order.isBillApproved) return res.json({ message: 'Bill already approved', order: withoutPin(order), amountPayable: order.finalPrice });

    const Order = getOrderModel();
    const User = getUserModel();
    const { getSequelize } = require('../config/db');
    const sequelize = getSequelize();
    let newFinal = 0;
    let diff = 0;

    try {
      await sequelize.transaction(async (t) => {
        // Lock and re-read: a cancel running in parallel either finishes first (we see Cancelled)
        // or waits for us (and then refunds the new finalPrice). Never two refunds on stale data.
        const fresh = await Order.findByPk(order.id, { transaction: t, lock: t.LOCK.UPDATE });
        if (!fresh || ['Cancelled', 'Delivered'].includes(fresh.status)) {
          throw new PricingError(409, 'ORDER_CLOSED', `This order is already ${String(fresh ? fresh.status : 'closed').toLowerCase()}.`);
        }
        if (fresh.isBillApproved) throw new PricingError(409, 'ALREADY_APPROVED', 'Bill already approved.');
        newFinal = money(Math.max(0, Number(fresh.billAmount) + Number(fresh.deliveryFee || 0) - Number(fresh.batchDiscount || 0) - Number(fresh.gateDiscount || 0)));
        diff = money(newFinal - Number(fresh.finalPrice || 0));
        const [n] = await Order.update(
          { isBillApproved: true, finalPrice: newFinal },
          { where: { id: order.id, isBillApproved: { [Op.not]: true }, status: { [Op.notIn]: ['Cancelled', 'Delivered'] } }, transaction: t } // older rows may hold NULL
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
    res.json({ message: msg, order: withoutPin(order), amountPayable: newFinal });
  } catch (error) {
    console.error('[APPROVE_BILL_ERROR]', error);
    res.status(500).json({ message: 'Could not approve the bill right now. Please try again.' });
  }
};

module.exports = { restaurantUpdateOrderStatus, autoCancelStalePendingOrders, cancelAndRefund, createOrder, quoteOrder, getServiceability, getOrderById, getMyOrders, rateOrder, getAllOrders, cancelOrder, updateOrderStatus, getSurgeStatus, restaurantAcceptOrder, verifyUPIPayment, restaurantReadyOrder, getOrderStats, uploadItemPhoto, approvePurchase, uploadBillProof, approveBill };
