const express = require('express');
const { registerUser, authUser, saveFcmToken, getUserProfile, updateUserProfile, logoutUser } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// ── Strict Auth Shield (Scaled for 500-1000 campus users on shared Wi-Fi) ──────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 auth attempts per IP per 15 min — prevents brute force while accommodating shared campus WiFi
  skip: (req, res) => process.env.NODE_ENV !== 'production' && process.env.RENDER !== 'true',
  message: { message: 'Too many authentication attempts, please try again after 15 minutes.' }
});

const { accountLockout } = require('../middleware/lockoutMiddleware');

const { body, validationResult } = require('express-validator');

// Validation Error Handler
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: errors.array()[0].msg,
      errors: errors.array() 
    });
  }
  next();
};

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').escape(),
  body('email').optional().isEmail().withMessage('Invalid email').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').notEmpty().withMessage('Phone is required').trim().escape(),
  body('role').optional().isIn(['student', 'admin', 'restaurant', 'delivery']).withMessage('Invalid role'),
  body('referralCode').optional().trim().escape()
];

const loginValidation = [
  body('phone').notEmpty().withMessage('Phone is required').trim().escape(),
  body('password').optional() // password might be optional if using firebaseToken
];

router.post('/register', authLimiter, registerValidation, validate, registerUser);
router.post('/login', authLimiter, accountLockout, loginValidation, validate, authUser);
router.post('/send-otp', authLimiter, require('../controllers/userController').sendOtp);
router.post('/verify-otp', authLimiter, require('../controllers/userController').verifyOtp);
router.post('/google-login', authLimiter, require('../controllers/userController').googleLogin);
router.post('/reset-password', authLimiter, require('../controllers/userController').resetPassword);
router.post('/logout', logoutUser);
router.post('/fcm-token', protect, saveFcmToken);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);

// Public Asset Discovery
router.get('/config', require('../controllers/adminController').getGlobalConfig);
router.get('/restaurants', require('../controllers/adminController').getRestaurants);
router.get('/restaurants/:id', require('../controllers/adminController').getRestaurantById);
router.get('/search', require('../controllers/searchController').globalSearch);

// ── BUG FIX: GET /products (all items) ──
// Returns all menu items across all restaurants for the catalog browse
// IMPORTANT: Must be registered BEFORE /products/:id to prevent route shadowing
router.get('/products', async (req, res) => {
  try {
    const { getMenuItemModel } = require('../models/MenuItem');
    const MenuItem = getMenuItemModel();
    const items = await MenuItem.findAll({ where: { isAvailable: true }, order: [['createdAt', 'DESC']] });
    res.json(items);
  } catch (_err) {
    res.status(500).json({ message: 'Failed to fetch products', error: _err.message });
  }
});

