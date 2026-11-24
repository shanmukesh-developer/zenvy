const express = require('express');
const router = express.Router();
const { checkSpinEntry, useSpin, getLeaderboard, getUserCoupons, getCouponHistory, validateCoupon } = require('../controllers/rewardController');
const { protect } = require('../middleware/authMiddleware');

router.get('/spin-eligibility', protect, checkSpinEntry);
// App sections control (owner, 24 Nov 2026): no spins while DEALS_ENABLED is off (403 FEATURE_OFF). Coupons already won stay usable.
router.post('/use-spin', protect, require('../utils/featureSwitches').requireOn('deals'), useSpin);
router.post('/validate-coupon', protect, validateCoupon);
router.get('/coupons', protect, getUserCoupons);
router.get('/coupons/history', protect, getCouponHistory);
router.get('/leaderboard', getLeaderboard); // Publicly accessible

router.get('/', protect, async (req, res) => {
  // Return summarized rewards info for the user
  const { checkSpinEntry } = require('../controllers/rewardController');
  await checkSpinEntry(req, res);
});

module.exports = router;
