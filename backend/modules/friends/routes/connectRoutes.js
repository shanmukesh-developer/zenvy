// /api/campus/connect — Friends > Connect (Phase 4). Contract: backend_contract.md "Friends (connect)".
//
//  /liveness/webhook  no auth (provider signature checked by the liveness adapter; 503 until configured)
//  /admin/*           protect + admin (role read from the DB). Not behind the connect flag, so admins can
//                     review photos and selfie checks before launch. Every Connect read is audited.
//  /profile DELETE, /pause, /me/data
//                     protect + an active account only: deleting, pausing and seeing your own data must
//                     work even when the flag is off or you are sanctioned (DPDP).
//  the rest           protect + requireFriends('connect') (verified, same campus, not sanctioned, flag on);
//                     changes also need the current guidelines (428 GUIDELINES_REQUIRED). The controller
//                     adds the Connect gate (18+, consent, age declaration, liveness, active profile).
const express = require('express');
const { protect, admin } = require('../../../middleware/authMiddleware');
const { requireFriends } = require('../services/eligibility');
const flags = require('../services/featureFlags');
const { wrap } = require('../services/http');
const c = require('../controllers/connectController');
const deletion = require('../services/connectDeletion');

// The connect phase has shipped: the sub-tab is on once an admin turns the 'connect' flag on
// (featureFlags DEFAULTS keep it OFF until the owner approves the launch).
flags.markImplemented('connect');
// Retention purges (ended-match chats after 30 days, unreviewed selfies after 30 days).
// No-op under NODE_ENV=test / CONNECT_JOBS=off.
deletion.start();

const router = express.Router();
const w = (fn) => wrap(fn, 'FRIENDS_CONNECT');

router.post('/liveness/webhook', express.json({ limit: '256kb' }), w(c.livenessWebhook));

// ── Admin ────────────────────────────────────────────────────────────────────
const adminRouter = express.Router();
adminRouter.use(protect, admin);
adminRouter.get('/photos', w(c.adminListPhotos));
adminRouter.post('/photos/:id/approve', w(c.adminApprovePhoto));
adminRouter.post('/photos/:id/reject', w(c.adminRejectPhoto));
adminRouter.get('/liveness', w(c.adminListLiveness));
adminRouter.post('/liveness/:userId/pass', w(c.adminPassLiveness));
adminRouter.post('/liveness/:userId/fail', w(c.adminFailLiveness));
adminRouter.get('/profiles', w(c.adminListProfiles));
adminRouter.get('/profiles/:id', w(c.adminGetProfile));
adminRouter.post('/profiles/:id/:action', w(c.adminModerateProfile));
adminRouter.get('/stats', w(c.adminStats));
adminRouter.get('/settings', w(c.adminGetSettings));
adminRouter.put('/settings', w(c.adminPutSettings));
adminRouter.post('/jobs/run', w(c.adminRunJobs));
router.use('/admin', adminRouter);

// ── Always available to the account owner ───────────────────────────────────
const anyAccount = requireFriends(null, { minimal: true });
router.delete('/profile', protect, anyAccount, w(c.deleteProfile));
router.post('/pause', protect, anyAccount, w(c.pause));
router.get('/me/data', protect, anyAccount, w(c.myData));
// Safety exits stay open even when Connect is switched off or the user lost verification: the chat
// layer still shows an active match, so unmatch / block must always work.
router.post('/block', protect, anyAccount, w(c.blockProfile));
router.post('/matches/:id/unmatch', protect, anyAccount, w(c.unmatch));
router.post('/matches/:id/block', protect, anyAccount, w(c.blockMatch));

// ── Students ─────────────────────────────────────────────────────────────────
const write = requireFriends('connect', { write: true });
router.use(protect, requireFriends('connect'));

router.get('/status', w(c.status));
router.get('/policy', w(c.policy));
router.post('/consent', write, w(c.consent));

router.put('/profile', write, w(c.updateProfile));
router.patch('/profile', write, w(c.updateProfile));
router.post('/activate', write, w(c.activate));
router.post('/resume', write, w(c.resume));

router.post('/photos', write, w(c.addPhoto));
router.delete('/photos/:id', w(c.deletePhoto));
router.get('/photos/:id', w(c.viewPhoto));

router.post('/liveness/start', write, w(c.livenessStart));
router.post('/liveness/manual', write, w(c.livenessManual));

router.get('/discover', w(c.discover));
router.post('/swipe', write, w(c.swipe));

router.get('/matches', w(c.listMatches));
router.get('/matches/:id', w(c.getMatch));

router.use((req, res) => res.status(404).json({ message: 'Not found.', code: 'NOT_FOUND' }));

module.exports = router;
