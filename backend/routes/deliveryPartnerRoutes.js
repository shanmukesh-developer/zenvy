const express = require('express');
const { registerPartner, authPartner, acceptOrder, getPendingOrders, updateOrderStatus, toggleOnline, getOrderHistory, saveFcmToken } = require('../controllers/deliveryPartnerController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/register', registerPartner);
router.post('/login', authPartner);
router.post('/fcm-token', protect, saveFcmToken);
router.get('/orders/pending', protect, getPendingOrders);
router.get('/orders/history', protect, getOrderHistory);
router.put('/accept/:orderId', protect, acceptOrder);
router.put('/status/:orderId', protect, updateOrderStatus);
router.put('/online', protect, toggleOnline);

module.exports = router;
