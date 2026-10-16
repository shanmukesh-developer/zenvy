// /api/campus/spaces — Friends > Spaces (Phase 5, plain WebRTC). Contract: backend_contract.md "Friends (spaces)".
//
//  /admin/*  protect + admin (role read from the DB). Not behind the spaces flag, so admins can
//            monitor and force-end Spaces before and after launch.
//  the rest  protect + requireFriends('spaces') (verified, same campus, not sanctioned, flag on);
//            every change also needs the current guidelines (428 GUIDELINES_REQUIRED).
// The live room (join, roles, hands, mute, remove, signaling) is on the /campus socket: socket/spaces.js.
// There is no recording route: Spaces are never recorded.
const express = require('express');
const { protect, admin } = require('../../../middleware/authMiddleware');
const { requireFriends } = require('../services/eligibility');
const flags = require('../services/featureFlags');
const { wrap } = require('../services/http');
const c = require('../controllers/spacesController');

// The spaces phase has shipped: the sub-tab is on once an admin turns the 'spaces' flag on
// (featureFlags DEFAULTS keep it OFF until the owner approves the launch).
flags.markImplemented('spaces');
// Reminders, expiry and abandoned rooms are scheduled by jobs/index.js (started from server.js, not on
// require). Still a no-op under NODE_ENV=test / FRIENDS_SPACE_JOBS=off.

const router = express.Router();
const w = (fn) => wrap(fn, 'FRIENDS_SPACES');

// ── Admin ────────────────────────────────────────────────────────────────────
const adminRouter = express.Router();
adminRouter.use(protect, admin);
adminRouter.get('/spaces', w(c.adminList));
adminRouter.get('/spaces/:id', w(c.adminGet));
adminRouter.post('/spaces/:id/end', w(c.adminEnd));
adminRouter.get('/stats', w(c.adminStats));
adminRouter.post('/jobs/run', w(c.adminRunJobs));
router.use('/admin', adminRouter);

// ── Students ─────────────────────────────────────────────────────────────────
const write = requireFriends('spaces', { write: true });
router.use(protect, requireFriends('spaces'));

router.get('/', w(c.list));
router.get('/meta', w(c.meta));
router.post('/', write, w(c.createSpace));

router.get('/:id', w(c.getSpace));
router.patch('/:id', write, w(c.updateSpace));
router.post('/:id/start', write, w(c.startSpace));
router.post('/:id/cancel', write, w(c.cancelSpace));
router.post('/:id/end', write, w(c.endSpace));
router.post('/:id/remind', write, w(c.remind));
router.delete('/:id/remind', w(c.unremind));

router.use((req, res) => res.status(404).json({ message: 'Not found.', code: 'NOT_FOUND' }));

module.exports = router;
