// Admin (/api/admin/campus-events; protect + admin). Works while the feature is off. Every decision is
// audited in CeAuditLog and mirrored into VerificationLog (the admin panel's audit table).
const { Op } = require('sequelize');
const E = require('../enums');
const { fail, assertUuid, cleanText, iso, optTime, adminAudit, pageOpts, paginate, money, bool } = require('../services/util');
const S = require('../services/serialize');
const clock = require('../services/clock');
const flag = require('../services/flag');
const EV = require('../services/events');
const cap = require('../services/capacity');
const tickets = require('../services/tickets');
const payments = require('../services/payments');
const notify = require('../services/notify');
const outcomes = require('../services/outcomes');
const audit = require('../services/audit');
const O = require('./organizer');
const { M, loadEvent, usersById, byIds, organizerContext, Entity } = require('./common');

const ES = E.EVENT_STATUS;
const OS = E.ORGANIZER_STATUS;
const N = E.NOTIFY;
const R = E.REG_STATUS;

const logBoth = async (req, entry) => {
  await audit.fromReq(req, entry, null, 'admin');
  await adminAudit(req, entry.eventId || entry.registrationId || entry.targetId, `campus_events.${entry.action}`, entry.details || {});
};

const eventOut = async (req, ev) => {
  const ctx = await organizerContext([ev]);
  const users = await usersById([ev.organizerUserId]);
  return { ...S.eventAdmin(req, ev, ctx(ev)), organizerName: (users.get(String(ev.organizerUserId)) || {}).name || null };
};

/** Admin dashboard buckets (spec §10). */
const BUCKETS = {
  pending_approval: () => ({ status: ES.SUBMITTED }),
  approved_upcoming: () => ({ status: ES.APPROVED }),
  published: () => ({ status: ES.PUBLISHED }),
  registration_open: (now) => ({ status: ES.PUBLISHED, startAt: { [Op.gt]: now }, [Op.and]: [{ [Op.or]: [{ regOpensAt: null }, { regOpensAt: { [Op.lte]: now } }] }, { [Op.or]: [{ regClosesAt: null }, { regClosesAt: { [Op.gt]: now } }] }] }),
  registration_closed: (now) => ({ status: ES.PUBLISHED, startAt: { [Op.gt]: now }, regClosesAt: { [Op.lte]: now } }),
  in_progress: (now) => ({ status: ES.PUBLISHED, startAt: { [Op.lte]: now }, endAt: { [Op.gt]: now } }),
  completed: () => ({ status: ES.COMPLETED }),
  cancelled: () => ({ status: ES.CANCELLED }),
  changes_pending: () => ({ pendingChanges: { [Op.ne]: null }, status: { [Op.in]: [ES.APPROVED, ES.PUBLISHED, ES.UNPUBLISHED] } }),
  unpublished: () => ({ status: ES.UNPUBLISHED }),
  drafts: () => ({ status: { [Op.in]: E.EDITABLE_EVENT_STATUSES } }),
};

const fullyBooked = async (now) => {
  const evs = await M().Event.findAll({ where: { status: ES.PUBLISHED, startAt: { [Op.gt]: now } } });
  const left = await require('./common').slotsLeftFor(evs);
  return evs.filter((ev) => (ev.format === E.FORMAT.SLOT ? (left.get(String(ev.id)) || 0) === 0 : S.capacityBlock(ev).remaining === 0));
};

// GET /summary
const summary = async (req, res) => {
  const now = clock.now();
  const out = {};
  for (const [k, w] of Object.entries(BUCKETS)) out[k] = await M().Event.count({ where: w(now) });
  out.fully_booked = (await fullyBooked(now)).length;
  out.organizers_pending = await M().Organizer.count({ where: { status: OS.PENDING } });
  out.refunds_pending = await M().Reg.count({ where: { paymentStatus: E.PAYMENT_STATUS.REFUND_PENDING } });
  out.venue_due = await M().Reg.count({ where: { paymentStatus: E.PAYMENT_STATUS.DUE_AT_VENUE, status: R.CONFIRMED } });
  res.json({
    buckets: out,
    switches: { enabled: await flag.readFlag({ fresh: true }), walletEnabled: await flag.readWalletFlag({ fresh: true }), onlinePayEnabled: await flag.readOnlineFlag({ fresh: true }), razorpayKeysPresent: payments.razorpay.keysPresent(), ticketsReady: tickets.configured() },
  });
};

