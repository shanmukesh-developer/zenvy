// /api/campus/tasks — Friends > Tasks (Phase 3). Contract: backend_contract.md "Friends (tasks)".
//
//  /admin/*  protect + admin (role read from the DB). Not behind the tasks flag, so admins can review
//            tasks, integrity refusals and disputes before the flag goes on.
//  the rest  protect + requireFriends('tasks') (verified, same campus, not sanctioned, flag on);
//            every change also needs the current guidelines (428 GUIDELINES_REQUIRED).
const express = require('express');
const { protect, admin } = require('../../../middleware/authMiddleware');
const { requireFriends } = require('../services/eligibility');
const flags = require('../services/featureFlags');
const { wrap } = require('../services/http');
const c = require('../controllers/tasksController');

// The tasks phase has shipped: the sub-tab is on once an admin turns the 'tasks' flag on
// (featureFlags DEFAULTS keep it OFF until the owner approves the launch).
flags.markImplemented('tasks');
// Expiry, 7-day auto-confirm (D4) and chat closing are scheduled by jobs/index.js (started from
// server.js, not on require). Still a no-op under NODE_ENV=test / FRIENDS_TASK_JOBS=off.

const router = express.Router();
const w = (fn) => wrap(fn, 'FRIENDS_TASKS');

// ── Admin ────────────────────────────────────────────────────────────────────
const adminRouter = express.Router();
adminRouter.use(protect, admin);
adminRouter.get('/tasks', w(c.adminList));
adminRouter.get('/tasks/:id', w(c.adminGet));
adminRouter.post('/tasks/:id/resolve-dispute', w(c.adminResolveDispute));
adminRouter.post('/tasks/:id/:action', w(c.adminModerate));
adminRouter.get('/stats', w(c.adminStats));
adminRouter.post('/jobs/run', w(c.adminRunJobs));
router.use('/admin', adminRouter);

// ── Students ─────────────────────────────────────────────────────────────────
const write = requireFriends('tasks', { write: true });
router.use(protect, requireFriends('tasks'));

router.get('/', w(c.board));
router.get('/meta', w(c.meta));
router.get('/mine', w(c.mine));
router.get('/users/:id/reputation', w(c.reputation));
router.post('/', write, w(c.createTask));

router.get('/:id', w(c.getTask));
router.patch('/:id', write, w(c.updateTask));

router.post('/:id/applications', write, w(c.apply));
router.delete('/:id/applications/mine', w(c.withdraw));
router.get('/:id/applications', w(c.listApplications));

router.post('/:id/select', write, w(c.select));
router.post('/:id/accept', write, w(c.accept));
router.post('/:id/decline', write, w(c.decline));
router.post('/:id/unselect', write, w(c.unselect));
router.post('/:id/submit', write, w(c.submit));
router.post('/:id/confirm', write, w(c.confirm));
router.post('/:id/reject-submission', write, w(c.rejectSubmission));
router.post('/:id/cancel', write, w(c.cancel));
router.post('/:id/dispute', write, w(c.dispute));

router.post('/:id/reviews', write, w(c.createReview));
router.get('/:id/reviews', w(c.listReviews));

router.use((req, res) => res.status(404).json({ message: 'Not found.', code: 'NOT_FOUND' }));

module.exports = router;
