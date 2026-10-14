// /api/campus/pulse — Friends > Pulse (Phase 2). Contract: backend_contract.md "Friends (pulse)".
// Mounted in campusRoutes AFTER the older campus routes (/pulse/today, /question, /whispers,
// /branch-wars, /counts), which keep answering first.
//
//  /admin/*  protect + admin (role read from the DB). Not behind the pulse flag, so admins can review
//            content and run the whisper import before the flag goes on.
//  the rest  protect + requireFriends('pulse') (verified, same campus, not sanctioned, flag on);
//            writes also need the current guidelines (428 GUIDELINES_REQUIRED).
const express = require('express');
const { protect, admin } = require('../../../middleware/authMiddleware');
const { requireFriends } = require('../services/eligibility');
const flags = require('../services/featureFlags');
const { wrap } = require('../services/http');
const c = require('../controllers/pulseController');

// The pulse phase has shipped: the sub-tab is on once an admin turns the 'pulse' flag on
// (featureFlags DEFAULTS keep it OFF until the owner approves the launch).
flags.markImplemented('pulse');

const router = express.Router();
const w = (fn) => wrap(fn, 'FRIENDS_PULSE');

// ── Admin ────────────────────────────────────────────────────────────────────
const adminRouter = express.Router();
adminRouter.use(protect, admin);
adminRouter.get('/posts', w(c.adminListPosts));
adminRouter.post('/posts/:id/:action', w(c.adminModPost));
adminRouter.get('/trends', w(c.adminTrends));
adminRouter.get('/stats', w(c.adminStats));
adminRouter.post('/backfill-whispers', w(c.adminBackfill));
router.use('/admin', adminRouter);

// ── Students ─────────────────────────────────────────────────────────────────
const write = requireFriends('pulse', { write: true });
router.use(protect, requireFriends('pulse'));

router.get('/feed', w(c.feed));
router.get('/trends', w(c.getTrends));
router.get('/hashtags/:tag', w(c.hashtagFeed));
router.get('/users/:id/posts', w(c.userPosts));
router.get('/mine', w(c.myPosts));
router.get('/entities/mine', w(c.myEntities));
router.get('/bookmarks', w(c.listBookmarks));

router.post('/posts', write, w(c.createPost));
router.get('/posts/:id', w(c.getPost));
router.patch('/posts/:id', write, w(c.updatePost));
router.delete('/posts/:id', w(c.deletePost));
router.get('/posts/:id/replies', w(c.listReplies));

router.post('/posts/:id/like', write, w(c.like));
router.delete('/posts/:id/like', w(c.unlike));
router.post('/posts/:id/repost', write, w(c.repost));
router.delete('/posts/:id/repost', w(c.unrepost));
router.post('/posts/:id/bookmark', write, w(c.bookmark));
router.delete('/posts/:id/bookmark', w(c.unbookmark));

router.post('/polls/:id/vote', write, w(c.votePoll));

router.use((req, res) => res.status(404).json({ message: 'Not found.', code: 'NOT_FOUND' }));

module.exports = router;
