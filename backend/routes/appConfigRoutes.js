const express = require('express');
const router = express.Router();
const appConfigController = require('../controllers/appConfigController');
const { protect, admin } = require('../middleware/authMiddleware');

// Get global app configuration (public, used by web & mobile)
// Short server cache + ETag; PUT below publishes 'config', which clears it (utils/realtime).
router.get('/', require('../utils/responseCache').cacheGet('config', { ttlMs: 60 * 1000 }), appConfigController.getConfig);

// Update global app configuration (admin only)
router.put('/', protect, admin, appConfigController.updateConfig);

module.exports = router;
