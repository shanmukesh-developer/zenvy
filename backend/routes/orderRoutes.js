const express = require('express');
const { createOrder, getOrderById, getMyOrders, rateOrder, cancelOrder, getAllOrders } = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/', protect, createOrder);
router.get('/', protect, getAllOrders);
router.get('/myorders', protect, getMyOrders);
router.get('/:id', protect, getOrderById);
router.put('/:id/rate', protect, rateOrder);
router.put('/:id/cancel', protect, cancelOrder);

module.exports = router;