// GET /review-queue   (submitted events + live events with pending changes)
const reviewQueue = async (req, res) => {
  const rows = await M().Event.findAll({ where: { [Op.or]: [{ status: ES.SUBMITTED }, { pendingChanges: { [Op.ne]: null }, status: { [Op.in]: [ES.APPROVED, ES.PUBLISHED, ES.UNPUBLISHED] } }] }, order: [['submittedAt', 'ASC'], ['updatedAt', 'ASC']], limit: 200 });
  const out = [];
  for (const ev of rows) out.push(await eventOut(req, ev));
  res.json({ events: out });
};

// GET /events?status&bucket&q&page&limit
const events = async (req, res) => {
  const now = clock.now();
  const q = req.query || {};
  const p = pageOpts(q, 50);
  let rows;
  if (q.bucket === 'fully_booked') rows = (await fullyBooked(now)).slice(p.offset, p.offset + p.fetch);
  else {
    const where = q.bucket ? (BUCKETS[q.bucket] ? BUCKETS[q.bucket](now) : null) : {};
    if (!where) throw fail(400, 'INVALID_INPUT', 'Unknown bucket.', { field: 'bucket' });
    if (q.status) where.status = String(q.status).toUpperCase();
    if (q.campusId) where.campusId = String(q.campusId);
    const text = cleanText(q.q, 60);
    if (text) where.title = { [require('../services/locks').isPg() ? Op.iLike : Op.like]: `%${text.replace(/[%_\\]/g, '')}%` };
    rows = await M().Event.findAll({ where, order: [['startAt', 'DESC']], limit: p.fetch, offset: p.offset });
  }
  const pg = paginate(rows, p);
  const out = [];
  for (const ev of pg.rows) out.push(await eventOut(req, ev));
  res.json({ events: out, pagination: pg.pagination });
};

// GET /events/:id
const eventDetail = async (req, res) => {
  const ev = await loadEvent(req.params.id);
  const slots = ev.format === E.FORMAT.SLOT ? await M().Slot.findAll({ where: { eventId: ev.id }, order: [['startAt', 'ASC']] }) : [];
  res.json({ event: await eventOut(req, ev), slots: slots.map((s) => ({ ...S.slotPublic(ev, s), status: s.status })), stats: await O.statsFor(ev), staff: await O.staffList(ev) });
};

// POST /events/:id/approve   { publishAt?, note? }
const approve = async (req, res) => {
  const ev = await loadEvent(req.params.id);
  if (ev.status !== ES.SUBMITTED) throw fail(409, 'NOT_SUBMITTED', 'Only submitted events can be approved.', { status: ev.status });
  const publishAt = optTime(req.body && req.body.publishAt, 'publishAt') || (ev.publishAt && new Date(ev.publishAt).getTime() > clock.nowMs() ? ev.publishAt : null);
  const later = publishAt && new Date(publishAt).getTime() > clock.nowMs();
  await ev.update({ status: later ? ES.APPROVED : ES.PUBLISHED, publishAt: later ? publishAt : ev.publishAt, publishedAt: later ? null : clock.now(), reviewedAt: clock.now(), reviewedBy: req.user.id, reviewNote: cleanText(req.body && req.body.note, 500) || null });
  await logBoth(req, { eventId: ev.id, action: 'event.approve', details: { publishAt: later ? iso(publishAt) : null } });
  notify.toOrganizer(ev, 'Event approved ✅', later ? `${ev.title} is approved and goes live ${new Date(publishAt).toISOString().slice(0, 16).replace('T', ' ')} UTC.` : `${ev.title} is approved and live for students.`, later ? N.EVENT_APPROVED : N.EVENT_PUBLISHED);
  notify.eventChanged(ev.id);
  res.json({ event: await eventOut(req, ev) });
};

// POST /events/:id/reject   { reason }
const reject = async (req, res) => {
  const ev = await loadEvent(req.params.id);
  if (ev.status !== ES.SUBMITTED) throw fail(409, 'NOT_SUBMITTED', 'Only submitted events can be rejected.', { status: ev.status });
  const reason = cleanText(req.body && req.body.reason, 500);
  if (reason.length < 3) throw fail(400, 'INVALID_INPUT', 'Give a reason (the organizer sees it).', { field: 'reason' });
  await ev.update({ status: ES.REJECTED, rejectionReason: reason, reviewedAt: clock.now(), reviewedBy: req.user.id });
  await logBoth(req, { eventId: ev.id, action: 'event.reject', details: { reason } });
  notify.toOrganizer(ev, 'Event not approved', `${ev.title}: ${reason.slice(0, 120)}`, N.EVENT_REJECTED);
  res.json({ event: await eventOut(req, ev) });
};

