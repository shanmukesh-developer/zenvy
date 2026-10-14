/**
 * Filing reports (users, and the system for flagged content / disputes). Shared by every phase.
 * A report never removes content by itself, with one exception: threat / self_harm / privacy (doxxing)
 * reports from >= autoHideThreshold distinct reporters move the target to pending_review and log a
 * system 'hide_pending' action, until a moderator decides.
 */
const { Op } = require('sequelize');
const { getModel } = require('../index');
const targets = require('./targets');
const limiter = require('./limiter');
const flags = require('./featureFlags');
const audit = require('./audit');
const { fail, isUniqueError } = require('./http');
const E = require('../models/foundation/enums');

const SYSTEM_REPORTER_ID = '00000000-0000-0000-0000-000000000000';
const OPEN_STATUSES = ['open', 'in_review', 'escalated'];
const AUTO_HIDE_CATEGORIES = ['threat', 'self_harm', 'privacy'];

const SEVERITY = {
  threat: 'critical',
  self_harm: 'critical',
  harassment: 'high',
  hate: 'high',
  sexual: 'high',
  privacy: 'high',
  impersonation: 'medium',
  academic_integrity: 'medium',
  defamation: 'medium',
  spam: 'low',
  other: 'low',
};
const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

const notifyAdminSafe = (action, id, extra) => {
  try { require('../../../utils/realtime').notifyAdmin('friends_report', action, id, extra); } catch { /* optional */ }
};

/** Has the system already hidden this target (and nobody restored it since)? */
const isAutoHidden = async (targetType, targetId) => {
  const FriendsModAction = getModel('FriendsModAction');
  const last = await FriendsModAction.findOne({
    where: { targetType, targetId, action: { [Op.in]: ['hide_pending', 'restore'] } },
    order: [['createdAt', 'DESC']],
  });
  return !!last && last.action === 'hide_pending';
};

const maybeAutoHide = async (resolver, report, cfg) => {
  if (!AUTO_HIDE_CATEGORIES.includes(report.category)) return false;
  if (!resolver.setStatus || !(resolver.statuses || []).includes('pending_review')) return false;
  const FriendsReport = getModel('FriendsReport');
  const reporters = await FriendsReport.count({
    distinct: true,
    col: 'reporterId',
    where: {
      targetType: report.targetType,
      targetId: report.targetId,
      category: { [Op.in]: AUTO_HIDE_CATEGORIES },
      status: { [Op.in]: OPEN_STATUSES },
      isSystem: false,
    },
  });
  if (reporters < cfg.autoHideThreshold) return false;
  if (await isAutoHidden(report.targetType, report.targetId)) return false;
  await resolver.setStatus(report.targetId, 'pending_review', {});
  await audit.record({
    actorId: null,
    actorRole: 'system',
    action: 'hide_pending',
    targetType: report.targetType,
    targetId: report.targetId,
    subjectUserId: report.targetOwnerId,
    anonymous: !!(report.snapshot && report.snapshot.anonymous),
    reportId: report.id,
    reason: `Auto-hidden after ${reporters} reports (${report.category})`,
    meta: { reporters },
  });
  return true;
};

/**
 * @param {object} p { reporterId, targetType, targetId, category, note, isSystem, subTab? }
 * @returns {Promise<{ report, duplicate: boolean, autoHidden: boolean }>}
 */
