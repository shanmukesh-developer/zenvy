const { getOrderModel } = require('../models/Order');
const { getUserModel } = require('../models/User');
const { Op } = require('sequelize');

// SRM Hostels List
const SRM_HOSTELS = [
  'Vedavathi', 'Krishna', 'Ganga-A', 'Ganga-B', 'Yamuna', 'Godavari', 'Narmada'
];

// @desc    Get order activity per block (Real-time aggregation)
// @route   GET /api/blocks/activity
const getBlockActivity = async (req, res) => {
  try {
    const Order = getOrderModel();
    const User = getUserModel();

    // 1. Fetch all completed orders to calculate volume
    const orders = await Order.findAll({ where: { status: 'Delivered' } });

    // Create an initial map with 0 counts
    const activityMap = {};
    SRM_HOSTELS.forEach(h => activityMap[h] = 0);

    // Fetch user blocks for the orders
    const userIds = [...new Set(orders.map(o => o.userId))];
    const users = await User.findAll({ where: { id: { [Op.in]: userIds } } });
    
    const userBlockMap = {};
    users.forEach(u => userBlockMap[u.id] = u.hostelBlock);

    orders.forEach(order => {
      const block = userBlockMap[order.userId];
      if (block && activityMap[block] !== undefined) {
        activityMap[block] += 1;
      }
    });

    const liveCounts = Object.keys(activityMap).map(name => ({
      name,
      count: activityMap[name]
    })).sort((a, b) => b.count - a.count);

    res.json(liveCounts);
  } catch (error) {
    console.error('[BLOCK_ERROR]', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { getBlockActivity, SRM_HOSTELS };
