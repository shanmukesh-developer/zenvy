// /api/campus/friends — Friends foundation (Phase 0). Mounted from modules/campus/campusRoutes.js.
const express = require('express');
const { protect } = require('../../../middleware/authMiddleware');
const { requireFriends } = require('../services/eligibility');
const { wrap } = require('../services/http');
const c = require('../controllers/friendsController');

const router = express.Router();
const w = (fn) => wrap(fn, 'FRIENDS');

// Always available to a signed-in user (the app decides what to show from it).
router.get('/eligibility', protect, w(c.getEligibility));
router.get('/guidelines', protect, w(c.getGuidelines));

// Verified campus members (no guideline acceptance needed to read or to accept).
const member = requireFriends(null);
const writer = requireFriends(null, { write: true });
// Safety tools stay open to unverified and sanctioned accounts (report, appeal, see decisions).
const anyAccount = requireFriends(null, { minimal: true });

router.post('/guidelines/accept', protect, member, w(c.acceptGuidelines));
router.get('/settings', protect, member, w(c.getSettings));
router.put('/settings', protect, member, w(c.updateSettings));
router.get('/users/:id', protect, member, w(c.getUserCard));

router.post('/follow', protect, writer, w(c.follow));
router.delete('/follow', protect, member, w(c.unfollow));
router.get('/following', protect, member, w(c.listFollowing));

router.post('/mute', protect, member, w(c.mute));
router.delete('/mute', protect, member, w(c.unmute));
router.get('/mutes', protect, member, w(c.listMutes));

router.post('/reports', protect, anyAccount, w(c.createReport));
router.get('/reports/mine', protect, anyAccount, w(c.myReports));
router.post('/appeals', protect, anyAccount, w(c.createAppeal));
router.get('/appeals/mine', protect, anyAccount, w(c.myAppeals));
router.get('/moderation/mine', protect, anyAccount, w(c.myModeration));

module.exports = router;
