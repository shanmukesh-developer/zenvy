// Tickets + entry check-in.
// Owner scenarios: #18 QR for eligible registrations, #19 invalid QR rejected, #20 used ticket can't be reused,
// #21 cancelled / unpaid tickets rejected, #22 staff check-in works.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

test.before(async () => { await H.setup({ label: 'ce-checkin' }); await H.setFlag(true); });
test.after(async () => { await H.configureRazorpay(false); await H.teardown(); });

const ticketOf = async (user, regId) => {
  const reg = (await H.api('GET', `/api/campus-events/registrations/${regId}`, user.token)).body.registration;
  return (await H.api('GET', `/api/campus-events/tickets/${reg.tickets[0].id}`, user.token)).body.ticket;
};
const validate = (staff, eventId, body) => H.api('POST', '/api/campus-events/check-in/validate', staff.token, { eventId, ...body });
const confirm = (staff, eventId, body) => H.api('POST', '/api/campus-events/check-in/confirm', staff.token, { eventId, ...body });

test('#18 QR tickets only for confirmed registrations (free, venue-confirmed); none for pending / waitlisted / unpaid', async () => {
  await H.configureRazorpay(true);
  const { event } = await H.mkEvent({ capacity: 2, priceType: 'PAID', price: 30, paymentModes: ['VENUE', 'ONLINE'] });
  const a = await H.mkStudent();
  const b = await H.mkStudent();
  const c = await H.mkStudent();
  const ra = await H.register(event.id, a, { paymentMode: 'VENUE' });
  assert.equal(ra.body.registration.tickets.length, 1);
  const tk = await ticketOf(a, ra.body.registration.id);
  assert.ok(tk.qrToken.startsWith('ZE1.'));
  assert.equal(tk.registration.paymentDue, true);
  assert.equal(JSON.stringify(tk).includes(a.id), false, 'QR payload carries no user id');
  const rb = await H.register(event.id, b, { paymentMode: 'ONLINE' });
  assert.equal(rb.body.registration.status, 'PENDING_PAYMENT');
  assert.equal(rb.body.registration.tickets.length, 0);
  const rc = await H.register(event.id, c, { paymentMode: 'VENUE' });
  assert.equal(rc.body.registration.status, 'WAITLISTED');
  assert.equal(rc.body.registration.tickets.length, 0);
  const my = await H.api('GET', '/api/campus-events/my/tickets', a.token);
  assert.equal(my.body.tickets.length, 1);
  assert.equal((await H.api('GET', `/api/campus-events/tickets/${tk.id}`, b.token)).status, 404, "others cannot open someone's ticket");
  await H.configureRazorpay(false);
});

