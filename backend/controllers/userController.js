const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Register a new user
// @route   POST /api/users/register
const registerUser = async (req, res) => {
  const { name, phone, password, hostelBlock, roomNumber } = req.body;

  const userExists = await User.findOne({ phone });

  if (userExists) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const user = await User.create({
    name,
    phone,
    password,
    hostelBlock,
    roomNumber
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      token: generateToken(user._id)
    });
  } else {
    res.status(400).json({ message: 'Invalid user data' });
  }
};

// @desc    Auth user & get token
// @route   POST /api/users/login
const authUser = async (req, res) => {
  const { phone, password } = req.body;

  const user = await User.findOne({ phone });

  if (user && (await user.comparePassword(password))) {
    res.json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      token: generateToken(user._id)
    });
  } else {
    res.status(401).json({ message: 'Invalid phone or password' });
  }
};

module.exports = { registerUser, authUser };