const fileReport = async (p) => {
  const isSystem = !!p.isSystem;
  const reporterId = isSystem ? SYSTEM_REPORTER_ID : p.reporterId;
  if (!E.REPORT_TARGETS.includes(p.targetType)) throw fail(400, 'INVALID_TARGET', 'You cannot report that.');
  if (!E.REPORT_CATEGORIES.includes(p.category)) throw fail(400, 'INVALID_CATEGORY', 'Pick a reason for the report.');
  const resolver = targets.get(p.targetType);
  if (!resolver) throw fail(404, 'TARGET_NOT_FOUND', 'We could not find that.');
  const target = await resolver.load(p.targetId, { viewerId: isSystem ? null : reporterId });
  if (!target) throw fail(404, 'TARGET_NOT_FOUND', 'We could not find that.');
  if (!isSystem && target.ownerId && String(target.ownerId) === String(reporterId)) {
    throw fail(400, 'CANNOT_REPORT_SELF', 'You cannot report your own content.');
  }

  const FriendsReport = getModel('FriendsReport');
  const existing = await FriendsReport.findOne({ where: { reporterId, targetType: p.targetType, targetId: p.targetId } });
  if (existing && isSystem && !OPEN_STATUSES.includes(existing.status)) {
    // One system report row per target (unique reporter/target): an edit flagged after an earlier
    // system report was closed must reopen it, or the content sits in pending_review with nothing
    // in the moderation queue.
    const cfgR = await flags.getConfig();
    const sev = SEVERITY[p.category] || 'low';
    await FriendsReport.update({
      status: 'open',
      category: p.category,
      severity: sev,
      note: p.note || null,
      targetOwnerId: target.ownerId || existing.targetOwnerId || null,
      snapshot: { ...(target.snapshot || {}), reportedAt: new Date().toISOString() },
      slaDueAt: new Date(Date.now() + (cfgR.slaHours[sev] || 48) * 3600 * 1000),
      resolvedBy: null,
      resolvedAt: null,
      decision: null,
      resolution: null,
      actionId: null,
    }, { where: { id: existing.id, status: { [Op.notIn]: OPEN_STATUSES } } });
    await existing.reload();
    notifyAdminSafe('created', existing.id, { scope: existing.subTab });
    return { report: existing, duplicate: false, reopened: true, autoHidden: false };
  }
  if (existing) return { report: existing, duplicate: true, autoHidden: false };

  if (!isSystem) limiter.enforce(reporterId, 'report');

  const cfg = await flags.getConfig();
  const severity = SEVERITY[p.category] || 'low';
  const subTab = E.SUB_TABS.includes(target.subTab) ? target.subTab : 'chat';
  let report;
  try {
    report = await FriendsReport.create({
      campusId: target.campusId || null,
      reporterId,
      targetType: p.targetType,
      targetId: p.targetId,
      targetOwnerId: target.ownerId || null,
      subTab,
      category: p.category,
      note: p.note || null,
      snapshot: { ...(target.snapshot || {}), reportedAt: new Date().toISOString() },
      severity,
      status: 'open',
      isSystem,
      slaDueAt: new Date(Date.now() + (cfg.slaHours[severity] || 48) * 3600 * 1000),
    });
  } catch (err) {
    if (!isUniqueError(err)) throw err;
    const again = await FriendsReport.findOne({ where: { reporterId, targetType: p.targetType, targetId: p.targetId } });
    return { report: again, duplicate: true, autoHidden: false };
  }

  let autoHidden = false;
  try {
    autoHidden = await maybeAutoHide(resolver, report, cfg);
  } catch (err) {
    console.warn('[FRIENDS_AUTOHIDE_WARN]', err.message);
  }
  notifyAdminSafe('created', report.id, { scope: subTab });
  return { report, duplicate: false, autoHidden };
};

/** System report for content the content policy flagged (or a task dispute). Never throws. */
const fileSystemReport = async ({ targetType, targetId, category = 'other', note }) => {
  try {
    return await fileReport({ isSystem: true, targetType, targetId, category, note: note ? String(note).slice(0, 500) : null });
  } catch (err) {
    console.warn('[FRIENDS_SYSTEM_REPORT_WARN]', targetType, err.message);
    return null;
  }
};

module.exports = {
  fileReport,
  fileSystemReport,
  SEVERITY,
  SEVERITY_RANK,
  OPEN_STATUSES,
  AUTO_HIDE_CATEGORIES,
  SYSTEM_REPORTER_ID,
  notifyAdminSafe,
};