// POST /events/:id/request-changes   { note }
const requestChanges = async (req, res) => {
  const ev = await loadEvent(req.params.id);
  if (ev.status !== ES.SUBMITTED) throw fail(409, 'NOT_SUBMITTED', 'Only submitted events can be sent back.', { status: ev.status });
  const note = cleanText(req.body && (req.body.note || req.body.reason), 500);
  if (note.length < 3) throw fail(400, 'INVALID_INPUT', 'Say what needs to change.', { field: 'note' });
  await ev.update({ status: ES.CHANGES_REQUESTED, reviewNote: note, reviewedAt: clock.now(), reviewedBy: req.user.id });
  await logBoth(req, { eventId: ev.id, action: 'event.request_changes', details: { note } });
  notify.toOrganizer(ev, 'Changes requested ✏️', `${ev.title}: ${note.slice(0, 120)}`, N.EVENT_CHANGES_REQUESTED);
  res.json({ event: await eventOut(req, ev) });
};

// POST /events/:id/unpublish { reason } | /republish
const unpublish = async (req, res) => {
  const ev = await loadEvent(req.params.id);
  if (![ES.PUBLISHED, ES.APPROVED].includes(ev.status)) throw fail(409, 'NOT_PUBLISHED', 'Only published events can be unpublished.');
  const reason = cleanText(req.body && req.body.reason, 500);
  if (reason.length < 3) throw fail(400, 'INVALID_INPUT', 'Give a reason.', { field: 'reason' });
  await ev.update({ status: ES.UNPUBLISHED, reviewNote: reason });
  await logBoth(req, { eventId: ev.id, action: 'event.unpublish', details: { reason } });
  notify.toOrganizer(ev, 'Event hidden', `${ev.title} was hidden from students: ${reason.slice(0, 120)}`, N.EVENT_REJECTED);
  notify.eventChanged(ev.id);
  res.json({ event: await eventOut(req, ev) });
};
const republish = async (req, res) => {
  const ev = await loadEvent(req.params.id);
  if (ev.status !== ES.UNPUBLISHED) throw fail(409, 'NOT_UNPUBLISHED', 'Only unpublished events can be republished.');
  await ev.update({ status: ES.PUBLISHED, publishedAt: ev.publishedAt || clock.now() });
  await logBoth(req, { eventId: ev.id, action: 'event.republish', details: {} });
  notify.eventChanged(ev.id);
  res.json({ event: await eventOut(req, ev) });
};

// POST /events/:id/cancel   { reason }
const cancelEvent = async (req, res) => {
  const ev0 = await loadEvent(req.params.id);
  let ev;
  if (E.EDITABLE_EVENT_STATUSES.includes(ev0.status) || ev0.status === ES.SUBMITTED) {
    const reason = cleanText(req.body && req.body.reason, 500);
    if (reason.length < 3) throw fail(400, 'INVALID_INPUT', 'Give a reason for the cancellation.', { field: 'reason' });
    ev = await ev0.update({ status: ES.CANCELLED, cancelledAt: clock.now(), cancelledBy: req.user.id, cancelReason: reason });
  } else ev = await EV.cancelEvent(req, ev0.id, { by: 'admin', reason: req.body && req.body.reason });
  await adminAudit(req, ev.id, 'campus_events.event.cancel', { reason: ev.cancelReason });
  res.json({ event: await eventOut(req, ev) });
};

// POST /events/:id/feature   { featured }
const feature = async (req, res) => {
  const ev = await loadEvent(req.params.id);
  await ev.update({ featured: bool(req.body && req.body.featured) });
  await logBoth(req, { eventId: ev.id, action: 'event.feature', details: { featured: ev.featured } });
  notify.eventChanged(ev.id);
  res.json({ event: await eventOut(req, ev) });
};

