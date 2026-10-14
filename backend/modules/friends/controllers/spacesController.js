/**
 * Friends > Spaces (Phase 5): /api/campus/spaces. Contract: backend_contract.md "Friends (spaces)".
 *
 * Live audio rooms for verified students of one campus, over plain WebRTC (owner decision; no
 * LiveKit, no media server). This file is the REST side: create (start now or schedule), reschedule,
 * start, cancel, end, "Remind me", lists, detail, admin monitor + force end, the 'space' report
 * target, and finishSpace(), the one place a Space leaves the live / scheduled states. The live room
 * (roles, hands, mute, remove, signaling) is socket/spaces.js + socket/spacesState.js.
 *
 * Lifecycle (server-only transitions, each ONE conditional UPDATE ... WHERE status = <expected>):
 *   scheduled ──start──▶ live ──end / host_left / empty / server_restart / moderation──▶ ended
 *   scheduled ──cancel / moderation──▶ cancelled          scheduled ──not started 60 min after──▶ expired
 *   create(startNow) ──▶ live
 * "One live Space per host" is also a database rule (partial unique fsp_one_live).
 *
 * Privacy: Spaces are never anonymous (hosts are named, like Tasks). Reminder lists, member rows,
 * removals and reports are never sent to students; counts are. Spaces are never recorded: there is no
 * recording column, route or code path, and every Space payload says recording:false.
 */
const { Op } = require('sequelize');
const { getModel, getSequelize } = require('../index');
const limiter = require('../services/limiter');
const identity = require('../services/identity');
const cursor = require('../services/cursor');
const blocks = require('../services/blocks');
const reportsSvc = require('../services/reports');
const targets = require('../services/targets');
const audit = require('../services/audit');
const contentPolicy = require('../services/contentPolicy');
const ice = require('../services/ice');
const { notify } = require('../services/notify');
const { fail, requireUuid, isUuid, isUniqueError, optText } = require('../services/http');
const S = require('../models/spaces/enums');
const state = require('../socket/spacesState');

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

limiter.define('space_create', 5, DAY);
limiter.define('space_edit', 20, HOUR);
limiter.define('space_transition', 30, HOUR);
limiter.define('space_remind', 60, HOUR);

const MAX_UPCOMING_PER_HOST = 10;
const NOT_RECORDED = 'Spaces are live only. They are never recorded or transcribed.';

const M = (name) => getModel(name);
const send = (res, status, payload) => res.status(status).json(identity.scrub(payload));
const likeOp = () => (getSequelize().getDialect() === 'postgres' ? Op.iLike : Op.like);
const ctxOf = (req) => (req.friends && req.friends.ctx) || null;
const campusOf = (req) => {
  const ctx = ctxOf(req);
  return ctx && ctx.profile ? ctx.profile.campusId : null;
};
const charLen = (s) => Array.from(String(s || '')).length;
const iso = (d) => (d ? new Date(d).toISOString() : null);