test('#19 invalid QR rejected: forged signature, wrong version, garbage, unknown code, other event; staff-only access', async () => {
  const { event, organizer } = await H.mkEvent({ capacity: 3, startInH: 1 });
  const { event: other } = await H.mkEvent({ capacity: 3, startInH: 1 });
  const s = await H.mkStudent();
  const r = await H.register(event.id, s);
  const tk = await ticketOf(s, r.body.registration.id);
  const parts = tk.qrToken.split('.');
  const forged = [...parts.slice(0, 3), `${parts[3].slice(0, -2)}AA`].join('.');
  const wrongVer = [parts[0], parts[1], '2', parts[3]].join('.');
  for (const token of [forged, wrongVer, 'hello', 'ZE1.not-a-uuid.1.xxxxxxxxxxxxxxxxxxxxxxxxx', `${tk.qrToken}x`]) {
    const v = await validate(organizer, event.id, { token });
    assert.equal(v.status, 200);
    assert.equal(v.body.result, 'INVALID', token);
    assert.equal(v.body.admit, false);
  }
  assert.equal((await validate(organizer, event.id, { code: 'ZZZZZZZZZZ' })).body.result, 'INVALID');
  // Another event's staff scanning this ticket.
  const otherOrg = (await H.ctx.M('CeEvent').findByPk(other.id)).organizerUserId;
  const otherUser = await H.ctx.M('User').findByPk(otherOrg);
  otherUser.token = H.userToken(otherUser);
  assert.equal((await validate(otherUser, other.id, { token: tk.qrToken })).body.result, 'WRONG_EVENT');
  // Not staff -> 403; every attempt logged.
  const rando = await H.mkStudent();
  const nf = await validate(rando, event.id, { token: tk.qrToken });
  assert.equal(nf.status, 403);
  assert.equal(nf.body.code, 'NOT_EVENT_STAFF');
  assert.ok(await H.ctx.M('CeCheckIn').count({ where: { eventId: event.id, result: 'INVALID' } }) >= 6);
  // Reissue kills the old QR.
  const adm = await H.admin();
  const re = await H.api('POST', `/api/admin/campus-events/tickets/${tk.id}/reissue`, adm.token);
  assert.equal(re.status, 200);
  assert.equal((await validate(organizer, event.id, { token: tk.qrToken })).body.result, 'INVALID', 'old version dead');
  assert.equal((await validate(organizer, event.id, { code: tk.ticketCode })).body.result, 'INVALID', 'old code dead');
  const tk2 = await ticketOf(s, r.body.registration.id);
  assert.equal((await validate(organizer, event.id, { token: tk2.qrToken })).body.result, 'VALID');
});

test('#20 a used ticket cannot be reused (atomic single use, parallel double scan admits once)', async () => {
  const { event, organizer } = await H.mkEvent({ capacity: 3, startInH: 0.5 });
  const s = await H.mkStudent();
  const r = await H.register(event.id, s);
  const tk = await ticketOf(s, r.body.registration.id);
  const results = await Promise.all(Array.from({ length: 6 }, () => confirm(organizer, event.id, { token: tk.qrToken })));
  const ok = results.filter((x) => x.status === 200);
  assert.equal(ok.length, 1, 'exactly one admission');
  assert.ok(results.filter((x) => x.status === 409).every((x) => x.body.code === 'ALREADY_USED'));
  assert.equal(await H.ctx.M('CeCheckIn').count({ where: { ticketId: tk.id, action: 'CONFIRM', result: 'VALID' } }), 1);
  const again = await validate(organizer, event.id, { code: tk.ticketCode.toLowerCase() });
  assert.equal(again.body.result, 'ALREADY_USED');
  assert.ok(again.body.ticket.usedAt);
  const can = await H.api('POST', `/api/campus-events/registrations/${r.body.registration.id}/cancel`, s.token, {});
  assert.equal(can.status, 409, 'cannot cancel after check-in');
  assert.equal((await H.ctx.M('CeEvent').findByPk(event.id)).checkedInCount, 1);
});

