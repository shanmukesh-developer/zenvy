// Friends moderation & admin API: /api/campus/mod (admins only in Phase 0; community moderators get
// scoped /mod/community/* endpoints in Phase 1). Every privileged action writes a FriendsModAction row.
const { Op } = require('sequelize');
const { getModel, getSequelize } = require('../index');
const flags = require('../services/featureFlags');
const limiter = require('../services/limiter');
const audit = require('../services/audit');
const targets = require('../services/targets');
const cursor = require('../services/cursor');
const eligibility = require('../services/eligibility');
const reportsSvc = require('../services/reports');
const { notify } = require('../services/notify');
const { fail, requireUuid, isUuid, optText, isUniqueError } = require('../services/http');
const E = require('../models/foundation/enums');

const notifyAdmin = (type, action, id, extra) => {
  try { require('../../../utils/realtime').notifyAdmin(type, action, id, extra); } catch { /* optional */ }
};

const likeOp = () => (getSequelize().getDialect() === 'postgres' ? Op.iLike : Op.like);

const listParam = (v, allowed, label) => {
  if (v === undefined || v === null || v === '') return null;
  const list = String(v).split(',').map((s) => s.trim()).filter(Boolean);
  for (const x of list) if (!allowed.includes(x)) throw fail(400, 'INVALID_FILTER', `Unknown ${label} ${x}.`);
  return list;
};

const reportPayload = (r, { withReporter = true } = {}) => ({
  id: r.id,
  campusId: r.campusId,
  ...(withReporter ? { reporterId: r.isSystem ? null : r.reporterId } : {}),
  isSystem: !!r.isSystem,
  targetType: r.targetType,
  targetId: r.targetId,
  subTab: r.subTab,
  category: r.category,
  note: r.note,
  severity: r.severity,
  status: r.status,
  assignedTo: r.assignedTo,
  slaDueAt: r.slaDueAt,
  overdue: !!r.slaDueAt && ['open', 'in_review', 'escalated'].includes(r.status) && new Date(r.slaDueAt).getTime() < Date.now(),
  decision: r.decision,
  resolution: r.resolution,
  resolvedBy: r.resolvedBy,
  resolvedAt: r.resolvedAt,
  actionId: r.actionId,
  createdAt: r.createdAt,
});

