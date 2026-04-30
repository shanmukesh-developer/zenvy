const express = require('express');
const { createOrder, getOrderById, getMyOrders, rateOrder, cancelOrder, getAllOrders, updateOrderStatus, getSurgeStatus, restaurantAcceptOrder, verifyUPIPayment, restaurantReadyOrder } = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/', protect, createOrder);
router.get('/', protect, admin, getAllOrders);
router.get('/myorders', protect, getMyOrders);
router.get('/surge-status', getSurgeStatus);
router.get('/:id', protect, getOrderById);
router.put('/:id/rate', protect, rateOrder);
router.put('/:id/cancel', protect, cancelOrder);
router.put('/:id/status', protect, admin, updateOrderStatus);
router.put('/:id/restaurant-accept', restaurantAcceptOrder);
router.put('/:id/restaurant-ready', restaurantReadyOrder);
router.put('/:id/verify-upi', protect, admin, verifyUPIPayment);

module.exports = router;
