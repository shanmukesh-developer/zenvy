// Friends foundation API: /api/campus/friends (eligibility, guidelines, settings, identity cards,
// follows, mutes, reports, appeals). Contract: backend_contract.md "Friends (F0)".
const crypto = require('crypto');
const { Op } = require('sequelize');
const { getModel, getSequelize } = require('../index');
const eligibility = require('../services/eligibility');
const flags = require('../services/featureFlags');
const limiter = require('../services/limiter');
const identity = require('../services/identity');
const cursor = require('../services/cursor');
const blocks = require('../services/blocks');
const reports = require('../services/reports');
const { notify } = require('../services/notify');
const { fail, requireUuid, isUniqueError, optText, isUuid } = require('../services/http');
const { DEFAULT_NOTIF_PREFS } = require('../models/foundation/settings');
const E = require('../models/foundation/enums');

const ipHash = (req) => {
  const ip = String(req.ip || '');
  if (!ip) return null;
  return crypto.createHmac('sha256', String(process.env.JWT_SECRET || 'zenvy')).update(`ip|${ip}`).digest('hex').slice(0, 64);
};

const settingsPayload = (s) => {
  const row = s || {};
  return {
    profileVisibility: row.profileVisibility || 'campus',
    showYear: row.showYear !== false,
    showBranch: row.showBranch !== false,
    defaultAnonymous: !!row.defaultAnonymous,
    notifPrefs: { ...DEFAULT_NOTIF_PREFS, ...(row.notifPrefs || {}) },
    guidelinesVersion: row.guidelinesVersion || null,
    guidelinesAcceptedAt: row.guidelinesAcceptedAt || null,
  };
};

const getOrCreateSettings = async (userId, transaction) => {
  const FriendsSettings = getModel('FriendsSettings');
  const found = await FriendsSettings.findOne({ where: { userId }, transaction });
  if (found) return found;
  try {
    return await FriendsSettings.create({ userId }, { transaction });
  } catch (err) {
    if (!isUniqueError(err)) throw err;
    return FriendsSettings.findOne({ where: { userId }, transaction });
  }
};

// ── Eligibility & guidelines ────────────────────────────────────────────────
// GET /eligibility — always 200 for a signed-in user; the app decides what to show from it.
const getEligibility = async (req, res) => {
  const [ctx, cfg] = await Promise.all([eligibility.loadContext(req.user.id, { fresh: true }), flags.getConfig()]);
  res.json(eligibility.describe(ctx, cfg, { limits: limiter.publicLimits() }));
};

// GET /guidelines
const getGuidelines = async (req, res) => {
  const [ctx, cfg] = await Promise.all([eligibility.loadContext(req.user.id), flags.getConfig()]);
  res.json({
    version: cfg.guidelines.version,
    text: cfg.guidelines.text,
    url: process.env.FRIENDS_GUIDELINES_URL || null,
    accepted: eligibility.guidelinesAccepted(ctx, cfg),
  });
};

// POST /guidelines/accept { version }
const acceptGuidelines = async (req, res) => {
  const { cfg } = req.friends;
  const version = Number(req.body && req.body.version);
  if (!Number.isInteger(version) || version !== cfg.guidelines.version) {
    throw fail(409, 'GUIDELINES_VERSION_MISMATCH', 'The guidelines were updated. Please read the latest version.', { version: cfg.guidelines.version });
  }
  limiter.enforce(req.user.id, 'guidelines');
  const sequelize = getSequelize();
  const FriendsConsent = getModel('FriendsConsent');
  const result = await sequelize.transaction(async (transaction) => {
    const settings = await getOrCreateSettings(req.user.id, transaction);
    const already = Number(settings.guidelinesVersion) === version && !!settings.guidelinesAcceptedAt;
    if (!already) {
      await FriendsConsent.create({ userId: req.user.id, kind: 'guidelines', version, acceptedAt: new Date(), ipHash: ipHash(req) }, { transaction });
      settings.guidelinesVersion = version;
      settings.guidelinesAcceptedAt = new Date();
      await settings.save({ transaction });
    }
    return { settings, already };
  });
  eligibility.clearEligibility(req.user.id);
  res.json({ accepted: true, version, acceptedAt: result.settings.guidelinesAcceptedAt, duplicate: result.already });
};

