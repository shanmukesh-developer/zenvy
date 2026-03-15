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

// @desc    Save Firebase Cloud Messaging Device Token
// @route   POST /api/users/fcm-token
const saveFcmToken = async (req, res) => {
  const { userId, fcmToken, appVersion } = req.body;

  try {
    const user = await User.findById(userId);
    if (user) {
      if (!user.fcmTokens) user.fcmTokens = [];
      
      // Update or add the new token ensuring duplicates aren't saved
      const existingTokenIndex = user.fcmTokens.findIndex(t => t.appVersion === appVersion);
      if (existingTokenIndex > -1) {
        user.fcmTokens[existingTokenIndex].token = fcmToken;
      } else {
        user.fcmTokens.push({ token: fcmToken, appVersion });
      }

      await user.save();
      res.json({ message: 'FCM Token saved successfully' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to save token' });
  }
};

module.exports = { registerUser, authUser, saveFcmToken };
