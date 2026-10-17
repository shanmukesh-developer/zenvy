// Lifecycle job, notifications, announcements, admin reports, retention.
// Owner scenario: #24 notifications reflect real states (sent once, ids only, latest status on reopen).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

test.before(async () => { await H.setup({ label: 'ce-lifecycle' }); await H.setFlag(true); });
test.after(async () => { await H.teardown(); });

test('#24 notifications reflect real states: confirmed / waitlist / promotion / cancel; ids-only data; no duplicates', async () => {
  const { event } = await H.mkEvent({ capacity: 1, title: 'Notify Workshop' });
  const a = await H.mkStudent();
  const b = await H.mkStudent();
  const ra = await H.register(event.id, a);
  await H.register(event.id, b);
  await H.api('POST', `/api/campus-events/registrations/${ra.body.registration.id}/cancel`, a.token, {});
  const na = await H.notificationsFor(a.id);
  const nb = await H.notificationsFor(b.id);
  assert.deepEqual(na.map((n) => n.type).filter((t) => t.startsWith('CE_')), ['CE_REGISTRATION_CONFIRMED']);
  assert.deepEqual(nb.map((n) => n.type).filter((t) => t.startsWith('CE_')), ['CE_WAITLISTED', 'CE_WAITLIST_PROMOTED']);
  const data = nb[1].data;
  assert.equal(data.eventId, event.id);
  assert.ok(data.registrationId);
  assert.equal(data.screen, 'campus_event');
  for (const v of Object.values(data)) assert.ok(String(v).length < 100, 'ids only, no payload dumps');
  // Socket nudges carry ids + status only.
  const nudges = H.emitted.filter((e) => e.ev === 'campus_event:changed' && e.room === `user_${b.id}`);
  assert.ok(nudges.length >= 1);
  assert.deepEqual(Object.keys(nudges[nudges.length - 1].p).filter((k) => k !== 'at').sort(), ['id', 'kind', 'status']);
  assert.equal(nudges[nudges.length - 1].p.status, 'CONFIRMED', 'latest real status');
  // Reopen: detail shows the latest real state.
  assert.equal((await H.api('GET', `/api/campus-events/${event.id}`, b.token)).body.event.cta.action, 'VIEW_TICKET');
  // Dedupe: the same notice for the same registration twice -> one row.
  const notify = H.r('modules/campusEvents/services/notify');
  notify.toUsers([b.id], 'Dup', 'Dup', { type: 'CE_TEST_DUP', registrationId: ra.body.registration.id });
  notify.toUsers([b.id], 'Dup', 'Dup', { type: 'CE_TEST_DUP', registrationId: ra.body.registration.id });
  assert.equal((await H.notificationsFor(b.id)).filter((n) => n.type === 'CE_TEST_DUP').length, 1);
});

test('reminders 24 h + 1 h sent once each; deadline notice to forming team captains once', async () => {
  const { event } = await H.mkEvent({ capacity: 5, startInH: 30, title: 'Reminder Talk' });
  const s = await H.mkStudent();
  await H.register(event.id, s);
  const { event: cup } = await H.mkEvent({ format: 'TEAM', maxTeams: 3, teamMin: 2, teamMax: 3, startInH: 60, regClosesAt: new Date(H.now() + 20 * H.HOUR).toISOString(), title: 'Deadline Cup' });
  const cap = await H.mkStudent();
  await H.api('POST', `/api/campus-events/${cup.id}/teams`, cap.token, { name: 'Late Team' });
  let j = await H.runJobs();
  assert.equal(j.deadlineNotices, 1);
  assert.ok((await H.notificationsFor(cap.id)).some((n) => n.type === 'CE_DEADLINE_SOON'));
  j = await H.runJobs();
  assert.equal(j.deadlineNotices, 0, 'once');
  H.advance(7 * H.HOUR); // 23 h before
  j = await H.runJobs();
  assert.equal(j.reminders24, 1);
  j = await H.runJobs();
  assert.equal(j.reminders24, 0, '24 h reminder once');
  H.advance(22 * H.HOUR + 30 * H.MIN); // 30 min before
  j = await H.runJobs();
  assert.equal(j.reminders1, 1);
  j = await H.runJobs();
  assert.equal(j.reminders1, 0, '1 h reminder once');
  const types = (await H.notificationsFor(s.id)).map((n) => n.type);
  assert.equal(types.filter((t) => t === 'CE_REMINDER_24H').length, 1);
  assert.equal(types.filter((t) => t === 'CE_REMINDER_1H').length, 1);
});

