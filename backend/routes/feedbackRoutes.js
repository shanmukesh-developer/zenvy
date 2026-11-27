// First-order feedback (owner, 27 Nov 2026; models/AppFeedback.js). Mounted in server.js:
//   /api/feedback        customer (signed in)
//     GET  /first-order          { show, orderId, points } - whether the app should show the box now
//     POST /first-order          { rating 1-5, comment? } -> saves it; +30 ZenWe Points the first time
//     POST /first-order/dismiss  "Maybe later": hidden until their next delivered order, at most twice
//   /api/admin/app-feedback  admins: GET the feedback list (newest first)
// The reward is for the feedback sent to ZenWe only. The app's "Rate ZenWe on Play Store" button is separate and
// never rewarded (Google Play forbids rewarding store reviews).
const express = require('express');
const { Op } = require('sequelize');
const { protect, admin } = require('../middleware/authMiddleware');
const { getAppFeedbackModel } = require('../models/AppFeedback');
const { getOrderModel } = require('../models/Order');
const { getUserModel } = require('../models/User');
const { sendServerError } = require('../utils/httpErrors');

const FEEDBACK_POINTS = 30;
const MAX_DISMISS = 2; // shown at most twice: after the first delivery, then once more after the next one

const deliveredOrders = async (userId) => {
  const Order = getOrderModel();
  const rows = await Order.findAll({
    where: { userId: String(userId), status: 'Delivered' },
    attributes: ['id', 'deliveredAt', 'createdAt'],
    order: [['createdAt', 'ASC']],
    limit: 200,
  });
  return rows;
};

// Whether to show the box now, and for which order.
const firstOrderState = async (userId) => {
  const AppFeedback = getAppFeedbackModel();
  const row = await AppFeedback.findOne({ where: { userId: String(userId) } });
  if (row && row.status === 'submitted') return { show: false, done: true };
  const delivered = await deliveredOrders(userId);
  if (!delivered.length) return { show: false, done: false };
  if (row && row.status === 'dismissed') {
    if (row.dismissCount >= MAX_DISMISS) return { show: false, done: false };
    if (delivered.length <= Number(row.dismissedAtDelivered || 0)) return { show: false, done: false };
  }
  return { show: true, done: false, orderId: String(delivered[delivered.length - 1].id) };
};

const router = express.Router();

router.get('/first-order', protect, async (req, res) => {
  try {
    const st = await firstOrderState(req.user.id);
    res.set('Cache-Control', 'no-store');
    res.json({ ...st, points: FEEDBACK_POINTS });
  } catch (err) { sendServerError(res, err, '[FEEDBACK_STATUS]'); }
});

router.post('/first-order', protect, async (req, res) => {
  try {
    const rating = Math.round(Number(req.body && req.body.rating));
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ message: 'Pick 1 to 5 stars.' });
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 1000) : '';
    const platform = typeof req.body.platform === 'string' ? req.body.platform.slice(0, 16) : null;
    const appVersion = typeof req.body.appVersion === 'string' ? req.body.appVersion.slice(0, 24) : null;
    const AppFeedback = getAppFeedbackModel();
    const User = getUserModel();
    const userId = String(req.user.id);
    const delivered = await deliveredOrders(userId);
    if (!delivered.length) return res.status(400).json({ message: 'You can send this after your first delivered order.' });
    const orderId = String(delivered[delivered.length - 1].id);

    let awarded = 0;
    await AppFeedback.sequelize.transaction(async (t) => {
      const [row] = await AppFeedback.findOrCreate({ where: { userId }, defaults: { userId, status: 'dismissed' }, transaction: t });
      if (row.status === 'submitted') {
        // Already sent: keep their latest words, never a second reward.
        await row.update({ rating, comment: comment || row.comment, platform, appVersion }, { transaction: t });
        return;
      }
      // Conditional update: only the request that flips it to 'submitted' credits the points.
      const [n] = await AppFeedback.update(
        { status: 'submitted', rating, comment: comment || null, orderId, platform, appVersion, pointsAwarded: FEEDBACK_POINTS },
        { where: { id: row.id, status: { [Op.ne]: 'submitted' } }, transaction: t },
      );
      if (n === 1) {
        await User.increment('zenPoints', { by: FEEDBACK_POINTS, where: { id: userId }, transaction: t });
        awarded = FEEDBACK_POINTS;
      }
    });
    const user = await User.findByPk(userId, { attributes: ['zenPoints'] });
    res.json({ ok: true, pointsAwarded: awarded, zenPoints: user ? Number(user.zenPoints) || 0 : null });
  } catch (err) { sendServerError(res, err, '[FEEDBACK_SUBMIT]'); }
});

router.post('/first-order/dismiss', protect, async (req, res) => {
  try {
    const AppFeedback = getAppFeedbackModel();
    const userId = String(req.user.id);
    const delivered = await deliveredOrders(userId);
    const [row] = await AppFeedback.findOrCreate({ where: { userId }, defaults: { userId, status: 'dismissed' } });
    if (row.status !== 'submitted') {
      await row.update({ dismissCount: (Number(row.dismissCount) || 0) + 1, dismissedAtDelivered: delivered.length });
    }
    res.json({ ok: true });
  } catch (err) { sendServerError(res, err, '[FEEDBACK_DISMISS]'); }
});

// ── Admin ─────────────────────────────────────────────────────────────────────────────────────────
const adminRouter = express.Router();
adminRouter.get('/', protect, admin, async (req, res) => {
  try {
    const AppFeedback = getAppFeedbackModel();
    const User = getUserModel();
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    const rows = await AppFeedback.findAll({ where: { status: 'submitted' }, order: [['updatedAt', 'DESC']], limit });
    const users = rows.length ? await User.findAll({ where: { id: { [Op.in]: rows.map((r) => r.userId) } }, attributes: ['id', 'name', 'phone'] }) : [];
    const byId = new Map(users.map((u) => [String(u.id), u]));
    const all = await AppFeedback.findAll({ where: { status: 'submitted' }, attributes: ['rating'] });
    const avg = all.length ? all.reduce((a, r) => a + (Number(r.rating) || 0), 0) / all.length : null;
    res.json({
      count: all.length,
      average: avg ? Math.round(avg * 10) / 10 : null,
      items: rows.map((r) => {
        const u = byId.get(String(r.userId));
        return {
          id: r.id, rating: r.rating, comment: r.comment, orderId: r.orderId, pointsAwarded: r.pointsAwarded,
          platform: r.platform, appVersion: r.appVersion, at: r.updatedAt,
          user: u ? { id: String(u.id), name: u.name || null, phone: u.phone || null } : { id: r.userId, name: null, phone: null },
        };
      }),
    });
  } catch (err) { sendServerError(res, err, '[ADMIN_APP_FEEDBACK]'); }
});

module.exports = { router, adminRouter, FEEDBACK_POINTS };