test('#21 cancelled / unpaid / pending tickets rejected; event cancellation cancels every ticket', async () => {
  await H.configureRazorpay(true);
  const { event, organizer } = await H.mkEvent({ capacity: 5, startInH: 0.5, priceType: 'PAID', price: 25, paymentModes: ['VENUE', 'ONLINE'], cancellationPolicy: { userCancelUntilHours: 0 } });
  const a = await H.mkStudent();
  const ra = await H.register(event.id, a, { paymentMode: 'VENUE' });
  const tka = await ticketOf(a, ra.body.registration.id);
  await H.api('POST', `/api/campus-events/registrations/${ra.body.registration.id}/cancel`, a.token, {});
  assert.equal((await validate(organizer, event.id, { token: tka.qrToken })).body.result, 'CANCELLED');
  const cc = await confirm(organizer, event.id, { token: tka.qrToken });
  assert.equal(cc.status, 409);
  assert.equal(cc.body.code, 'CANCELLED');
  // Venue fee due: confirm without collecting -> PAYMENT_DUE; with collectPayment -> admitted + marked paid (audited).
  const b = await H.mkStudent();
  const rb = await H.register(event.id, b, { paymentMode: 'VENUE' });
  const tkb = await ticketOf(b, rb.body.registration.id);
  const v = await validate(organizer, event.id, { token: tkb.qrToken });
  assert.equal(v.body.result, 'VALID');
  assert.equal(v.body.paymentDue, 25);
  assert.equal(v.body.admit, false);
  const due = await confirm(organizer, event.id, { token: tkb.qrToken });
  assert.equal(due.status, 409);
  assert.equal(due.body.code, 'PAYMENT_DUE');
  const paid = await confirm(organizer, event.id, { token: tkb.qrToken, collectPayment: true });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.admitted, true);
  assert.equal(paid.body.collected, 25);
  assert.equal((await H.ctx.M('CeRegistration').findByPk(rb.body.registration.id)).paymentStatus, 'PAID_AT_VENUE');
  assert.ok(await H.ctx.M('CeAuditLog').findOne({ where: { registrationId: rb.body.registration.id, action: 'payment.mark_paid_at_venue' } }));
  // Event cancelled by the organizer: every remaining ticket rejected.
  const c = await H.mkStudent();
  const rc = await H.register(event.id, c, { paymentMode: 'VENUE' });
  const tkc = await ticketOf(c, rc.body.registration.id);
  assert.equal((await H.api('POST', `/api/campus-events/organizer/events/${event.id}/cancel`, organizer.token, { reason: 'Hall unavailable' })).status, 200);
  assert.equal((await validate(organizer, event.id, { token: tkc.qrToken })).body.result, 'CANCELLED');
  assert.ok((await H.notificationsFor(c.id)).some((n) => n.type === 'CE_EVENT_CANCELLED'));
  await H.configureRazorpay(false);
});

test('#21b unpaid online + pending approval are not admitted', async () => {
  const org = await H.mkOrganizer();
  const { event } = await H.mkEvent({ organizer: org, capacity: 5, startInH: 0.5, approvalRequired: true });
  const s = await H.mkStudent();
  const r = await H.register(event.id, s);
  assert.equal(r.body.registration.status, 'PENDING_APPROVAL');
  // A ticket that exists for a registration that is not confirmed (admin voided approval later) -> PENDING / UNPAID.
  await H.api('POST', `/api/campus-events/organizer/events/${event.id}/registrations/${r.body.registration.id}/approve`, org.token);
  const tk = await ticketOf(s, r.body.registration.id);
  await H.ctx.M('CeRegistration').update({ status: 'PENDING_PAYMENT' }, { where: { id: r.body.registration.id } });
  assert.equal((await validate(org, event.id, { token: tk.qrToken })).body.result, 'UNPAID');
  await H.ctx.M('CeRegistration').update({ status: 'PENDING_APPROVAL' }, { where: { id: r.body.registration.id } });
  assert.equal((await validate(org, event.id, { token: tk.qrToken })).body.result, 'PENDING');
});

