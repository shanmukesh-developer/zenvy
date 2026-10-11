// Saves pushes as in-app notifications (GET /api/notifications).
// Never throws: a failed write must not block the push or the request that sent it.
const { Op } = require('sequelize');

// Pushes that are not worth keeping in the notification list (chat bubbles, ringing calls).
const NOT_STORED_TYPES = new Set(['chat_message', 'call', 'incoming_call', 'typing']);
const MAX_TOKEN_LOOKUP = 200;
const MAX_RECIPIENTS = 20000;

const clip = (v, n) => (v == null ? null : String(v).slice(0, n));

const tokenString = (t) => (typeof t === 'string' ? t : t && typeof t.token === 'string' ? t.token : null);

// Finds the customer accounts that own these device tokens (User.fcmTokens is a JSON text column).
const usersForTokens = async (tokens) => {
  const { getUserModel } = require('../models/User');
  const User = getUserModel();
  const unique = [...new Set(tokens.map(tokenString).filter((t) => t && t.length >= 20))];
  if (!unique.length || unique.length > MAX_TOKEN_LOOKUP) return [];
  const ids = new Set();
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const rows = await User.findAll({
      where: { [Op.or]: chunk.map((t) => ({ fcmTokens: { [Op.like]: `%"${t.replace(/[\\%]/g, '')}"%` } })) },
      attributes: ['id'],
    });
    rows.forEach((r) => ids.add(String(r.id)));
  }
  return [...ids];
};

/**
 * @param {object} p
 * @param {string[]} [p.userIds]  recipients when the caller knows them (preferred)
 * @param {Array}    [p.tokens]   device tokens; used to find the recipients when userIds is not given
 */
const recordNotifications = async ({ userIds, tokens, title, body, data = {} }) => {
  try {
    const type = data && data.type ? String(data.type) : null;
    if (type && NOT_STORED_TYPES.has(type)) return 0;
    if (!title) return 0;

    let recipients = Array.isArray(userIds) ? userIds.filter(Boolean).map(String) : null;
    if (!recipients) recipients = Array.isArray(tokens) ? await usersForTokens(tokens) : [];
    recipients = [...new Set(recipients)].slice(0, MAX_RECIPIENTS);
    if (!recipients.length) return 0;

    const { getNotificationModel } = require('../models/Notification');
    const Notification = getNotificationModel();
    const cleanData = {};
    Object.entries(data || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && typeof v !== 'object') cleanData[k] = clip(v, 200);
    });
    const orderId = clip(data && (data.orderId || data.order_id), 64);

    for (let i = 0; i < recipients.length; i += 1000) {
      await Notification.bulkCreate(recipients.slice(i, i + 1000).map((userId) => ({
        userId,
        title: clip(title, 200),
        body: clip(body, 2000),
        type: clip(type, 40),
        orderId,
        data: cleanData,
      })));
    }
    return recipients.length;
  } catch (e) {
    console.warn('[NOTIFICATION_STORE] could not save notification:', e.message);
    return 0;
  }
};

module.exports = { recordNotifications, NOT_STORED_TYPES };
