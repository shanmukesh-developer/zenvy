/**
 * Friends audit trail (FriendsModAction). Every privileged or moderation action writes one row.
 * record() throws, so a privileged read (reveal_author, view_connect, view_private_chat) can be made
 * to fail closed when its audit row cannot be written. recordSafe() never throws (for side effects).
 * Logs carry the action and target type only, never content or anonymous identities.
 */
const { getModel } = require('../index');
const { MOD_ACTIONS, ACTOR_ROLES } = require('../models/foundation/enums');

const clip = (v, n) => (v === undefined || v === null ? null : String(v).slice(0, n));

const record = async (entry, { transaction } = {}) => {
  const FriendsModAction = getModel('FriendsModAction');
  if (!MOD_ACTIONS.includes(entry.action)) throw new Error(`unknown audit action ${entry.action}`);
  const actorRole = ACTOR_ROLES.includes(entry.actorRole) ? entry.actorRole : 'system';
  const row = await FriendsModAction.create({
    actorId: entry.actorId || null,
    actorRole,
    action: entry.action,
    targetType: clip(entry.targetType, 24),
    targetId: entry.targetId || null,
    subjectUserId: entry.subjectUserId || null,
    communityId: entry.communityId || null,
    reportId: entry.reportId || null,
    reason: clip(entry.reason, 500),
    meta: entry.meta || {},
  }, { transaction });
  console.log(`[FRIENDS_AUDIT] ${actorRole} ${entry.action} ${entry.targetType || '-'}`);
  return row;
};

const recordSafe = async (entry, opts) => {
  try {
    return await record(entry, opts);
  } catch (err) {
    console.warn('[FRIENDS_AUDIT_WARN]', entry && entry.action, err.message);
    return null;
  }
};

/** Public (admin) shape of an action row. */
const serializeAction = (a) => ({
  id: a.id,
  actorId: a.actorId,
  actorRole: a.actorRole,
  action: a.action,
  targetType: a.targetType,
  targetId: a.targetId,
  subjectUserId: a.subjectUserId,
  communityId: a.communityId,
  reportId: a.reportId,
  reason: a.reason,
  meta: a.meta || {},
  createdAt: a.createdAt,
});

module.exports = { record, recordSafe, serializeAction };