// PATCH /events/:id   (admin edit, applied at once, audited)
const editEvent = async (req, res) => {
  const ev0 = await loadEvent(req.params.id);
  if ([ES.CANCELLED, ES.COMPLETED].includes(ev0.status)) throw fail(409, 'EVENT_CLOSED', 'This event is closed.');
  const fields = await EV.cleanFields(req.user.id, req.body || {}, ev0, { isAdmin: true });
  if (!Object.keys(fields).length) return res.json({ event: await eventOut(req, ev0) });
  const ev = await EV.applyMaterial(req, ev0.id, fields, { action: 'event.admin_edit' });
  await adminAudit(req, ev.id, 'campus_events.event.admin_edit', { fields: Object.keys(fields) });
  res.json({ event: await eventOut(req, ev) });
};

// POST /events/:id/changes/approve | /changes/reject { note }
const approveChanges = async (req, res) => {
  const ev0 = await loadEvent(req.params.id);
  if (!ev0.pendingChanges || !ev0.pendingChanges.fields) throw fail(409, 'NO_PENDING_CHANGES', 'There are no changes waiting.');
  const fields = EV.revive(ev0.pendingChanges.fields);
  const ev = await EV.applyMaterial(req, ev0.id, fields, { action: 'event.changes_approve' });
  await ev.update({ pendingChanges: null });
  await adminAudit(req, ev.id, 'campus_events.event.changes_approve', { fields: Object.keys(fields) });
  notify.toOrganizer(ev, 'Changes approved ✅', `Your changes to ${ev.title} are live.`, N.CHANGES_APPROVED);
  res.json({ event: await eventOut(req, ev) });
};
const rejectChanges = async (req, res) => {
  const ev = await loadEvent(req.params.id);
  if (!ev.pendingChanges) throw fail(409, 'NO_PENDING_CHANGES', 'There are no changes waiting.');
  const note = cleanText(req.body && (req.body.note || req.body.reason), 500) || 'Not approved';
  await ev.update({ pendingChanges: null, reviewNote: note });
  await logBoth(req, { eventId: ev.id, action: 'event.changes_reject', details: { note } });
  notify.toOrganizer(ev, 'Changes not approved', `${ev.title}: ${note.slice(0, 120)}`, N.EVENT_REJECTED);
  res.json({ event: await eventOut(req, ev) });
};

// GET /events/:id/registrations   (admin view incl. user ids)
const eventRegistrations = async (req, res) => {
  const ev = await loadEvent(req.params.id);
  res.json({ registrations: await O.participantRows(ev, req.query || {}, { forAdmin: true }) });
};

// GET /registrations?eventId&status&paymentStatus&page&limit
const registrations = async (req, res) => {
  const q = req.query || {};
  const p = pageOpts(q, 100, 500);
  const where = {};
  if (q.eventId) where.eventId = assertUuid(q.eventId, 'event');
  if (q.status) where.status = String(q.status).toUpperCase();
  if (q.paymentStatus) where.paymentStatus = String(q.paymentStatus).toUpperCase();
  if (q.paymentMode) where.paymentMode = String(q.paymentMode).toUpperCase();
  const rows = await M().Reg.findAll({ where, order: [['createdAt', 'DESC']], limit: p.fetch, offset: p.offset });
  const pg = paginate(rows, p);
  const users = await usersById(pg.rows.map((r) => r.userId));
  const evs = await byIds(M().Event, pg.rows.map((r) => r.eventId));
  res.json({
    registrations: pg.rows.map((r) => ({
      ...S.registrationForOrganizer(r, { user: users.get(String(r.userId)), forAdmin: true }), eventId: r.eventId, eventTitle: (evs.get(String(r.eventId)) || {}).title || null,
      payment: S.paymentBlock(r), refundAttempts: r.refundAttempts || 0,
    })),
    pagination: pg.pagination,
  });
};

// POST /registrations/:id/cancel   { reason }   (admin override: full refund)
const cancelRegistration = async (req, res) => {
  const reg0 = await M().Reg.findByPk(assertUuid(req.params.id, 'registration'));
  if (!reg0) throw fail(404, 'NOT_FOUND', 'This registration was not found.');
  if (!E.OPEN_REG_STATUSES.includes(reg0.status)) throw fail(409, 'NOT_CANCELLABLE', 'This registration is already closed.');
  const reason = cleanText(req.body && req.body.reason, 300);
  if (reason.length < 3) throw fail(400, 'INVALID_INPUT', 'Give a reason (the student sees it).', { field: 'reason' });
  const out = await cap.inLock(reg0.eventId, async (t, ev) => {
    const reg = await M().Reg.findByPk(reg0.id, { transaction: t });
    if (!E.OPEN_REG_STATUSES.includes(reg.status)) throw fail(409, 'NOT_CANCELLABLE', 'This registration is already closed.');
    const r = await cap.endRegistration(t, ev, reg, { by: 'admin', reason, pct: 100 });
    await audit.fromReq(req, { eventId: ev.id, registrationId: reg.id, action: 'registration.admin_cancel', details: { reason } }, t, 'admin');
    return r;
  });
  await adminAudit(req, reg0.id, 'campus_events.registration.cancel', { reason });
  outcomes.ended(out.reg, out.event, { by: 'admin', reason });
  outcomes.promoted(out.promoted, out.event);
  res.json({ registration: { id: out.reg.id, status: out.reg.status, paymentStatus: out.reg.paymentStatus } });
};

