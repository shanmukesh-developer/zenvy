const express = require('express');
const router = express.Router();
const { 
  getAllRestaurants, 
  createRestaurant, 
  updateRestaurant, 
  getAllMenuItems,
  upsertMenuItem,
  deleteMenuItem,
  deleteRestaurant,
  getAllRiders,
  approveRider,
  getAllUsers,
  setEliteStatus,
  updateGlobalConfig,
  getGlobalConfig,
  getVaultItems,
  upsertVaultItem,
  deleteVaultItem,
  seedDatabase,
  getDashboardStats,
  getFinanceReport,
  getAuditLogs,
  getRewardsAnalytics,
  getSystemHealth,
  getOrderVolumeStats,
  batchUpdateOrders,
  getAllCoupons,
  createCoupon,
  deleteCoupon,
  broadcastPushNotification,
  updateRider,
  resetRiderSos,
  updateUserWallet,
  getRestaurantPayouts,
  settleRestaurantPayout,
  settleRiderPayout,
  getDisputedOrders,
  processManualRefund,
  toggleUserBan,
  getRecentReviews,
  deleteReview,
  getRiderPayouts
} = require('../controllers/adminController');
const { getAllOrders } = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authMiddleware');

// ─── Unprotected routes ──────────────────────────────────
router.post('/broadcast-push', broadcastPushNotification);

// ─── Protected Admin Routes ──────────────────────────────────
router.use(protect);
router.use(admin);

// Live Orders Intelligence
router.get('/orders', getAllOrders);
router.get('/stats', getDashboardStats);
router.get('/stats/volume', getOrderVolumeStats);
router.put('/orders/batch-update', batchUpdateOrders);

// Restaurant & Menu Control
router.get('/restaurants', getAllRestaurants);
router.post('/restaurants', createRestaurant);
router.post('/restaurants/:id', updateRestaurant);
router.get('/menu-items', getAllMenuItems);
router.post('/menu-items/:id', upsertMenuItem); // id can be 'new'
router.delete('/menu-items/:id/delete', deleteMenuItem);
router.delete('/restaurants/:id', deleteRestaurant);

// Fleet Management
router.get('/riders', getAllRiders);
router.put('/riders/:id/approve', approveRider);
router.route('/riders/:id')
  .post(updateRider)
  .put(updateRider);
router.post('/riders/:id/reset-sos', resetRiderSos);
router.get('/fleet/payouts', getRiderPayouts);

// User Management
router.get('/users', getAllUsers);
router.put('/users/:userId/elite', setEliteStatus);
router.post('/users/:userId/wallet', updateUserWallet);
router.put('/users/:userId/ban', toggleUserBan);

// Coupon Management
router.get('/coupons', getAllCoupons);
router.post('/coupons', createCoupon);
router.delete('/coupons/:id', deleteCoupon);

// Global Configuration
router.get('/config', getGlobalConfig);
router.post('/config', updateGlobalConfig);

// Zenvy Vault Control
router.get('/vault', getVaultItems);
router.post('/vault/:id', upsertVaultItem); // id can be 'new'
router.delete('/vault/:id', deleteVaultItem);

// Database Seeding Engine
router.post('/seed', seedDatabase);

// Finance & Payouts
router.get('/finance', getFinanceReport);
router.get('/finance/payouts', getRestaurantPayouts);
router.post('/finance/settle-restaurant', settleRestaurantPayout);
router.post('/finance/settle-rider', settleRiderPayout);
router.get('/finance/disputes', getDisputedOrders);
router.post('/finance/refund/:orderId', processManualRefund);

// Reviews & Analytics
router.get('/reviews', getRecentReviews);
router.delete('/reviews/:orderId', deleteReview);
router.get('/audit', getAuditLogs);
router.get('/rewards-analytics', getRewardsAnalytics);
router.get('/health', getSystemHealth);

module.exports = router;
