const { getOrderModel } = require('../models/Order');
const { getUserModel } = require('../models/User');
const { getRestaurantModel } = require('../models/Restaurant');
const { getDeliveryPartnerModel } = require('../models/DeliveryPartner');
const { sendPushToTokens } = require('../utils/push');
const { updateStreak, calculateBadgePerks } = require('../middleware/rewardEngine');
const { getMenuItemModel } = require('../models/MenuItem');
const { sendWhatsAppMessage, formatOrderMessage } = require('../utils/whatsappUtil');
const { Op } = require('sequelize');

// @desc    Create a new order
// @route   POST /api/orders
const createOrder = async (req, res) => {
  const { restaurantId, items, totalPrice: _totalPrice, deliverySlot, deliveryAddress, paymentMethod, upiUTR, upiScreenshot } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'No order items' });
  }

  try {
    const Restaurant = getRestaurantModel();
    const targetRid = typeof restaurantId === 'object' ? (restaurantId._id || restaurantId.id) : restaurantId;
    const restaurant = await Restaurant.findByPk(targetRid);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    // ── Dynamic Delivery Fee Calculation ──────────────────────
    const { isSurgeActive, SURGE_MULTIPLIER } = require('../server');
    const { getMatrixDistance } = require('../utils/distance');
    const matrix = await getMatrixDistance(restaurant.location, deliveryAddress || 'Amaravathi');
    const distanceKm = matrix.distance;
    const estDuration = matrix.duration;

    // Base fee ₹25. If distance > 2km, add ₹10 per additional km.
    let calculatedFee = Math.max(25, Math.round(25 + Math.max(0, distanceKm - 2) * 10));
    
    // Apply Surge Multiplier (Zone-Aware)
    const isSurge = isSurgeActive(restaurant.zone);
    if (isSurge) {
      calculatedFee = Math.round(calculatedFee * SURGE_MULTIPLIER);
    }

    // ── Multi-Order Batching (Efficiency Engine) ──────────
    const User = getUserModel();
    let currentUser = null;
    try {
      console.log('Fetching currentUser with ID:', req.user.id, typeof req.user.id);
      currentUser = await User.findByPk(req.user.id);
    } catch (dbErr) {
      console.error('dbErr on User.findByPk:', dbErr.message);
    }
    const Order = getOrderModel();
    
    // Find active orders from same restaurant to same hostel block
    const batchableOrder = await Order.findOne({
      where: {
        restaurantId,
        status: ['Pending', 'Accepted', 'Preparing']
      },
      include: [{
        model: User,
        as: 'user', 
        where: { hostelBlock: currentUser?.hostelBlock || 'Unknown' }
      }]
    }).catch(() => null);

    let batchDiscount = 0;
    if (batchableOrder) {
      batchDiscount = Math.round(calculatedFee * 0.2); // 20% Batching Discount
      console.log(`[BATCH_ENGINE] Found stackable order ${batchableOrder.id}. Applying ₹${batchDiscount} discount.`);
    }

    // ── Badge Perks Engine (Gourmet Benefits) ──────────
    const perks = calculateBadgePerks(currentUser);
    let perkDiscount = 0;
    
    // Delivery Discount (based on percentage of fee)
    if (perks.deliveryDiscount > 0) {
      perkDiscount += Math.round(calculatedFee * perks.deliveryDiscount);
    }
    
    // Direct Order Discount (Flat)
    if (perks.orderDiscount > 0) {
      perkDiscount += perks.orderDiscount;
    }

    if (perkDiscount > 0) {
      console.log(`[PERKS_ENGINE] Applying ₹${perkDiscount} discount for status: ${perks.status}`);
    }

    // ── Backend Price Validation (Security Guard) ────────────
    const MenuItem = getMenuItemModel();
    const itemIds = items.map(i => i.menuItemId || i.id || i._id);
    const dbItems = await MenuItem.findAll({ where: { id: itemIds } });
    const itemMap = Object.fromEntries(dbItems.map(i => [i.id, i]));
    
    let backendTotalPrice = 0;
    const validatedItems = [];
    
    for (const i of items) {
      const dbItem = itemMap[i.menuItemId || i.id || i._id];
      if (!dbItem) {
        return res.status(400).json({ message: `Invalid menu item: ${i.name || 'Unknown'}` });
      }

      if (!dbItem.isAvailable) {
        return res.status(400).json({ message: `Item just went out of stock: ${dbItem.name}` });
      }
      
      // Hard cap quantity to prevent overflows and absurd orders
      const qty = Math.min(20, Math.max(1, i.quantity || 1));
      
      const price = dbItem.price;
      backendTotalPrice += price * qty;
      validatedItems.push({
        ...i,
        quantity: qty,
        price,
        name: dbItem.name
      });
    }

    // ── Coupon Engine (One-Time Rewards) ──────────
    const { couponCode } = req.body;
    let couponDiscount = 0;
    let appliedCoupon = null;

    if (couponCode) {
      const { getCouponModel } = require('../models/Coupon');
      const Coupon = getCouponModel();
      appliedCoupon = await Coupon.findOne({
        where: { code: couponCode, userId: req.user.id, isUsed: false }
      });

      if (!appliedCoupon) {
        return res.status(400).json({ message: 'Invalid or expired reward code.' });
      }

      if (appliedCoupon.type === 'FREEDEL') {
        couponDiscount = calculatedFee; // 100% Delivery discount
      }
    }

    const finalPrice = Math.max(0, backendTotalPrice + (calculatedFee - couponDiscount) - batchDiscount - perkDiscount);

    // ── Wallet Payment Engine (Atomic Deduction) ──────────
    if (paymentMethod === 'Wallet') {
      if (!currentUser || (currentUser.walletBalance || 0) < finalPrice) {
        return res.status(400).json({ 
          message: `Insufficient Wallet Balance. Needed: ₹${finalPrice}, Current: ₹${currentUser?.walletBalance || 0}` 
        });
      }

      // Atomically decrement balance to prevent race condition/overdraft
      await currentUser.decrement('walletBalance', { by: finalPrice });
      console.log(`[WALLET_ENGINE] User ${req.user.id} balance deducted by ₹${finalPrice}.`);
    }

    const createdOrder = await Order.create({
      userId: req.user.id,
      restaurantId: targetRid,
      items: validatedItems,
      totalPrice: backendTotalPrice,
      deliveryFee: calculatedFee,
      distance: distanceKm,
      estDuration,
      batchDiscount,
      gateDiscount: perkDiscount, // Reusing gateDiscount for Badge Perks
      finalPrice,
      deliverySlot: (deliverySlot || 'ASAP').replace(/[<>]/g, ''), // Basic XSS Sanitization
      deliveryAddress: deliveryAddress || 'Amaravathi Center',
      hostelGateDelivery: false,
      isSurge: isSurge,
      paymentMethod,
      upiUTR: paymentMethod === 'UPI' ? upiUTR : null,
      upiScreenshot: paymentMethod === 'UPI' ? upiScreenshot : null,
      upiStatus: paymentMethod === 'UPI' ? 'Pending' : 'Verified', // Default to Verified for COD/Card for now
      status: restaurant.isOffline ? 'Accepted' : 'Pending',
      deliveryPin: Math.floor(1000 + Math.random() * 9000).toString()
    });

    try {
      if (appliedCoupon) {
        appliedCoupon.isUsed = true;
        await appliedCoupon.save();
        console.log(`[REWARD_ENGINE] One-time coupon ${appliedCoupon.code} consumed.`);
      }
      await updateStreak(req.user.id);
      const User = getUserModel();
      const user = await User.findByPk(req.user.id);
      if (user) {
        user.totalOrders = (user.totalOrders || 0) + 1;
        await user.save();
      }
    } catch (statsErr) {
      console.warn('[ORDER_STATS] stats update skipped:', statsErr.message);
    }

    const io = req.app.get('io');
    const { checkSurgeState } = require('../server');
    if (checkSurgeState) {
      checkSurgeState(io, restaurant.zone || 'Amaravathi_Central');
    }

    // Emit block order pulse for map UI
    try {
      if (currentUser && currentUser.hostelBlock) {
        io.emit('blockOrderPulse', { blockName: currentUser.hostelBlock });
      }
    } catch (e) {
      console.warn('[BLOCK_PULSE_WARN] Socket emit failed:', e.message);
    }

    res.status(201).json({ ...createdOrder.toJSON(), _id: createdOrder.id });

    // ── Universal Dispatch Logic ──────────────────────
    console.log(`[DISPATCH] Broadcasting newOrder event for Order ID: ${createdOrder.id}`);
    
    // 🟢 WhatsApp Integration: Send Confirmation to Customer
    try {
      if (currentUser && currentUser.phone) {
        const orderForMsg = await Order.findByPk(createdOrder.id, { 
          include: [{ model: getRestaurantModel(), as: 'restaurant', attributes: ['name'] }] 
        });
        const msg = formatOrderMessage(orderForMsg, 'CUSTOMER_CONFIRMATION');
        await sendWhatsAppMessage(currentUser.phone, msg, 'CONFIRMATION');
      }
    } catch (waErr) {
      console.error('[WHATSAPP_ERROR] Customer alert failed:', waErr.message);
    }

    // 1. Notify ALL online riders via socket instantly
    io.emit('newOrder', {
      id: createdOrder.id.toString(),
      restaurant: restaurant.name,
      restaurantAddress: restaurant.location,
      customerName: currentUser?.name || 'Customer',
      drop: createdOrder.deliveryAddress,
      items: createdOrder.items,
      totalPrice: createdOrder.totalPrice,
      finalPrice: createdOrder.finalPrice,
      earnings: `₹${createdOrder.deliveryFee}`,
      distance: createdOrder.distance,
      createdAt: createdOrder.createdAt
    });

    // 2. Smart Proximity Dispatch (Targeted Push to Closest Riders)
    try {
      const { getCoordsForAddress, getHaversineDistance } = require('../utils/distance');
      const DeliveryPartner = getDeliveryPartnerModel();
      const onlineRiders = await DeliveryPartner.findAll({ where: { isOnline: true } });
      
      const restaurantCoords = getCoordsForAddress(restaurant.location);
      
      // Calculate distances and sort
      const ridersWithDistance = onlineRiders.map(rider => {
          const riderCoords = rider.lastLocation || { lat: 16.5062, lon: 80.6480 }; // Fallback to center
          const dist = getHaversineDistance(restaurantCoords.lat, restaurantCoords.lon, riderCoords.lat, riderCoords.lon);
          return { rider, dist };
      }).sort((a, b) => a.dist - b.dist);

      // Targeted Push Notifications (Top 5 closest)
      const targetRiders = ridersWithDistance.slice(0, 5);
      const riderTokens = [];
      targetRiders.forEach(({ rider }) => {
        if (rider.fcmTokens) riderTokens.push(...rider.fcmTokens.map(t => t.token));
      });

      if (riderTokens.length > 0) {
        const title = restaurant.isOffline ? '🛒 Offline Shop Order!' : '🛵 New Pending Order!';
        const body = restaurant.isOffline 
          ? `Go buy/pickup at ${restaurant.name} (Closest to you!)`
          : `New order from ${restaurant.name} is waiting for acceptance!`;

        await sendPushToTokens(
          riderTokens, 
          title, 
          body, 
          { orderId: createdOrder.id, distance: createdOrder.distance, type: 'NEW_ORDER' }
        );

        // 🟢 WhatsApp Integration: Targeted Alert to Rider
        try {
          const topRider = targetRiders[0]?.rider;
          if (topRider && topRider.phone) {
             const riderMsg = formatOrderMessage(createdOrder, 'RIDER_ALERT');
             await sendWhatsAppMessage(topRider.phone, riderMsg, 'RIDER_ALERT');
          }
        } catch (waRiderErr) {
          console.error('[WHATSAPP_ERROR] Rider alert failed:', waRiderErr.message);
        }
      }
    } catch (dispatchErr) {
      console.error('[DISPATCH_ERROR]', dispatchErr.message);
    }

    // 3. Optional Restaurant/Admin Portal Updates
    if (!restaurant.isOffline) {
      // Online Shop: Emit to Restaurant Portal
      io.to(`restaurant_${restaurant.id}`).emit('restaurant_newOrder', {
        id: createdOrder.id,
        items: createdOrder.items,
        totalPrice: createdOrder.totalPrice,
        address: createdOrder.deliveryAddress
      });
      io.emit('admin_newOrder', { id: createdOrder.id, restaurant: restaurant.name, status: createdOrder.status });
    }

  } catch (error) {
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(__dirname, '..', 'socket_debug.txt');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] [ORDER_CREATE_ERROR] Full Error: ${error.stack || error}\n`);
    res.status(400).json({ message: 'Invalid order data', error: error.message });
  }
};

// @desc    Restaurant/Admin accepts order & dispatches to Rider
const restaurantAcceptOrder = async (req, res) => {
  try {
    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Pending') return res.status(400).json({ message: 'Order is not pending' });

    order.status = 'Accepted';
    await order.save();

    const io = req.app.get('io');
    io.emit('statusUpdated', { orderId: order.id, status: 'Accepted' });
    io.to(order.id.toString()).emit('statusUpdated', 'Accepted');

    // Fetch Restaurant to broadcast details to riders
    const Restaurant = getRestaurantModel();
    let restaurant = await Restaurant.findByPk(order.restaurantId);

    // ── Smart Proximity Dispatch ──────────────────────
    try {
      const { getCoordsForAddress, getHaversineDistance } = require('../utils/distance');
      const DeliveryPartner = getDeliveryPartnerModel();
      const onlineRiders = await DeliveryPartner.findAll({ where: { isOnline: true } });
      
      const restCoords = getCoordsForAddress(restaurant ? restaurant.location : '');
      const ridersWithDist = onlineRiders.map(rider => {
        const riderCoords = rider.lastLocation || { lat: 16.5062, lon: 80.6480 };
        const dist = getHaversineDistance(restCoords.lat, restCoords.lon, riderCoords.lat, riderCoords.lon);
        return { rider, dist };
      }).sort((a, b) => a.dist - b.dist);

      // Notify ALL via socket for real-time race
      io.emit('newOrder', {
        id: order.id,
        restaurant: restaurant ? restaurant.name : 'Unknown',
        restaurantAddress: restaurant ? restaurant.location : '',
        drop: order.deliveryAddress,
        items: order.items,
        totalPrice: order.totalPrice,
        finalPrice: order.finalPrice,
        earnings: `₹${order.deliveryFee}`,
        distance: order.distance
      });

      // Target closest 5 for Push Notifications
      const targetRiders = ridersWithDist.slice(0, 5);
      const riderTokens = [];
      targetRiders.forEach(({ rider }) => {
        if (rider.fcmTokens) riderTokens.push(...rider.fcmTokens.map(t => t.token));
      });

      if (riderTokens.length > 0) {
        await sendPushToTokens(
          riderTokens, 
          '🛵 New Order Ready!', 
          `${restaurant?.name || 'Restaurant'} is ready for pickup. Closest to you!`, 
          { orderId: order.id, distance: order.distance, type: 'NEW_ORDER' }
        );
      }
    } catch (dispatchErr) {
      console.error('[SMART_DISPATCH_ERROR]', dispatchErr.message);
    }

    res.json({ message: 'Order picked up/accepted by restaurant', orderId: order.id });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// @desc    Get order by ID
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
          attributes: ['id', 'name', 'phone', 'photoUrl', 'averageRating', 'totalRatings', 'vehicleType', 'vehicleNumber', 'bio'] 
        }
      ]
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const orderData = order.toJSON();
    // Map associations for legacy frontend compatibility (+ _id)
    if (orderData.deliveryPartner) {
        orderData.deliveryPartner._id = orderData.deliveryPartner.id;
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get logged in user orders
const getMyOrders = async (req, res) => {
  try {
    const Order = getOrderModel();
    const orders = await Order.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json(orders.map(o => ({ ...o.toJSON(), _id: o.id })));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Rate an order
const rateOrder = async (req, res) => {
  const { rating, review } = req.body;
  try {
    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.userId !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

    order.rating = rating;
    order.review = review;
    await order.save();

    if (order.deliveryPartnerId) {
      const DeliveryPartner = getDeliveryPartnerModel();
      const partner = await DeliveryPartner.findByPk(order.deliveryPartnerId);
      if (partner) {
        const total = (partner.averageRating || 5) * (partner.totalRatings || 0) + rating;
        const count = (partner.totalRatings || 0) + 1;
        partner.averageRating = parseFloat((total / count).toFixed(1));
        partner.totalRatings = count;
        await partner.save();
      }
    }
    res.json({ message: 'Rating submitted', rating });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all orders (Admin)
const getAllOrders = async (req, res) => {
  try {
    const Order = getOrderModel();
    const orders = await Order.findAll({ order: [['createdAt', 'DESC']], limit: 50 });
    res.json(orders.map(o => ({ ...o.toJSON(), _id: o.id })));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Cancel an order
const cancelOrder = async (req, res) => {
  try {
    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Allow cancellation if: (a) you are the order owner, or (b) order is still Pending (restaurant reject)
    const isOwner = order.userId === req.user.id;
    const isStillPending = order.status === 'Pending';
    if (!isOwner && !isStillPending) {
      return res.status(403).json({ message: 'Not authorized to cancel this order' });
    }

    // Customer cancellation window: 120 seconds after placement (unless still Pending)
    if (isOwner && !isStillPending) {
      const elapsed = (Date.now() - new Date(order.createdAt).getTime()) / 1000;
      if (elapsed > 120) {
        return res.status(400).json({ message: 'Cancellation window closed' });
      }
    }

    order.status = 'Cancelled';
    await order.save();

    // ── Refund Logic (Only for Wallet payments) ──────────────────────
    try {
      if (order.paymentMethod === 'Wallet') {
        const User = getUserModel();
        const user = await User.findByPk(order.userId);
        if (user) {
          user.walletBalance = (user.walletBalance || 0) + (order.finalPrice || order.totalPrice);
          await user.save();
          console.log(`[REFUND] ₹${order.finalPrice} refunded to wallet for user ${user.id}`);
        }
      }
    } catch (refundErr) {
      console.error('[REFUND_ERROR]', refundErr.message);
    }

    const io = req.app.get('io');
    io.emit('orderCancelled', { orderId: order.id });
    io.to(order.id.toString()).emit('statusUpdated', 'Cancelled');

    res.json({ message: 'Order cancelled', orderId: order.id });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update order status (Admin)
// @route   PUT /api/orders/:id/status
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['Pending', 'Accepted', 'PickedUp', 'Delivered', 'Cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
    }

    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (status === 'Delivered' && order.status !== 'Delivered') {
      const { evaluateBadges } = require('../services/BadgeService');
      const User = getUserModel();
      const user = await User.findByPk(order.userId);
      if (user) {
        // Award Points (10 pts per 100 spent)
        const pts = Math.floor((order.finalPrice || order.totalPrice) / 100) * 10;
        user.zenPoints = (user.zenPoints || 0) + pts;
        user.completedOrders = (user.completedOrders || 0) + 1;

        // Achievements Logic
        const hour = new Date().getHours();
        if (hour >= 22 || hour < 4) {
          user.lateNightOrders = (user.lateNightOrders || 0) + 1;
        }

        const newBadges = evaluateBadges(user);
        if (newBadges.length > 0) {
          const currentBadges = Array.isArray(user.badges) ? [...user.badges] : [];
          user.badges = [...currentBadges, ...newBadges];
        }
        await user.save();

        // Pass new badges to status update event
        order.newBadges = newBadges;
      }
    }

    order.status = status;
    await order.save();

    const io = req.app.get('io');
    io.emit('statusUpdated', { 
      orderId: order.id, 
      status,
      newBadges: status === 'Delivered' ? (order.newBadges || []) : []
    });
    io.to(order.id.toString()).emit('statusUpdated', {
      status,
      newBadges: status === 'Delivered' ? (order.newBadges || []) : []
    });

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
  const { isSurgeActive, SURGE_MULTIPLIER } = require('../server');
  res.json({ isSurge: isSurgeActive(), multiplier: SURGE_MULTIPLIER });
};

const verifyUPIPayment = async (req, res) => {
  const { isVerified } = req.body; // boolean
  try {
    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.paymentMethod !== 'UPI') return res.status(400).json({ message: 'Not a UPI order' });

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
    
    const io = req.app.get('io');
    io.emit('statusUpdated', { orderId: order.id, status: order.status });
    io.to(order.id.toString()).emit('statusUpdated', order.status);

    res.json({ message: `Payment ${isVerified ? 'Verified' : 'Rejected'}`, orderId: order.id, status: order.status });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { createOrder, getOrderById, getMyOrders, rateOrder, getAllOrders, cancelOrder, updateOrderStatus, getSurgeStatus, restaurantAcceptOrder, verifyUPIPayment };