// ── Settings ────────────────────────────────────────────────────────────────
const getSettings = async (req, res) => {
  const FriendsSettings = getModel('FriendsSettings');
  const s = await FriendsSettings.findOne({ where: { userId: req.user.id } });
  res.json({ settings: settingsPayload(s) });
};

// PUT /settings { profileVisibility, showYear, showBranch, defaultAnonymous, notifPrefs }
const updateSettings = async (req, res) => {
  limiter.enforce(req.user.id, 'settings');
  const b = req.body || {};
  const patch = {};
  if (b.profileVisibility !== undefined) {
    if (!E.PROFILE_VISIBILITY.includes(b.profileVisibility)) throw fail(400, 'INVALID_INPUT', 'Profile visibility must be campus or followers.', { field: 'profileVisibility' });
    patch.profileVisibility = b.profileVisibility;
  }
  for (const key of ['showYear', 'showBranch', 'defaultAnonymous']) {
    if (b[key] === undefined) continue;
    if (typeof b[key] !== 'boolean') throw fail(400, 'INVALID_INPUT', `${key} must be true or false.`, { field: key });
    patch[key] = b[key];
  }
  let prefsPatch = null;
  if (b.notifPrefs !== undefined) {
    if (!b.notifPrefs || typeof b.notifPrefs !== 'object' || Array.isArray(b.notifPrefs)) throw fail(400, 'INVALID_INPUT', 'notifPrefs must be an object.', { field: 'notifPrefs' });
    prefsPatch = {};
    for (const [k, v] of Object.entries(b.notifPrefs)) {
      if (!(k in DEFAULT_NOTIF_PREFS)) throw fail(400, 'INVALID_INPUT', `Unknown notification setting ${k}.`, { field: `notifPrefs.${k}` });
      if (typeof v !== 'boolean') throw fail(400, 'INVALID_INPUT', `notifPrefs.${k} must be true or false.`, { field: `notifPrefs.${k}` });
      prefsPatch[k] = v;
    }
  }
  const settings = await getOrCreateSettings(req.user.id);
  Object.assign(settings, patch);
  if (prefsPatch) settings.notifPrefs = { ...DEFAULT_NOTIF_PREFS, ...(settings.notifPrefs || {}), ...prefsPatch };
  await settings.save();
  eligibility.clearEligibility(req.user.id);
  res.json({ settings: settingsPayload(settings) });
};

// ── Identity cards ──────────────────────────────────────────────────────────
/** A user another Friends member can see: exists, active, verified, same campus, not blocked either way. */
const visibleUser = async (viewerCtx, targetId) => {
  if (!isUuid(targetId)) return null;
  const User = getModel('User');
  const CampusProfile = getModel('CampusProfile');
  const [u, p] = await Promise.all([
    User.findByPk(targetId, { attributes: ['id', 'name', 'isActive'] }),
    CampusProfile.findOne({ where: { userId: targetId }, attributes: ['campusId', 'verificationStatus'] }),
  ]);
  if (!u || u.isActive === false || !p || p.verificationStatus !== 'verified') return null;
  if (!viewerCtx.campus || String(p.campusId) !== String(viewerCtx.campus.id)) return null;
  if (String(targetId) !== String(viewerCtx.userId) && await blocks.isBlocked(viewerCtx.userId, targetId)) return null;
  return u;
};

// GET /users/:id
const getUserCard = async (req, res) => {
  const { ctx } = req.friends;
  const targetId = req.params.id;
  const u = await visibleUser(ctx, targetId);
  if (!u) throw fail(404, 'USER_NOT_FOUND', 'This student is not available.');
  const FriendsKarma = getModel('FriendsKarma');
  const FriendsEdge = getModel('FriendsEdge');
  const me = req.user.id;
  const [card, karma, followers, following, myEdges] = await Promise.all([
    identity.identityOf(req, targetId, { viewerId: me }),
    FriendsKarma.findOne({ where: { userId: targetId } }),
    FriendsEdge.count({ where: { kind: 'follow', targetType: 'user', targetId } }),
    FriendsEdge.count({ where: { userId: targetId, kind: 'follow', targetType: 'user' } }),
    FriendsEdge.findAll({ where: { userId: me, targetType: 'user', targetId, kind: { [Op.in]: ['follow', 'mute'] } }, attributes: ['kind'] }),
  ]);
  const k = karma || {};
  const ratingCount = Number(k.taskRatingCount) || 0;
  const stats = card.limited && String(targetId) !== String(me) ? null : {
    karma: Number(k.karma) || 0,
    helpfulAnswers: Number(k.helpfulAnswers) || 0,
    resourcesShared: Number(k.resourcesShared) || 0,
    tasks: {
      tasksCompleted: Number(k.tasksCompleted) || 0,
      ratingAvg: ratingCount ? Math.round(((Number(k.taskRatingSum) || 0) / ratingCount) * 10) / 10 : null,
      ratingCount,
    },
  };
  res.json({
    user: card,
    stats,
    followerCount: followers,
    followingCount: following,
    isMe: String(targetId) === String(me),
    isFollowing: myEdges.some((e) => e.kind === 'follow'),
    isMuted: myEdges.some((e) => e.kind === 'mute'),
  });
};

