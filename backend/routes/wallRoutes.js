const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { getWallEventModel } = require('../models/WallEvent');
const { getWallSubmissionModel } = require('../models/WallSubmission');
const { getWallLikeModel } = require('../models/WallLike');
const { getUserModel } = require('../models/User');
const { protect, admin } = require('../middleware/authMiddleware');
const { sendPushToTopic } = require('../utils/push');

// Simple in-memory rate limiting for /like endpoint per user (max 30 per min)
const likeRateLimitMap = new Map();
const checkLikeRateLimit = (userId) => {
  const now = Date.now();
  const userLogs = likeRateLimitMap.get(userId) || [];
  const recentLogs = userLogs.filter(ts => now - ts < 60000);
  if (recentLogs.length >= 30) return false;
  recentLogs.push(now);
  likeRateLimitMap.set(userId, recentLogs);
  return true;
};

// ── ADMIN: Create Wall Event ──
// POST /api/wall/events
router.post('/events', protect, admin, async (req, res) => {
  try {
    const WallEvent = getWallEventModel();
    if (!WallEvent) return res.status(500).json({ message: 'WallEvent model not initialized.' });

    const { title, description, startTime, endTime, couponValue, couponCode, bannerText, bannerGradient } = req.body;
    if (!title || !startTime || !endTime) {
      return res.status(400).json({ message: 'Title, startTime, and endTime are required.' });
    }

    const event = await WallEvent.create({
      title,
      description: description || '',
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      status: 'ACTIVE',
      couponCode: couponCode || null,
      couponValue: couponValue ? parseInt(couponValue, 10) : 100,
      bannerText: bannerText || '🔥 LIVE PHOTO CONTEST: Vote for your favourite photos & win instant discount coupons! 📸✨',
      bannerGradient: bannerGradient || 'fire'
    });

    // Notify all users about new Wall Event
    try {
      await sendPushToTopic('all_users', '📸 The Wall Photo Contest is LIVE!', `Submit your photo for "${title}" & win a ₹${event.couponValue} coupon!`, {
        type: 'WALL_EVENT_STARTED',
        eventId: event.id
      });
    } catch (e) {
      console.error('[WALL_PUSH_ERR]', e);
    }

    res.status(201).json(event);
  } catch (err) {
    console.error('Error creating Wall event:', err);
    res.status(500).json({ message: 'Failed to create Wall event.' });
  }
});

