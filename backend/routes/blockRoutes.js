const express = require('express');
const router = express.Router();
const { getBlockActivity } = require('../controllers/blockController');
const { protect } = require('../middleware/authMiddleware');


// Signed-in only (B10): was public and did a full table scan per request.
router.get('/activity', protect, getBlockActivity);

module.exports = router;