// ── Follows & mutes ─────────────────────────────────────────────────────────
const edgeInput = (req, allowedTypes) => {
  const src = { ...(req.query || {}), ...(req.body || {}) };
  const targetType = String(src.targetType || '');
  const targetId = String(src.targetId || '');
  if (!allowedTypes.includes(targetType)) throw fail(400, 'INVALID_TARGET', `targetType must be one of ${allowedTypes.join(', ')}.`);
  requireUuid(targetId, 'target');
  return { targetType, targetId };
};

const visibleEntity = async (ctx, entityId) => {
  const FriendsEntity = getModel('FriendsEntity');
  const e = await FriendsEntity.findByPk(entityId);
  if (!e || e.status !== 'active' || !ctx.campus || String(e.campusId) !== String(ctx.campus.id)) return null;
  return e;
};

// POST /follow { targetType: user|entity, targetId }
const follow = async (req, res) => {
  const { ctx } = req.friends;
  const { targetType, targetId } = edgeInput(req, ['user', 'entity']);
  if (targetType === 'user' && targetId === req.user.id) throw fail(400, 'CANNOT_FOLLOW_SELF', 'You cannot follow yourself.');
  if (targetType === 'user') {
    if (await blocks.isBlocked(req.user.id, targetId)) throw fail(403, 'BLOCKED', 'You cannot follow this person.');
    if (!(await visibleUser(ctx, targetId))) throw fail(404, 'USER_NOT_FOUND', 'This student is not available.');
  } else if (!(await visibleEntity(ctx, targetId))) {
    throw fail(404, 'ENTITY_NOT_FOUND', 'That club or account is not available.');
  }
  const FriendsEdge = getModel('FriendsEdge');
  const where = { userId: req.user.id, kind: 'follow', targetType, targetId };
  const existing = await FriendsEdge.findOne({ where });
  if (existing) return res.json({ following: true, duplicate: true });
  limiter.enforce(req.user.id, 'follow');
  try {
    await FriendsEdge.create(where);
  } catch (err) {
    if (isUniqueError(err)) return res.json({ following: true, duplicate: true });
    throw err;
  }
  if (targetType === 'user') {
    await notify('FRIENDS_FOLLOW', [targetId], { id: req.user.id, dedupeKey: `follow:${req.user.id}`, body: `${ctx.user.name || 'A student'} followed you.` });
  }
  res.status(201).json({ following: true, duplicate: false });
};

// DELETE /follow { targetType, targetId }
const unfollow = async (req, res) => {
  const { targetType, targetId } = edgeInput(req, ['user', 'entity']);
  const FriendsEdge = getModel('FriendsEdge');
  const n = await FriendsEdge.destroy({ where: { userId: req.user.id, kind: 'follow', targetType, targetId } });
  res.json({ following: false, removed: n > 0 });
};