// ── ADMIN: Update Wall Event & Moving Banner ──
// PUT /api/wall/events/:id
router.put('/events/:id', protect, admin, async (req, res) => {
  try {
    const WallEvent = getWallEventModel();
    if (!WallEvent) return res.status(500).json({ message: 'WallEvent model not initialized.' });

    const event = await WallEvent.findByPk(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const { title, description, bannerText, bannerGradient, couponValue, couponCode, endTime } = req.body;
    if (title !== undefined) event.title = title;
    if (description !== undefined) event.description = description;
    if (bannerText !== undefined) event.bannerText = bannerText;
    if (bannerGradient !== undefined) event.bannerGradient = bannerGradient;
    if (couponValue !== undefined) event.couponValue = parseInt(couponValue, 10);
    if (couponCode !== undefined) event.couponCode = couponCode;
    if (endTime !== undefined) event.endTime = new Date(endTime);

    await event.save();
    res.json({ message: 'Event and moving banner updated successfully!', event });
  } catch (err) {
    console.error('Error updating Wall event:', err);
    res.status(500).json({ message: 'Failed to update Wall event.' });
  }
});

// ── GET Active Wall Event & Submissions ──
// GET /api/wall/events/active
router.get('/events/active', async (req, res) => {
  try {
    const WallEvent = getWallEventModel();
    const WallSubmission = getWallSubmissionModel();
    const WallLike = getWallLikeModel();
    const User = getUserModel();

    if (!WallEvent || !WallSubmission) return res.status(500).json({ message: 'Models not initialized.' });

    const now = new Date();
    let activeEvent = await WallEvent.findOne({
      where: {
        status: 'ACTIVE',
        endTime: { [Op.gt]: now }
      },
      order: [['createdAt', 'DESC']]
    });

    // If no active event exists in future, check if there's any ACTIVE event created recently
    if (!activeEvent) {
      activeEvent = await WallEvent.findOne({
        where: { status: 'ACTIVE' },
        order: [['createdAt', 'DESC']]
      });
    }

    if (!activeEvent) {
      return res.json({ activeEvent: null, submissions: [], userSubmission: null });
    }

    // Fetch approved submissions sorted by likeCount DESC
    const submissions = await WallSubmission.findAll({
      where: {
        eventId: activeEvent.id,
        isApproved: true
      },
      order: [['likeCount', 'DESC'], ['createdAt', 'ASC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'profileImage']
        }
      ]
    });

    // Extract current user's liked submission IDs if token provided
    let userLikedSubmissionIds = [];
    let userSubmission = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const token = authHeader.split(' ')[1].replace(/['"]+/g, '').trim();
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded.id) {
          const userLikes = await WallLike.findAll({
            where: { userId: decoded.id },
            attributes: ['submissionId']
          });
          userLikedSubmissionIds = userLikes.map(l => l.submissionId);

          userSubmission = await WallSubmission.findOne({
            where: { eventId: activeEvent.id, userId: decoded.id }
          });
        }
      } catch (e) {
        // Token invalid/expired, continue without user-specific data
      }
    }

    res.json({
      activeEvent,
      submissions,
      userLikedSubmissionIds,
      userSubmission
    });
  } catch (err) {
    console.error('Error fetching active Wall event:', err);
    res.status(500).json({ message: 'Failed to fetch active Wall event.' });
  }
});

// ── GET Hall of Fame (Ended Events with Winners) ──
// GET /api/wall/events/history
router.get('/events/history', async (req, res) => {
  try {
    const WallEvent = getWallEventModel();
    const WallSubmission = getWallSubmissionModel();
    const User = getUserModel();

    if (!WallEvent) return res.status(500).json({ message: 'Models not initialized.' });

    const endedEvents = await WallEvent.findAll({
      where: { status: 'ENDED' },
      order: [['endTime', 'DESC']],
      limit: 20
    });

    const history = [];
    for (const evt of endedEvents) {
      let winnerUser = null;
      let winningSubmission = null;

      if (evt.winnerUserId) {
        winnerUser = await User.findByPk(evt.winnerUserId, {
          attributes: ['id', 'name', 'profileImage']
        });
        winningSubmission = await WallSubmission.findOne({
          where: { eventId: evt.id, userId: evt.winnerUserId, isApproved: true },
          order: [['likeCount', 'DESC']]
        });
      }

      // If no winner set yet, find top submission
      if (!winningSubmission) {
        winningSubmission = await WallSubmission.findOne({
          where: { eventId: evt.id, isApproved: true },
          order: [['likeCount', 'DESC'], ['createdAt', 'ASC']],
          include: [{ model: User, as: 'user', attributes: ['id', 'name', 'profileImage'] }]
        });
        if (winningSubmission && winningSubmission.user) {
          winnerUser = winningSubmission.user;
        }
      }

      history.push({
        event: evt,
        winner: winnerUser,
        winningSubmission
      });
    }

    res.json(history);
  } catch (err) {
    console.error('Error fetching Wall history:', err);
    res.status(500).json({ message: 'Failed to fetch Wall history.' });
  }
});