test('#22 staff check-in works: granted staff validate + confirm with a limited view; entry window; revoke; rate limit', async () => {
  const { event, organizer } = await H.mkEvent({ capacity: 5, startInH: 3, entryOpensBeforeMin: 60 });
  const staff = await H.mkStudent({ name: 'Gate Volunteer' });
  const s = await H.mkStudent({ name: 'Priya Sharma' });
  const r = await H.register(event.id, s);
  const tk = await ticketOf(s, r.body.registration.id);
  assert.equal((await validate(staff, event.id, { token: tk.qrToken })).status, 403);
  const g = await H.api('POST', `/api/campus-events/organizer/events/${event.id}/staff`, organizer.token, { userId: staff.id });
  assert.equal(g.status, 201);
  const early = await validate(staff, event.id, { token: tk.qrToken });
  assert.equal(early.body.result, 'NOT_YET_VALID');
  assert.ok(early.body.entryOpensAt);
  H.advance(2 * H.HOUR + 5 * H.MIN);
  const v = await validate(staff, event.id, { code: tk.ticketCode });
  assert.equal(v.body.result, 'VALID');
  assert.equal(v.body.ticket.holder, 'Priya S.');
  for (const k of ['phone', 'email', 'userId', 'answers']) assert.equal(JSON.stringify(v.body.ticket).includes(`"${k}"`), false, k);
  const c = await confirm(staff, event.id, { code: tk.ticketCode });
  assert.equal(c.status, 200);
  assert.equal(c.body.admitted, true);
  const row = await H.ctx.M('CeCheckIn').findOne({ where: { ticketId: tk.id, action: 'CONFIRM', result: 'VALID' } });
  assert.equal(row.staffUserId, staff.id);
  const list = await H.api('GET', '/api/campus-events/check-in/events', staff.token);
  assert.ok(list.body.events.some((e) => e.id === event.id));
  const recent = await H.api('GET', `/api/campus-events/check-in/events/${event.id}/recent`, staff.token);
  assert.ok(recent.body.checkIns.length >= 2);
  // After the event ends -> EXPIRED.
  const s2 = await H.mkStudent();
  const { event: e2, organizer: o2 } = await H.mkEvent({ capacity: 5, startInH: 1, durationH: 1 });
  const r2 = await H.register(e2.id, s2);
  const tk2 = await ticketOf(s2, r2.body.registration.id);
  H.advance(2 * H.HOUR + H.MIN);
  assert.equal((await validate(o2, e2.id, { token: tk2.qrToken })).body.result, 'EXPIRED');
  // Revoke staff -> 403.
  await H.api('POST', `/api/campus-events/organizer/events/${event.id}/staff/${g.body.staff.id}/revoke`, organizer.token);
  assert.equal((await validate(staff, event.id, { token: tk.qrToken })).status, 403);
  // Rate limit (120 / min per staff).
  H.r('modules/campusEvents/services/util').resetLimits();
  let limited = null;
  for (let i = 0; i < 125 && !limited; i++) {
    const x = await validate(organizer, event.id, { code: 'AAAAAAAAAA' });
    if (x.status === 429) limited = x;
  }
  assert.ok(limited, 'rate limited');
  assert.equal(limited.body.code, 'RATE_LIMITED');
  H.r('modules/campusEvents/services/util').resetLimits();
});

test('team ticket admits the team once; member tickets per member when attendance is per member', async () => {
  const { event, organizer } = await H.mkEvent({ format: 'TEAM', maxTeams: 2, teamMin: 2, teamMax: 3, startInH: 0.5, attendancePerMember: true });
  const cap = await H.mkStudent();
  const p = await H.mkStudent();
  const team = (await H.api('POST', `/api/campus-events/${event.id}/teams`, cap.token, { name: 'Gate Team' })).body.team;
  const inv = await H.api('POST', `/api/campus-events/teams/${team.id}/invitations`, cap.token, { userId: p.id });
  await H.api('POST', `/api/campus-events/team-invitations/${inv.body.invitation.id}/respond`, p.token, { accept: true });
  await H.api('POST', `/api/campus-events/teams/${team.id}/submit`, cap.token, { acceptRules: true, rulesVersion: 1 });
  const tp = await H.api('GET', '/api/campus-events/my/tickets', p.token);
  const kinds = tp.body.tickets.map((t) => t.kind).sort();
  assert.deepEqual(kinds, ['MEMBER', 'TEAM'], 'member sees own MEMBER ticket + the TEAM ticket');
  const team1 = tp.body.tickets.find((t) => t.kind === 'TEAM');
  assert.equal(team1.holder, 'Gate Team');
  assert.equal((await confirm(organizer, event.id, { token: team1.qrToken })).status, 200);
  assert.equal((await confirm(organizer, event.id, { token: team1.qrToken })).body.code, 'ALREADY_USED');
  const mem = tp.body.tickets.find((t) => t.kind === 'MEMBER');
  assert.equal((await confirm(organizer, event.id, { token: mem.qrToken })).status, 200);
});