// GET /queue?status=&severity=&subTab=&category=&q=&assignee=&cursor=
const getQueue = async (req, res) => {
  const FriendsReport = getModel('FriendsReport');
  const q = req.query || {};
  const where = {};
  const status = q.status === 'all' ? null : (listParam(q.status, E.REPORT_STATUS, 'status') || reportsSvc.OPEN_STATUSES);
  if (status) where.status = { [Op.in]: status };
  const severity = listParam(q.severity, E.SEVERITIES, 'severity');
  if (severity) where.severity = { [Op.in]: severity };
  const subTab = listParam(q.subTab, E.SUB_TABS, 'subTab');
  if (subTab) where.subTab = { [Op.in]: subTab };
  const category = listParam(q.category, E.REPORT_CATEGORIES, 'category');
  if (category) where.category = { [Op.in]: category };
  if (q.assignee === 'me') where.assignedTo = req.user.id;
  else if (q.assignee === 'none') where.assignedTo = null;
  else if (q.assignee) where.assignedTo = requireUuid(String(q.assignee), 'assignee');
  const and = [];
  if (q.q) {
    const term = String(q.q).trim().slice(0, 80).replace(/[%_\\]/g, '');
    if (term) and.push({ [Op.or]: [{ note: { [likeOp()]: `%${term}%` } }, { snapshot: { [likeOp()]: `%${term}%` } }] });
  }
  const c = cursor.after(q.cursor);
  if (c) and.push(c);
  if (and.length) where[Op.and] = and;
  const limit = cursor.pageSize(q.limit, 30);
  const rows = await FriendsReport.findAll({ where, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: limit + 1 });
  const { items, nextCursor } = cursor.page(rows, limit);

  // Group the page by target; reporter counts cover every open report on the target.
  const groups = new Map();
  for (const r of items) {
    const key = `${r.targetType}:${r.targetId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const out = [];
  for (const list of groups.values()) {
    const latest = list[0];
    const reporterCount = await FriendsReport.count({
      distinct: true,
      col: 'reporterId',
      where: { targetType: latest.targetType, targetId: latest.targetId, status: { [Op.in]: reportsSvc.OPEN_STATUSES } },
    });
    const sev = list.reduce((m, r) => (reportsSvc.SEVERITY_RANK[r.severity] > reportsSvc.SEVERITY_RANK[m] ? r.severity : m), 'low');
    const due = list.map((r) => r.slaDueAt).filter(Boolean).map((d) => new Date(d).getTime());
    const slaDueAt = due.length ? new Date(Math.min(...due)) : null;
    out.push({
      targetType: latest.targetType,
      targetId: latest.targetId,
      latestReportId: latest.id,
      reportIds: list.map((r) => r.id),
      reporterCount,
      categories: [...new Set(list.map((r) => r.category))],
      severity: sev,
      status: latest.status,
      subTab: latest.subTab,
      assignedTo: latest.assignedTo,
      slaDueAt,
      overdue: !!slaDueAt && slaDueAt.getTime() < Date.now() && reportsSvc.OPEN_STATUSES.includes(latest.status),
      snapshot: latest.snapshot,
      lastReportedAt: latest.createdAt,
    });
  }
  res.json({ items: out, nextCursor });
};

const loadReport = async (id) => {
  requireUuid(id, 'report');
  const r = await getModel('FriendsReport').findByPk(id);
  if (!r) throw fail(404, 'REPORT_NOT_FOUND', 'Report not found.');
  return r;
};

// GET /reports/:id — evidence, all reports on the target, current state, prior actions, author history.
const getReport = async (req, res) => {
  const report = await loadReport(req.params.id);
  const FriendsReport = getModel('FriendsReport');
  const FriendsModAction = getModel('FriendsModAction');
  const FriendsSanction = getModel('FriendsSanction');
  const resolver = targets.get(report.targetType);
  const [siblings, actions] = await Promise.all([
    FriendsReport.findAll({ where: { targetType: report.targetType, targetId: report.targetId }, order: [['createdAt', 'DESC']], limit: 200 }),
    FriendsModAction.findAll({ where: { targetType: report.targetType, targetId: report.targetId }, order: [['createdAt', 'DESC']], limit: 100 }),
  ]);
  let currentState = null;
  try { currentState = resolver && resolver.currentState ? await resolver.currentState(report.targetId) : null; } catch { currentState = null; }

  // Anonymous content: history is summarised without linking a user id (reveal-author is separate and audited).
  const anonymous = !!(report.snapshot && report.snapshot.anonymous);
  let authorHistory = null;
  if (report.targetOwnerId) {
    const [sanctions, priorActions] = await Promise.all([
      FriendsSanction.findAll({ where: { userId: report.targetOwnerId }, order: [['createdAt', 'DESC']], limit: 50 }),
      FriendsModAction.count({ where: { subjectUserId: report.targetOwnerId, action: { [Op.in]: ['remove', 'hide', 'warn', 'sanction'] } } }),
    ]);
    authorHistory = anonymous
      ? { anonymous: true, sanctionCount: sanctions.length, priorActionCount: priorActions }
      : {
        anonymous: false,
        userId: report.targetOwnerId,
        priorActionCount: priorActions,
        sanctions: sanctions.map((s) => ({ id: s.id, scope: s.scope, until: s.until, liftedAt: s.liftedAt, reason: s.reason, createdAt: s.createdAt })),
      };
    if (!anonymous) {
      const u = await getModel('User').findByPk(report.targetOwnerId, { attributes: ['id', 'name'] });
      if (u) authorHistory.name = u.name;
    }
  }
  res.json({
    report: { ...reportPayload(report), snapshot: report.snapshot },
    reports: siblings.map((r) => reportPayload(r)),
    reporterCount: new Set(siblings.filter((r) => reportsSvc.OPEN_STATUSES.includes(r.status)).map((r) => r.reporterId)).size,
    currentState,
    actions: actions.map((a) => audit.serializeAction(a, { anonymous })),
    authorHistory,
    moderation: resolver ? { statuses: resolver.statuses || [], canReveal: !!resolver.revealAuthor } : { statuses: [], canReveal: false },
  });
};

// POST /reports/:id/assign { userId | 'me' }
const assignReport = async (req, res) => {
  const report = await loadReport(req.params.id);
  const raw = req.body && req.body.userId;
  const assignee = raw === 'me' || raw === undefined ? req.user.id : requireUuid(String(raw), 'moderator');
  if (assignee !== req.user.id) {
    const u = await getModel('User').findByPk(assignee, { attributes: ['id', 'role'] });
    if (!u || String(u.role || '').toLowerCase() !== 'admin') throw fail(400, 'NOT_A_MODERATOR', 'Reports can only be assigned to admins.');
  }
  if (!reportsSvc.OPEN_STATUSES.includes(report.status)) throw fail(409, 'ALREADY_RESOLVED', 'This report is already closed.');
  const FriendsReport = getModel('FriendsReport');
  await FriendsReport.update(
    { assignedTo: assignee, status: report.status === 'open' ? 'in_review' : report.status },
    { where: { targetType: report.targetType, targetId: report.targetId, status: { [Op.in]: ['open', 'in_review'] } } },
  );
  await FriendsReport.update({ assignedTo: assignee }, { where: { id: report.id } });
  const action = await audit.record({ actorId: req.user.id, actorRole: 'admin', action: 'assign', targetType: report.targetType, targetId: report.targetId, reportId: report.id, meta: { assignee } });
  notifyAdmin('friends_report', 'updated', report.id);
  res.json({ ok: true, assignedTo: assignee, actionId: action.id });
};

const DECISION_ACTION = { dismiss: 'dismiss', remove: 'remove', hide: 'hide', warn: 'warn', sanction: 'sanction', escalate: 'escalate' };

const parseSanction = (s) => {
  if (!s || typeof s !== 'object') throw fail(400, 'SANCTION_REQUIRED', 'Choose a sanction scope and length.');
  const scope = String(s.scope || 'friends');
  if (!E.SANCTION_SCOPES.includes(scope)) throw fail(400, 'INVALID_SANCTION', `Scope must be one of ${E.SANCTION_SCOPES.join(', ')}.`);
  if (s.permanent === true) return { scope, until: null };
  const days = Number(s.days);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw fail(400, 'INVALID_SANCTION', 'Sanction length must be 1-365 days (or permanent).');
  return { scope, until: new Date(Date.now() + days * 86400 * 1000), days };
};

// POST /reports/:id/resolve { decision, sanction?{scope,days|permanent}, note, notifyReporter }
const resolveReport = async (req, res) => {
  const report = await loadReport(req.params.id);
  const b = req.body || {};
  const decision = String(b.decision || '');
  if (!DECISION_ACTION[decision]) throw fail(400, 'INVALID_DECISION', 'Decision must be dismiss, remove, hide, warn, sanction or escalate.');
  const note = optText(b.note, 500, 'Note');
  if (!reportsSvc.OPEN_STATUSES.includes(report.status)) throw fail(409, 'ALREADY_RESOLVED', 'This report is already closed.');
  const resolver = targets.get(report.targetType);
  const subject = report.targetOwnerId || null;
  if (['remove', 'hide'].includes(decision)) {
    const want = decision === 'remove' ? 'removed' : 'hidden';
    if (!resolver || !resolver.setStatus || !(resolver.statuses || []).includes(want)) {
      throw fail(422, 'ACTION_NOT_SUPPORTED', `This kind of content cannot be ${want} from here.`);
    }
  }
  if (['warn', 'sanction'].includes(decision) && !subject) throw fail(422, 'NO_SUBJECT', 'There is no account to act on for this report.');
  const sanctionSpec = decision === 'sanction' ? parseSanction(b.sanction) : null;

  const sequelize = getSequelize();
  const FriendsReport = getModel('FriendsReport');
  const FriendsSanction = getModel('FriendsSanction');
  const wasAutoHidden = decision === 'dismiss' && (E.UGC_TARGETS || []).includes(report.targetType)
    ? await reportsSvc.isAutoHidden(report.targetType, report.targetId) : false;
  const result = await sequelize.transaction(async (transaction) => {
    // Re-check inside the transaction: two moderators resolving at once act only once.
    const fresh = await FriendsReport.findByPk(report.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!reportsSvc.OPEN_STATUSES.includes(fresh.status)) throw fail(409, 'ALREADY_RESOLVED', 'This report is already closed.');
    if (decision === 'remove') await resolver.setStatus(report.targetId, 'removed', { transaction });
    if (decision === 'hide') await resolver.setStatus(report.targetId, 'hidden', { transaction });
    // C2: campus content auto-hidden while it waited for review comes back when the reports are dismissed.
    let restored = false;
    if (decision === 'dismiss' && (E.UGC_TARGETS || []).includes(report.targetType) && resolver && resolver.setStatus
      && (resolver.statuses || []).includes('visible') && wasAutoHidden) {
      await resolver.setStatus(report.targetId, 'visible', { transaction });
      await audit.record({
        actorId: req.user.id, actorRole: 'admin', action: 'restore', targetType: report.targetType, targetId: report.targetId,
        anonymous: !!(report.snapshot && report.snapshot.anonymous), reportId: report.id, reason: note || 'Reports dismissed',
      }, { transaction });
      restored = true;
    }
    const action = await audit.record({
      actorId: req.user.id,
      actorRole: 'admin',
      action: DECISION_ACTION[decision],
      targetType: report.targetType,
      targetId: report.targetId,
      subjectUserId: ['remove', 'hide', 'warn', 'sanction'].includes(decision) ? subject : null,
      anonymous: !!(report.snapshot && report.snapshot.anonymous),
      reportId: report.id,
      reason: note,
      meta: { decision, ...(sanctionSpec ? { scope: sanctionSpec.scope, until: sanctionSpec.until, days: sanctionSpec.days || null } : {}) },
    }, { transaction });
    let sanction = null;
    if (sanctionSpec) {
      sanction = await FriendsSanction.create({
        userId: subject, scope: sanctionSpec.scope, until: sanctionSpec.until, reason: note, actionId: action.id, createdBy: req.user.id,
      }, { transaction });
    }
    const patch = decision === 'escalate'
      ? { status: 'escalated', actionId: action.id }
      : {
        status: decision === 'dismiss' ? 'dismissed' : 'actioned',
        resolvedBy: req.user.id,
        resolvedAt: new Date(),
        decision,
        resolution: note,
        actionId: action.id,
      };
    const statusesToClose = decision === 'escalate' ? ['open', 'in_review'] : reportsSvc.OPEN_STATUSES;
    const [closed] = await FriendsReport.update(patch, {
      where: { targetType: report.targetType, targetId: report.targetId, status: { [Op.in]: statusesToClose } },
      transaction,
    });
    return { action, sanction, closed, restored };
  });

  if (subject) eligibility.clearEligibility(subject);
  const reporters = decision === 'escalate' ? [] : (await FriendsReport.findAll({
    where: { actionId: result.action.id, isSystem: false }, attributes: ['reporterId'],
  })).map((r) => r.reporterId);
  if (b.notifyReporter !== false && reporters.length) {
    await notify('MOD_OUTCOME', reporters.filter((id) => id !== subject), { id: report.id, dedupeKey: `outcome:${result.action.id}`, data: { kind: 'report_outcome' } });
  }
  if (subject && ['remove', 'hide', 'warn', 'sanction'].includes(decision)) {
    await notify('MOD_OUTCOME', [subject], { id: result.action.id, dedupeKey: `decision:${result.action.id}`, data: { kind: 'decision', actionId: result.action.id } });
  }
  notifyAdmin('friends_report', 'updated', report.id, { scope: report.subTab });
  res.json({
    ok: true,
    decision,
    actionId: result.action.id,
    reportsClosed: result.closed,
    ...(result.restored ? { restored: true } : {}),
    sanction: result.sanction ? { id: result.sanction.id, scope: result.sanction.scope, until: result.sanction.until } : null,
  });
};

// POST /reveal-author { targetType, targetId, reason (>= 20 chars) } — admins only, audited before returning.
const revealAuthor = async (req, res) => {
  const b = req.body || {};
  const targetType = String(b.targetType || '');
  const targetId = requireUuid(String(b.targetId || ''), 'target');
  const reason = typeof b.reason === 'string' ? b.reason.trim() : '';
  if (reason.length < 20) throw fail(400, 'REASON_REQUIRED', 'Write a reason of at least 20 characters. This access is logged.');
  if (reason.length > 500) throw fail(400, 'TOO_LONG', 'Reason can be at most 500 characters.');
  const resolver = targets.get(targetType);
  if (!resolver) throw fail(404, 'TARGET_NOT_FOUND', 'Target not found.');
  if (!resolver.revealAuthor) throw fail(400, 'NOT_ANONYMOUS', 'This content is not anonymous.');
  limiter.enforce(req.user.id, 'reveal_author');
  const userId = await resolver.revealAuthor(targetId);
  if (!userId) throw fail(404, 'TARGET_NOT_FOUND', 'Target not found or not anonymous.');
  // Fail closed: no audit row, no identity.
  const action = await audit.record({
    actorId: req.user.id, actorRole: 'admin', action: 'reveal_author', targetType, targetId, subjectUserId: userId, reason,
  });
  const u = await getModel('User').findByPk(userId, { attributes: ['id', 'name'] });
  res.json({ userId, name: u ? u.name : null, actionId: action.id });
};

// ── Appeals ─────────────────────────────────────────────────────────────────
// GET /appeals?status=open|upheld|reversed&cursor=
const listAppeals = async (req, res) => {
  const FriendsAppeal = getModel('FriendsAppeal');
  const FriendsModAction = getModel('FriendsModAction');
  const status = listParam(req.query.status, E.APPEAL_STATUS, 'status') || ['open'];
  const where = { status: { [Op.in]: status } };
  const c = cursor.after(req.query.cursor);
  if (c) Object.assign(where, c);
  const limit = cursor.pageSize(req.query.limit, 30);
  const rows = await FriendsAppeal.findAll({ where, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: limit + 1 });
  const { items, nextCursor } = cursor.page(rows, limit);
  const actions = await FriendsModAction.findAll({ where: { id: { [Op.in]: items.map((a) => a.actionId) } } });
  const byId = new Map(actions.map((a) => [String(a.id), a]));
  res.json({
    items: items.map((a) => ({
      id: a.id,
      // An appeal against a decision on anonymous content must not unmask its author.
      userId: audit.isAnonymousAction(byId.get(String(a.actionId))) ? null : a.userId,
      actionId: a.actionId, text: a.text, status: a.status, note: a.note,
      reviewedBy: a.reviewedBy, reviewedAt: a.reviewedAt, createdAt: a.createdAt,
      action: byId.get(String(a.actionId)) ? audit.serializeAction(byId.get(String(a.actionId))) : null,
    })),
    nextCursor,
  });
};

// POST /appeals/:id/decide { decision: upheld|reversed, note }
const decideAppeal = async (req, res) => {
  const id = requireUuid(req.params.id, 'appeal');
  const decision = String((req.body && req.body.decision) || '');
  if (!['upheld', 'reversed'].includes(decision)) throw fail(400, 'INVALID_DECISION', 'Decision must be upheld or reversed.');
  const note = optText(req.body && req.body.note, 500, 'Note');
  const FriendsAppeal = getModel('FriendsAppeal');
  const FriendsModAction = getModel('FriendsModAction');
  const FriendsSanction = getModel('FriendsSanction');
  const sequelize = getSequelize();
  const out = await sequelize.transaction(async (transaction) => {
    const appeal = await FriendsAppeal.findByPk(id, { transaction });
    if (!appeal) throw fail(404, 'APPEAL_NOT_FOUND', 'Appeal not found.');
    const [n] = await FriendsAppeal.update(
      { status: decision, reviewedBy: req.user.id, reviewedAt: new Date(), note },
      { where: { id, status: 'open' }, transaction },
    );
    if (!n) throw fail(409, 'ALREADY_DECIDED', 'This appeal was already decided.');
    const action = await FriendsModAction.findByPk(appeal.actionId, { transaction });
    // Follow-up rows of a decision on anonymous content stay anonymous too (B3): otherwise the
    // lift / restore / appeal rows would pair the hidden author with the content in the audit list.
    const anonymous = audit.isAnonymousAction(action);
    const effects = [];
    if (decision === 'reversed' && action) {
      if (action.action === 'sanction') {
        const [lifted] = await FriendsSanction.update(
          { liftedAt: new Date(), liftedBy: req.user.id },
          { where: { actionId: action.id, liftedAt: null }, transaction },
        );
        if (lifted) {
          effects.push('sanction_lifted');
          await audit.record({ actorId: req.user.id, actorRole: 'admin', action: 'lift_sanction', targetType: 'user', targetId: appeal.userId, subjectUserId: appeal.userId, anonymous, reason: note, meta: { appealId: id, sourceActionId: action.id } }, { transaction });
        }
      } else if (['remove', 'hide', 'hide_pending'].includes(action.action)) {
        const resolver = targets.get(action.targetType);
        if (resolver && resolver.setStatus && (resolver.statuses || []).includes('visible')) {
          await resolver.setStatus(action.targetId, 'visible', { transaction });
          effects.push('content_restored');
          await audit.record({ actorId: req.user.id, actorRole: 'admin', action: 'restore', targetType: action.targetType, targetId: action.targetId, subjectUserId: appeal.userId, anonymous, reason: note, meta: { appealId: id, sourceActionId: action.id } }, { transaction });
        }
      }
    }
    const logged = await audit.record({
      actorId: req.user.id,
      actorRole: 'admin',
      action: decision === 'reversed' ? 'appeal_reversed' : 'appeal_upheld',
      targetType: action ? action.targetType : null,
      targetId: action ? action.targetId : null,
      subjectUserId: appeal.userId,
      anonymous,
      reason: note,
      meta: { appealId: id, sourceActionId: appeal.actionId, effects },
    }, { transaction });
    return { appeal, effects, logged };
  });
  eligibility.clearEligibility(out.appeal.userId);
  await notify('APPEAL_DECIDED', [out.appeal.userId], { id, dedupeKey: `appeal:${id}`, data: { decision } });
  notifyAdmin('friends_appeal', 'updated', id);
  res.json({ ok: true, decision, effects: out.effects, actionId: out.logged.id });
};

// ── Sanctions ───────────────────────────────────────────────────────────────
// A sanction issued over anonymous content does not link to its source action (B3): the action
// row names the content, and sanction.userId + action.targetId together would unmask the author.
const sanctionPayload = (s, anonymous = false) => ({
  id: s.id, userId: s.userId, scope: s.scope, until: s.until, reason: s.reason, actionId: anonymous ? null : s.actionId,
  anonymous: !!anonymous,
  createdBy: s.createdBy, liftedAt: s.liftedAt, liftedBy: s.liftedBy, createdAt: s.createdAt,
  active: !s.liftedAt && (!s.until || new Date(s.until).getTime() > Date.now()),
});
const anonymousActionIds = async (actionIds) => {
  const ids = [...new Set(actionIds.filter(Boolean).map(String))];
  if (!ids.length) return new Set();
  const rows = await getModel('FriendsModAction').findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'meta'] });
  return new Set(rows.filter((a) => audit.isAnonymousAction(a)).map((a) => String(a.id)));
};

// GET /sanctions?userId=&active=true|false&cursor=
const listSanctions = async (req, res) => {
  const FriendsSanction = getModel('FriendsSanction');
  const where = {};
  if (req.query.userId) where.userId = requireUuid(String(req.query.userId), 'user');
  const and = [];
  if (req.query.active === 'true') {
    where.liftedAt = null;
    and.push({ [Op.or]: [{ until: null }, { until: { [Op.gt]: new Date() } }] });
  }
  const c = cursor.after(req.query.cursor);
  if (c) and.push(c);
  if (and.length) where[Op.and] = and;
  const limit = cursor.pageSize(req.query.limit, 30);
  const rows = await FriendsSanction.findAll({ where, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: limit + 1 });
  const { items, nextCursor } = cursor.page(rows, limit);
  const anon = await anonymousActionIds(items.map((s) => s.actionId));
  res.json({ items: items.map((s) => sanctionPayload(s, anon.has(String(s.actionId)))), nextCursor });
};

// POST /sanctions { userId, scope, days | permanent, reason }
const createSanction = async (req, res) => {
  const b = req.body || {};
  const userId = requireUuid(String(b.userId || ''), 'user');
  const u = await getModel('User').findByPk(userId, { attributes: ['id', 'role'] });
  if (!u) throw fail(404, 'USER_NOT_FOUND', 'User not found.');
  if (String(u.role || '').toLowerCase() === 'admin') throw fail(400, 'CANNOT_SANCTION_ADMIN', 'Admins cannot be sanctioned here.');
  const spec = parseSanction(b);
  const reason = optText(b.reason, 500, 'Reason');
  if (!reason) throw fail(400, 'REASON_REQUIRED', 'Write a reason for the sanction.');
  const sequelize = getSequelize();
  const FriendsSanction = getModel('FriendsSanction');
  const out = await sequelize.transaction(async (transaction) => {
    const action = await audit.record({ actorId: req.user.id, actorRole: 'admin', action: 'sanction', targetType: 'user', targetId: userId, subjectUserId: userId, reason, meta: { scope: spec.scope, until: spec.until } }, { transaction });
    const sanction = await FriendsSanction.create({ userId, scope: spec.scope, until: spec.until, reason, actionId: action.id, createdBy: req.user.id }, { transaction });
    return { action, sanction };
  });
  eligibility.clearEligibility(userId);
  await notify('MOD_OUTCOME', [userId], { id: out.action.id, dedupeKey: `decision:${out.action.id}`, data: { kind: 'decision', actionId: out.action.id } });
  res.status(201).json({ sanction: sanctionPayload(out.sanction), actionId: out.action.id });
};

// POST /sanctions/:id/lift { reason }
const liftSanction = async (req, res) => {
  const id = requireUuid(req.params.id, 'sanction');
  const reason = optText(req.body && req.body.reason, 500, 'Reason');
  const FriendsSanction = getModel('FriendsSanction');
  const s = await FriendsSanction.findByPk(id);
  if (!s) throw fail(404, 'SANCTION_NOT_FOUND', 'Sanction not found.');
  const [n] = await FriendsSanction.update({ liftedAt: new Date(), liftedBy: req.user.id }, { where: { id, liftedAt: null } });
  if (!n) throw fail(409, 'ALREADY_LIFTED', 'This sanction was already lifted.');
  const anonymous = (await anonymousActionIds([s.actionId])).has(String(s.actionId));
  const action = await audit.record({ actorId: req.user.id, actorRole: 'admin', action: 'lift_sanction', targetType: 'user', targetId: s.userId, subjectUserId: s.userId, anonymous, reason, meta: { sanctionId: id } });
  eligibility.clearEligibility(s.userId);
  res.json({ ok: true, actionId: action.id });
};

// GET /actions?targetId=&actorId=&subjectUserId=&action=&cursor=
const listActions = async (req, res) => {
  const FriendsModAction = getModel('FriendsModAction');
  const where = {};
  for (const k of ['targetId', 'actorId', 'subjectUserId']) if (req.query[k]) where[k] = requireUuid(String(req.query[k]), k);
  const actions = listParam(req.query.action, E.MOD_ACTIONS, 'action');
  if (actions) where.action = { [Op.in]: actions };
  const c = cursor.after(req.query.cursor);
  if (c) Object.assign(where, c);
  const limit = cursor.pageSize(req.query.limit, 30);
  const rows = await FriendsModAction.findAll({ where, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: limit + 1 });
  const { items, nextCursor } = cursor.page(rows, limit);
  // Filtering by subject must not list one person's anonymous content (that is a reveal-author).
  const shown = where.subjectUserId ? items.filter((a) => !audit.isAnonymousAction(a)) : items;
  res.json({ items: shown.map((a) => audit.serializeAction(a)), nextCursor });
};

// ── Config ──────────────────────────────────────────────────────────────────
const configPayload = (cfg) => ({
  config: cfg,
  implemented: Object.fromEntries(E.FEATURES.map((f) => [f, flags.isImplemented(f)])),
  effective: flags.featureMap(cfg),
});

const getConfig = async (req, res) => {
  res.json(configPayload(await flags.getConfig({ fresh: true })));
};

const putConfig = async (req, res) => {
  const patch = req.body || {};
  const { errors, config } = await flags.setConfig(patch);
  if (errors) throw fail(400, 'INVALID_CONFIG', errors[0], { errors });
  await audit.record({ actorId: req.user.id, actorRole: 'admin', action: 'config_update', targetType: 'config', meta: { keys: Object.keys(patch).slice(0, 20), features: config.features, enabled: config.enabled, guidelinesVersion: config.guidelines.version } });
  eligibility.clearEligibility();
  res.json(configPayload(config));
};

// ── Verified entities & badges ──────────────────────────────────────────────
const HANDLE_RE = /^[a-z0-9_]{3,40}$/;
const entityPayload = (e) => ({
  id: e.id, campusId: e.campusId, type: e.type, name: e.name, handle: e.handle, description: e.description,
  avatarUrl: e.avatarUrl, verified: !!e.verified, managerIds: e.managerIds || [], status: e.status, createdAt: e.createdAt,
});

const validateManagers = async (list, campusId) => {
  if (list === undefined) return undefined;
  if (!Array.isArray(list) || list.length > 20 || list.some((x) => !isUuid(x))) throw fail(400, 'INVALID_INPUT', 'managerIds must be up to 20 user ids.');
  const ids = [...new Set(list)];
  if (!ids.length) return [];
  const profiles = await getModel('CampusProfile').findAll({ where: { userId: { [Op.in]: ids } }, attributes: ['userId', 'campusId', 'verificationStatus'] });
  const ok = new Set(profiles.filter((p) => String(p.campusId) === String(campusId) && p.verificationStatus === 'verified').map((p) => String(p.userId)));
  const bad = ids.filter((i) => !ok.has(String(i)));
  if (bad.length) throw fail(400, 'INVALID_MANAGER', 'Managers must be verified students of the same campus.', { userIds: bad });
  return ids;
};

const entityFields = async (b, existing) => {
  const campusId = existing ? existing.campusId : requireUuid(String(b.campusId || ''), 'campus');
  if (!existing) {
    const Campus = getModel('Campus');
    if (!(await Campus.findByPk(campusId))) throw fail(404, 'CAMPUS_NOT_FOUND', 'Campus not found.');
  }
  const out = {};
  if (b.type !== undefined || !existing) {
    if (!E.ENTITY_TYPES.includes(b.type)) throw fail(400, 'INVALID_INPUT', `type must be one of ${E.ENTITY_TYPES.join(', ')}.`);
    out.type = b.type;
  }
  if (b.name !== undefined || !existing) {
    const name = optText(b.name, 80, 'Name');
    if (!name || name.length < 2) throw fail(400, 'INVALID_INPUT', 'Name must be 2-80 characters.');
    out.name = name;
  }
  if (b.handle !== undefined || !existing) {
    const handle = String(b.handle || '').trim().toLowerCase();
    if (!HANDLE_RE.test(handle)) throw fail(400, 'INVALID_HANDLE', 'Handle must be 3-40 lower-case letters, digits or _.');
    out.handle = handle;
  }
  if (b.description !== undefined) out.description = optText(b.description, 300, 'Description');
  if (b.avatarUrl !== undefined) {
    const { cleanImageRef } = require('../../campus/campusHelpers');
    const v = b.avatarUrl ? cleanImageRef(String(b.avatarUrl), { maxDataUrlChars: 0 }) : null;
    if (b.avatarUrl && !v) throw fail(400, 'INVALID_INPUT', 'Avatar must be an uploaded campus image or an https URL.');
    out.avatarUrl = v;
  }
  if (b.verified !== undefined) {
    if (typeof b.verified !== 'boolean') throw fail(400, 'INVALID_INPUT', 'verified must be true or false.');
    out.verified = b.verified;
  }
  if (b.status !== undefined) {
    if (!E.ENTITY_STATUS.includes(b.status)) throw fail(400, 'INVALID_INPUT', 'status must be active or disabled.');
    out.status = b.status;
  }
  const managers = await validateManagers(b.managerIds, campusId);
  if (managers !== undefined) out.managerIds = managers;
  return { campusId, ...out };
};

// GET /entities?campusId=&q=
const listEntities = async (req, res) => {
  const FriendsEntity = getModel('FriendsEntity');
  const where = {};
  if (req.query.campusId) where.campusId = requireUuid(String(req.query.campusId), 'campus');
  if (req.query.q) {
    const term = String(req.query.q).trim().slice(0, 60).replace(/[%_\\]/g, '');
    if (term) where[Op.or] = [{ name: { [likeOp()]: `%${term}%` } }, { handle: { [likeOp()]: `%${term.toLowerCase()}%` } }];
  }
  const rows = await FriendsEntity.findAll({ where, order: [['name', 'ASC']], limit: 500 });
  res.json({ items: rows.map(entityPayload) });
};

const createEntity = async (req, res) => {
  const fields = await entityFields(req.body || {}, null);
  const FriendsEntity = getModel('FriendsEntity');
  let e;
  try {
    e = await FriendsEntity.create({ ...fields, createdBy: req.user.id });
  } catch (err) {
    if (isUniqueError(err)) throw fail(409, 'HANDLE_TAKEN', 'That handle is already used on this campus.');
    throw err;
  }
  await audit.record({ actorId: req.user.id, actorRole: 'admin', action: 'entity_create', targetType: 'entity', targetId: e.id, meta: { name: e.name, handle: e.handle, verified: !!e.verified } });
  res.status(201).json({ entity: entityPayload(e) });
};

const updateEntity = async (req, res) => {
  const id = requireUuid(req.params.id, 'entity');
  const FriendsEntity = getModel('FriendsEntity');
  const e = await FriendsEntity.findByPk(id);
  if (!e) throw fail(404, 'ENTITY_NOT_FOUND', 'Entity not found.');
  const { campusId: _c, ...fields } = await entityFields(req.body || {}, e);
  Object.assign(e, fields);
  try {
    await e.save();
  } catch (err) {
    if (isUniqueError(err)) throw fail(409, 'HANDLE_TAKEN', 'That handle is already used on this campus.');
    throw err;
  }
  await audit.record({ actorId: req.user.id, actorRole: 'admin', action: 'entity_update', targetType: 'entity', targetId: e.id, meta: { fields: Object.keys(fields) } });
  res.json({ entity: entityPayload(e) });
};

const BADGE_RE = /^[a-z_]{3,40}$/;

// POST /badges { userId, code }
const grantBadge = async (req, res) => {
  const userId = requireUuid(String((req.body && req.body.userId) || ''), 'user');
  const code = String((req.body && req.body.code) || '').trim();
  if (!BADGE_RE.test(code)) throw fail(400, 'INVALID_BADGE', 'Badge code must be 3-40 lower-case letters or _.');
  if (!(await getModel('User').findByPk(userId, { attributes: ['id'] }))) throw fail(404, 'USER_NOT_FOUND', 'User not found.');
  const FriendsBadge = getModel('FriendsBadge');
  const existing = await FriendsBadge.findOne({ where: { userId, code } });
  if (existing) return res.json({ badge: { id: existing.id, userId, code, source: existing.source }, duplicate: true });
  const badge = await FriendsBadge.create({ userId, code, source: 'admin', grantedBy: req.user.id });
  await audit.record({ actorId: req.user.id, actorRole: 'admin', action: 'badge_grant', targetType: 'user', targetId: userId, subjectUserId: userId, meta: { code } });
  res.status(201).json({ badge: { id: badge.id, userId, code, source: 'admin' } });
};

// DELETE /badges/:id
const revokeBadge = async (req, res) => {
  const id = requireUuid(req.params.id, 'badge');
  const FriendsBadge = getModel('FriendsBadge');
  const badge = await FriendsBadge.findByPk(id);
  if (!badge) throw fail(404, 'BADGE_NOT_FOUND', 'Badge not found.');
  await badge.destroy();
  await audit.record({ actorId: req.user.id, actorRole: 'admin', action: 'badge_revoke', targetType: 'user', targetId: badge.userId, subjectUserId: badge.userId, meta: { code: badge.code } });
  res.json({ ok: true });
};


// ── C2: campus kill switches (Whispers, After Dark) ─────────────────────────
// GET /switches -> { whispers: bool, afterDark: bool }
const getSwitches = async (req, res) => {
  const sw = require('../../../utils/featureSwitches');
  const out = {};
  for (const name of Object.keys(sw.SWITCHES)) out[name] = await sw.isOn(name, { fresh: true });
  res.json({ switches: out, keys: Object.fromEntries(Object.entries(sw.SWITCHES).map(([k, v]) => [k, v.key])) });
};

// PUT /switches { whispers?: bool, afterDark?: bool } — audited as config_update.
const putSwitches = async (req, res) => {
  const sw = require('../../../utils/featureSwitches');
  const b = req.body || {};
  const changes = Object.entries(b).filter(([k]) => sw.SWITCHES[k]);
  if (!changes.length) throw fail(400, 'NOTHING_TO_CHANGE', `Send one of: ${Object.keys(sw.SWITCHES).join(', ')}.`);
  for (const [k, v] of changes) if (typeof v !== 'boolean') throw fail(400, 'INVALID_SWITCH', `${k} must be true or false.`);
  for (const [k, v] of changes) {
    await sw.setOn(k, v);
    await audit.recordSafe({ actorId: req.user.id, actorRole: 'admin', action: 'config_update', reason: `${sw.SWITCHES[k].label} turned ${v ? 'on' : 'off'}`, meta: { switch: sw.SWITCHES[k].key, enabled: v } });
  }
  const out = {};
  for (const name of Object.keys(sw.SWITCHES)) out[name] = await sw.isOn(name);
  notifyAdmin('friends_config', 'updated', 'switches');
  res.json({ ok: true, switches: out });
};


// C2: POST /content/:type/:id { action: 'remove'|'hide'|'restore', reason } — take campus content down
// (or bring it back) without waiting for a report, e.g. a whisper an admin spotted. Audited; open
// reports on the target are left for the queue (resolve them there to notify reporters).
const CONTENT_ACTION_STATUS = { remove: 'removed', hide: 'hidden', restore: 'visible' };
const setContentStatus = async (req, res) => {
  const targetType = String(req.params.type || '');
  const targetId = requireUuid(String(req.params.id || ''), 'target');
  const action = String((req.body && req.body.action) || '');
  const status = CONTENT_ACTION_STATUS[action];
  if (!status) throw fail(400, 'INVALID_ACTION', 'Action must be remove, hide or restore.');
  if (!(E.UGC_TARGETS || []).includes(targetType)) throw fail(400, 'INVALID_TARGET', 'That kind of content cannot be moderated from here.');
  const reason = optText(req.body && req.body.reason, 500, 'Reason');
  const resolver = targets.get(targetType);
  if (!resolver || !resolver.setStatus || !(resolver.statuses || []).includes(status)) throw fail(422, 'ACTION_NOT_SUPPORTED', 'This kind of content cannot be changed from here.');
  const target = await resolver.load(targetId, {});
  if (!target) throw fail(404, 'TARGET_NOT_FOUND', 'Target not found.');
  const anonymous = !!(target.snapshot && target.snapshot.anonymous);
  const sequelize = getSequelize();
  const logged = await sequelize.transaction(async (transaction) => {
    await resolver.setStatus(targetId, status, { transaction });
    return audit.record({
      actorId: req.user.id, actorRole: 'admin', action, targetType, targetId,
      subjectUserId: action === 'restore' ? null : (target.ownerId || null), anonymous, reason,
      meta: { direct: true, snapshot: target.snapshot ? { excerpt: target.snapshot.excerpt } : null },
    }, { transaction });
  });
  notifyAdmin('friends_report', 'updated', targetId);
  res.json({ ok: true, targetType, targetId, status, actionId: logged.id });
};


// C2: GET /whispers?status=visible|hidden|all&limit= — recent Campus Whispers for the admin board
// (author never included: use the audited reveal-author on a report, or warn / sanction from it).
const listWhispers = async (req, res) => {
  const W = getModel('CampusWhisper');
  if (!W) return res.json({ items: [] });
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const where = {};
  if (req.query.before) {
    const d = new Date(String(req.query.before));
    if (!Number.isNaN(d.getTime())) where.createdAt = { [Op.lt]: d };
  }
  const rows = await W.findAll({ where, order: [['createdAt', 'DESC']], limit, attributes: ['id', 'alias', 'topic', 'text', 'hearts', 'createdAt'] });
  const ids = rows.map((r) => r.id);
  const State = getModel('FriendsContentState');
  const states = ids.length && State ? await State.findAll({ where: { targetType: 'whisper', targetId: { [Op.in]: ids } }, attributes: ['targetId', 'status'], raw: true }) : [];
  const stateBy = new Map(states.map((x) => [String(x.targetId), x.status]));
  const counts = ids.length ? await getModel('FriendsReport').findAll({
    where: { targetType: 'whisper', targetId: { [Op.in]: ids }, status: { [Op.in]: reportsSvc.OPEN_STATUSES } },
    attributes: ['targetId', 'reporterId'], raw: true,
  }) : [];
  const reportersBy = new Map();
  counts.forEach((r) => { const k = String(r.targetId); if (!reportersBy.has(k)) reportersBy.set(k, new Set()); reportersBy.get(k).add(r.reporterId); });
  let items = rows.map((w) => ({
    id: w.id, alias: w.alias, topic: w.topic, text: w.text, hearts: (w.hearts || []).length, createdAt: w.createdAt,
    status: stateBy.get(String(w.id)) || 'visible', openReporters: reportersBy.has(String(w.id)) ? reportersBy.get(String(w.id)).size : 0,
  }));
  if (req.query.status === 'visible') items = items.filter((i) => i.status === 'visible');
  else if (req.query.status === 'hidden') items = items.filter((i) => i.status !== 'visible');
  res.json({ items, nextBefore: rows.length === limit ? rows[rows.length - 1].createdAt : null });
};

module.exports = {
  listWhispers,
  setContentStatus,
  getSwitches,
  putSwitches,
  getQueue,
  getReport,
  assignReport,
  resolveReport,
  revealAuthor,
  listAppeals,
  decideAppeal,
  listSanctions,
  createSanction,
  liftSanction,
  listActions,
  getConfig,
  putConfig,
  listEntities,
  createEntity,
  updateEntity,
  grantBadge,
  revokeBadge,
};