// ── POST Submit Photo to Active Wall Event ──
// POST /api/wall/events/:id/submit
router.post('/events/:id/submit', protect, async (req, res) => {
  try {
    const WallEvent = getWallEventModel();
    const WallSubmission = getWallSubmissionModel();
    if (!WallEvent || !WallSubmission) return res.status(500).json({ message: 'Models not initialized.' });

    const eventId = req.params.id;
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ message: 'Image payload is required.' });
    }

    const event = await WallEvent.findByPk(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    if (event.status !== 'ACTIVE' || new Date(event.endTime) < new Date()) {
      return res.status(400).json({ message: 'This photo contest has ended or is not active.' });
    }

    // Check if user already submitted for this event
    const existing = await WallSubmission.findOne({
      where: { eventId, userId: req.user.id }
    });

    if (existing) {
      return res.status(400).json({ message: 'You have already submitted a photo for this event!' });
    }

    // Auto-approve for admins, moderation required for regular users
    const isAdmin = req.user.role && req.user.role.toLowerCase() === 'admin';

    const submission = await WallSubmission.create({
      eventId,
      userId: req.user.id,
      imageUrl,
      likeCount: 0,
      isApproved: isAdmin ? true : false
    });

    res.status(201).json({
      message: isAdmin ? 'Photo submitted and live!' : 'Photo submitted for admin approval!',
      submission
    });
  } catch (err) {
    console.error('Error submitting Wall photo:', err);
    res.status(500).json({ message: 'Failed to submit photo to Wall.' });
  }
});

// ── POST Toggle Like on Wall Submission ──
// POST /api/wall/submissions/:id/like
router.post('/submissions/:id/like', protect, async (req, res) => {
  try {
    const WallSubmission = getWallSubmissionModel();
    const WallLike = getWallLikeModel();
    const WallEvent = getWallEventModel();

    if (!WallSubmission || !WallLike) return res.status(500).json({ message: 'Models not initialized.' });

    // Rate limit check
    if (!checkLikeRateLimit(req.user.id)) {
      return res.status(429).json({ message: 'Too many vote actions! Please slow down.' });
    }

    const submissionId = req.params.id;
    const submission = await WallSubmission.findByPk(submissionId, {
      include: [{ model: WallEvent, as: 'event' }]
    });

    if (!submission) return res.status(404).json({ message: 'Submission not found.' });

    if (submission.event && submission.event.status === 'ENDED') {
      return res.status(400).json({ message: 'Voting has closed for this event.' });
    }

    // Toggle like
    const existingLike = await WallLike.findOne({
      where: { submissionId, userId: req.user.id }
    });

    let liked = false;
    if (existingLike) {
      await existingLike.destroy();
      submission.likeCount = Math.max(0, submission.likeCount - 1);
      await submission.save();
      liked = false;
    } else {
      await WallLike.create({ submissionId, userId: req.user.id });
      submission.likeCount = submission.likeCount + 1;
      await submission.save();
      liked = true;
    }

    res.json({
      liked,
      likeCount: submission.likeCount
    });
  } catch (err) {
    console.error('Error toggling Wall like:', err);
    res.status(500).json({ message: 'Failed to toggle vote.' });
  }
});

// ── GET Wall Leaderboard ──
// GET /api/wall/events/:id/leaderboard
router.get('/events/:id/leaderboard', async (req, res) => {
  try {
    const WallSubmission = getWallSubmissionModel();
    const User = getUserModel();

    const submissions = await WallSubmission.findAll({
      where: { eventId: req.params.id, isApproved: true },
      order: [['likeCount', 'DESC'], ['createdAt', 'ASC']],
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'profileImage'] }]
    });

    res.json(submissions);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ message: 'Failed to fetch leaderboard.' });
  }
});

