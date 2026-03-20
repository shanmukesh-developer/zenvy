const express = require('express');
const router = express.Router();
const { 
  getAllRestaurants, 
  createRestaurant, 
  updateRestaurant, 
  getAllMenuItems, 
  upsertMenuItem,
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
  getAuditLogs
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');

// Middleware to ensure the user is an admin
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Administrative access required' });
  }
};

// ─── Protected Admin Routes ──────────────────────────────────
router.use(protect);
router.use(adminOnly);

// Restaurant & Menu Control
router.get('/restaurants', getAllRestaurants);
router.post('/restaurants', createRestaurant);
router.post('/restaurants/:id', updateRestaurant);
router.get('/menu-items', getAllMenuItems);
router.post('/menu-items/:id', upsertMenuItem); // id can be 'new'

// Fleet Management
router.get('/riders', getAllRiders);
router.put('/riders/:id/approve', approveRider);

// User Management
router.get('/users', getAllUsers);
router.put('/users/:userId/elite', setEliteStatus);

// Global Configuration
router.get('/config', getGlobalConfig);
router.post('/config', updateGlobalConfig);

// Zenvy Vault Control
router.get('/vault', getVaultItems);
router.post('/vault/:id', upsertVaultItem); // id can be 'new'
router.delete('/vault/:id', deleteVaultItem);

// Database Seeding Engine
router.post('/seed', seedDatabase);

// Nexus Intelligence
router.get('/stats', getDashboardStats);
router.get('/finance', getFinanceReport);
router.get('/audit', getAuditLogs);

module.exports = router;