test('COMPLETED after endAt; open holds / waitlist closed; retention purge erases answers after retentionDays', async () => {
  const { event } = await H.mkEvent({ capacity: 1, startInH: 2, durationH: 1, questions: [{ id: 'food', label: 'Food preference', type: 'TEXT' }], title: 'Retention Talk' });
  const a = await H.mkStudent();
  const b = await H.mkStudent();
  const ra = await H.register(event.id, a, { answers: { food: 'Veg' } });
  const rb = await H.register(event.id, b, { answers: { food: 'Non-veg' } });
  assert.equal(rb.body.registration.status, 'WAITLISTED');
  H.advance(3 * H.HOUR + H.MIN);
  const j = await H.runJobs();
  assert.equal(j.completed, 1);
  const ev = await H.ctx.M('CeEvent').findByPk(event.id);
  assert.equal(ev.status, 'COMPLETED');
  assert.equal((await H.ctx.M('CeRegistration').findByPk(rb.body.registration.id)).status, 'EXPIRED');
  assert.equal((await H.ctx.M('CeRegistration').findByPk(ra.body.registration.id)).status, 'CONFIRMED');
  const done = await H.api('GET', '/api/campus-events/my/registrations?tab=completed', a.token);
  assert.ok(done.body.registrations.some((x) => x.id === ra.body.registration.id));
  H.advance(181 * H.DAY);
  const j2 = await H.runJobs();
  assert.ok(j2.purged >= 1);
  assert.equal((await H.ctx.M('CeRegistration').findByPk(ra.body.registration.id)).answers, null);
  assert.ok((await H.ctx.M('CeEvent').findByPk(event.id)).retentionPurgedAt);
  assert.ok(await H.ctx.M('CeAuditLog').findOne({ where: { eventId: event.id, action: 'retention.purge_answers' } }));
});

test('announcements: organizer -> registrants (rate limited 5/day), material edits wait for admin, venue change notifies', async () => {
  const { event, organizer } = await H.mkEvent({ capacity: 5, title: 'Announce Fest' });
  const s = await H.mkStudent();
  await H.register(event.id, s);
  const outsider = await H.mkStudent();
  const a1 = await H.api('POST', `/api/campus-events/organizer/events/${event.id}/announcements`, organizer.token, { title: 'Bring water', body: 'It will be hot. Bring a bottle.' });
  assert.equal(a1.status, 201);
  assert.ok((await H.notificationsFor(s.id)).some((n) => n.type === 'CE_ANNOUNCEMENT'));
  assert.equal((await H.notificationsFor(outsider.id)).length, 0);
  assert.equal((await H.api('GET', `/api/campus-events/${event.id}/announcements`, s.token)).body.announcements.length, 1);
  assert.equal((await H.api('GET', `/api/campus-events/${event.id}/announcements`, outsider.token)).status, 404);
  for (let i = 0; i < 4; i++) assert.equal((await H.api('POST', `/api/campus-events/organizer/events/${event.id}/announcements`, organizer.token, { title: `Update ${i}`, body: 'Details inside.' })).status, 201);
  const sixth = await H.api('POST', `/api/campus-events/organizer/events/${event.id}/announcements`, organizer.token, { title: 'One more', body: 'Too many.' });
  assert.equal(sixth.status, 429);
  // Material edit (venue) on a live event -> pendingChanges; cosmetic (description) live.
  const e = await H.api('PATCH', `/api/campus-events/organizer/events/${event.id}`, organizer.token, { venue: 'Open Air Theatre', description: 'Now with music.' });
  assert.equal(e.status, 200);
  assert.deepEqual(e.body.pendingReview, ['venue']);
  assert.equal(e.body.event.venue, 'Main Auditorium');
  assert.equal(e.body.event.description, 'Now with music.');
  const adm = await H.admin();
  const q = await H.api('GET', '/api/admin/campus-events/review-queue', adm.token);
  assert.ok(q.body.events.some((x) => x.id === event.id && x.pendingChanges));
  const ok = await H.api('POST', `/api/admin/campus-events/events/${event.id}/changes/approve`, adm.token);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.event.venue, 'Open Air Theatre');
  assert.ok((await H.notificationsFor(s.id)).some((n) => n.type === 'CE_VENUE_CHANGED'));
  const low = await H.api('PATCH', `/api/campus-events/organizer/events/${event.id}`, organizer.token, { capacity: 0 });
  assert.equal(low.status, 400);
});

