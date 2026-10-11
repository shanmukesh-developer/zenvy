// In-app notification history (rows are written by utils/push.js whenever a push is sent).
const express = require('express');
const { Op } = require('sequelize');
const { protect } = require('../middleware/authMiddleware');
const { getNotificationModel } = require('../models/Notification');

const router = express.Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const shape = (n) => ({
  id: n.id,
  _id: n.id,
  title: n.title,
  body: n.body || '',
  type: n.type || null,
  orderId: n.orderId || null,
  data: n.data || {},
  read: !!n.readAt,
  readAt: n.readAt,
  createdAt: n.createdAt,
});

const unreadCountFor = (userId) => getNotificationModel().count({ where: { userId, readAt: null } });

// GET /api/notifications?limit=50&before=<ISO date>
router.get('/', protect, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const where = { userId: req.user.id };
    if (req.query.before) {
      const before = new Date(String(req.query.before));
      if (!Number.isNaN(before.getTime())) where.createdAt = { [Op.lt]: before };
    }
    const rows = await getNotificationModel().findAll({ where, order: [['createdAt', 'DESC']], limit });
    const unreadCount = await unreadCountFor(req.user.id);
    res.json({ notifications: rows.map(shape), unreadCount, hasMore: rows.length === limit });
  } catch (e) {
    console.error('[NOTIFICATIONS_LIST]', e.message);
    res.status(500).json({ message: 'We could not load your notifications. Please try again.' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', protect, async (req, res) => {
  try {
    res.json({ unreadCount: await unreadCountFor(req.user.id) });
  } catch (e) {
    console.error('[NOTIFICATIONS_COUNT]', e.message);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/notifications/read  { ids?: [uuid] } — marks the listed ones (or all when ids is omitted) as read
const markRead = async (req, res, ids) => {
  try {
    const where = { userId: req.user.id, readAt: null };
    if (Array.isArray(ids)) {
      const clean = ids.map(String).filter((id) => UUID_RE.test(id)).slice(0, 200);
      if (!clean.length) return res.json({ updated: 0, unreadCount: await unreadCountFor(req.user.id) });
      where.id = { [Op.in]: clean };
    }
    const [updated] = await getNotificationModel().update({ readAt: new Date() }, { where });
    res.json({ updated, unreadCount: await unreadCountFor(req.user.id) });
  } catch (e) {
    console.error('[NOTIFICATIONS_READ]', e.message);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

router.put('/read', protect, (req, res) => markRead(req, res, Array.isArray(req.body?.ids) ? req.body.ids : undefined));
router.put('/read-all', protect, (req, res) => markRead(req, res, undefined));
router.put('/:id/read', protect, (req, res) => {
  if (!UUID_RE.test(String(req.params.id))) return res.status(404).json({ message: 'Notification not found' });
  return markRead(req, res, [req.params.id]);
});

// DELETE /api/notifications/:id  and  DELETE /api/notifications (clear all)
router.delete('/:id', protect, async (req, res) => {
  try {
    if (!UUID_RE.test(String(req.params.id))) return res.status(404).json({ message: 'Notification not found' });
    const removed = await getNotificationModel().destroy({ where: { id: req.params.id, userId: req.user.id } });
    if (!removed) return res.status(404).json({ message: 'Notification not found' });
    res.json({ removed, unreadCount: await unreadCountFor(req.user.id) });
  } catch (e) {
    console.error('[NOTIFICATIONS_DELETE]', e.message);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

router.delete('/', protect, async (req, res) => {
  try {
    const removed = await getNotificationModel().destroy({ where: { userId: req.user.id } });
    res.json({ removed, unreadCount: 0 });
  } catch (e) {
    console.error('[NOTIFICATIONS_CLEAR]', e.message);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
