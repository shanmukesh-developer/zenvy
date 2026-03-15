const Order = require('../models/Order');
const User = require('../models/User');

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

    const createdOrder = await order.save();

    // Notify delivery riders via Socket.io
    const io = req.app.get('io');
    io.emit('newOrder', {
      id: createdOrder._id,
      restaurant: 'SRM Kitchen', // Simplified for now
      drop: createdOrder.hostelGateDelivery ? 'Hostel Gate' : 'Room Delivery',
      earnings: `₹${Math.round(createdOrder.finalPrice * 0.1)}` // Simulated commission
    });

    // Update streak and user stats
    const { updateStreak } = require('../middleware/rewardEngine');
    await updateStreak(req.user.id);
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { totalOrders: 1 }
    });

    res.status(201).json(createdOrder);
  } catch (error) {
    res.status(400).json({ message: 'Invalid order data' });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
const getOrderById = async (req, res) => {
  try {
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
