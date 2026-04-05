const { getOrderModel } = require('../models/Order');
const { getUserModel } = require('../models/User');
const { getRestaurantModel } = require('../models/Restaurant');
const { getDeliveryPartnerModel } = require('../models/DeliveryPartner');
const { sendPushToTokens } = require('../utils/push');
const { updateStreak } = require('../middleware/rewardEngine');

// @desc    Create a new order
// @route   POST /api/orders
const createOrder = async (req, res) => {
  const { restaurantId, items, totalPrice, deliveryFee, deliverySlot, deliveryAddress } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'No order items' });
  }

  try {
    // ── On-Demand & Scheduled Delivery (city-wide) ──────────
    const finalPrice = totalPrice + deliveryFee;
    const Order = getOrderModel();
    const createdOrder = await Order.create({
      userId: req.user.id,
      restaurantId,
      items,
      totalPrice,
      deliveryFee,
      batchDiscount: 0,
      gateDiscount: 0,
      finalPrice,
      deliverySlot: deliverySlot || 'ASAP',
      deliveryAddress: deliveryAddress || '',
      hostelGateDelivery: false
    });

    try {
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
    // ── Surge Pricing: record new order and check window ──────
    const { orderTimestamps: surgeTs, checkSurgeState } = require('../server');
    if (surgeTs && checkSurgeState) {
      surgeTs.push(Date.now());
      checkSurgeState(io);
    }

    let restaurantName = 'Restaurant';
    try {
      const Restaurant = getRestaurantModel();
      const restaurant = await Restaurant.findByPk(restaurantId);
      if (restaurant) restaurantName = restaurant.name;
    } catch (e) { restaurantName = restaurantId || 'Restaurant'; }

    io.emit('newOrder', {
      id: createdOrder.id,
      restaurant: restaurantName,
      drop: createdOrder.hostelGateDelivery ? 'Hostel Gate' : 'Room Delivery',
      items: createdOrder.items,
      totalPrice: createdOrder.totalPrice,
      finalPrice: createdOrder.finalPrice,
      earnings: `₹${Math.round((createdOrder.finalPrice) * 0.1)}`
    });

    try {
      const User = getUserModel();
      const user = await User.findByPk(req.user.id);
      if (user && user.hostelBlock) {
        io.emit('blockOrderPulse', { blockName: user.hostelBlock });
      }
    } catch (e) {}

    res.status(201).json({ ...createdOrder.toJSON(), _id: createdOrder.id });

    try {
      const DeliveryPartner = getDeliveryPartnerModel();
      const onlineRiders = await DeliveryPartner.findAll({ where: { isOnline: true } });
      let riderTokens = [];
      onlineRiders.forEach(rider => {
        if (rider.fcmTokens) riderTokens.push(...rider.fcmTokens.map(t => t.token));
      });
      if (riderTokens.length > 0) {
        await sendPushToTokens(riderTokens, '🛵 New Order!', `${restaurantName} → ${createdOrder.hostelGateDelivery ? 'Hostel Gate' : 'Room'} (₹${Math.round(createdOrder.finalPrice * 0.1)})`, { orderId: createdOrder.id, type: 'NEW_ORDER' });
      }
    } catch (pushErr) {
      console.error('[PUSH_ERROR]', pushErr.message);
    }

  } catch (error) {
    console.error('[ORDER_CREATE_ERROR]', error.message);
    res.status(400).json({ message: 'Invalid order data', error: error.message });
  }
};

// @desc    Get order by ID
const getOrderById = async (req, res) => {
  try {
    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.id);
    if (order) {
      res.json({ ...order.toJSON(), _id: order.id });
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
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
      order: [['createdAt', 'DESC']]
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
    if (order.userId !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

    const elapsed = (Date.now() - new Date(order.createdAt).getTime()) / 1000;
    if (elapsed > 120 && order.status !== 'Pending') {
      return res.status(400).json({ message: 'Cancellation window closed' });
    }

    order.status = 'Cancelled';
    await order.save();

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

    order.status = status;
    await order.save();

    const io = req.app.get('io');
    io.emit('statusUpdated', { orderId: order.id, status });
    io.to(order.id.toString()).emit('statusUpdated', status);

    res.json({ message: 'Order status updated', orderId: order.id, status });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { createOrder, getOrderById, getMyOrders, rateOrder, getAllOrders, cancelOrder, updateOrderStatus };
