const express = require('express');
const { registerUser, authUser, saveFcmToken, getUserProfile, updateUserProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/register', registerUser);
router.post('/login', authUser);
router.post('/fcm-token', saveFcmToken);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);

// Public Asset Discovery
router.get('/restaurants', require('../controllers/adminController').getRestaurants);
router.get('/restaurants/:id', require('../controllers/adminController').getRestaurantById);
router.get('/products/:id', require('../controllers/adminController').getMenuItemById);
router.get('/search', require('../controllers/searchController').globalSearch);

module.exports = router;