const pulseCard = async (space) => {
  try {
    const pulse = require('./pulseController');
    // A Space under review / hidden / removed must not be advertised in the feed.
    const visible = space.modStatus === 'visible' ? space.status : 'ended';
    await pulse.upsertSpaceCard({ id: space.id, campusId: space.campusId, hostId: space.hostId, entityId: space.entityId, title: space.title, status: visible });
  } catch (err) {
    console.warn('[FRIENDS_SPACES_CARD_WARN]', err.message);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// Lifecycle core (also used by the socket engine and the jobs)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Moves a Space out of `from` into a finished state, once. Returns true only for the caller that made
 * the change (so notifications and audit happen exactly once). Then: member rows closed, unsent
 * reminders skipped (holders told on cancel), the live room torn down, the Pulse card updated.
 */
const finishSpace = async (spaceId, { to, from, reason, notifyHolders = to === 'cancelled' } = {}) => {
  const FriendsSpace = M('FriendsSpace');
  const now = new Date();
  const [n] = await FriendsSpace.update(
    { status: to, endedAt: now, endReason: reason },
    { where: { id: spaceId, status: { [Op.in]: from } } },
  );
  if (!n) return false;
  const space = await FriendsSpace.findByPk(spaceId);
  try {
    await M('FriendsSpaceMember').update({ leftAt: now, handRaisedAt: null }, { where: { spaceId, leftAt: null } });
  } catch (err) { console.warn('[FRIENDS_SPACES_FINISH_WARN]', err.message); }
  const Reminder = M('FriendsSpaceReminder');
  const pending = await Reminder.findAll({ where: { spaceId, sentAt: null }, attributes: ['id', 'userId'] });
  if (pending.length) {
    await Reminder.update({ sentAt: now, skippedReason: to === 'expired' ? 'missed' : 'cancelled' }, { where: { spaceId, sentAt: null } });
    if (notifyHolders && space) {
      const ids = pending.map((r) => String(r.userId)).filter((u) => u !== String(space.hostId));
      await notify('SPACE_UPDATED', ids, { id: space.id, body: `"${space.title}" was cancelled.`, dedupeKey: `${space.id}:cancelled` });
    }
  }
  state.teardown(spaceId, reason);
  if (space) await pulseCard(space);
  return true;
};

/** Sends due reminders for one Space (or all due ones). Each row is claimed once: idempotent. */
const sendReminders = async ({ spaceIds = null, now = new Date() } = {}) => {
  const FriendsSpace = M('FriendsSpace');
  const Reminder = M('FriendsSpaceReminder');
  const lead = new Date(now.getTime() + S.REMINDER_LEAD_MINUTES * MIN);
  const missedBefore = new Date(now.getTime() - S.REMINDER_LEAD_MINUTES * MIN);
  const where = {
    modStatus: 'visible',
    [Op.or]: [{ status: 'live' }, { status: 'scheduled', scheduledFor: { [Op.lte]: lead } }],
  };
  if (spaceIds) where.id = { [Op.in]: spaceIds };
  const spaces = await FriendsSpace.findAll({ where, limit: 200 });
  let sent = 0;
  let missed = 0;
  for (const space of spaces) {
    const due = await Reminder.findAll({ where: { spaceId: space.id, sentAt: null }, attributes: ['id', 'userId'], limit: 1000 });
    if (!due.length) continue;
    // Render free sleeps when idle: a reminder for a scheduled start more than 10 min ago is skipped.
    const late = space.status === 'scheduled' && space.scheduledFor && new Date(space.scheduledFor) < missedBefore;
    const claimed = [];
    for (const r of due) {
      const [ok] = await Reminder.update(
        late ? { sentAt: now, skippedReason: 'missed' } : { sentAt: now },
        { where: { id: r.id, sentAt: null } },
      );
      if (ok) {
        if (late) missed++;
        else if (String(r.userId) !== String(space.hostId)) claimed.push(String(r.userId));
      }
    }
    if (claimed.length) {
      const body = space.status === 'live' ? `"${space.title}" is live now.` : `"${space.title}" starts soon.`;
      const got = await notify('SPACE_REMINDER', claimed, { id: space.id, body, dedupeKey: `${space.id}:${iso(space.scheduledFor) || 'live'}` });
      sent += got.length;
    }
  }
  return { sent, missed };
};

// ═════════════════════════════════════════════════════════════════════════════
// Validation + serialization
// ═════════════════════════════════════════════════════════════════════════════

const TZ_RE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;
/** Start time: ISO 8601 WITH a timezone (Z or ±hh:mm), 5 min to 30 days ahead. Stored in UTC. */
const parseSchedule = (raw) => {
  if (typeof raw !== 'string' || !TZ_RE.test(raw.trim())) {
    throw fail(400, 'INVALID_SCHEDULE', 'Send the start time as an ISO date with a timezone.');
  }
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) throw fail(400, 'INVALID_SCHEDULE', 'That start time is not valid.');
  const now = Date.now();
  if (d.getTime() < now + S.SCHEDULE_MIN_MINUTES * MIN) {
    throw fail(400, 'INVALID_SCHEDULE', `Pick a time at least ${S.SCHEDULE_MIN_MINUTES} minutes from now, or start now.`, { minMinutes: S.SCHEDULE_MIN_MINUTES });
  }
  if (d.getTime() > now + S.SCHEDULE_MAX_DAYS * DAY) {
    throw fail(400, 'INVALID_SCHEDULE', `Spaces can be scheduled up to ${S.SCHEDULE_MAX_DAYS} days ahead.`, { maxDays: S.SCHEDULE_MAX_DAYS });
  }
  return d;
};

const readText = (b, { partial = false } = {}) => {
  const out = {};
  if (!partial || b.title !== undefined) {
    if (typeof b.title !== 'string') throw fail(400, 'INVALID_INPUT', 'Give the Space a title.', { field: 'title' });
    const t = b.title.trim().replace(/\s+/g, ' ');
    if (charLen(t) < S.TITLE_MIN) throw fail(400, 'TOO_SHORT', `The title needs at least ${S.TITLE_MIN} characters.`, { field: 'title', min: S.TITLE_MIN });
    if (charLen(t) > S.TITLE_MAX) throw fail(400, 'TOO_LONG', `The title can be at most ${S.TITLE_MAX} characters.`, { field: 'title', max: S.TITLE_MAX });
    out.title = t;
  }
  if (!partial || b.topic !== undefined) out.topic = optText(b.topic, S.TOPIC_MAX, 'topic');
  if (!partial || b.description !== undefined) out.description = optText(b.description, S.DESCRIPTION_MAX, 'description');
  if (!partial || b.participation !== undefined) {
    const p = b.participation === undefined || b.participation === null ? 'request' : b.participation;
    if (!S.PARTICIPATION.includes(p)) throw fail(400, 'INVALID_PARTICIPATION', 'Choose who can speak: request or open.');
    out.participation = p;
  }
  return out;
};

const flagCategory = (reasons) => {
  if (reasons.includes('SELF_HARM')) return 'self_harm';
  if (reasons.some((r) => /SPAM|LINK/.test(r))) return 'spam';
  return 'other';
};

/** Active, verified entity of my campus that I manage (403 otherwise): no club impersonation. */
const managedEntity = async (entityId, me, campusId) => {
  requireUuid(entityId, 'entity');
  const e = await M('FriendsEntity').findByPk(entityId);
  if (!e || e.status !== 'active' || !e.verified || String(e.campusId) !== String(campusId)
    || !(e.managerIds || []).map(String).includes(String(me))) {
    throw fail(403, 'NOT_ENTITY_MANAGER', 'You can only host as a verified club or account you manage.');
  }
  return e;
};

/** Space DTOs for a viewer (host identity, counts, my reminder / role). */
const serializeSpaces = async (req, rows, me, { admin = false } = {}) => {
  if (!rows.length) return [];
  const ids = rows.map((s) => s.id);
  const Reminder = M('FriendsSpaceReminder');
  const [reminders, mine, members] = await Promise.all([
    Reminder.findAll({ where: { spaceId: { [Op.in]: ids } }, attributes: ['spaceId', 'userId'] }),
    me ? M('FriendsSpaceMember').findAll({ where: { spaceId: { [Op.in]: ids }, userId: me }, attributes: ['spaceId', 'removedAt'] }) : [],
    admin ? M('FriendsSpaceMember').findAll({ where: { spaceId: { [Op.in]: ids } }, attributes: ['spaceId', 'removedAt'] }) : [],
  ]);
  const interested = new Map();
  const reminded = new Set();
  reminders.forEach((r) => {
    const k = String(r.spaceId);
    interested.set(k, (interested.get(k) || 0) + 1);
    if (me && String(r.userId) === String(me)) reminded.add(k);
  });
  const removedFrom = new Set(mine.filter((m) => m.removedAt).map((m) => String(m.spaceId)));
  const idMap = await identity.loadIdentities(req, rows.map((s) => s.hostId), { viewerId: me });
  const entIds = rows.map((s) => s.entityId).filter(Boolean);
  const ents = entIds.length ? await M('FriendsEntity').findAll({ where: { id: { [Op.in]: entIds } } }) : [];
  const entOf = new Map(ents.map((e) => [String(e.id), identity.entityIdentity(req, e)]));
  const totals = new Map();
  if (admin) {
    members.forEach((m) => {
      const k = String(m.spaceId);
      const t = totals.get(k) || { members: 0, removed: 0 };
      t.members++;
      if (m.removedAt) t.removed++;
      totals.set(k, t);
    });
  }
  return rows.map((s) => {
    const k = String(s.id);
    const isHost = !!me && String(s.hostId) === String(me);
    const host = idMap.get(String(s.hostId)) || { userId: null, name: 'Former student', avatarUrl: null, verified: false, badges: [] };
    const live = s.status === 'live' ? state.liveCounts(k) : { participants: 0, speakers: 0, listeners: 0 };
    const dto = {
      id: s.id,
      title: s.title,
      topic: s.topic || null,
      description: s.description || null,
      participation: s.participation,
      visibility: s.visibility,
      status: s.status,
      scheduledFor: iso(s.scheduledFor),
      startedAt: iso(s.startedAt),
      endedAt: iso(s.endedAt),
      endReason: s.endReason || null,
      host: s.entityId && entOf.get(String(s.entityId)) ? { ...host, entity: entOf.get(String(s.entityId)) } : host,
      isHost,
      myRole: s.status === 'live' && me ? state.roleOf(k, me) : null,
      removed: removedFrom.has(k),
      reminded: reminded.has(k),
      interestedCount: interested.get(k) || 0,
      participantCount: live.participants,
      speakerCount: live.speakers,
      listenerCount: live.listeners,
      speakers: s.status === 'live' ? state.speakersOf(k) : [],
      limits: { maxSpeakers: s.maxSpeakers, maxListeners: s.maxListeners },
      full: { speakers: live.speakers >= s.maxSpeakers, listeners: live.listeners >= s.maxListeners },
      recording: false,
      canStart: isHost && s.status === 'scheduled' && s.modStatus === 'visible',
      canEdit: isHost && s.status === 'scheduled',
      canCancel: isHost && s.status === 'scheduled',
      canEnd: isHost && s.status === 'live',
      canRemind: !isHost && s.status === 'scheduled',
      createdAt: iso(s.createdAt),
    };
    if (isHost || admin) {
      dto.modStatus = s.modStatus;
      dto.underReview = s.modStatus === 'pending_review';
    }
    if (admin) {
      dto.campusId = s.campusId;
      dto.peakListeners = s.peakListeners;
      dto.removedReason = s.removedReason || null;
      dto.memberTotals = totals.get(k) || { members: 0, removed: 0 };
      dto.lastActiveAt = iso(s.lastActiveAt);
    }
    return dto;
  });
};

const serializeOne = async (req, space, me, opts) => (await serializeSpaces(req, [space], me, opts))[0];

const notFound = () => fail(404, 'SPACE_NOT_FOUND', 'This Space is not available.');

/** A Space this viewer may see: same campus, visible (or mine), host not blocked either way. */
const loadVisible = async (req, id) => {
  requireUuid(String(id), 'Space');
  const me = req.user.id;
  const space = await M('FriendsSpace').findByPk(id);
  if (!space || String(space.campusId) !== String(campusOf(req))) throw notFound();
  const isHost = String(space.hostId) === String(me);
  if (!isHost && space.modStatus !== 'visible') throw notFound();
  if (!isHost && (await blocks.blockedIds(me)).has(String(space.hostId))) throw notFound();
  return { space, isHost };
};

const loadHosted = async (req, id) => {
  const { space, isHost } = await loadVisible(req, id);
  if (!isHost) throw fail(403, 'NOT_HOST', 'Only the host can do that.');
  return space;
};

// ═════════════════════════════════════════════════════════════════════════════
// Student endpoints
// ═════════════════════════════════════════════════════════════════════════════

// GET /meta
const meta = async (req, res) => {
  const limits = Object.fromEntries(Object.entries(limiter.publicLimits()).filter(([k]) => k.startsWith('space_')));
  const turn = ice.iceServersFor('meta').turn;
  send(res, 200, {
    text: { titleMin: S.TITLE_MIN, titleMax: S.TITLE_MAX, topicMax: S.TOPIC_MAX, descriptionMax: S.DESCRIPTION_MAX },
    participation: [
      { key: 'request', label: 'Raise hand to speak', hint: 'Hosts accept who comes on stage.' },
      { key: 'open', label: 'Open stage', hint: 'Anyone who raises a hand gets a free seat.' },
    ],
    schedule: { minMinutes: S.SCHEDULE_MIN_MINUTES, maxDays: S.SCHEDULE_MAX_DAYS, expireAfterMinutes: S.EXPIRE_AFTER_MINUTES, reminderLeadMinutes: S.REMINDER_LEAD_MINUTES, timezone: 'Send ISO 8601 with an offset; times come back in UTC.' },
    caps: { maxSpeakers: S.maxSpeakers(), maxListeners: S.maxListeners() },
    reconnectGraceSec: Math.round(S.graceMs() / 1000),
    recording: false,
    notRecorded: NOT_RECORDED,
    network: { turn, note: turn ? null : 'Audio connects directly between phones. On some networks (strict campus Wi-Fi or mobile data) it may not connect.' },
    limits,
  });
};

// GET /?status=live|scheduled|mine&cursor=&limit=
const list = async (req, res) => {
  const me = req.user.id;
  const campusId = campusOf(req);
  const status = req.query.status === undefined ? 'live' : String(req.query.status);
  if (!['live', 'scheduled', 'mine'].includes(status)) throw fail(400, 'INVALID_STATUS', 'status must be live, scheduled or mine.');
  const limit = cursor.pageSize(req.query.limit, 20);
  const FriendsSpace = M('FriendsSpace');
  let rows;
  let nextCursor = null;
  if (status === 'mine') {
    const after = cursor.after(req.query.cursor);
    rows = await FriendsSpace.findAll({
      where: { hostId: me, ...(after || {}) },
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: limit + 1,
    });
    const pg = cursor.page(rows, limit);
    rows = pg.items;
    nextCursor = pg.nextCursor;
  } else {
    const blocked = [...(await blocks.blockedIds(me))];
    const where = {
      campusId,
      status,
      [Op.and]: [
        { [Op.or]: [{ modStatus: 'visible' }, { hostId: me }] },
        ...(blocked.length ? [{ hostId: { [Op.notIn]: blocked } }] : []),
      ],
    };
    if (status === 'live') {
      const after = cursor.after(req.query.cursor, 'startedAt');
      if (after) where[Op.and].push(after);
      rows = await FriendsSpace.findAll({ where, order: [['startedAt', 'DESC'], ['id', 'DESC']], limit: limit + 1 });
      const pg = cursor.page(rows, limit, 'startedAt');
      rows = pg.items;
      nextCursor = pg.nextCursor;
    } else {
      // Upcoming: soonest first (scheduledFor ASC, id ASC).
      const c = cursor.decode(req.query.cursor);
      if (c) where[Op.and].push({ [Op.or]: [{ scheduledFor: { [Op.gt]: c.value } }, { scheduledFor: c.value, id: { [Op.gt]: c.id } }] });
      rows = await FriendsSpace.findAll({ where, order: [['scheduledFor', 'ASC'], ['id', 'ASC']], limit: limit + 1 });
      const hasMore = rows.length > limit;
      rows = hasMore ? rows.slice(0, limit) : rows;
      nextCursor = hasMore && rows.length ? cursor.encode(rows[rows.length - 1], 'scheduledFor') : null;
    }
  }
  send(res, 200, { items: await serializeSpaces(req, rows, me), nextCursor });
};

// GET /:id
const getSpace = async (req, res) => {
  const { space } = await loadVisible(req, req.params.id);
  send(res, 200, { space: await serializeOne(req, space, req.user.id) });
};

// POST /  { title, topic?, description?, participation?, startNow | scheduledFor, entityId?, clientId? }
const createSpace = async (req, res) => {
  const me = req.user.id;
  const campusId = campusOf(req);
  const b = req.body || {};
  const FriendsSpace = M('FriendsSpace');
  if (b.clientId !== undefined && b.clientId !== null && !isUuid(String(b.clientId))) throw fail(400, 'INVALID_INPUT', 'clientId must be a UUID.');
  if (b.clientId) {
    const dup = await FriendsSpace.findOne({ where: { hostId: me, clientId: String(b.clientId) } });
    if (dup) return send(res, 200, { space: await serializeOne(req, dup, me), duplicate: true });
  }
  const text = readText(b);
  const startNow = b.startNow === true;
  let scheduledFor = null;
  if (!startNow) {
    if (b.scheduledFor === undefined || b.scheduledFor === null) throw fail(400, 'INVALID_SCHEDULE', 'Start now or pick a start time.');
    scheduledFor = parseSchedule(b.scheduledFor);
  }
  const entity = b.entityId ? await managedEntity(String(b.entityId), me, campusId) : null;
  const verdict = contentPolicy.enforce([text.title, text.topic, text.description].filter(Boolean).join('\n'), { kind: 'post', cfg: req.friends.cfg });

  if (startNow) {
    const live = await FriendsSpace.findOne({ where: { hostId: me, status: 'live' }, attributes: ['id'] });
    if (live) throw fail(409, 'ALREADY_HOSTING', 'You are already hosting a live Space. End it first.', { spaceId: live.id });
  } else {
    const upcoming = await FriendsSpace.count({ where: { hostId: me, status: 'scheduled' } });
    if (upcoming >= MAX_UPCOMING_PER_HOST) throw fail(409, 'TOO_MANY_SCHEDULED', `You can have up to ${MAX_UPCOMING_PER_HOST} upcoming Spaces.`);
  }
  limiter.enforce(me, 'space_create');

  const now = new Date();
  let space;
  try {
    space = await FriendsSpace.create({
      campusId,
      hostId: me,
      entityId: entity ? entity.id : null,
      clientId: b.clientId ? String(b.clientId) : null,
      ...text,
      visibility: 'campus',
      status: startNow ? 'live' : 'scheduled',
      modStatus: verdict.decision === 'flag' ? 'pending_review' : 'visible',
      scheduledFor: startNow ? now : scheduledFor,
      startedAt: startNow ? now : null,
      lastActiveAt: startNow ? now : null,
      maxSpeakers: S.maxSpeakers(),
      maxListeners: S.maxListeners(),
    });
  } catch (err) {
    if (!isUniqueError(err)) throw err;
    if (b.clientId) {
      const dup = await FriendsSpace.findOne({ where: { hostId: me, clientId: String(b.clientId) } });
      if (dup) return send(res, 200, { space: await serializeOne(req, dup, me), duplicate: true });
    }
    const live = await FriendsSpace.findOne({ where: { hostId: me, status: 'live' }, attributes: ['id'] });
    throw fail(409, 'ALREADY_HOSTING', 'You are already hosting a live Space. End it first.', live ? { spaceId: live.id } : {});
  }
  if (verdict.decision === 'flag') {
    await reportsSvc.fileSystemReport({ targetType: 'space', targetId: space.id, category: flagCategory(verdict.reasons), note: `Content check: ${verdict.reasons.join(', ')}` });
  }
  await pulseCard(space);
  return send(res, 201, { space: await serializeOne(req, space, me), duplicate: false, ...(verdict.decision === 'flag' ? { underReview: true } : {}) });
};

// PATCH /:id  { title?, topic?, description?, participation?, scheduledFor? }  host, scheduled only
const updateSpace = async (req, res) => {
  const me = req.user.id;
  const space = await loadHosted(req, req.params.id);
  if (space.status !== 'scheduled') throw fail(409, 'NOT_SCHEDULED', 'Only upcoming Spaces can be changed.', { status: space.status });
  const b = req.body || {};
  const allowed = ['title', 'topic', 'description', 'participation', 'scheduledFor'];
  const unknown = Object.keys(b).filter((k) => !allowed.includes(k));
  if (unknown.length) throw fail(400, 'INVALID_INPUT', `These fields cannot be changed: ${unknown.join(', ')}.`, { fields: unknown });
  const text = readText(b, { partial: true });
  const patch = { ...text };
  let moved = false;
  if (b.scheduledFor !== undefined) {
    const d = parseSchedule(b.scheduledFor);
    if (!space.scheduledFor || d.getTime() !== new Date(space.scheduledFor).getTime()) {
      patch.scheduledFor = d;
      moved = true;
    }
  }
  if (!Object.keys(patch).length) return send(res, 200, { space: await serializeOne(req, space, me), unchanged: true });
  limiter.enforce(me, 'space_edit');
  let verdict = { decision: 'allow', reasons: [] };
  if (text.title !== undefined || text.topic !== undefined || text.description !== undefined) {
    const merged = { title: space.title, topic: space.topic, description: space.description, ...text };
    verdict = contentPolicy.enforce([merged.title, merged.topic, merged.description].filter(Boolean).join('\n'), { kind: 'post', cfg: req.friends.cfg });
    if (verdict.decision === 'flag' && space.modStatus === 'visible') patch.modStatus = 'pending_review';
  }
  const [n] = await M('FriendsSpace').update(patch, { where: { id: space.id, status: 'scheduled' } });
  if (!n) throw fail(409, 'STATE_CHANGED', 'This Space changed. Refresh and try again.');
  if (moved) {
    // A new time means a new reminder: clear the sent marks so holders are reminded again.
    await M('FriendsSpaceReminder').update({ sentAt: null, skippedReason: null }, { where: { spaceId: space.id } });
  }
  await space.reload();
  if (verdict.decision === 'flag') {
    await reportsSvc.fileSystemReport({ targetType: 'space', targetId: space.id, category: flagCategory(verdict.reasons), note: `Content check: ${verdict.reasons.join(', ')}` });
  }
  if (moved) {
    const holders = (await M('FriendsSpaceReminder').findAll({ where: { spaceId: space.id }, attributes: ['userId'] }))
      .map((r) => String(r.userId)).filter((u) => u !== String(me));
    await notify('SPACE_UPDATED', holders, { id: space.id, body: `"${space.title}" has a new time.`, dedupeKey: `${space.id}:${iso(space.scheduledFor)}` });
  }
  await pulseCard(space);
  send(res, 200, { space: await serializeOne(req, space, me), rescheduled: moved });
};

// POST /:id/start  host; scheduled -> live
const startSpace = async (req, res) => {
  const me = req.user.id;
  const space = await loadHosted(req, req.params.id);
  if (space.status === 'live') return send(res, 200, { space: await serializeOne(req, space, me), duplicate: true });
  if (space.status !== 'scheduled') throw fail(409, 'NOT_SCHEDULED', 'This Space cannot be started.', { status: space.status });
  if (space.modStatus !== 'visible') throw fail(409, 'UNDER_REVIEW', 'This Space is being reviewed and cannot start yet.');
  limiter.enforce(me, 'space_transition');
  const now = new Date();
  let n;
  try {
    [n] = await M('FriendsSpace').update({ status: 'live', startedAt: now, lastActiveAt: now }, { where: { id: space.id, status: 'scheduled', hostId: me, modStatus: 'visible' } });
  } catch (err) {
    if (!isUniqueError(err)) throw err;
    throw fail(409, 'ALREADY_HOSTING', 'You are already hosting a live Space. End it first.');
  }
  await space.reload();
  if (!n) {
    if (space.status === 'live') return send(res, 200, { space: await serializeOne(req, space, me), duplicate: true });
    throw fail(409, 'STATE_CHANGED', 'This Space changed. Refresh and try again.', { status: space.status });
  }
  await pulseCard(space);
  await sendReminders({ spaceIds: [space.id] });
  send(res, 200, { space: await serializeOne(req, space, me), duplicate: false });
};

// POST /:id/cancel  host; scheduled -> cancelled
const cancelSpace = async (req, res) => {
  const me = req.user.id;
  const space = await loadHosted(req, req.params.id);
  if (space.status === 'cancelled') return send(res, 200, { space: await serializeOne(req, space, me), duplicate: true });
  if (space.status !== 'scheduled') throw fail(409, 'NOT_SCHEDULED', space.status === 'live' ? 'This Space is live. End it instead.' : 'This Space cannot be cancelled.', { status: space.status });
  limiter.enforce(me, 'space_transition');
  const done = await finishSpace(space.id, { to: 'cancelled', from: ['scheduled'], reason: 'cancelled' });
  await space.reload();
  if (!done && space.status !== 'cancelled') throw fail(409, 'STATE_CHANGED', 'This Space changed. Refresh and try again.', { status: space.status });
  send(res, 200, { space: await serializeOne(req, space, me), duplicate: !done });
};

// POST /:id/end  host; live -> ended
const endSpace = async (req, res) => {
  const me = req.user.id;
  const space = await loadHosted(req, req.params.id);
  if (space.status === 'ended') return send(res, 200, { space: await serializeOne(req, space, me), duplicate: true });
  if (space.status !== 'live') throw fail(409, 'NOT_LIVE', space.status === 'scheduled' ? 'This Space has not started. Cancel it instead.' : 'This Space is not live.', { status: space.status });
  const done = await finishSpace(space.id, { to: 'ended', from: ['live'], reason: 'host_ended' });
  await space.reload();
  if (!done && space.status !== 'ended') throw fail(409, 'STATE_CHANGED', 'This Space changed. Refresh and try again.', { status: space.status });
  send(res, 200, { space: await serializeOne(req, space, me), duplicate: !done });
};

const reminderOut = async (spaceId, reminded, duplicate) => ({
  reminded,
  interestedCount: await M('FriendsSpaceReminder').count({ where: { spaceId } }),
  duplicate,
});

// POST /:id/remind
const remind = async (req, res) => {
  const me = req.user.id;
  const { space, isHost } = await loadVisible(req, req.params.id);
  if (isHost) throw fail(400, 'HOST_CANNOT_REMIND', 'You are the host of this Space.');
  if (space.status !== 'scheduled') throw fail(409, 'NOT_SCHEDULED', space.status === 'live' ? 'This Space is live now. Join it instead.' : 'This Space is over.', { status: space.status });
  const Reminder = M('FriendsSpaceReminder');
  const existing = await Reminder.findOne({ where: { spaceId: space.id, userId: me } });
  if (existing) return send(res, 200, await reminderOut(space.id, true, true));
  limiter.enforce(me, 'space_remind');
  try {
    await Reminder.create({ spaceId: space.id, userId: me });
  } catch (err) {
    if (!isUniqueError(err)) throw err;
    return send(res, 200, await reminderOut(space.id, true, true));
  }
  send(res, 201, await reminderOut(space.id, true, false));
};

// DELETE /:id/remind
const unremind = async (req, res) => {
  const me = req.user.id;
  const { space } = await loadVisible(req, req.params.id);
  const n = await M('FriendsSpaceReminder').destroy({ where: { spaceId: space.id, userId: me } });
  send(res, 200, await reminderOut(space.id, false, !n));
};

// ═════════════════════════════════════════════════════════════════════════════
// Admin (protect + admin): live monitor, detail, force end, stats, jobs
// ═════════════════════════════════════════════════════════════════════════════

const adminCampus = async (raw) => {
  if (raw === undefined || raw === null || raw === '') return null;
  const id = requireUuid(String(raw), 'campus');
  const c = await M('Campus').findByPk(id);
  if (!c) throw fail(404, 'CAMPUS_NOT_FOUND', 'Campus not found.');
  return c.id;
};

// GET /admin/spaces?status=&modStatus=&campusId=&q=&cursor=
const adminList = async (req, res) => {
  const where = {};
  const campusId = await adminCampus(req.query.campusId);
  if (campusId) where.campusId = campusId;
  if (req.query.status) {
    const st = String(req.query.status);
    if (!S.SPACE_STATUS.includes(st)) throw fail(400, 'INVALID_STATUS', 'Unknown status.');
    where.status = st;
  }
  if (req.query.modStatus) {
    const ms = String(req.query.modStatus);
    if (!S.MOD_STATUS.includes(ms)) throw fail(400, 'INVALID_STATUS', 'Unknown moderation status.');
    where.modStatus = ms;
  }
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
  const and = [];
  if (q) and.push({ [Op.or]: [{ title: { [likeOp()]: `%${q}%` } }, { topic: { [likeOp()]: `%${q}%` } }] });
  const after = cursor.after(req.query.cursor);
  if (after) and.push(after);
  if (and.length) where[Op.and] = and;
  const limit = cursor.pageSize(req.query.limit, 30);
  const rows = await M('FriendsSpace').findAll({ where, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: limit + 1 });
  const pg = cursor.page(rows, limit);
  send(res, 200, { items: await serializeSpaces(req, pg.items, null, { admin: true }), nextCursor: pg.nextCursor });
};

// GET /admin/spaces/:id  (members with roles, removals, audit trail)
const adminGet = async (req, res) => {
  requireUuid(String(req.params.id), 'Space');
  const space = await M('FriendsSpace').findByPk(req.params.id);
  if (!space) throw notFound();
  const members = await M('FriendsSpaceMember').findAll({ where: { spaceId: space.id }, order: [['createdAt', 'ASC']], limit: 500 });
  const ids = await identity.loadIdentities(req, members.map((m) => m.userId), {});
  const room = state.getRoom(space.id);
  const actions = await M('FriendsModAction').findAll({ where: { targetType: 'space', targetId: space.id }, order: [['createdAt', 'DESC']], limit: 100 });
  const reports = await M('FriendsReport').count({ where: { targetType: 'space', targetId: space.id } });
  send(res, 200, {
    space: await serializeOne(req, space, null, { admin: true }),
    members: members.map((m) => ({
      user: ids.get(String(m.userId)) || { userId: m.userId, name: 'Former student' },
      role: m.role,
      present: !!(room && room.members.has(String(m.userId))),
      handRaisedAt: iso(m.handRaisedAt),
      mutedByHost: !!m.mutedByHost,
      removedAt: iso(m.removedAt),
      joinedAt: iso(m.joinedAt),
      leftAt: iso(m.leftAt),
    })),
    live: room ? state.snapshot(room) : null,
    reports,
    actions: actions.map(audit.serializeAction),
  });
};

// POST /admin/spaces/:id/end { reason }  live -> ended / scheduled -> cancelled (audited)
const adminEnd = async (req, res) => {
  requireUuid(String(req.params.id), 'Space');
  const reason = optText((req.body || {}).reason, 500, 'reason');
  if (!reason || reason.length < 5) throw fail(400, 'REASON_REQUIRED', 'Give a short reason (at least 5 characters).');
  const space = await M('FriendsSpace').findByPk(req.params.id);
  if (!space) throw notFound();
  if (!S.OPEN_STATUS.includes(space.status)) throw fail(409, 'NOT_OPEN', 'This Space is already over.', { status: space.status });
  const to = space.status === 'live' ? 'ended' : 'cancelled';
  const done = await finishSpace(space.id, { to, from: [space.status], reason: 'admin', notifyHolders: to === 'cancelled' });
  if (!done) throw fail(409, 'STATE_CHANGED', 'This Space changed. Refresh and try again.');
  const action = await audit.record({ actorId: req.user.id, actorRole: 'admin', action: 'space_end', targetType: 'space', targetId: space.id, subjectUserId: space.hostId, reason, meta: { from: space.status, to } });
  await space.reload();
  send(res, 200, { space: await serializeOne(req, space, null, { admin: true }), actionId: action.id });
};

// GET /admin/stats?campusId=
const adminStats = async (req, res) => {
  const campusId = await adminCampus(req.query.campusId);
  const w = (extra) => ({ ...(campusId ? { campusId } : {}), ...extra });
  const FriendsSpace = M('FriendsSpace');
  const byStatus = {};
  for (const s of S.SPACE_STATUS) byStatus[s] = await FriendsSpace.count({ where: w({ status: s }) });
  let liveParticipants = 0;
  for (const room of state._rooms.values()) if (!campusId || String(room.campusId) === String(campusId)) liveParticipants += room.members.size;
  send(res, 200, {
    byStatus,
    created24h: await FriendsSpace.count({ where: w({ createdAt: { [Op.gte]: new Date(Date.now() - DAY) } }) }),
    pendingReview: await FriendsSpace.count({ where: w({ modStatus: 'pending_review' }) }),
    liveRooms: state._rooms.size,
    liveParticipants,
    caps: { maxSpeakers: S.maxSpeakers(), maxListeners: S.maxListeners() },
    turnConfigured: ice.iceServersFor('stats').turn,
    recording: false,
  });
};

// POST /admin/jobs/run
const adminRunJobs = async (req, res) => {
  const stats = await require('../jobs/spaceJobs').runOnce();
  send(res, 200, { ok: true, stats });
};

// ═════════════════════════════════════════════════════════════════════════════
// Unified moderation: the 'space' report target
// ═════════════════════════════════════════════════════════════════════════════

const sameCampusViewer = async (viewerId, campusId) => {
  if (!viewerId) return true;
  const p = await M('CampusProfile').findOne({ where: { userId: viewerId }, attributes: ['campusId'] });
  return !!p && String(p.campusId) === String(campusId);
};

/** Moderation decision on a Space: hidden / removed also end it (live) or cancel it (scheduled). */
const setModStatus = async (id, status, { transaction } = {}) => {
  const FriendsSpace = M('FriendsSpace');
  const space = await FriendsSpace.findByPk(id, { transaction });
  if (!space) return false;
  await FriendsSpace.update({ modStatus: status, removedReason: status === 'visible' ? null : 'Moderation decision' }, { where: { id }, transaction });
  const after = async () => {
    const fresh = await FriendsSpace.findByPk(id);
    if (!fresh) return;
    // Live: any non-visible decision (including an automatic pending_review after repeated threat
    // reports) ends the room at once. Scheduled: hidden / removed cancel it; pending_review only hides
    // it (it cannot start) until a moderator decides, so an approval can restore it.
    const endLive = status !== 'visible' && fresh.status === 'live';
    const cancelScheduled = ['hidden', 'removed'].includes(status) && fresh.status === 'scheduled';
    if (endLive || cancelScheduled) {
      await finishSpace(id, { to: endLive ? 'ended' : 'cancelled', from: [fresh.status], reason: 'moderation', notifyHolders: cancelScheduled });
    } else {
      await pulseCard(fresh);
    }
  };
  if (transaction && typeof transaction.afterCommit === 'function') transaction.afterCommit(() => after().catch((err) => console.warn('[FRIENDS_SPACES_MOD_WARN]', err.message)));
  else await after();
  return true;
};

targets.register('space', {
  statuses: ['pending_review', 'hidden', 'removed', 'visible'],
  async load(id, { viewerId } = {}) {
    if (!isUuid(String(id))) return null;
    const s = await M('FriendsSpace').findByPk(id);
    if (!s) return null;
    if (viewerId) {
      if (!(await sameCampusViewer(viewerId, s.campusId))) return null;
      const isHost = String(s.hostId) === String(viewerId);
      if (!isHost && s.modStatus !== 'visible') return null;
      if (!isHost && (await blocks.blockedIds(viewerId)).has(String(s.hostId))) return null;
    }
    return {
      ownerId: s.hostId,
      campusId: s.campusId,
      subTab: 'spaces',
      snapshot: {
        excerpt: targets.excerpt([s.title, s.topic, s.description].filter(Boolean).join('\n')),
        mediaIds: [],
        anonymous: false,
        status: s.status,
        scheduledFor: iso(s.scheduledFor),
        participants: state.liveCounts(s.id).participants,
        createdAt: s.createdAt,
      },
    };
  },
  async setStatus(id, status, opts = {}) {
    return setModStatus(id, status, opts);
  },
  async currentState(id) {
    const s = await M('FriendsSpace').findByPk(id);
    if (!s) return { exists: false };
    return { exists: true, status: s.status, modStatus: s.modStatus, endReason: s.endReason || null, live: state.liveCounts(s.id) };
  },
});

module.exports = {
  meta,
  list,
  getSpace,
  createSpace,
  updateSpace,
  startSpace,
  cancelSpace,
  endSpace,
  remind,
  unremind,
  adminList,
  adminGet,
  adminEnd,
  adminStats,
  adminRunJobs,
  // for socket/spacesState.js, jobs/spaceJobs.js and tests
  _internal: { finishSpace, sendReminders, setModStatus, parseSchedule, NOT_RECORDED },
};
