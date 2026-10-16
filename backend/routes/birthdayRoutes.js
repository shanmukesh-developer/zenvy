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

// Photos: utils/imageStore (bytes in the CampusMedia table, short URL on the row). Render's
// filesystem is ephemeral, so nothing is written to /uploads/.

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

// Push + live toast to every active student for one approved birthday. Never throws.
const announceBirthday = async (io, celebration) => {
  try {
    const { getUserModel } = require('../models/User');
    const User = getUserModel();
    if (User) {
      const activeUsers = await User.findAll({ where: { isActive: true }, attributes: ['id', 'fcmTokens'] });
      let allTokens = [];
      activeUsers.forEach(user => {
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
            android: { notification: { color: '#FF1493', sound: 'default' } }
          }
        );
      }
    }
  } catch (pushErr) {
    console.error('Failed to send direct birthday push to tokens:', pushErr.message);
  }
  try {
    if (io) {
      io.emit('global_announcement', {
        message: `🎉 Celebrate ${celebration.candidateName}'s Birthday! 🎂 Tap here to wish them and join the campus celebration! 🎁✨`,
        type: 'promo'
      });
    }
  } catch (sockErr) {
    console.error('Failed to emit birthday socket announcement:', sockErr.message);
  }
};

// Hourly (jobs/index.js): approved birthdays whose day (IST) has come and that were approved earlier,
// announced once from 08:00 IST so nobody is woken at midnight.
const announceDueBirthdays = async (io) => {
  const BirthdayCelebration = getBirthdayCelebrationModel();
  if (!BirthdayCelebration) return 0;
  const istHour = new Date(Date.now() + IST_OFFSET_MS).getUTCHours();
  if (istHour < 8) return 0;
  const due = await BirthdayCelebration.findAll({
    // approvedAt before today: same-day approvals were already announced by the approve route.
    where: { status: 'approved', birthdayDate: istTodayYmd(), announcedAt: null, approvedAt: { [Op.lt]: istDayWindow(istTodayYmd()).start } },
    limit: 20,
  });
  let count = 0;
  for (const celebration of due) {
    const [claimed] = await BirthdayCelebration.update({ announcedAt: new Date() }, { where: { id: celebration.id, announcedAt: null } });
    if (claimed === 0) continue;
    count++;
    await announceBirthday(io, celebration);
    require('../utils/realtime').publish('announcement', 'created', celebration.id, { scope: 'birthday' });
  }
  if (count) console.log(`[BIRTHDAY] Announced ${count} birthday(s) for today`);
  return count;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => UUID_RE.test(String(v || ''));
const MAX_PENDING_PER_USER = 3;
// Public shapes never carry account ids (B25): who submitted / approved / wished stays private.
const publicCelebration = (c) => {
  const j = typeof c.toJSON === 'function' ? c.toJSON() : { ...c };
  delete j.userId;
  delete j.approvedBy;
  return j;
};
const publicWish = (w, viewerId) => {
  const j = typeof w.toJSON === 'function' ? w.toJSON() : { ...w };
  // The viewer's own wish is flagged (the id itself stays private), so the app can show
  // "Your wish has been sent" without the userId the list used to leak.
  j.wishedByMe = !!viewerId && String(j.userId) === String(viewerId);
  delete j.userId;
  return j;
};
// Signed-in viewer on the public lists (only to answer wishedByMe); never required.
const optionalUserId = (req) => {
  const h = req.headers && req.headers.authorization;
  if (!h || !h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(h.split(' ')[1].replace(/['"]+/g, '').trim(), process.env.JWT_SECRET);
    return decoded && decoded.id ? String(decoded.id) : null;
  } catch {
    return null;
  }
};
// Which of these celebrations the viewer has already wished.
const wishedSetFor = async (viewerId, celebrationIds) => {
  const BirthdayWish = getBirthdayWishModel();
  if (!viewerId || !BirthdayWish || !celebrationIds.length) return new Set();
  const rows = await BirthdayWish.findAll({ where: { userId: viewerId, celebrationId: { [Op.in]: celebrationIds } }, attributes: ['celebrationId'] });
  return new Set(rows.map((r) => String(r.celebrationId)));
};

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

    // A few pending requests per person at a time (B25): each one carries a photo for review.
    const pendingMine = await BirthdayCelebration.count({ where: { userId: req.user.id, status: 'pending' } });
    if (pendingMine >= MAX_PENDING_PER_USER) {
      return res.status(429).json({ code: 'TOO_MANY_PENDING', message: `You already have ${MAX_PENDING_PER_USER} birthday requests waiting for review. Please wait for them first.` });
    }

    // The photo bytes go to the media table (sniffed, max 5 MB); the row keeps the short URL.
    const { storeImageRef, sendImageError } = require('../utils/imageStore');
    const photo = await storeImageRef(candidatePhoto || null, { req, ownerId: req.user.id, purpose: 'birthday' });
    if (!photo.ok) return sendImageError(res, photo);
    const candidatePhotoUrl = photo.value;

    // Create pending celebration
    const celebration = await BirthdayCelebration.create({
      userId: req.user.id,
      candidateName,
      candidatePhotoUrl,
      birthdayDate,
      status: 'pending',
      wishCount: 0
    });

    res.status(201).json(publicCelebration(celebration));
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

    const wished = await wishedSetFor(optionalUserId(req), activeCelebrations.map((c) => c.id));
    res.json(activeCelebrations.map((c) => ({ ...publicCelebration(c), wishedByMe: wished.has(String(c.id)) })));
  } catch (err) {
    console.error('Error fetching active birthdays:', err);
    res.status(500).json({ message: 'Failed to fetch active birthdays.' });
  }
});

// GET /api/birthdays/pending - Fetch pending submissions (Admin only)
router.get('/pending', protect, admin, async (req, res) => {
  try {
    const BirthdayCelebration = getBirthdayCelebrationModel();
    // Paged (B25): ?limit (default 50, max 100) & ?offset. The array shape is unchanged; the total
    // is in the X-Total-Count header.
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const { rows, count } = await BirthdayCelebration.findAndCountAll({
      where: { status: 'pending' },
      order: [['createdAt', 'ASC']],
      limit,
      offset
    });
    res.set('X-Total-Count', String(count));
    res.json(rows);
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

    const celebration = isUuid(req.params.id) ? await BirthdayCelebration.findByPk(req.params.id) : null;
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

    // Birthday is today: announce now (exactly once). Future dates are announced on the day by
    // announceDueBirthdays (hourly job in jobs/index.js).
    if (isToday) {
      const [claimed] = await BirthdayCelebration.update({ announcedAt: now }, { where: { id: celebration.id, announcedAt: null } });
      if (claimed > 0) await announceBirthday(req.app.get('io'), celebration);
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

    const celebration = isUuid(req.params.id) ? await BirthdayCelebration.findByPk(req.params.id) : null;
    if (!celebration) return res.status(404).json({ message: 'Celebration not found.' });

    const rejectedPhoto = celebration.candidatePhotoUrl;
    await celebration.update({
      status: 'rejected',
      candidatePhotoUrl: null
    });
    // A rejected photo is not kept (B19).
    if (rejectedPhoto) require('../utils/mediaCleanup').releaseMedia([rejectedPhoto], 'birthday').catch(() => 0);

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

    const celebration = isUuid(req.params.id) ? await BirthdayCelebration.findByPk(req.params.id) : null;
    if (!celebration) return res.status(404).json({ message: 'Birthday celebration not found.' });

    // Check if expired
    if (celebration.status === 'expired' || (celebration.expiresAt && new Date(celebration.expiresAt) < new Date())) {
      return res.status(400).json({ message: 'This birthday celebration has expired.' });
    }

    if (celebration.status !== 'approved') {
      return res.status(400).json({ message: 'This birthday is not live yet.' });
    }

    // The column is VARCHAR(255): longer wishes failed and were reported as "already wished" (B16).
    const message = typeof req.body?.message === 'string' ? req.body.message.replace(/[<>]/g, '').trim().slice(0, 255) : '';

    // Create unique wish constraint check
    try {
      await BirthdayWish.create({
        celebrationId: celebration.id,
        userId: req.user.id,
        userName: req.user.name || 'Anonymous Peer',
        message: message || ''
      });
    } catch (dbErr) {
      // Only a real duplicate is "already wished" (B16); anything else is a server error.
      if (dbErr && dbErr.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ code: 'ALREADY_WISHED', wishedByMe: true, message: 'You have already wished this candidate! ❤️' });
      }
      throw dbErr;
    }

    // Atomic increment (B16): concurrent wishes all count.
    await BirthdayCelebration.increment('wishCount', { by: 1, where: { id: celebration.id } });
    await celebration.reload({ attributes: ['id', 'wishCount'] });

    // Wishes show on the celebration itself (GET /api/birthdays/:id/wishes); no per-wish feed posts.

    res.json({ message: 'Wish sent successfully!', wishCount: celebration.wishCount, wishedByMe: true });
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

    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Birthday celebration not found.' });
    const wishes = await BirthdayWish.findAll({
      where: { celebrationId: req.params.id },
      order: [['createdAt', 'DESC']],
      limit: 500
    });

    const viewerId = optionalUserId(req);
    res.json(wishes.map((w) => publicWish(w, viewerId)));
  } catch (err) {
    console.error('Error fetching wishes:', err);
    res.status(500).json({ message: 'Failed to fetch wishes.' });
  }
});

module.exports = router;
module.exports.announceDueBirthdays = announceDueBirthdays;