// POST /registrations/:id/refund   (retry a WALLET / ONLINE refund now, or record a cash venue refund)
const refund = async (req, res) => {
  const reg = await M().Reg.findByPk(assertUuid(req.params.id, 'registration'));
  if (!reg) throw fail(404, 'NOT_FOUND', 'This registration was not found.');
  if (reg.paymentStatus !== E.PAYMENT_STATUS.REFUND_PENDING) throw fail(409, 'NO_REFUND_DUE', 'No refund is pending on this registration.', { paymentStatus: reg.paymentStatus });
  let amount = 0;
  if (reg.paymentMode === E.PAYMENT_MODE.VENUE) {
    await O.markVenueRefunded(req, reg.eventId, reg.id, 'admin');
    amount = money(reg.refundAmount);
  } else amount = await payments.processRefund(reg.id);
  await adminAudit(req, reg.id, 'campus_events.registration.refund', { amount });
  const fresh = await M().Reg.findByPk(reg.id);
  if (fresh.paymentStatus === E.PAYMENT_STATUS.REFUNDED) notify.toUsers([fresh.userId], 'Refund done', `₹${money(fresh.refundAmount)} was refunded.`, { type: N.REFUND_DONE, registrationId: fresh.id, eventId: fresh.eventId });
  res.json({ registration: { id: fresh.id, paymentStatus: fresh.paymentStatus, refundAmount: money(fresh.refundAmount) }, refunded: amount });
};

// POST /registrations/:id/mark-paid
const markPaid = async (req, res) => {
  const reg0 = await M().Reg.findByPk(assertUuid(req.params.id, 'registration'));
  if (!reg0) throw fail(404, 'NOT_FOUND', 'This registration was not found.');
  const reg = await O.markPaid(req, reg0.eventId, reg0.id, 'admin');
  await adminAudit(req, reg.id, 'campus_events.registration.mark_paid', { amount: money(reg.total) });
  res.json({ registration: { id: reg.id, paymentStatus: reg.paymentStatus } });
};

// GET /payments?status   (online payment rows; no card data exists anywhere)
const paymentsList = async (req, res) => {
  const q = req.query || {};
  const p = pageOpts(q, 100, 500);
  const where = {};
  if (q.status) where.status = String(q.status).toUpperCase();
  const rows = await M().Payment.findAll({ where, order: [['createdAt', 'DESC']], limit: p.fetch, offset: p.offset });
  const pg = paginate(rows, p);
  res.json({ payments: pg.rows.map((x) => ({ id: x.id, registrationId: x.registrationId, eventId: x.eventId, provider: x.provider, amount: x.amountPaise / 100, status: x.status, providerOrderId: x.providerOrderId, providerPaymentId: x.providerPaymentId, providerRefundId: x.providerRefundId, failureReason: x.failureReason, createdAt: iso(x.createdAt) })), pagination: pg.pagination });
};

// ── Organizers ───────────────────────────────────────────────────────────────
const organizerOut = (o, users, ents) => ({
  ...S.organizerOwn(o), userId: o.userId, name: (users.get(String(o.userId)) || {}).name || null, applicationNote: o.applicationNote, proofText: o.proofText,
  entity: ents.get(String(o.entityId)) ? { id: o.entityId, name: ents.get(String(o.entityId)).name, verified: !!ents.get(String(o.entityId)).verified } : null,
  reviewedAt: iso(o.reviewedAt),
});

// GET /organizers?status
const organizers = async (req, res) => {
  const where = {};
  if (req.query.status) where.status = String(req.query.status).toUpperCase();
  const rows = await M().Organizer.findAll({ where, order: [['createdAt', 'DESC']], limit: 500 });
  const users = await usersById(rows.map((r) => r.userId));
  const ents = Entity() ? await byIds(Entity(), rows.map((r) => r.entityId), ['id', 'name', 'verified']) : new Map();
  res.json({ organizers: rows.map((o) => organizerOut(o, users, ents)) });
};

