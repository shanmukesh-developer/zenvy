const Order = require('../models/Order');
const User = require('../models/User');

// SRM Hostels List
const SRM_HOSTELS = [
  'Vedavathi', 'Krishna', 'Ganga-A', 'Ganga-B', 'Yamuna', 'Godavari', 'Narmada'
];

// @desc    Get order activity per block (Real-time aggregation)
// @route   GET /api/blocks/activity
const getBlockActivity = async (req, res) => {
  try {
    // 1. Fetch all completed orders to calculate volume
    const orders = await Order.find({ status: 'Delivered' });

    // 2. Map orders to their user's hostel blocks
    // Note: In a large scale app, we'd use MongoDB $lookup aggregation, 
    // but for the SRM campus scale, we can map locally or do a quick join.
    
    // Create an initial map with 0 counts
    const activityMap = {};
    SRM_HOSTELS.forEach(h => activityMap[h] = 0);

    // Fetch user blocks for the orders
    const userIds = [...new Set(orders.map(o => o.userId))];
    const users = await User.find({ _id: { $in: userIds } });
    const userBlockMap = {};
    users.forEach(u => userBlockMap[u._id] = u.hostelBlock);

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
