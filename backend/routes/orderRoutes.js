const express = require('express');
const { createOrder, getOrderById, getMyOrders } = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/', protect, createOrder);
router.get('/myorders', protect, getMyOrders);
router.get('/:id', protect, getOrderById);

module.exports = router;
