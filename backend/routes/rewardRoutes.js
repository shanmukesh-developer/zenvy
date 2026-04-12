const express = require('express');
const router = express.Router();
const { checkSpinEntry, useSpin, getLeaderboard, getUserCoupons } = require('../controllers/rewardController');
const { protect } = require('../middleware/authMiddleware');

router.get('/spin-eligibility', protect, checkSpinEntry);
router.post('/use-spin', protect, useSpin);
router.get('/coupons', protect, getUserCoupons);
router.get('/leaderboard', getLeaderboard); // Publicly accessible

module.exports = router;
