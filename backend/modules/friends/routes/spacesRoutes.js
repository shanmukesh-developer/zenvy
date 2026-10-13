// /api/campus/spaces — Friends spaces sub-tab. PHASE STUB: every request answers 403 FEATURE_OFF
// (or VERIFICATION_REQUIRED / FRIENDS_SANCTIONED first) until the spaces phase replaces this file.
// The shipping phase must call featureFlags.markImplemented('spaces') at the top of its router.
const express = require('express');
const { protect } = require('../../../middleware/authMiddleware');
const { requireFriends } = require('../services/eligibility');

const router = express.Router();
router.use(protect, requireFriends('spaces'));
// Unreachable while the phase is unimplemented (requireFriends answers FEATURE_OFF), kept as a guard.
router.use((req, res) => res.status(403).json({ message: 'This part of Friends is not available yet.', code: 'FEATURE_OFF', feature: 'spaces' }));

module.exports = router;