// GET /following?type=user|entity&cursor=
const listFollowing = async (req, res) => {
  const type = req.query.type === 'entity' ? 'entity' : 'user';
  const limit = cursor.pageSize(req.query.limit, 30);
  const FriendsEdge = getModel('FriendsEdge');
  const where = { userId: req.user.id, kind: 'follow', targetType: type };
  const c = cursor.after(req.query.cursor);
  if (c) Object.assign(where, c);
  const rows = await FriendsEdge.findAll({ where, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: limit + 1 });
  const { items, nextCursor } = cursor.page(rows, limit);
  const blocked = await blocks.blockedIds(req.user.id);
  const visible = items.filter((r) => !blocked.has(String(r.targetId)));
  let out;
  if (type === 'user') {
    const ids = visible.map((r) => r.targetId);
    const idents = await identity.loadIdentities(req, ids, { viewerId: req.user.id });
    out = visible.map((r) => idents.get(String(r.targetId))).filter(Boolean).map((u) => ({ type: 'user', user: u }));
  } else {
    const FriendsEntity = getModel('FriendsEntity');
    const ents = await FriendsEntity.findAll({ where: { id: { [Op.in]: visible.map((r) => r.targetId) }, status: 'active' } });
    const byId = new Map(ents.map((e) => [String(e.id), e]));
    out = visible.map((r) => byId.get(String(r.targetId))).filter(Boolean).map((e) => ({ type: 'entity', entity: identity.entityIdentity(req, e) }));
  }
  res.json({ items: out, nextCursor });
};

const MUTE_TYPES = ['user', 'entity', 'community', 'hashtag'];

// POST /mute { targetType, targetId }
const mute = async (req, res) => {
  const { targetType, targetId } = edgeInput(req, MUTE_TYPES);
  if (targetType === 'user' && targetId === req.user.id) throw fail(400, 'CANNOT_MUTE_SELF', 'You cannot mute yourself.');
  if (targetType === 'user') {
    const User = getModel('User');
    if (!(await User.findByPk(targetId, { attributes: ['id'] }))) throw fail(404, 'USER_NOT_FOUND', 'This student is not available.');
  }
  limiter.enforce(req.user.id, 'mute');
  const FriendsEdge = getModel('FriendsEdge');
  const where = { userId: req.user.id, kind: 'mute', targetType, targetId };
  const [, created] = await FriendsEdge.findOrCreate({ where, defaults: where }).catch((err) => {
    if (isUniqueError(err)) return [null, false];
    throw err;
  });
  res.status(created ? 201 : 200).json({ muted: true, duplicate: !created });
};

// DELETE /mute
const unmute = async (req, res) => {
  const { targetType, targetId } = edgeInput(req, MUTE_TYPES);
  const FriendsEdge = getModel('FriendsEdge');
  const n = await FriendsEdge.destroy({ where: { userId: req.user.id, kind: 'mute', targetType, targetId } });
  res.json({ muted: false, removed: n > 0 });
};

// GET /mutes
const listMutes = async (req, res) => {
  const FriendsEdge = getModel('FriendsEdge');
  const rows = await FriendsEdge.findAll({ where: { userId: req.user.id, kind: 'mute' }, order: [['createdAt', 'DESC']], limit: 500 });
  const userIds = rows.filter((r) => r.targetType === 'user').map((r) => r.targetId);
  const idents = await identity.loadIdentities(req, userIds, { viewerId: req.user.id });
  res.json({
    items: rows.map((r) => ({
      targetType: r.targetType,
      targetId: r.targetId,
      user: r.targetType === 'user' ? idents.get(String(r.targetId)) || null : undefined,
      createdAt: r.createdAt,
    })),
  });
};

// ── Reports ─────────────────────────────────────────────────────────────────
// POST /reports { targetType, targetId, category, note }
const createReport = async (req, res) => {
  const b = req.body || {};
  const targetType = String(b.targetType || '');
  const targetId = requireUuid(String(b.targetId || ''), 'target');
  const note = optText(b.note, 500, 'Note');
  const { report, duplicate } = await reports.fileReport({
    reporterId: req.user.id,
    targetType,
    targetId,
    category: String(b.category || ''),
    note,
  });
  if (duplicate) return res.status(200).json({ reportId: report.id, status: 'received', duplicate: true });
  return res.status(201).json({ reportId: report.id, status: 'received' });
};

const publicReportStatus = (s) => (s === 'actioned' || s === 'dismissed' ? 'closed' : s === 'open' ? 'received' : 'in_review');

// GET /reports/mine
const myReports = async (req, res) => {
  const FriendsReport = getModel('FriendsReport');
  const limit = cursor.pageSize(req.query.limit, 30);
  const where = { reporterId: req.user.id };
  const c = cursor.after(req.query.cursor);
  if (c) Object.assign(where, c);
  const rows = await FriendsReport.findAll({ where, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: limit + 1 });
  const { items, nextCursor } = cursor.page(rows, limit);
  res.json({
    items: items.map((r) => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      category: r.category,
      status: publicReportStatus(r.status),
      outcome: r.status === 'actioned' ? 'action_taken' : r.status === 'dismissed' ? 'no_action' : null,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
    })),
    nextCursor,
  });
};