/** Grants (or re-activates) organizer access for a user. */
const grantOrganizer = async (req, { userId, entityId = null, displayName, campusId }) => {
  const existing = await M().Organizer.findOne({ where: { userId } });
  const fields = { status: OS.ACTIVE, grantedBy: req.user.id, grantedAt: clock.now(), reviewedBy: req.user.id, reviewedAt: clock.now(), ...(entityId ? { entityId } : {}), ...(displayName ? { displayName } : {}), ...(campusId ? { campusId } : {}) };
  if (existing && existing.status === OS.ACTIVE && (!entityId || String(existing.entityId) === String(entityId))) return { row: existing, created: false };
  const row = existing ? await existing.update(fields) : await M().Organizer.create({ userId, ...fields });
  await logBoth(req, { targetId: row.id, action: 'organizer.grant', details: { organizerId: row.id, userId, entityId } });
  notify.toUsers([userId], 'You can publish campus events 🎉', 'Your organizer access is active. Create an event from Campus Events.', { type: N.ORGANIZER_APPROVED, organizerId: row.id });
  return { row, created: !existing };
};

// POST /organizers   { userId, entityId?, displayName? }
const createOrganizer = async (req, res) => {
  const userId = assertUuid(req.body && req.body.userId, 'user');
  const ctx = await require('../services/eligibility').loadContext(userId);
  if (!ctx.user) throw fail(404, 'NOT_FOUND', 'This user was not found.');
  let entityId = null;
  if (req.body.entityId) {
    entityId = assertUuid(req.body.entityId, 'club');
    const row = Entity() ? await Entity().findByPk(entityId) : null;
    if (!row) throw fail(404, 'NOT_FOUND', 'This club was not found.');
  }
  const { row } = await grantOrganizer(req, { userId, entityId, displayName: cleanText(req.body.displayName, 80) || ctx.user.name, campusId: ctx.campusId });
  res.status(201).json({ organizer: S.organizerOwn(row) });
};

const setOrganizerStatus = (to, from, action, notice) => async (req, res) => {
  const o = await M().Organizer.findByPk(assertUuid(req.params.id, 'organizer'));
  if (!o) throw fail(404, 'NOT_FOUND', 'This organizer was not found.');
  if (from && !from.includes(o.status)) throw fail(409, 'INVALID_STATE', `This organizer is ${o.status}.`, { status: o.status });
  const note = cleanText(req.body && (req.body.reason || req.body.note), 500) || null;
  if ([OS.SUSPENDED, OS.REVOKED, OS.REJECTED].includes(to) && !note) throw fail(400, 'INVALID_INPUT', 'Give a reason.', { field: 'reason' });
  await o.update({ status: to, reviewNote: note, reviewedBy: req.user.id, reviewedAt: clock.now(), ...(to === OS.ACTIVE ? { grantedBy: req.user.id, grantedAt: clock.now() } : {}) });
  await logBoth(req, { targetId: o.id, action, details: { organizerId: o.id, note } });
  if (notice) notify.toUsers([o.userId], notice[0], note ? `${notice[1]} ${note.slice(0, 120)}` : notice[1], { type: to === OS.ACTIVE ? N.ORGANIZER_APPROVED : N.ORGANIZER_SUSPENDED, organizerId: o.id });
  res.json({ organizer: S.organizerOwn(o) });
};
const approveOrganizer = setOrganizerStatus(OS.ACTIVE, [OS.PENDING, OS.REJECTED], 'organizer.approve', ['Organizer access approved 🎉', 'You can now create campus events.']);
const rejectOrganizer = setOrganizerStatus(OS.REJECTED, [OS.PENDING], 'organizer.reject', ['Organizer application not approved', 'Reason:']);
const suspendOrganizer = setOrganizerStatus(OS.SUSPENDED, [OS.ACTIVE], 'organizer.suspend', ['Organizer access suspended', 'Reason:']);
const reinstateOrganizer = setOrganizerStatus(OS.ACTIVE, [OS.SUSPENDED, OS.REVOKED], 'organizer.reinstate', ['Organizer access restored', 'You can create campus events again.']);
const revokeOrganizer = setOrganizerStatus(OS.REVOKED, [OS.ACTIVE, OS.SUSPENDED, OS.PENDING], 'organizer.revoke', ['Organizer access removed', 'Reason:']);

