const Order = require('../models/Order');
const User = require('../models/User');
const { sendPushToTokens } = require('../utils/push');

// @desc    Create a new order
// @route   POST /api/orders
const createOrder = async (req, res) => {
  const { restaurantId, items, totalPrice, deliveryFee, deliverySlot, hostelGateDelivery } = req.body;

  if (items && items.length === 0) {
    return res.status(400).json({ message: 'No order items' });
  }

  try {
    // 🛑 SRM Curfew Enforcement: No orders after 9:30 PM (21:30)
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 100 + minutes;
    
    if (currentTime > 2130) {
      return res.status(403).json({ message: 'Curfew Active: SRM Campus food delivery is allowed only upto 9:30 PM.' });
    }

    let gateDiscount = 0;
    let batchDiscount = 0;

    // Logic: 30% discount if picked up at gate
    if (hostelGateDelivery) {
      gateDiscount = Math.round(deliveryFee * 0.3);
    }

    // Logic: Batch discount (Simplification: ₹20 off for pre-defined slots)
    const validBatchSlots = ['7:30 PM', '9:00 PM', '11:30 PM'];
    if (validBatchSlots.includes(deliverySlot)) {
      batchDiscount = 20;
    }

    const finalPrice = totalPrice + deliveryFee - gateDiscount - batchDiscount;

    const order = new Order({
      userId: req.user.id,
      restaurantId,
      items,
      totalPrice,
      deliveryFee,
      batchDiscount,
      gateDiscount,
      finalPrice,
      deliverySlot,
      hostelGateDelivery
    });

    let createdOrder;
    
    // Fallback for local testing without MongoDB
    if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
      createdOrder = {
        _id: 'TEST_ORDER_ID_' + Math.floor(Math.random() * 10000),
        hostelGateDelivery,
        finalPrice,
        items: items || [],
        totalPrice: totalPrice || 0,
        status: 'Accepted'
      };
    } else {
      createdOrder = await order.save();

      // Update streak and user stats (non-critical, don't crash order)
      try {
        const { updateStreak } = require('../middleware/rewardEngine');
        await updateStreak(req.user.id);
        await User.findByIdAndUpdate(req.user.id, {
          $inc: { totalOrders: 1 }
        });
      } catch (statsErr) {
        console.warn('User stats update skipped:', statsErr.message);
      }
    }

    // Notify delivery riders via Socket.io
    const io = req.app.get('io');
    io.emit('newOrder', {
      id: createdOrder._id,
      restaurant: 'SRM Kitchen', // Simplified for now
      drop: createdOrder.hostelGateDelivery ? 'Hostel Gate' : 'Room Delivery',
      earnings: `₹${Math.round(createdOrder.finalPrice * 0.1)}` // Simulated commission
    });

    res.status(201).json(createdOrder);

    // Alert Admin via Push Notification
    try {
      const admins = await User.find({ role: 'admin' });
      let adminTokens = [];
      admins.forEach(admin => {
        if (admin.fcmTokens) adminTokens.push(...admin.fcmTokens);
      });

      if (adminTokens.length > 0) {
        await sendPushToTokens(
          adminTokens,
          'New Order Placed!',
          `Order ${createdOrder._id.toString().slice(-4)} has been placed for ${createdOrder.hostelGateDelivery ? 'Hostel Gate' : 'Room Delivery'}.`,
          { orderId: createdOrder._id.toString(), type: 'NEW_ORDER' }
        );
      }
    } catch (pushErr) {
      console.error('Failed to send push notification to admin', pushErr);
    }

  } catch (error) {
    console.error('Order Creation Error:', error);
    res.status(400).json({ message: 'Invalid order data', error: error.message });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
const getOrderById = async (req, res) => {
  try {
    if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
      return res.json({
        _id: req.params.id,
        items: [{ name: 'Test Item Local', quantity: 1, price: 100 }],
        totalPrice: 100,
        status: 'Accepted',
        restaurantId: { name: 'SRM Local Test Kitchen' }
      });
    }

    const order = await Order.findById(req.params.id).populate('restaurantId', 'name');
    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get loggd in user orders
// @route   GET /api/orders/myorders
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).sort('-createdAt');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { createOrder, getOrderById, getMyOrders };
