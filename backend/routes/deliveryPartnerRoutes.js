const express = require('express');
const { registerPartner, authPartner, acceptOrder, getPendingOrders, getActiveOrders, updateOrderStatus, toggleOnline, getOrderHistory, saveFcmToken, getLeaderboard, getRiderProfile, updateRiderProfile, getPublicRiderProfile, getTodayStats } = require('../controllers/deliveryPartnerController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/register', registerPartner);
router.post('/login', authPartner);
router.post('/fcm-token', protect, saveFcmToken);
router.get('/orders/pending', protect, getPendingOrders);
router.get('/orders/active', protect, getActiveOrders);
router.get('/orders/history', protect, getOrderHistory);
router.get('/leaderboard', protect, getLeaderboard);
router.get('/stats/today', protect, getTodayStats);
router.get('/profile', protect, getRiderProfile);
router.put('/profile', protect, updateRiderProfile);
router.get('/profile/:id/public', getPublicRiderProfile);   // No auth — customer tracking
router.put('/accept/:orderId', protect, acceptOrder);
router.put('/status/:orderId', protect, updateOrderStatus);
router.put('/online', protect, toggleOnline);

module.exports = router;