// POST /organizers/bulk-grant   { entityId? | campusId? }  managers of verified, active FriendsEntities
const bulkGrant = async (req, res) => {
  const ent = Entity();
  if (!ent) throw fail(503, 'UNAVAILABLE', 'Clubs are not available.');
  const where = { verified: true };
  if (req.body && req.body.entityId) where.id = assertUuid(req.body.entityId, 'club');
  else if (req.body && req.body.campusId) where.campusId = assertUuid(req.body.campusId, 'campus');
  else throw fail(400, 'INVALID_INPUT', 'Send entityId or campusId.', { field: 'entityId' });
  const rows = await ent.findAll({ where });
  let granted = 0; let skipped = 0;
  for (const e of rows) {
    if (e.status === 'suspended') { skipped++; continue; }
    for (const uid of (Array.isArray(e.managerIds) ? e.managerIds : []).map(String)) {
      const ctx = await require('../services/eligibility').loadContext(uid);
      if (!ctx.user || ctx.user.isActive === false) { skipped++; continue; }
      const existing = await M().Organizer.findOne({ where: { userId: uid } });
      if (existing && [OS.SUSPENDED, OS.REVOKED].includes(existing.status)) { skipped++; continue; }
      const r = await grantOrganizer(req, { userId: uid, entityId: e.id, displayName: e.name, campusId: e.campusId || ctx.campusId });
      if (r.created || (existing && existing.status !== OS.ACTIVE)) granted++; else skipped++;
    }
  }
  res.json({ entities: rows.length, granted, skipped });
};

// ── Staff ────────────────────────────────────────────────────────────────────
// GET /staff?eventId
const staff = async (req, res) => res.json({ staff: await O.staffList(await loadEvent(assertUuid(req.query.eventId, 'event'))) });
// POST /events/:id/staff { userId } | /events/:id/staff/:staffId/revoke
const addStaff = async (req, res) => {
  const ev = await loadEvent(req.params.id);
  const row = await O.grantStaff(req, ev, req.body && req.body.userId, 'admin');
  await adminAudit(req, ev.id, 'campus_events.staff.grant', { staffId: row.id });
  res.status(201).json({ staff: { id: row.id, status: row.status } });
};
const removeStaff = async (req, res) => {
  const ev = await loadEvent(req.params.id);
  const row = await O.revokeStaff(req, ev, req.params.staffId, 'admin');
  await adminAudit(req, ev.id, 'campus_events.staff.revoke', { staffId: row.id });
  res.json({ staff: { id: row.id, status: row.status } });
};

// POST /tickets/:id/void { reason } | /tickets/:id/reissue
const voidTicket = async (req, res) => {
  const tk = await M().Ticket.findByPk(assertUuid(req.params.id, 'ticket'));
  if (!tk) throw fail(404, 'NOT_FOUND', 'This ticket was not found.');
  if (tk.status !== E.TICKET_STATUS.ACTIVE) throw fail(409, 'NOT_ACTIVE', `This ticket is ${tk.status}.`);
  const reason = cleanText(req.body && req.body.reason, 300) || 'Voided by admin';
  await tk.update({ status: E.TICKET_STATUS.VOID, voidReason: reason });
  await logBoth(req, { eventId: tk.eventId, registrationId: tk.registrationId, action: 'ticket.void', details: { ticketId: tk.id, reason } });
  notify.nudge([tk.userId], 'ticket', tk.id, tk.status);
  res.json({ ticket: S.ticketBrief(tk) });
};
const reissueTicket = async (req, res) => {
  const tk0 = await M().Ticket.findByPk(assertUuid(req.params.id, 'ticket'));
  if (!tk0) throw fail(404, 'NOT_FOUND', 'This ticket was not found.');
  const tk = await require('../services/locks').tx(async (t) => tickets.reissue(await M().Ticket.findByPk(tk0.id, { transaction: t }), t));
  await logBoth(req, { eventId: tk.eventId, registrationId: tk.registrationId, action: 'ticket.reissue', details: { ticketId: tk.id, tokenVersion: tk.tokenVersion } });
  notify.toUsers([tk.userId], 'New ticket issued', 'Your event ticket was reissued. The old QR code no longer works.', { type: N.TICKET_AVAILABLE, ticketId: tk.id, eventId: tk.eventId, dedupe: tk.tokenVersion });
  res.json({ ticket: S.ticketBrief(tk) });
};

