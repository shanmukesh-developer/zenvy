const { getUserModel } = require('../models/User');
const jwt = require('jsonwebtoken');
const admin = require('../config/firebase');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
};

// @desc    Register a new user (requires Firebase phone verification)
// @route   POST /api/users/register
const registerUser = async (req, res) => {
  const { name, phone, password, hostelBlock, roomNumber, firebaseToken } = req.body;

  // ── 1. Require Firebase ID token ──────────────────────────────────────
  if (!firebaseToken) {
    return res.status(401).json({ message: 'Phone verification is required to create an account.' });
  }

  try {
    // ── 2. Verify the token with Firebase Admin ───────────────────────────
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    } catch (tokenErr) {
      console.error('[FIREBASE_TOKEN_ERROR]', tokenErr.message);
      return res.status(401).json({ message: 'Phone verification failed. Please try again.' });
    }

    // ── 3. Confirm the verified phone matches the submitted phone ─────────
    const verifiedPhone = decodedToken.phone_number; // e.g. "+919876543210"
    const submittedPhone = `+91${phone.replace(/\D/g, '')}`;
    if (verifiedPhone !== submittedPhone) {
      console.warn(`[REGISTER_PHONE_MISMATCH] token: ${verifiedPhone}, submitted: ${submittedPhone}`);
      return res.status(401).json({ message: 'Phone number mismatch. Please verify the correct number.' });
    }

    // ── 4. Create the user ────────────────────────────────────────────────
    const User = getUserModel();
    const userExists = await User.findOne({ where: { phone } });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const user = await User.create({ name, phone, password, hostelBlock, roomNumber });
    res.status(201).json({
      _id: user.id,
      name: user.name,
      phone: user.phone,
      isElite: false,
      address: user.address || '',
      city: user.city || 'Amaravathi',
      profileImage: user.profileImage || null,
      badges: user.badges || [],
      completedOrders: user.completedOrders || 0,
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
  const { phone, password, firebaseToken } = req.body;

  try {
    const User = getUserModel();
    let user;

    // ── 1. If firebaseToken is provided, use OTP Login flow ──────────────
    if (firebaseToken) {
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(firebaseToken);
      } catch (tokenErr) {
        console.error('[FIREBASE_LOGIN_TOKEN_ERROR]', tokenErr.message);
        return res.status(401).json({ message: 'Phone verification failed. Login denied.' });
      }

      const verifiedPhoneNumeric = decodedToken.phone_number.replace(/\D/g, '').slice(-10);
      user = await User.findOne({ where: { phone: verifiedPhoneNumeric } });

      if (!user) {
        return res.status(404).json({ message: 'Account not found. Please register first.' });
      }
    } 
    // ── 2. Otherwise, use traditional Password Login flow ───────────────
    else {
      user = await User.findOne({ where: { phone } });
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ message: 'Invalid phone or password' });
      }
    }

    // ── 3. Return user data and JWT token ────────────────────────────────
    res.json({
      _id: user.id,
      name: user.name,
      phone: user.phone,
      isElite: user.isElite || false,
      hostelBlock: user.hostelBlock,
      roomNumber: user.roomNumber,
      zenPoints: user.zenPoints || 0,
      address: user.address || '',
      city: user.city || 'Amaravathi',
      profileImage: user.profileImage || null,
      badges: user.badges || [],
      completedOrders: user.completedOrders || 0,
      token: generateToken(user.id, user.role)
    });
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
        isElite: user.isElite || false,
        address: user.address || '',
        city: user.city || 'Amaravathi',
        profileImage: user.profileImage || null,
        badges: user.badges || [],
        completedOrders: user.completedOrders || 0
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
      if (req.body.address) user.address = req.body.address;
      if (req.body.city) user.city = req.body.city;
      if (req.body.profileImage !== undefined) user.profileImage = req.body.profileImage;
      
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
        walletBalance: user.walletBalance || 0,
        streakCount: user.streakCount || 0,
        totalOrders: user.totalOrders || 0,
        zenPoints: user.zenPoints || 0,
        address: user.address || '',
        city: user.city || 'Amaravathi',
        profileImage: user.profileImage || null,
        badges: user.badges || [],
        completedOrders: user.completedOrders || 0,
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
