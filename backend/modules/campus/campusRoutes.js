const express = require('express');
const router = express.Router();
const { protect, admin } = require('../../middleware/authMiddleware');
const {
  getCampuses,
  getCampusProfile,
  updateCampusProfile,
  requestEmailOtp,
  confirmEmailOtp,
  submitIdCard,
  getVerificationRequests,
  reviewVerification,
  getVerificationMethods,
  getVerificationStatus,
} = require('./controllers/profileController');
const { parseUpload, uploadMedia, serveMedia, serveAvatar } = require('./controllers/mediaController');
const { searchCampus, openDm, setGroupDiscoverable, joinOpenGroup } = require('./controllers/peopleController');

const {
  createGroup,
  previewGroupByCode,
  joinGroupByCode,
  resetJoinCode,
  getMyGroups,
} = require('./controllers/groupController');

const {
  getMyAssignments,
  createAssignment,
  getAssignments,
  submitAssignment,
  createAnnouncement,
  acknowledgeAnnouncement,
  getAnnouncements,
} = require('./controllers/classworkController');

const {
  getChats,
  getChatMessages,
} = require('./controllers/chatController');

const {
  createPoll,
  getPolls,
  votePoll,
} = require('./controllers/pollController');

const {
  createLostFound,
  getLostFound,
  resolveLostFound,
} = require('./controllers/lostFoundController');

const {
  createRidePool,
  getRidePools,
  joinRidePool,
  leaveRidePool,
} = require('./controllers/ridePoolController');

const {
  getProximityRooms,
  getProximityMessages,
  postProximityMessage,
} = require('./controllers/proximityController');

const {
  getToday,
  getDailyQuestion,
  answerDailyQuestion,
  upvoteAnswer,
  getWhispers,
  createWhisper,
  reactWhisper,
  getBranchLeaderboard,
} = require('./controllers/pulseController');

// Campuses
router.get('/campuses', getCampuses);

// Media: one upload for every campus image; served from a short URL with long cache headers.
// GET is public by unguessable id (ID cards need the owner/admin token or a signed link).
router.post('/media', protect, parseUpload, uploadMedia);
router.get('/media/:id', serveMedia);
router.get('/avatar/:userId', serveAvatar);

// People & clubs
router.get('/search', protect, searchCampus);
router.post('/dm', protect, openDm);

// Chats (list + cursor-paginated history). Messaging itself is socket-driven (/campus ns).
router.get('/chats', protect, getChats);
router.get('/chats/:id/messages', protect, getChatMessages);

// Profile & Verification
router.get('/profile', protect, getCampusProfile);
router.put('/profile', protect, updateCampusProfile);
router.get('/verify/methods', protect, getVerificationMethods);
router.get('/verify/status', protect, getVerificationStatus);
router.post('/verify/email-otp', protect, requestEmailOtp);
router.post('/verify/confirm-otp', protect, confirmEmailOtp);
router.post('/verify/upload-id', protect, submitIdCard);
router.get('/verify/requests', protect, getVerificationRequests);
router.post('/verify/:id/review', protect, reviewVerification);

// Groups & Classroom
router.get('/groups/mine', protect, getMyGroups);
router.post('/groups', protect, createGroup);
router.post('/groups/join', protect, joinGroupByCode);
router.get('/groups/preview/:code', previewGroupByCode);
router.post('/groups/:id/code/reset', protect, resetJoinCode);
router.put('/groups/:id/discoverable', protect, setGroupDiscoverable);
router.post('/groups/:id/join-open', protect, joinOpenGroup);

// Classwork & Announcements
router.get('/assignments', protect, getMyAssignments);
router.post('/assignments', protect, createAssignment);
router.get('/assignments/:conversationId', protect, getAssignments);
router.post('/assignments/:id/submit', protect, submitAssignment);
router.get('/announcements/:conversationId', protect, getAnnouncements);
router.post('/announcements', protect, createAnnouncement);
router.post('/announcements/:id/ack', protect, acknowledgeAnnouncement);