// GET /settings | PUT /settings { enabled?, walletEnabled?, onlinePayEnabled?, settings? }
const getSettings = async (req, res) => {
  res.json({
    enabled: await flag.readFlag({ fresh: true }), walletEnabled: await flag.readWalletFlag({ fresh: true }), onlinePayEnabled: await flag.readOnlineFlag({ fresh: true }),
    razorpayKeysPresent: payments.razorpay.keysPresent(), ticketsReady: tickets.configured(), settings: await flag.readSettings({ fresh: true }), categories: E.CATEGORIES,
  });
};
const putSettings = async (req, res) => {
  const b = req.body || {};
  if (b.enabled !== undefined) { await flag.writeFlag(bool(b.enabled)); await logBoth(req, { action: 'settings.flag', details: { enabled: bool(b.enabled) } }); }
  if (b.walletEnabled !== undefined) { await flag.writeWalletFlag(bool(b.walletEnabled)); await logBoth(req, { action: 'settings.wallet', details: { enabled: bool(b.walletEnabled) } }); }
  if (b.onlinePayEnabled !== undefined) { await flag.writeOnlineFlag(bool(b.onlinePayEnabled)); await logBoth(req, { action: 'settings.online_pay', details: { enabled: bool(b.onlinePayEnabled) } }); }
  if (b.settings && typeof b.settings === 'object') { await flag.writeSettings(b.settings); await logBoth(req, { action: 'settings.update', details: b.settings }); }
  return getSettings(req, res);
};

// GET /reports?from&to   per event: registrations, confirmed, checked in, money by mode, refunds
const reports = async (req, res) => {
  const from = optTime(req.query.from, 'from') || new Date(clock.nowMs() - 30 * 24 * 60 * 60 * 1000);
  const to = optTime(req.query.to, 'to') || new Date(clock.nowMs() + 365 * 24 * 60 * 60 * 1000);
  const rows = await M().Event.findAll({ where: { startAt: { [Op.between]: [from, to] }, status: { [Op.in]: [ES.PUBLISHED, ES.UNPUBLISHED, ES.COMPLETED, ES.CANCELLED, ES.APPROVED] } }, order: [['startAt', 'ASC']], limit: 500 });
  const out = [];
  const totals = { registrations: 0, confirmed: 0, checkedIn: 0, collected: { VENUE: 0, WALLET: 0, ONLINE: 0 }, refunded: 0, dueAtVenue: 0 };
  for (const ev of rows) {
    const s = await O.statsFor(ev);
    out.push({ id: ev.id, title: ev.title, status: ev.status, startAt: iso(ev.startAt), category: ev.category, format: ev.format, ...s });
    totals.registrations += s.total; totals.confirmed += s.confirmed; totals.checkedIn += s.checkedIn; totals.refunded += s.refunded; totals.dueAtVenue += s.dueAtVenue;
    for (const k of Object.keys(totals.collected)) totals.collected[k] += s.collected[k];
  }
  res.json({ from: iso(from), to: iso(to), events: out, totals });
};

// GET /audit?eventId&limit
const auditLog = async (req, res) => {
  const where = {};
  if (req.query.eventId) where.eventId = assertUuid(req.query.eventId, 'event');
  const p = pageOpts(req.query, 100, 500);
  const rows = await M().Audit.findAll({ where, order: [['at', 'DESC']], limit: p.fetch, offset: p.offset });
  const pg = paginate(rows, p);
  res.json({ audit: pg.rows.map((r) => ({ id: r.id, eventId: r.eventId, teamId: r.teamId, registrationId: r.registrationId, actorUserId: r.actorUserId, actorRole: r.actorRole, action: r.action, details: r.details, at: iso(r.at) })), pagination: pg.pagination });
};

module.exports = {
  summary, reviewQueue, events, eventDetail, approve, reject, requestChanges, unpublish, republish, cancelEvent, feature, editEvent,
  approveChanges, rejectChanges, eventRegistrations, registrations, cancelRegistration, refund, markPaid, paymentsList, organizers,
  createOrganizer, approveOrganizer, rejectOrganizer, suspendOrganizer, reinstateOrganizer, revokeOrganizer, bulkGrant, staff, addStaff,
  removeStaff, voidTicket, reissueTicket, getSettings, putSettings, reports, auditLog,
};
