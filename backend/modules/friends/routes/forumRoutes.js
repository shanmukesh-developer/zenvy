// /api/campus/forum — Friends > Forum (Phase 1). Contract: backend_contract.md "Friends (forum)".
//
//  /admin/*  protect + admin (role read from the DB). Not behind the forum flag, so admins can set up
//            communities, moderators, review targets and Freshers Guides before the flag goes on.
//  the rest  protect + requireFriends('forum') (verified, same campus, not sanctioned, flag on);
//            writes also need the current guidelines (428 GUIDELINES_REQUIRED).
const express = require('express');
const { protect, admin } = require('../../../middleware/authMiddleware');
const { requireFriends } = require('../services/eligibility');
const flags = require('../services/featureFlags');
const { wrap } = require('../services/http');
const c = require('../controllers/forumController');

// The forum phase has shipped: the sub-tab is on once an admin turns the 'forum' flag on.
flags.markImplemented('forum');

const router = express.Router();
const w = (fn) => wrap(fn, 'FRIENDS_FORUM');

// ── Admin ────────────────────────────────────────────────────────────────────
const adminRouter = express.Router();
adminRouter.use(protect, admin);
adminRouter.get('/communities', w(c.adminListCommunities));
adminRouter.post('/communities', w(c.adminCreateCommunity));
adminRouter.put('/communities/:id', w(c.adminUpdateCommunity));
adminRouter.post('/communities/:id/moderators', w(c.adminAddModerator));
adminRouter.delete('/communities/:id/moderators/:userId', w(c.adminRemoveModerator));
adminRouter.get('/communities/:id/modlog', w(c.adminModLog));
adminRouter.put('/communities/:id/freshers-guide', w(c.adminUpsertGuide));
adminRouter.get('/freshers-guides', w(c.adminListGuides));
adminRouter.post('/seed', w(c.adminSeed));
adminRouter.get('/review-targets', w(c.adminListTargets));
adminRouter.post('/review-targets', w(c.adminCreateTarget));
adminRouter.put('/review-targets/:id', w(c.adminUpdateTarget));
adminRouter.post('/review-targets/:id/approve', w(c.adminApproveTarget));
adminRouter.post('/review-targets/:id/reject', w(c.adminRejectTarget));
adminRouter.get('/reviews', w(c.adminListReviews));
adminRouter.post('/reviews/:id/response', w(c.adminCreateResponse));
adminRouter.post('/posts/:id/:action', w(c.adminModPost));
adminRouter.post('/comments/:id/:action', w(c.adminModComment));
router.use('/admin', adminRouter);

// ── Students ─────────────────────────────────────────────────────────────────
const read = requireFriends('forum');
const write = requireFriends('forum', { write: true });
router.use(protect, read);

router.get('/communities', w(c.listCommunities));
router.post('/communities', write, w(c.requestCommunity));
router.get('/communities/:id', w(c.getCommunity));
router.put('/communities/:id', write, w(c.updateCommunity));
router.post('/communities/:id/join', write, w(c.joinCommunity));
router.post('/communities/:id/leave', w(c.leaveCommunity));
router.get('/communities/:id/posts', w(c.listPosts));
router.post('/communities/:id/posts', write, w(c.createPost));
router.get('/communities/:id/modlog', w(c.modLog));

router.get('/search', w(c.search));
router.get('/mine', w(c.myPosts));
router.get('/bookmarks', w(c.listBookmarks));

router.get('/posts/:id', w(c.getPost));
router.patch('/posts/:id', write, w(c.updatePost));
router.delete('/posts/:id', w(c.deletePost));
router.post('/posts/:id/bookmark', write, w(c.bookmark));
router.delete('/posts/:id/bookmark', w(c.unbookmark));
router.get('/posts/:id/comments', w(c.listComments));
router.post('/posts/:id/comments', write, w(c.createComment));
router.post('/posts/:id/best-answer', write, w(c.setBestAnswer));
router.delete('/posts/:id/best-answer', write, w(c.clearBestAnswer));

router.patch('/comments/:id', write, w(c.updateComment));
router.delete('/comments/:id', w(c.deleteComment));

router.put('/vote', write, w(c.vote));

router.get('/review-targets', w(c.listReviewTargets));
router.post('/review-targets', write, w(c.requestReviewTarget));
router.get('/review-targets/:id', w(c.getReviewTarget));
router.patch('/reviews/:id', write, w(c.updateReview));
router.delete('/reviews/:id', w(c.deleteReview));
router.post('/reviews/:id/response', write, w(c.createResponse));
router.patch('/reviews/:id/response', write, w(c.updateResponse));
router.delete('/reviews/:id/response', w(c.deleteResponse));

// Community moderators (scoped to their communities; every action audited).
router.get('/mod/reports', w(c.modReports));
router.post('/mod/reports/:id/dismiss', write, w(c.modDismiss));
router.post('/mod/posts/:id/:action', write, w(c.modPost));
router.post('/mod/comments/:id/:action', write, w(c.modComment));

router.use((req, res) => res.status(404).json({ message: 'Not found.', code: 'NOT_FOUND' }));

module.exports = router;