// ── ADMIN: End Wall Event Manually ──
// PUT /api/wall/events/:id/end
router.put('/events/:id/end', protect, admin, async (req, res) => {
  try {
    const WallEvent = getWallEventModel();
    const WallSubmission = getWallSubmissionModel();
    const User = getUserModel();
    if (!WallEvent || !WallSubmission) return res.status(500).json({ message: 'Models not initialized.' });

    const event = await WallEvent.findByPk(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    if (event.status === 'ENDED') return res.status(400).json({ message: 'Event is already ended.' });

    // Find winner — top approved submission by likeCount
    const topSubmission = await WallSubmission.findOne({
      where: { eventId: event.id, isApproved: true },
      order: [['likeCount', 'DESC'], ['createdAt', 'ASC']],
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'profileImage'] }]
    });

    event.status = 'ENDED';
    event.endTime = new Date();
    if (topSubmission) {
      event.winnerUserId = topSubmission.userId;
    }
    await event.save();

    res.json({
      message: 'Event ended successfully!',
      event,
      winner: topSubmission ? topSubmission.user : null,
      winningSubmission: topSubmission
    });
  } catch (err) {
    console.error('Error ending Wall event:', err);
    res.status(500).json({ message: 'Failed to end event.' });
  }
});

// ── ADMIN: Get All Wall Events (for management) ──
// GET /api/wall/admin/events
router.get('/admin/events', protect, admin, async (req, res) => {
  try {
    const WallEvent = getWallEventModel();
    const WallSubmission = getWallSubmissionModel();
    if (!WallEvent) return res.status(500).json({ message: 'Models not initialized.' });

    const events = await WallEvent.findAll({
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    // Attach submission counts
    const enriched = [];
    for (const evt of events) {
      const totalSubmissions = await WallSubmission.count({ where: { eventId: evt.id } });
      const approvedSubmissions = await WallSubmission.count({ where: { eventId: evt.id, isApproved: true } });
      const pendingSubmissions = await WallSubmission.count({ where: { eventId: evt.id, isApproved: false } });
      enriched.push({
        ...evt.toJSON(),
        totalSubmissions,
        approvedSubmissions,
        pendingSubmissions
      });
    }

    res.json(enriched);
  } catch (err) {
    console.error('Error fetching admin events:', err);
    res.status(500).json({ message: 'Failed to fetch events.' });
  }
});

// ── ADMIN: Get Pending Submissions Moderation Queue ──
// GET /api/wall/admin/pending
router.get('/admin/pending', protect, admin, async (req, res) => {
  try {
    const WallSubmission = getWallSubmissionModel();
    const WallEvent = getWallEventModel();
    const User = getUserModel();

    const pending = await WallSubmission.findAll({
      where: { isApproved: false },
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'profileImage'] },
        { model: WallEvent, as: 'event', attributes: ['id', 'title', 'status'] }
      ]
    });

    res.json(pending);
  } catch (err) {
    console.error('Error fetching pending submissions:', err);
    res.status(500).json({ message: 'Failed to fetch pending queue.' });
  }
});

// ── ADMIN: Approve Submission ──
// PUT /api/wall/admin/submissions/:id/approve
router.put('/admin/submissions/:id/approve', protect, admin, async (req, res) => {
  try {
    const WallSubmission = getWallSubmissionModel();
    const submission = await WallSubmission.findByPk(req.params.id);
    if (!submission) return res.status(404).json({ message: 'Submission not found.' });

    submission.isApproved = true;
    await submission.save();

    res.json({ message: 'Submission approved and live on The Wall!', submission });
  } catch (err) {
    console.error('Error approving submission:', err);
    res.status(500).json({ message: 'Failed to approve submission.' });
  }
});

// ── ADMIN: Reject Submission ──
// PUT /api/wall/admin/submissions/:id/reject
router.put('/admin/submissions/:id/reject', protect, admin, async (req, res) => {
  try {
    const WallSubmission = getWallSubmissionModel();
    const submission = await WallSubmission.findByPk(req.params.id);
    if (!submission) return res.status(404).json({ message: 'Submission not found.' });

    await submission.destroy();

    res.json({ message: 'Submission rejected and removed.' });
  } catch (err) {
    console.error('Error rejecting submission:', err);
    res.status(500).json({ message: 'Failed to reject submission.' });
  }
});

module.exports = router;