// ── GENUINE PRODUCT REVIEWS & RATINGS (Direct from Customer Orders) ──
router.get('/products/:id/reviews', async (req, res) => {
  try {
    const rawId = req.params.id.trim();
    const cleanSlug = rawId.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const { getProductReviewModel } = require('../models/ProductReview');
    const { getOrderModel } = require('../models/Order');
    const { Op } = require('sequelize');
    const ProductReview = getProductReviewModel();
    const Order = getOrderModel();

    let allReviews = [];

    // 1. Fetch from ProductReview table
    if (ProductReview) {
      const dbReviews = await ProductReview.findAll({
        where: {
          [Op.or]: [
            { productId: rawId },
            { productId: cleanSlug },
            { productName: { [Op.like]: `%${rawId.replace(/[-_]/g, ' ')}%` } }
          ]
        },
        order: [['createdAt', 'DESC']],
        limit: 50
      });

      allReviews = dbReviews.map(r => ({
        id: r.id,
        name: r.userName || 'Verified Buyer',
        block: r.userBlock || 'Campus Resident',
        rating: r.rating || 5,
        time: new Date(r.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        comment: r.comment || '',
        verified: r.verified !== false,
        helpfulCount: r.helpfulCount || 1,
        tags: r.tags || []
      }));
    }

    // 2. Also check completed orders for this item
    if (Order) {
      const ordersWithReviews = await Order.findAll({
        where: {
          review: { [Op.not]: null },
          status: 'Delivered'
        },
        order: [['createdAt', 'DESC']],
        limit: 30
      });

      for (const ord of ordersWithReviews) {
        let items = [];
        try {
          items = typeof ord.items === 'string' ? JSON.parse(ord.items) : (Array.isArray(ord.items) ? ord.items : []);
        } catch {
          items = [];
        }
        const matchingItem = items.find(it => 
          (it.menuItemId && (it.menuItemId === rawId || it.menuItemId === cleanSlug)) ||
          (it.id && (it.id === rawId || it.id === cleanSlug)) ||
          (it.name && it.name.toLowerCase().includes(rawId.replace(/[-_]/g, ' ').toLowerCase()))
        );

        if (matchingItem && ord.review && !allReviews.some(r => r.id === 'ord-rev-' + ord.id)) {
          allReviews.push({
            id: 'ord-rev-' + ord.id,
            name: 'Campus Verified Buyer',
            block: ord.deliveryAddress ? ord.deliveryAddress.split(',')[0].trim() : 'Campus Resident',
            rating: ord.rating || 5,
            time: new Date(ord.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
            comment: ord.review,
            verified: true,
            helpfulCount: 2
          });
        }
      }
    }

    // Calculate genuine mathematical average and star distribution
    const count = allReviews.length;
    let avg = 0;
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    if (count > 0) {
      let sum = 0;
      allReviews.forEach(r => {
        const star = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
        dist[star] = (dist[star] || 0) + 1;
        sum += (r.rating || 5);
      });
      avg = parseFloat((sum / count).toFixed(1));
    }

    res.json({
      success: true,
      productId: rawId,
      totalCount: count,
      averageRating: avg,
      distribution: dist,
      reviews: allReviews
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch reviews', error: err.message });
  }
});

// Post a genuine review directly for a product
router.post('/products/:id/reviews', protect, async (req, res) => {
  try {
    const rawId = req.params.id.trim();
    const { rating, comment, tags } = req.body;
    const { getProductReviewModel } = require('../models/ProductReview');
    const { getUserModel } = require('../models/User');
    const ProductReview = getProductReviewModel();
    const User = getUserModel();

    const user = await User.findByPk(req.user.id);
    const starRating = Math.min(5, Math.max(1, Number(rating) || 5));

    const newReview = await ProductReview.create({
      productId: rawId,
      productName: req.body.productName || 'Campus Dish',
      userId: req.user.id,
      userName: user?.name || req.user.name || 'Verified Student',
      userBlock: user?.hostelBlock || 'Campus Resident',
      rating: starRating,
      comment: comment || '',
      tags: Array.isArray(tags) ? tags : [],
      verified: true,
      helpfulCount: 0
    });

    res.json({
      success: true,
      message: 'Genuine customer review published successfully!',
      review: newReview
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit review', error: err.message });
  }
});

router.get('/products/:id', require('../controllers/adminController').getMenuItemById);

// ── BUG FIX: GET /orders (customer's own orders) ──
router.get('/orders', protect, async (req, res) => {
  try {
    const { getOrderModel } = require('../models/Order');
    const Order = getOrderModel();
    const orders = await Order.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']] });
    res.json(orders);
  } catch (_err) {
    res.status(500).json({ message: 'Failed to fetch orders', error: _err.message });
  }
});

// ── BUG FIX: GET /rewards (spin + leaderboard) ──
router.get('/rewards', protect, async (req, res) => {
  try {
    const { getUserModel } = require('../models/User');
    const User = getUserModel();
    const user = await User.findByPk(req.user.id, { attributes: ['id', 'name', 'zenPoints', 'completedOrders', 'streakCount', 'badges', 'spinsUsed'] });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const spinsEarned = Math.floor((user.completedOrders || 0) / 2);
    const spinsAvailable = Math.max(0, spinsEarned - (user.spinsUsed || 0));

    res.json({
      zenPoints: user.zenPoints || 0,
      completedOrders: user.completedOrders || 0,
      streakCount: user.streakCount || 0,
      badges: user.badges || [],
      spinEligible: spinsAvailable > 0
    });
  } catch (_err) {
    res.status(500).json({ message: 'Failed to fetch rewards', error: _err.message });
  }
});

module.exports = router;
