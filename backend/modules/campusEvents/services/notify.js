// Campus Events notifications. Never throws, never blocks the request (fire-and-forget, after commit).
//  Students: push + in-app Notification row (campus pushToUsers -> utils/push) with ids-only data
//            { type: CE_*, eventId, registrationId?, teamId?, ticketId?, screen: 'campus_event' } and a
//            socket nudge `campus_event:changed` { kind, id, status } to room user_<id>.
//  Public:   data:changed type 'campus_event' (ids only) so browse / detail screens refetch.
//  Admins:   admin:changed type 'campus_event_admin'.
// Dedupe: a (type, entity, user) key is sent at most once per DEDUPE_MS in this process; the state
// machine only reaches each transition once (conditional updates), and reminders / deadline notices are
// additionally guarded by sent-at timestamps on the event / slot rows.
const realtime = require('../../../utils/realtime');

const pending = new Set();
const track = (p) => {
  pending.add(p);
  p.finally(() => pending.delete(p));
  return p;
};
const idle = async () => { while (pending.size) await Promise.allSettled([...pending]); };

const DEDUPE_MS = 10 * 60 * 1000;
const recent = new Map();
setInterval(() => {
  const t = Date.now();
  for (const [k, at] of recent) if (t - at > DEDUPE_MS) recent.delete(k);
}, 5 * 60 * 1000).unref?.();
const resetDedupe = () => recent.clear();

const ids = (list) => [...new Set((Array.isArray(list) ? list : [list]).filter(Boolean).map(String))];

/** Push + in-app row to each user (once per dedupe key). data: ids only. */
const toUsers = (userIds, title, body, data = {}) => {
  const entity = data.registrationId || data.teamId || data.ticketId || data.eventId || '';
  const list = ids(userIds).filter((uid) => {
    if (!data.type) return true;
    const key = `${data.type}:${entity}:${data.dedupe || ''}:${uid}`;
    if (recent.has(key)) return false;
    recent.set(key, Date.now());
    return true;
  });
  if (!list.length || !title) return;
  const clean = {};
  for (const [k, v] of Object.entries({ screen: 'campus_event', ...data })) {
    if (k !== 'dedupe' && v !== undefined && v !== null && typeof v !== 'object') clean[k] = String(v);
  }
  track(Promise.resolve()
    .then(() => require('../../campus/campusHelpers').pushToUsers(list, title, body, clean))
    .catch((err) => console.warn('[CAMPUS_EVENTS_PUSH_WARN]', err.message)));
};

const nudge = (userIds, kind, id, status) => {
  ids(userIds).forEach((uid) => realtime.toUser(uid, 'campus_event:changed', { kind, id, ...(status ? { status } : {}) }));
};
const eventChanged = (eventId) => realtime.publish('campus_event', 'updated', eventId);
const admin = (action, id) => realtime.notifyAdmin('campus_event_admin', action, id);

/** One registration changed: its owner (push optional) + team members nudged. */
const registrationEvent = (reg, { title, body, type, extraUsers = [] } = {}) => {
  const who = [reg.userId, ...extraUsers];
  if (title) toUsers(who, title, body, { type, eventId: reg.eventId, registrationId: reg.id, ...(reg.teamId ? { teamId: reg.teamId } : {}) });
  nudge(who, 'registration', reg.id, reg.status);
  eventChanged(reg.eventId);
  admin('updated', reg.eventId);
};

/** Accepted members of a team (for team registration notices). */
const teamUserIds = async (teamId) => {
  if (!teamId) return [];
  try {
    const { getModel } = require('../index');
    const rows = await getModel('CeTeamMember').findAll({ where: { teamId, status: 'ACCEPTED' }, attributes: ['userId'] });
    return rows.map((r) => String(r.userId));
  } catch {
    return [];
  }
};

/** Registration notice to the registrant, or to every accepted member for a team registration. */
const registrationNotice = (reg, opts) => {
  track(Promise.resolve().then(async () => {
    const extra = reg.teamId ? await teamUserIds(reg.teamId) : [];
    registrationEvent(reg, { ...opts, extraUsers: extra });
  }).catch((err) => console.warn('[CAMPUS_EVENTS_NOTIFY_WARN]', err.message)));
};

/** Everyone holding an open registration on an event (optionally by status / slot), team members included. */
const registrantIds = async (eventId, { statuses, slotId } = {}) => {
  const { getModel } = require('../index');
  const { Op } = require('sequelize');
  const E = require('../enums');
  const where = { eventId, status: { [Op.in]: statuses || [E.REG_STATUS.CONFIRMED, E.REG_STATUS.PENDING_APPROVAL, E.REG_STATUS.PENDING_PAYMENT, E.REG_STATUS.OFFERED, E.REG_STATUS.WAITLISTED, E.REG_STATUS.HELD] } };
  if (slotId) where.slotId = slotId;
  const regs = await getModel('CeRegistration').findAll({ where, attributes: ['id', 'userId', 'teamId'] });
  const out = new Set(regs.map((r) => String(r.userId)));
  const teamIds = regs.map((r) => r.teamId).filter(Boolean);
  if (teamIds.length) {
    const members = await getModel('CeTeamMember').findAll({ where: { teamId: { [Op.in]: teamIds }, status: 'ACCEPTED' }, attributes: ['userId'] });
    members.forEach((m) => out.add(String(m.userId)));
  }
  return [...out];
};

/** Event-wide notice to registrants (+ public refresh). */
const eventBroadcast = (event, { title, body, type, statuses, slotId, dedupe } = {}) => {
  track(Promise.resolve().then(async () => {
    const who = await registrantIds(event.id, { statuses, slotId });
    if (title && who.length) toUsers(who, title, body, { type, eventId: event.id, ...(slotId ? { slotId } : {}), ...(dedupe ? { dedupe } : {}) });
    nudge(who, 'event', event.id, event.status);
  }).catch((err) => console.warn('[CAMPUS_EVENTS_NOTIFY_WARN]', err.message)));
  eventChanged(event.id);
  admin('updated', event.id);
};

const toOrganizer = (event, title, body, type) => {
  toUsers([event.organizerUserId], title, body, { type, eventId: event.id });
  nudge([event.organizerUserId], 'event', event.id, event.status);
  admin('updated', event.id);
};

module.exports = { track, toUsers, nudge, eventChanged, admin, registrationEvent, registrationNotice, eventBroadcast, toOrganizer, registrantIds, teamUserIds, idle, resetDedupe };