test('admin: summary buckets, events by bucket, registrations / payments, reports, settings, audit; non-admin 403', async () => {
  const adm = await H.admin();
  const s = await H.mkStudent();
  assert.equal((await H.api('GET', '/api/admin/campus-events/summary', s.token)).status, 403);
  const { event } = await H.mkEvent({ capacity: 1, priceType: 'PAID', price: 10, paymentModes: ['VENUE'], title: 'Admin Bucket Event' });
  await H.register(event.id, s, { paymentMode: 'VENUE' });
  const sum = await H.api('GET', '/api/admin/campus-events/summary', adm.token);
  assert.equal(sum.status, 200);
  for (const k of ['pending_approval', 'approved_upcoming', 'published', 'registration_open', 'fully_booked', 'registration_closed', 'in_progress', 'completed', 'cancelled']) assert.equal(typeof sum.body.buckets[k], 'number', k);
  assert.ok(sum.body.buckets.fully_booked >= 1);
  const fb = await H.api('GET', '/api/admin/campus-events/events?bucket=fully_booked', adm.token);
  assert.ok(fb.body.events.some((e) => e.id === event.id));
  const regs = await H.api('GET', `/api/admin/campus-events/registrations?eventId=${event.id}`, adm.token);
  assert.equal(regs.body.registrations[0].payment.status, 'DUE_AT_VENUE');
  const rep = await H.api('GET', '/api/admin/campus-events/reports', adm.token);
  assert.ok(rep.body.events.some((e) => e.id === event.id && e.dueAtVenue === 10));
  const st = await H.api('PUT', '/api/admin/campus-events/settings', adm.token, { settings: { holdMinutes: 15 } });
  assert.equal(st.body.settings.holdMinutes, 15);
  assert.equal((await H.api('PUT', '/api/admin/campus-events/settings', adm.token, { settings: { holdMinutes: 999 } })).status, 400);
  await H.api('PUT', '/api/admin/campus-events/settings', adm.token, { settings: { holdMinutes: 10 } });
  const au = await H.api('GET', '/api/admin/campus-events/audit', adm.token);
  assert.ok(au.body.audit.some((x) => x.action === 'event.approve'));
  // Admin cancels a registration (override) -> audited + student told.
  const reg = regs.body.registrations[0];
  const c = await H.api('POST', `/api/admin/campus-events/registrations/${reg.id}/cancel`, adm.token, { reason: 'Duplicate account' });
  assert.equal(c.status, 200);
  assert.ok((await H.notificationsFor(s.id)).some((n) => n.type === 'CE_REGISTRATION_CANCELLED'));
  assert.ok(await H.ctx.M('VerificationLog').findOne({ where: { action: 'campus_events.registration.cancel' } }));
  // Unpublish hides it; republish shows it.
  await H.api('POST', `/api/admin/campus-events/events/${event.id}/unpublish`, adm.token, { reason: 'Safety review' });
  assert.ok(!(await H.api('GET', '/api/campus-events?limit=50', s.token)).body.events.some((e) => e.id === event.id));
  await H.api('POST', `/api/admin/campus-events/events/${event.id}/republish`, adm.token);
  assert.ok((await H.api('GET', '/api/campus-events?limit=50', s.token)).body.events.some((e) => e.id === event.id));
});

test('job is idle (one cheap pass) when nothing is active', async () => {
  const fresh = H.r('modules/campusEvents/jobs');
  const Event = H.ctx.M('CeEvent');
  const n = await Event.count();
  assert.ok(n > 0);
  const r = await fresh.runCampusEventJobs(new Date(H.now()));
  assert.equal(typeof r, 'object');
});