// Polls (Phase 4 smart tray)
router.post('/polls', protect, createPoll);
router.get('/polls/:conversationId', protect, getPolls);
router.post('/polls/:id/vote', protect, votePoll);

// Lost & Found (Phase 4 smart tray)
router.post('/lost-found', protect, createLostFound);
router.get('/lost-found', protect, getLostFound);
router.post('/lost-found/:id/resolve', protect, resolveLostFound);

// Ride Pool (Phase 4 smart tray)
router.post('/ride-pool', protect, createRidePool);
router.get('/ride-pool', protect, getRidePools);
router.post('/ride-pool/:id/join', protect, joinRidePool);
router.post('/ride-pool/:id/leave', protect, leaveRidePool);

// Phase 5: Proximity Rooms (location-bound live chat)
router.get('/proximity/rooms', protect, getProximityRooms);
router.get('/proximity/rooms/:slug/messages', protect, getProximityMessages);
router.post('/proximity/rooms/:slug/messages', protect, postProximityMessage);

// Pulse: Today on Campus, 9 PM Question, Whispers, Branch Wars (all real, DB-backed)
router.get('/pulse/today', protect, getToday);
router.get('/pulse/question', protect, getDailyQuestion);
router.post('/pulse/question/answer', protect, answerDailyQuestion);
router.post('/pulse/question/answer/:id/upvote', protect, upvoteAnswer);
router.get('/pulse/whispers', protect, getWhispers);
router.post('/pulse/whispers', protect, createWhisper);
router.post('/pulse/whispers/:id/react', protect, reactWhisper);
router.get('/pulse/branch-wars', protect, getBranchLeaderboard);
// Board counts for the Pulse cards (no photos downloaded)
router.get('/pulse/counts', protect, async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const { getLostAndFoundModel, getRidePoolModel } = require('./models');
    const [openLostFound, openRides] = await Promise.all([
      getLostAndFoundModel().count({ where: { status: 'open' } }),
      getRidePoolModel().count({
        where: { status: 'open', departureTime: { [Op.gte]: new Date(Date.now() - 30 * 60 * 1000) } },
      }),
    ]);
    res.json({ openLostFound, openRides });
  } catch (err) {
    console.error('[PULSE_COUNTS_ERR]', err.message);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

// Admin: publish real Pulse content (mess menu, events, the 9 PM question)
const pulseAdmin = require('./controllers/pulseAdminController');
router.put('/admin/mess-menu', protect, admin, pulseAdmin.upsertMessMenu);
router.delete('/admin/mess-menu/:id', protect, admin, pulseAdmin.deleteMessMenu);
router.get('/admin/events', protect, admin, pulseAdmin.listEvents);
router.post('/admin/events', protect, admin, pulseAdmin.createEvent);
router.put('/admin/events/:id', protect, admin, pulseAdmin.updateEvent);
router.delete('/admin/events/:id', protect, admin, pulseAdmin.deleteEvent);
router.put('/admin/daily-question', protect, admin, pulseAdmin.upsertDailyQuestion);

// ── Zenvy Friends (Campus Buddy > Friends) ────────────────────────────────────
// Mounted last so the existing /pulse/* routes above keep answering first. Each sub-tab router is a
// FEATURE_OFF stub until its phase ships (modules/friends/routes/*Routes.js).
router.use('/friends', require('../friends/routes/friendsRoutes'));
router.use('/mod', require('../friends/routes/modRoutes'));
router.use('/pulse', require('../friends/routes/pulseRoutes'));
router.use('/forum', require('../friends/routes/forumRoutes'));
router.use('/tasks', require('../friends/routes/tasksRoutes'));
router.use('/connect', require('../friends/routes/connectRoutes'));
router.use('/spaces', require('../friends/routes/spacesRoutes'));

module.exports = router;
