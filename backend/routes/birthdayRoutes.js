const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

const { getBirthdayCelebrationModel } = require('../models/BirthdayCelebration');
const { getBirthdayWishModel } = require('../models/BirthdayWish');
const { protect, admin } = require('../middleware/authMiddleware');
const { sendPushToTopic, sendPushToTokens } = require('../utils/push');

// Helper: Store photo directly in the database as base64 data URI.
// Render's filesystem is ephemeral — files in /uploads/ are lost on restart.
// Storing in the DB column (TEXT type) ensures persistence across deploys.
function processPhoto(base64Payload) {
  if (!base64Payload) return null;
  // If it's already a data URI or regular URL, keep it as-is
  if (base64Payload.startsWith('data:image') || base64Payload.startsWith('http')) {
    return base64Payload;
  }
  return null;
}

// ── IST date helpers (community-n17) ──
const IST_OFFSET_MS = 330 * 60 * 1000;
const istTodayYmd = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
// Returns 'YYYY-MM-DD' for a real calendar date, else null.
const parseYmd = (v) => {
  const raw = String(v || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toISOString().slice(0, 10) === raw ? raw : null;
};
// The celebration is live for that whole day in IST.
const istDayWindow = (ymd) => {
  const start = new Date(Date.parse(`${ymd}T00:00:00Z`) - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};
const daysFromToday = (ymd) => Math.round((Date.parse(`${ymd}T00:00:00Z`) - Date.parse(`${istTodayYmd()}T00:00:00Z`)) / 86400000);

// POST /api/birthdays - Submit birthday celebration request
router.post('/', protect, async (req, res) => {
  try {
    const BirthdayCelebration = getBirthdayCelebrationModel();
    if (!BirthdayCelebration) return res.status(500).json({ message: 'Database model not initialized.' });

    const { candidatePhoto } = req.body;
    const candidateName = String(req.body.candidateName || '').replace(/[<>]/g, '').trim();
    if (!candidateName || !req.body.birthdayDate) {
      return res.status(400).json({ message: 'Candidate name and date are required.' });
    }
    if (candidateName.length > 60) {
      return res.status(400).json({ message: 'Please keep the name under 60 characters.' });
    }
    const birthdayDate = parseYmd(req.body.birthdayDate);
    if (!birthdayDate) {
      return res.status(400).json({ code: 'INVALID_DATE', message: 'Please enter the birthday as YYYY-MM-DD, for example 2026-10-21.' });
    }
    const ahead = daysFromToday(birthdayDate);
    if (ahead < 0 || ahead > 60) {
      return res.status(400).json({ code: 'INVALID_DATE', message: 'Pick the birthday date from today up to 60 days ahead.' });
    }

    // Store photo as base64 data URI directly in database (survives server restarts)
    const candidatePhotoUrl = processPhoto(candidatePhoto);

    // Create pending celebration
    const celebration = await BirthdayCelebration.create({
      userId: req.user.id,
      candidateName,
      candidatePhotoUrl,
      birthdayDate,
      status: 'pending',
      wishCount: 0
    });

    res.status(201).json(celebration);
  } catch (err) {
    console.error('Error submitting birthday request:', err);
    res.status(500).json({ message: 'Failed to submit birthday celebration.' });
  }
});

// GET /api/birthdays/active - Fetch active, approved celebrations (expiresAt > now)
router.get('/active', async (req, res) => {
  try {
    const BirthdayCelebration = getBirthdayCelebrationModel();
    if (!BirthdayCelebration) return res.status(500).json({ message: 'Database model not initialized.' });

    // Only birthdays whose date is today in IST.
    const activeCelebrations = await BirthdayCelebration.findAll({
      where: {
        status: 'approved',
        birthdayDate: istTodayYmd()
      },
      order: [['approvedAt', 'DESC']]
    });

    res.json(activeCelebrations);
  } catch (err) {
    console.error('Error fetching active birthdays:', err);
    res.status(500).json({ message: 'Failed to fetch active birthdays.' });
  }
});

// GET /api/birthdays/pending - Fetch pending submissions (Admin only)
router.get('/pending', protect, admin, async (req, res) => {
  try {
    const BirthdayCelebration = getBirthdayCelebrationModel();
    const pending = await BirthdayCelebration.findAll({
      where: { status: 'pending' },
      order: [['createdAt', 'ASC']]
    });
    res.json(pending);
  } catch (err) {
    console.error('Error fetching pending birthdays:', err);
    res.status(500).json({ message: 'Failed to fetch pending requests.' });
  }
});

// PUT /api/birthdays/:id/approve - Approve a birthday request (Admin only)
router.put('/:id/approve', protect, admin, async (req, res) => {
  try {
    const BirthdayCelebration = getBirthdayCelebrationModel();
    if (!BirthdayCelebration) return res.status(500).json({ message: 'Database model not initialized.' });

    const celebration = await BirthdayCelebration.findByPk(req.params.id);
    if (!celebration) return res.status(404).json({ message: 'Celebration not found.' });

    const now = new Date();
    const birthdayYmd = parseYmd(celebration.birthdayDate) || istTodayYmd();
    // Visible for the whole birthday (IST), not "24 hours from approval".
    const { end: expiresAt } = istDayWindow(birthdayYmd);
    if (expiresAt <= now) {
      return res.status(400).json({ message: 'This birthday has already passed, so it cannot go live. Reject it instead.' });
    }
    const isToday = birthdayYmd === istTodayYmd();

    await celebration.update({
      status: 'approved',
      approvedBy: req.user.id,
      approvedAt: now,
      expiresAt: expiresAt
    });

    // Fetch all active users' FCM tokens and broadcast push notifications directly to everyone
    try {
      const { getUserModel } = require('../models/User');
      const User = getUserModel();
      if (User && isToday) {
        const activeUsers = await User.findAll({ where: { isActive: true } });
        let allTokens = [];
        activeUsers.forEach(user => {
          if (user.fcmTokens) {
            let tokenList = user.fcmTokens;
            if (typeof tokenList === 'string') {
              try { tokenList = JSON.parse(tokenList); } catch { tokenList = [tokenList]; }
            }
            if (Array.isArray(tokenList)) {
              tokenList.forEach(t => {
                const tokenStr = typeof t === 'string' ? t : t?.token;
                if (tokenStr) allTokens.push(tokenStr);
              });
            }
          }
        });
        allTokens = [...new Set(allTokens.filter(Boolean))];

        if (allTokens.length > 0) {
          await sendPushToTokens(
            allTokens,
            `🎉 Celebrate ${celebration.candidateName}'s Birthday! 🎂`,
            `Tap here to wish them and join the campus celebration! 🎁✨`,
            {
              type: 'BIRTHDAY_ALERT',
              celebrationId: String(celebration.id),
              candidateName: celebration.candidateName
            },
            {
              recipients: activeUsers.map((u) => u.id),
              android: {
                notification: {
                  color: '#FF1493',
                  sound: 'default'
                }
              }
            }
          );
        }
      }
    } catch (pushErr) {
      console.error('Failed to send direct birthday push to tokens:', pushErr);
    }

    // Broadcast via Socket.io so active users get live toast & save to notification history
    try {
      const io = req.app.get('io');
      if (io && isToday) {
        io.emit('global_announcement', {
          message: `🎉 Celebrate ${celebration.candidateName}'s Birthday! 🎂 Tap here to wish them and join the campus celebration! 🎁✨`,
          type: 'promo'
        });
      }
    } catch (sockErr) {
      console.error('Failed to emit birthday socket announcement:', sockErr);
    }

    require('../utils/realtime').publish('announcement', 'created', celebration.id, { scope: 'birthday' });
    res.json({ message: 'Birthday approved successfully.', celebration });
  } catch (err) {
    console.error('Error approving birthday:', err);
    res.status(500).json({ message: 'Failed to approve birthday.' });
  }
});

// PUT /api/birthdays/:id/reject - Reject a birthday request (Admin only)
router.put('/:id/reject', protect, admin, async (req, res) => {
  try {
    const BirthdayCelebration = getBirthdayCelebrationModel();
    if (!BirthdayCelebration) return res.status(500).json({ message: 'Database model not initialized.' });

    const celebration = await BirthdayCelebration.findByPk(req.params.id);
    if (!celebration) return res.status(404).json({ message: 'Celebration not found.' });

    await celebration.update({
      status: 'rejected'
    });

    require('../utils/realtime').notifyAdmin('announcement', 'updated', celebration.id, { scope: 'birthday' });
    res.json({ message: 'Birthday request rejected.', celebration });
  } catch (err) {
    console.error('Error rejecting birthday:', err);
    res.status(500).json({ message: 'Failed to reject request.' });
  }
});

// POST /api/birthdays/:id/wish - Send a birthday wish (User only)
router.post('/:id/wish', protect, async (req, res) => {
  try {
    const BirthdayCelebration = getBirthdayCelebrationModel();
    const BirthdayWish = getBirthdayWishModel();

    if (!BirthdayCelebration || !BirthdayWish) {
      return res.status(500).json({ message: 'Database models not initialized.' });
    }

    const celebration = await BirthdayCelebration.findByPk(req.params.id);
    if (!celebration) return res.status(404).json({ message: 'Birthday celebration not found.' });

    // Check if expired
    if (celebration.status === 'expired' || (celebration.expiresAt && new Date(celebration.expiresAt) < new Date())) {
      return res.status(400).json({ message: 'This birthday celebration has expired.' });
    }

    if (celebration.status !== 'approved') {
      return res.status(400).json({ message: 'This birthday is not live yet.' });
    }

    const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 300) : '';

    // Create unique wish constraint check
    try {
      await BirthdayWish.create({
        celebrationId: celebration.id,
        userId: req.user.id,
        userName: req.user.name || 'Anonymous Peer',
        message: message || ''
      });
    } catch (dbErr) {
      // SequelizeUniqueConstraintError
      return res.status(400).json({ message: 'You have already wished this candidate! ❤️' });
    }

    // Increment wishCount
    celebration.wishCount = (celebration.wishCount || 0) + 1;
    await celebration.save();

    // Wishes show on the celebration itself (GET /api/birthdays/:id/wishes); no per-wish feed posts.

    res.json({ message: 'Wish sent successfully!', wishCount: celebration.wishCount });
  } catch (err) {
    console.error('Error wishing candidate:', err);
    res.status(500).json({ message: 'Failed to send wish.' });
  }
});

// GET /api/birthdays/:id/wishes - Fetch wishes for a celebration
router.get('/:id/wishes', async (req, res) => {
  try {
    const BirthdayWish = getBirthdayWishModel();
    if (!BirthdayWish) return res.status(500).json({ message: 'Database model not initialized.' });

    const wishes = await BirthdayWish.findAll({
      where: { celebrationId: req.params.id },
      order: [['createdAt', 'DESC']]
    });

    res.json(wishes);
  } catch (err) {
    console.error('Error fetching wishes:', err);
    res.status(500).json({ message: 'Failed to fetch wishes.' });
  }
});

module.exports = router;
