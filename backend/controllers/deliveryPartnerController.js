const { getDeliveryPartnerModel } = require('../models/DeliveryPartner');
const { getOrderModel } = require('../models/Order');
const { getUserModel } = require('../models/User');
const { getRestaurantModel } = require('../models/Restaurant');
const { sendPushToTokens } = require('../utils/push');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Register a new delivery partner
const registerPartner = async (req, res) => {
  try {
    const { name, phone, password, vehicleType } = req.body;
    const DeliveryPartner = getDeliveryPartnerModel();
    const partnerExists = await DeliveryPartner.findOne({ where: { phone } });
    if (partnerExists) return res.status(400).json({ message: 'Partner already exists' });

    const partner = await DeliveryPartner.create({ name, phone, password, vehicleType });
    res.status(201).json({ _id: partner.id, name: partner.name, token: generateToken(partner.id) });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Auth partner & get token
const authPartner = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Hardcoded master credentials for dev
    if (phone === 'driver-1' && password === 'srk') {
      return res.json({ _id: 'mock-driver-1', name: 'Hostel Hub Rider', token: 'mock_jwt_token_for_srm_driver' });
    }

    const DeliveryPartner = getDeliveryPartnerModel();
    const partner = await DeliveryPartner.findOne({ where: { phone } });
    if (partner && (await bcrypt.compare(password, partner.password))) {
      res.json({ _id: partner.id, name: partner.name, token: generateToken(partner.id) });
    } else {
      res.status(401).json({ message: 'Invalid phone or password' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Accept an order
const acceptOrder = async (req, res) => {
  try {
    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Pending') return res.status(400).json({ message: 'Order already accepted' });

    order.deliveryPartnerId = req.user.id;
    order.status = 'Accepted';
    await order.save();

    const DeliveryPartner = getDeliveryPartnerModel();
    const partner = await DeliveryPartner.findByPk(req.user.id);
    if (partner) { partner.currentOrderId = order.id; await partner.save(); }

    const io = req.app.get('io');
    io.to(order.id.toString()).emit('statusUpdated', 'Accepted');

    try {
      const User = getUserModel();
      const Restaurant = getRestaurantModel();
      const customer = await User.findByPk(order.userId);
      const restaurant = await Restaurant.findByPk(order.restaurantId);

      res.json({
        id: order.id,
        restaurant: restaurant?.name || 'Restaurant',
        restaurantAddress: 'SRM Campus',
        customerName: customer?.name || 'Student',
        customerPhone: customer?.phone || 'Unknown',
        drop: order.hostelGateDelivery ? `${customer?.hostelBlock || 'Hostel'} (Gate)` : `${customer?.hostelBlock || 'Hostel'} (Room)`,
        items: order.items,
        totalPrice: order.totalPrice,
        finalPrice: order.finalPrice,
        earnings: `₹${Math.round((order.finalPrice || order.totalPrice) * 0.1)}`
      });

      if (customer?.fcmTokens?.length > 0) {
        await sendPushToTokens(customer.fcmTokens, 'Order Accepted! 🛵', 'Your Zenvy rider is on the way.', { orderId: order.id, type: 'ORDER_UPDATE' });
      }
    } catch (e) {
      if (!res.headersSent) res.json({ _id: order.id, status: 'Accepted' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all pending orders
const getPendingOrders = async (req, res) => {
  try {
    const Order = getOrderModel();
    const User = getUserModel();
    const Restaurant = getRestaurantModel();
    const orders = await Order.findAll({ where: { status: 'Pending' }, order: [['createdAt', 'DESC']] });

    const enrichedOrders = await Promise.all(orders.map(async (order) => {
      const restaurant = await Restaurant.findByPk(order.restaurantId).catch(() => null);
      const customer = await User.findByPk(order.userId).catch(() => null);
      return {
        id: order.id,
        restaurant: restaurant?.name || 'Restaurant',
        restaurantAddress: 'SRM Campus',
        customerName: customer?.name || 'Student',
        customerPhone: customer?.phone || 'Unknown',
        drop: order.hostelGateDelivery ? `${customer?.hostelBlock || 'Block'} (Gate)` : `${customer?.hostelBlock || 'Block'} (Room)`,
        items: order.items,
        totalPrice: order.totalPrice,
        finalPrice: order.finalPrice,
        earnings: `₹${Math.round((order.finalPrice || order.totalPrice) * 0.1)}`,
        createdAt: order.createdAt
      };
    }));

    res.json(enrichedOrders);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get order history
const getOrderHistory = async (req, res) => {
  try {
    const Order = getOrderModel();
    const Restaurant = getRestaurantModel();
    const { Op } = require('sequelize');
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const orders = await Order.findAll({
      where: { deliveryPartnerId: req.user.id, status: 'Delivered', updatedAt: { [Op.gte]: twentyFourHoursAgo } },
      order: [['updatedAt', 'DESC']]
    });

    const enrichedOrders = await Promise.all(orders.map(async (order) => {
      const restaurant = await Restaurant.findByPk(order.restaurantId).catch(() => null);
      return {
        id: order.id,
        restaurant: restaurant?.name || 'Restaurant',
        drop: order.hostelGateDelivery ? 'Hostel Gate' : 'Room Delivery',
        items: order.items,
        totalPrice: order.totalPrice,
        finalPrice: order.finalPrice,
        earnings: `₹${Math.round((order.finalPrice || order.totalPrice) * 0.1)}`,
        deliveredAt: order.updatedAt
      };
    }));

    res.json(enrichedOrders);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['PickedUp', 'Delivered'];
    if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status' });

    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.deliveryPartnerId !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });

    if (status === 'PickedUp' && order.status !== 'Accepted') return res.status(400).json({ message: 'Must be Accepted first' });
    if (status === 'Delivered' && order.status !== 'PickedUp') return res.status(400).json({ message: 'Must be PickedUp first' });

    order.status = status;
    await order.save();

    if (status === 'Delivered') {
      const earnings = Math.round((order.finalPrice || order.totalPrice) * 0.1);
      const DeliveryPartner = getDeliveryPartnerModel();
      const User = getUserModel();
      const partner = await DeliveryPartner.findByPk(req.user.id);
      if (partner) {
        partner.currentOrderId = null;
        partner.totalEarnings = (partner.totalEarnings || 0) + earnings;
        partner.zenPoints = (partner.zenPoints || 0) + 5;
        await partner.save();
      }
      const customer = await User.findByPk(order.userId);
      if (customer) {
        const pts = Math.floor((order.finalPrice || order.totalPrice) / 100) * 10;
        customer.zenPoints = (customer.zenPoints || 0) + pts;
        await customer.save();
      }
    }

    const io = req.app.get('io');
    io.to(order.id.toString()).emit('statusUpdated', status);
    res.json({ ...order.toJSON(), _id: order.id });

    try {
      const User = getUserModel();
      const customer = await User.findByPk(order.userId);
      if (customer?.fcmTokens?.length > 0) {
        const titles = { PickedUp: 'Order Picked Up! 🛵', Delivered: 'Order Delivered! 🎉' };
        const bodies = { PickedUp: 'Rider is on the way!', Delivered: 'Enjoy your meal!' };
        await sendPushToTokens(customer.fcmTokens, titles[status], bodies[status], { orderId: order.id, type: 'ORDER_UPDATE' });
      }
    } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Toggle online status
const toggleOnline = async (req, res) => {
  try {
    const DeliveryPartner = getDeliveryPartnerModel();
    await DeliveryPartner.update({ isOnline: req.body.isOnline }, { where: { id: req.user.id } });
    res.json({ isOnline: req.body.isOnline });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Save FCM Token for partner
const saveFcmToken = async (req, res) => {
  const { fcmToken, appVersion } = req.body;
  try {
    const DeliveryPartner = getDeliveryPartnerModel();
    const partner = await DeliveryPartner.findByPk(req.user.id);
    if (partner) {
      const tokens = partner.fcmTokens || [];
      const idx = tokens.findIndex(t => t.appVersion === appVersion);
      if (idx > -1) tokens[idx].token = fcmToken; else tokens.push({ token: fcmToken, appVersion });
      partner.fcmTokens = tokens;
      await partner.save();
      res.json({ message: 'FCM Token saved' });
    } else {
      res.status(404).json({ message: 'Partner not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to save token' });
  }
};

module.exports = { registerPartner, authPartner, acceptOrder, getPendingOrders, updateOrderStatus, toggleOnline, getOrderHistory, saveFcmToken };
