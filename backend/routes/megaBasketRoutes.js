const express = require('express');
const { protect, approvedRider, admin } = require('../middleware/authMiddleware');
const {
  createBasket,
  payBasket,
  getBasket,
  getCustomerBaskets,
  getPendingBaskets,
  claimBasket,
  startShopping,
  updateItemStatus,
  submitBill,
  approvePrices,
  purchaseCompleted,
  startDelivery,
  completeDelivery,
  getActiveBaskets,
  getAllBaskets,
  cancelBasket,
  getBasketFees
} = require('../controllers/megaBasketController');
const { cacheGet } = require('../utils/responseCache');

const router = express.Router();

// Non-UUID ids answer 404 instead of a PostgreSQL "invalid input syntax for type uuid" 500
// (SQLite never complained, so this only showed up in production).
const UUID_PARAM_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.param('id', (req, res, next, id) => (UUID_PARAM_RE.test(String(id || '')) ? next() : res.status(404).json({ message: 'Basket not found', code: 'NOT_FOUND' })));

// Admin Endpoints
router.get('/admin/all', protect, admin, getAllBaskets);

// Public: current fees (the app shows them before a basket exists). Before '/:id'.
router.get('/fees', cacheGet('megaBasketFees', { ttlMs: 5 * 60 * 1000 }), getBasketFees);

// Customer Endpoints
router.post('/', protect, createBasket);
router.get('/', protect, getCustomerBaskets);
router.get('/:id', protect, getBasket);
router.post('/:id/pay', protect, payBasket);
router.post('/:id/approve', protect, approvePrices);
router.put('/:id/cancel', protect, cancelBasket); // owner before shopping starts, admin any time before delivery

// Rider Endpoints
router.get('/rider/pending', protect, approvedRider, getPendingBaskets);
router.get('/rider/active', protect, approvedRider, getActiveBaskets);
router.post('/:id/claim', protect, approvedRider, claimBasket);
router.post('/:id/start-shopping', protect, approvedRider, startShopping);
router.put('/:id/item-status', protect, approvedRider, updateItemStatus);
router.post('/:id/submit-bill', protect, approvedRider, submitBill);
router.post('/:id/purchase-completed', protect, approvedRider, purchaseCompleted);
router.post('/:id/start-delivery', protect, approvedRider, startDelivery);
router.post('/:id/complete-delivery', protect, approvedRider, completeDelivery);

module.exports = router;