// ── Appeals ─────────────────────────────────────────────────────────────────
const APPEALABLE = ['remove', 'hide', 'hide_pending', 'warn', 'sanction', 'reject'];

// POST /appeals { actionId, text }
const createAppeal = async (req, res) => {
  const b = req.body || {};
  const actionId = requireUuid(String(b.actionId || ''), 'decision');
  const text = optText(b.text, 1000, 'Appeal');
  if (!text || text.length < 10) throw fail(400, 'TOO_SHORT', 'Tell us in a few words why the decision is wrong (at least 10 characters).');
  const FriendsModAction = getModel('FriendsModAction');
  const FriendsAppeal = getModel('FriendsAppeal');
  const action = await FriendsModAction.findByPk(actionId);
  // Only the user the action targeted can appeal it (others get the same 404 as a missing id).
  if (!action || String(action.subjectUserId) !== String(req.user.id)) throw fail(404, 'ACTION_NOT_FOUND', 'We could not find that decision.');
  if (!APPEALABLE.includes(action.action)) throw fail(400, 'NOT_APPEALABLE', 'This decision cannot be appealed.');
  const existing = await FriendsAppeal.findOne({ where: { userId: req.user.id, actionId } });
  if (existing) throw fail(409, 'APPEAL_EXISTS', 'You have already appealed this decision.', { appealId: existing.id, status: existing.status });
  limiter.enforce(req.user.id, 'appeal');
  let appeal;
  try {
    appeal = await FriendsAppeal.create({ userId: req.user.id, actionId, text, status: 'open' });
  } catch (err) {
    if (isUniqueError(err)) throw fail(409, 'APPEAL_EXISTS', 'You have already appealed this decision.');
    throw err;
  }
  try { require('../../../utils/realtime').notifyAdmin('friends_appeal', 'created', appeal.id); } catch { /* optional */ }
  res.status(201).json({ appealId: appeal.id, status: 'open' });
};

const appealPayload = (a) => ({ id: a.id, actionId: a.actionId, text: a.text, status: a.status, note: a.note, createdAt: a.createdAt, reviewedAt: a.reviewedAt });

// GET /appeals/mine
const myAppeals = async (req, res) => {
  const FriendsAppeal = getModel('FriendsAppeal');
  const rows = await FriendsAppeal.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']], limit: 100 });
  res.json({ items: rows.map(appealPayload) });
};

// GET /moderation/mine — decisions about me (appealable) and active restrictions. Moderator ids are not shown.
const myModeration = async (req, res) => {
  const FriendsModAction = getModel('FriendsModAction');
  const FriendsAppeal = getModel('FriendsAppeal');
  const actions = await FriendsModAction.findAll({
    where: { subjectUserId: req.user.id, action: { [Op.in]: [...APPEALABLE, 'restore', 'lift_sanction', 'appeal_upheld', 'appeal_reversed'] } },
    order: [['createdAt', 'DESC']],
    limit: 100,
  });
  const appeals = await FriendsAppeal.findAll({ where: { userId: req.user.id, actionId: { [Op.in]: actions.map((a) => a.id) } } });
  const appealOf = new Map(appeals.map((a) => [String(a.actionId), a]));
  const ctx = await eligibility.loadContext(req.user.id, { fresh: true });
  res.json({
    sanctions: ctx.sanctions.map((s) => ({ id: s.id, scope: s.scope, until: s.until })),
    actions: actions.map((a) => {
      const ap = appealOf.get(String(a.id));
      return {
        id: a.id,
        action: a.action,
        targetType: a.targetType,
        targetId: a.targetId,
        reason: a.reason,
        createdAt: a.createdAt,
        appealable: APPEALABLE.includes(a.action) && !ap,
        appeal: ap ? { id: ap.id, status: ap.status } : null,
      };
    }),
  });
};

module.exports = {
  getEligibility,
  getGuidelines,
  acceptGuidelines,
  getSettings,
  updateSettings,
  getUserCard,
  follow,
  unfollow,
  listFollowing,
  mute,
  unmute,
  listMutes,
  createReport,
  myReports,
  createAppeal,
  myAppeals,
  myModeration,
  getOrCreateSettings,
  APPEALABLE,
};
