// Push to every live admin's devices + an 'adminAlert' socket event to the admin room. The same
// pattern utils/stallStuckJob.js uses inline, shared for C1 (rider pickup timeout, SMS budget).
// Never throws; resolves the number of admin devices pushed.
const pushAdmins = async (title, body, data = {}, { io = null } = {}) => {
  let devices = 0;
  try {
    const { Op } = require('sequelize');
    const { getUserModel } = require('../models/User');
    const User = getUserModel();
    if (!User) return 0;
    const admins = await User.findAll({ where: { role: 'admin', isActive: { [Op.ne]: false } }, attributes: ['id', 'fcmTokens'] });
    const tokens = admins
      .flatMap((a) => (Array.isArray(a.fcmTokens) ? a.fcmTokens : []))
      .map((t) => (typeof t === 'string' ? t : t && t.token))
      .filter(Boolean);
    if (tokens.length) {
      const { sendPushToTokens } = require('./push');
      await sendPushToTokens(tokens, title, body, data, { recipients: admins.map((a) => a.id) });
      devices = tokens.length;
    }
  } catch (err) {
    console.warn('[ADMIN_ALERT_PUSH_WARN]', err.message);
  }
  try {
    if (io) io.to('admin-room').emit('adminAlert', { title, body, ...data, at: new Date().toISOString() });
  } catch { /* socket is best effort */ }
  return devices;
};

module.exports = { pushAdmins };
