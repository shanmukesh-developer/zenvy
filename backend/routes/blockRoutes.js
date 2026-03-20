const express = require('express');
const router = express.Router();
const { getBlockActivity } = require('../controllers/blockController');
const { protect } = require('../middleware/authMiddleware');

router.get('/activity', protect, getBlockActivity);

module.exports = router;
