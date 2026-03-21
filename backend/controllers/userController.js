const { getUserModel } = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
};

// @desc    Register a new user
// @route   POST /api/users/register
const registerUser = async (req, res) => {
  const { name, phone, password, hostelBlock, roomNumber } = req.body;

  try {
    const User = getUserModel();
    const userExists = await User.findOne({ where: { phone } });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const user = await User.create({ name, phone, password, hostelBlock, roomNumber });
    res.status(201).json({
      _id: user.id,
      name: user.name,
      phone: user.phone,
      isElite: false,
      token: generateToken(user.id, user.role)
    });
  } catch (error) {
    console.error('[USER_REGISTER_ERROR]', error);
    res.status(500).json({ message: `Registration Failed: ${error.message}` });
  }
};

// @desc    Auth user & get token
// @route   POST /api/users/login
const authUser = async (req, res) => {
  const { phone, password } = req.body;

  try {
    const User = getUserModel();
    const user = await User.findOne({ where: { phone } });
    if (user && (await user.comparePassword(password))) {
      res.json({
        _id: user.id,
        name: user.name,
        phone: user.phone,
        isElite: user.isElite || false,
        hostelBlock: user.hostelBlock,
        roomNumber: user.roomNumber,
        zenPoints: user.zenPoints || 0,
        token: generateToken(user.id, user.role)
      });
    } else {
      res.status(401).json({ message: 'Invalid phone or password' });
    }
  } catch (error) {
    console.error('[AUTH_ERROR]', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Save FCM Token
// @route   POST /api/users/fcm-token
const saveFcmToken = async (req, res) => {
  const { userId, fcmToken, appVersion } = req.body;

  try {
    const User = getUserModel();
    const user = await User.findByPk(userId);
    if (user) {
      const tokens = user.fcmTokens || [];
      const idx = tokens.findIndex(t => t.appVersion === appVersion);
      if (idx > -1) { tokens[idx].token = fcmToken; } else { tokens.push({ token: fcmToken, appVersion }); }
      user.fcmTokens = tokens;
      await user.save();
      res.json({ message: 'FCM Token saved' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('[FCM_ERROR]', error);
    res.status(500).json({ message: 'Failed to save token' });
  }
};

// @desc    Get user profile
// @route   GET /api/users/profile
const getUserProfile = async (req, res) => {
  try {
    const User = getUserModel();
    const user = await User.findByPk(req.user.id);
    if (user) {
      res.json({
        _id: user.id,
        name: user.name,
        phone: user.phone,
        hostelBlock: user.hostelBlock,
        roomNumber: user.roomNumber,
        walletBalance: user.walletBalance,
        streakCount: user.streakCount,
        totalOrders: user.totalOrders,
        role: user.role,
        zenPoints: user.zenPoints || 0,
        isElite: user.isElite || false
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('[PROFILE_ERROR]', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
const updateUserProfile = async (req, res) => {
  try {
    const User = getUserModel();
    const user = await User.findByPk(req.user.id);
    if (user) {
      if (req.body.name) user.name = req.body.name;
      if (req.body.hostelBlock) user.hostelBlock = req.body.hostelBlock;
      if (req.body.roomNumber) user.roomNumber = req.body.roomNumber;
      
      // CRITICAL FIX: Removed insecure req.body.isElite assignment
      // Elite status must only be updated by a verified payment webhook or admin route.
      
      await user.save();
      res.json({
        _id: user.id,
        name: user.name,
        phone: user.phone,
        hostelBlock: user.hostelBlock,
        roomNumber: user.roomNumber,
        isElite: user.isElite,
        zenPoints: user.zenPoints,
        token: generateToken(user.id, user.role)
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('[UPDATE_PROFILE_ERROR]', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = { registerUser, authUser, saveFcmToken, getUserProfile, updateUserProfile };
