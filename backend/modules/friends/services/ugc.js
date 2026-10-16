/**
 * C2: user-generated-content safety shared by the campus surfaces outside Friends (whispers, community
 * posts, lost & found, campus spot messages, groups, polls, campus chat).
 *
 *  - Moderation state (FriendsContentState): hidden / pending_review / removed content is filtered
 *    out of every list (hiddenIds / filterVisible). No row = visible.
 *  - postGuard(userId): an active Friends sanction (scope 'friends' or 'pulse') also stops posting on
 *    these public campus surfaces, so "warn / ban the author" from the moderation queue really bites.
 *  - blockedIds(userId): people blocked in either direction (cached 30 s, cleared on block / unblock).
 *  - Rate limits for whispers and community posts are DB counts (exact across processes):
 *      WHISPER_LIMIT_PER_HOUR (5), WHISPER_LIMIT_PER_DAY (20),
 *      COMMUNITY_POST_LIMIT_PER_HOUR (10), COMMUNITY_POST_LIMIT_PER_DAY (50).
 */
const { Op } = require('sequelize');
const { getModel } = require('../index');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const intEnv = (name, def, min = 0, max = 100000) => {
  const n = parseInt(process.env[name], 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : def;
};

const autoHideThreshold = () => intEnv('UGC_AUTO_HIDE_REPORTS', 3, 1, 100);

const limits = () => ({
  whisper: { hour: intEnv('WHISPER_LIMIT_PER_HOUR', 5, 1), day: intEnv('WHISPER_LIMIT_PER_DAY', 20, 1) },
  community_post: { hour: intEnv('COMMUNITY_POST_LIMIT_PER_HOUR', 10, 1), day: intEnv('COMMUNITY_POST_LIMIT_PER_DAY', 50, 1) },
});

// ── Moderation state ─────────────────────────────────────────────────────────
const stateModel = () => getModel('FriendsContentState');

/** Set of ids (strings) of this type that are not visible. */
const hiddenIds = async (targetType, ids) => {
  const Model = stateModel();
  const list = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!Model || !list.length) return new Set();
  const out = new Set();
  for (let i = 0; i < list.length; i += 500) {
    const rows = await Model.findAll({
      where: { targetType, targetId: { [Op.in]: list.slice(i, i + 500) }, status: { [Op.ne]: 'visible' } },
      attributes: ['targetId'],
      raw: true,
    });
    rows.forEach((r) => out.add(String(r.targetId)));
  }
  return out;
};

/** rows minus the hidden ones (idOf picks the id). */
const filterVisible = async (targetType, rows, idOf = (r) => r.id) => {
  if (!rows || !rows.length) return rows || [];
  const hidden = await hiddenIds(targetType, rows.map(idOf));
  return hidden.size ? rows.filter((r) => !hidden.has(String(idOf(r)))) : rows;
};

const stateOf = async (targetType, targetId) => {
  const Model = stateModel();
  if (!Model) return 'visible';
  const row = await Model.findOne({ where: { targetType, targetId: String(targetId) }, attributes: ['status'] });
  return row ? row.status : 'visible';
};

const isHidden = async (targetType, targetId) => (await stateOf(targetType, targetId)) !== 'visible';

const setState = async (targetType, targetId, status, { transaction, ownerId, actorId } = {}) => {
  const Model = stateModel();
  if (!Model) return false;
  const where = { targetType, targetId: String(targetId) };
  const row = await Model.findOne({ where, transaction });
  if (row) {
    await row.update({ status, updatedBy: actorId || null, ...(ownerId ? { ownerId } : {}) }, { transaction });
  } else {
    try {
      await Model.create({ ...where, status, ownerId: ownerId || null, updatedBy: actorId || null }, { transaction });
    } catch (err) {
      if (!(err && err.name === 'SequelizeUniqueConstraintError')) throw err;
      await Model.update({ status, updatedBy: actorId || null }, { where, transaction });
    }
  }
  return true;
};

// ── Blocks ──────────────────────────────────────────────────────────────────
const blockedIds = async (userId) => {
  if (!userId) return new Set();
  return require('./blocks').blockedIds(String(userId));
};

// ── Posting guard (sanctions) ───────────────────────────────────────────────
const SANCTION_SCOPES = ['friends', 'pulse'];

/** null when the user may post; else { status, body } to send. Never throws on a lookup error. */
const postGuard = async (userId) => {
  if (!userId) return null;
  try {
    const eligibility = require('./eligibility');
    const ctx = await eligibility.loadContext(userId);
    const now = Date.now();
    const s = (ctx.sanctions || []).find((x) => SANCTION_SCOPES.includes(x.scope) && (!x.until || new Date(x.until).getTime() > now));
    if (!s) return null;
    return {
      status: 403,
      body: {
        code: 'FRIENDS_SANCTIONED',
        message: s.until
          ? 'You cannot post on campus boards until your restriction ends.'
          : 'You cannot post on campus boards. You can appeal from Me > Friends privacy & safety.',
        scope: s.scope,
        until: s.until,
      },
    };
  } catch (err) {
    console.warn('[UGC_POST_GUARD_WARN]', err.message);
    return null;
  }
};

// ── Rate limits (DB counts) ─────────────────────────────────────────────────
/**
 * countSince(sinceDate) -> number of the user's own items created since then.
 * Returns null when allowed, else { status: 429, body } with retryAfter in seconds.
 */
const checkRate = async (kind, countSince) => {
  const rule = limits()[kind];
  if (!rule) return null;
  const now = Date.now();
  const [lastHour, lastDay] = await Promise.all([countSince(new Date(now - HOUR)), countSince(new Date(now - DAY))]);
  const what = kind === 'whisper' ? 'whispers' : 'posts';
  if (lastHour >= rule.hour) {
    return { status: 429, body: { code: 'RATE_LIMITED', message: `You can share up to ${rule.hour} ${what} an hour. Please try again a little later.`, retryAfter: 15 * 60, window: 'hour', limit: rule.hour } };
  }
  if (lastDay >= rule.day) {
    return { status: 429, body: { code: 'RATE_LIMITED', message: `You have reached today's limit of ${rule.day} ${what}. Please try again tomorrow.`, retryAfter: 6 * 3600, window: 'day', limit: rule.day } };
  }
  return null;
};

module.exports = {
  autoHideThreshold,
  limits,
  hiddenIds,
  filterVisible,
  stateOf,
  isHidden,
  setState,
  blockedIds,
  postGuard,
  checkRate,
};
