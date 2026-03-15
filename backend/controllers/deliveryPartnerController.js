const DeliveryPartner = require('../models/DeliveryPartner');
const Order = require('../models/Order');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Register a new delivery partner
// @route   POST /api/delivery/register
const registerPartner = async (req, res) => {
  const { name, phone, password, vehicleType } = req.body;
  const partnerExists = await DeliveryPartner.findOne({ phone });

  if (partnerExists) {
    return res.status(400).json({ message: 'Partner already exists' });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  const partner = await DeliveryPartner.create({
    name,
    phone,
    password: hashedPassword,
    vehicleType
  });

  if (partner) {
    res.status(201).json({
      _id: partner._id,
      name: partner.name,
      token: generateToken(partner._id)
    });
  } else {
    res.status(400).json({ message: 'Invalid partner data' });
  }
};

// @desc    Auth partner & get token
// @route   POST /api/delivery/login
const authPartner = async (req, res) => {
  const { phone, password } = req.body;
  const partner = await DeliveryPartner.findOne({ phone });

  if (partner && (await bcrypt.compare(password, partner.password))) {
    res.json({
      _id: partner._id,
      name: partner.name,
      token: generateToken(partner._id)
    });
  } else {
    res.status(401).json({ message: 'Invalid phone or password' });
  }
};

// @desc    Accept an order
// @route   PUT /api/delivery/accept/:orderId
const acceptOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.status !== 'Pending') {
      return res.status(400).json({ message: 'Order already accepted by someone else' });
    }

    order.deliveryPartnerId = req.user.id;
    order.status = 'Accepted';
    await order.save();

    await DeliveryPartner.findByIdAndUpdate(req.user.id, {
      currentOrderId: order._id
    });

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { registerPartner, authPartner, acceptOrder };
