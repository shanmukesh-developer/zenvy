// /api/campus/tasks — Friends tasks sub-tab. PHASE STUB: every request answers 403 FEATURE_OFF
// (or VERIFICATION_REQUIRED / FRIENDS_SANCTIONED first) until the tasks phase replaces this file.
// The shipping phase must call featureFlags.markImplemented('tasks') at the top of its router.
const express = require('express');
const { protect } = require('../../../middleware/authMiddleware');
const { requireFriends } = require('../services/eligibility');

const router = express.Router();
router.use(protect, requireFriends('tasks'));
// Unreachable while the phase is unimplemented (requireFriends answers FEATURE_OFF), kept as a guard.
router.use((req, res) => res.status(403).json({ message: 'This part of Friends is not available yet.', code: 'FEATURE_OFF', feature: 'tasks' }));

module.exports = router;
