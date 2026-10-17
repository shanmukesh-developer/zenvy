// Foundation: feature flag, organizer gating, admin review, discovery + filters.
// Owner scenarios: #1 discover upcoming, #2 filter date/category/price, #15 unauthorized organizers can't
// publish, #16 pending not publicly listed, #17 admin approve/reject.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

test.before(async () => { await H.setup({ label: 'ce-foundation' }); });
test.after(async () => { await H.teardown(); });

test('flag: default OFF (missing row = off); FEATURE_OFF on browse / register / teams; own lists still work', async () => {
  const flag = H.r('modules/campusEvents/services/flag');
  flag.clearCache();
  assert.equal(await flag.readFlag({ fresh: true }), false);
  const s = await H.mkStudent();
  const st = await H.api('GET', '/api/campus-events/status', s.token);
  assert.equal(st.status, 200);
  assert.equal(st.body.enabled, false);
  for (const [m, u] of [['GET', '/api/campus-events'], ['GET', '/api/campus-events/sections'], ['POST', '/api/campus-events/00000000-0000-4000-8000-000000000000/register'], ['POST', '/api/campus-events/00000000-0000-4000-8000-000000000000/teams'], ['POST', '/api/campus-events/team-join']]) {
    const r = await H.api(m, u, s.token, m === 'POST' ? {} : undefined);
    assert.equal(r.status, 403, `${m} ${u}`);
    assert.equal(r.body.code, 'FEATURE_OFF');
  }
  assert.equal((await H.api('GET', '/api/campus-events/my/registrations', s.token)).status, 200);
  assert.equal((await H.api('GET', '/api/campus-events/my/tickets', s.token)).status, 200);
  const adm = await H.admin();
  assert.equal((await H.api('GET', '/api/admin/campus-events/summary', adm.token)).status, 200);
  // Organizer drafts work while off; submit is refused.
  const org = await H.mkOrganizer();
  const draft = await H.mkEvent({ organizer: org, approve: false });
  const sub = await H.api('POST', `/api/campus-events/organizer/events/${draft.event.id}/submit`, org.token);
  assert.equal(sub.status, 403);
  assert.equal(sub.body.code, 'FEATURE_OFF');
});

test('flag: CAMPUS_EVENTS_DEV_ENABLE=1 works only outside production', async () => {
  const flag = H.r('modules/campusEvents/services/flag');
  const GC = H.ctx.M('GlobalConfig');
  await GC.destroy({ where: { key: 'CAMPUS_EVENTS_ENABLED' } });
  process.env.CAMPUS_EVENTS_DEV_ENABLE = '1';
  try {
    flag.clearCache();
    assert.equal(await flag.readFlag({ fresh: true }), true, 'dev override on in test/dev');
    process.env.NODE_ENV = 'production';
    flag.clearCache();
    assert.equal(await flag.readFlag({ fresh: true }), false, 'dev override refused in production');
    process.env.NODE_ENV = 'test';
    process.env.RENDER = 'true';
    flag.clearCache();
    assert.equal(await flag.readFlag({ fresh: true }), false, 'dev override refused on Render');
  } finally {
    delete process.env.RENDER;
    process.env.NODE_ENV = 'test';
    delete process.env.CAMPUS_EVENTS_DEV_ENABLE;
    flag.clearCache();
  }
  assert.equal(await flag.readFlag({ fresh: true }), false);
});

test('tickets: CAMPUS_EVENTS_TICKET_SECRET missing in production -> 503 TICKETS_NOT_CONFIGURED (no crash)', async () => {
  const tickets = H.r('modules/campusEvents/services/tickets');
  assert.equal(tickets.configured(), true, 'dev/test: generated per-process secret');
  process.env.NODE_ENV = 'production';
  try {
    tickets._resetWarn();
    assert.equal(await H.silent(async () => tickets.configured()), false);
    await H.setFlag(true);
    const { event } = await (async () => { process.env.NODE_ENV = 'test'; const e = await H.mkEvent({ capacity: 5 }); process.env.NODE_ENV = 'production'; return e; })();
    const s = await H.mkStudent();
    const r = await H.silent(() => H.register(event.id, s));
    assert.equal(r.status, 503);
    assert.equal(r.body.code, 'TICKETS_NOT_CONFIGURED');
    process.env.CAMPUS_EVENTS_TICKET_SECRET = 'a-real-looking-production-secret-123';
    assert.equal(tickets.configured(), true);
  } finally {
    process.env.NODE_ENV = 'test';
    delete process.env.CAMPUS_EVENTS_TICKET_SECRET;
    await H.setFlag(false);
  }
});

test('#15 unauthorized organizers cannot publish (ordinary students 403 NOT_ORGANIZER; suspended blocked)', async () => {
  await H.setFlag(true);
  const s = await H.mkStudent();
  const r = await H.api('POST', '/api/campus-events/organizer/events', s.token, { title: 'Fake event', startAt: new Date(H.now() + H.DAY).toISOString(), endAt: new Date(H.now() + H.DAY + H.HOUR).toISOString() });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'NOT_ORGANIZER');
  // Apply -> pending -> still cannot create.
  const ap = await H.api('POST', '/api/campus-events/organizer/apply', s.token, { displayName: 'Chess Club', note: 'We run weekly chess nights.' });
  assert.equal(ap.status, 201);
  assert.equal(ap.body.organizer.status, 'PENDING');
  assert.equal((await H.api('POST', '/api/campus-events/organizer/events', s.token, { title: 'Chess night' })).status, 403);
  // Unverified students cannot even apply.
  const u = await H.mkStudent({ verified: false });
  const ap2 = await H.api('POST', '/api/campus-events/organizer/apply', u.token, { displayName: 'X Club' });
  assert.equal(ap2.status, 403);
  assert.equal(ap2.body.code, 'VERIFICATION_REQUIRED');
  // Admin approves -> can create; suspend -> blocked again.
  const adm = await H.admin();
  const list = await H.api('GET', '/api/admin/campus-events/organizers?status=PENDING', adm.token);
  const row = list.body.organizers.find((o) => o.userId === s.id);
  assert.ok(row);
  assert.equal((await H.api('POST', `/api/admin/campus-events/organizers/${row.id}/approve`, adm.token, {})).status, 200);
  const c = await H.api('POST', '/api/campus-events/organizer/events', s.token, { title: 'Chess night', startAt: new Date(H.now() + H.DAY).toISOString(), endAt: new Date(H.now() + H.DAY + H.HOUR).toISOString() });
  assert.equal(c.status, 201);
  assert.equal(c.body.event.status, 'DRAFT');
  assert.equal((await H.api('POST', `/api/admin/campus-events/organizers/${row.id}/suspend`, adm.token, {})).status, 400, 'reason required');
  assert.equal((await H.api('POST', `/api/admin/campus-events/organizers/${row.id}/suspend`, adm.token, { reason: 'Spam events' })).status, 200);
  const blocked = await H.api('POST', '/api/campus-events/organizer/events', s.token, { title: 'Again' });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, 'NOT_ORGANIZER');
  assert.equal((await H.api('POST', `/api/admin/campus-events/organizers/${row.id}/revoke`, adm.token, { reason: 'Repeated spam' })).status, 200);
  // Another organizer cannot read or edit someone else's event.
  const other = await H.mkOrganizer();
  assert.equal((await H.api('GET', `/api/campus-events/organizer/events/${c.body.event.id}`, other.token)).status, 404);
  assert.equal((await H.api('PATCH', `/api/campus-events/organizer/events/${c.body.event.id}`, other.token, { title: 'Hijack' })).status, 404);
  // Audit rows exist for the admin decisions (CeAuditLog + VerificationLog mirror).
  const audits = await H.ctx.M('VerificationLog').findAll();
  assert.ok(audits.some((a) => a.action === 'campus_events.organizer.approve'));
  assert.ok(audits.some((a) => a.action === 'campus_events.organizer.suspend'));
});

test('organizers: admin grant, bulk grant FriendsEntity managers, questions may not ask for IDs', async () => {
  const adm = await H.admin();
  const s = await H.mkStudent();
  const g = await H.api('POST', '/api/admin/campus-events/organizers', adm.token, { userId: s.id, displayName: 'Music Club' });
  assert.equal(g.status, 201);
  assert.equal(g.body.organizer.status, 'ACTIVE');
  const m1 = await H.mkStudent();
  const m2 = await H.mkStudent();
  const c = await H.campus();
  const ent = await H.ctx.M('FriendsEntity').create({ campusId: c.id, type: 'club', name: 'Robotics Club', handle: `robotics${Date.now()}`, verified: true, managerIds: [m1.id, m2.id], status: 'active' });
  const b = await H.api('POST', '/api/admin/campus-events/organizers/bulk-grant', adm.token, { entityId: ent.id });
  assert.equal(b.status, 200);
  assert.equal(b.body.granted, 2);
  const again = await H.api('POST', '/api/admin/campus-events/organizers/bulk-grant', adm.token, { entityId: ent.id });
  assert.equal(again.body.granted, 0, 'idempotent');
  const me = await H.api('GET', '/api/campus-events/organizer/me', m1.token);
  assert.equal(me.body.organizer.status, 'ACTIVE');
  assert.equal(me.body.managedClubs[0].name, 'Robotics Club');
  const bad = await H.api('POST', '/api/campus-events/organizer/events', m1.token, { title: 'ID check', questions: [{ label: 'Your Aadhaar number', type: 'TEXT' }] });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'QUESTION_NOT_ALLOWED');
});

test('#16 pending (draft / submitted / rejected) events are not publicly listed; #17 admin approve / reject / request changes', async () => {
  await H.setFlag(true);
  const s = await H.mkStudent();
  const org = await H.mkOrganizer();
  const adm = await H.admin();
  const { event: draft } = await H.mkEvent({ organizer: org, approve: false, title: 'Draft Hackathon' });
  const browse = async () => (await H.api('GET', '/api/campus-events?limit=50', s.token)).body.events.map((e) => e.id);
  assert.ok(!(await browse()).includes(draft.id));
  assert.equal((await H.api('GET', `/api/campus-events/${draft.id}`, s.token)).status, 404);
  assert.equal((await H.api('POST', `/api/campus-events/organizer/events/${draft.id}/submit`, org.token)).status, 200);
  assert.ok(!(await browse()).includes(draft.id), 'submitted not listed');
  assert.equal((await H.api('GET', `/api/campus-events/${draft.id}`, s.token)).status, 404);
  assert.equal((await H.register(draft.id, s)).status, 404, 'cannot register for a pending event');
  const q = await H.api('GET', '/api/admin/campus-events/review-queue', adm.token);
  assert.ok(q.body.events.some((e) => e.id === draft.id));
  // Request changes -> organizer edits -> resubmit -> reject.
  assert.equal((await H.api('POST', `/api/admin/campus-events/events/${draft.id}/request-changes`, adm.token, { note: 'Add the venue room number' })).status, 200);
  assert.equal((await H.api('PATCH', `/api/campus-events/organizer/events/${draft.id}`, org.token, { venue: 'Main Auditorium, Room 101' })).status, 200);
  assert.equal((await H.api('POST', `/api/campus-events/organizer/events/${draft.id}/submit`, org.token)).status, 200);
  assert.equal((await H.api('POST', `/api/admin/campus-events/events/${draft.id}/reject`, adm.token, {})).status, 400, 'reason required');
  const rej = await H.api('POST', `/api/admin/campus-events/events/${draft.id}/reject`, adm.token, { reason: 'Clashes with exams' });
  assert.equal(rej.status, 200);
  assert.equal(rej.body.event.status, 'REJECTED');
  assert.ok(!(await browse()).includes(draft.id), 'rejected not listed');
  // Approve another -> listed.
  const { event: ok } = await H.mkEvent({ organizer: org, title: 'Approved Workshop' });
  assert.equal(ok.status, 'PUBLISHED');
  assert.ok((await browse()).includes(ok.id));
  const notes = await H.notificationsFor(org.id);
  assert.ok(notes.some((n) => n.type === 'CE_EVENT_REJECTED'));
  assert.ok(notes.some((n) => n.type === 'CE_EVENT_CHANGES_REQUESTED'));
  assert.ok(notes.some((n) => n.type === 'CE_EVENT_PUBLISHED'));
  // Scheduled publish: APPROVED until publishAt, then the job publishes it.
  const { event: later } = await H.mkEvent({ organizer: org, approve: false, title: 'Scheduled Talk' });
  await H.api('POST', `/api/campus-events/organizer/events/${later.id}/submit`, org.token);
  const ap = await H.api('POST', `/api/admin/campus-events/events/${later.id}/approve`, adm.token, { publishAt: new Date(H.now() + 2 * H.HOUR).toISOString() });
  assert.equal(ap.body.event.status, 'APPROVED');
  assert.ok(!(await browse()).includes(later.id));
  H.advance(2 * H.HOUR + H.MIN);
  const j = await H.runJobs();
  assert.ok(j.published >= 1);
  assert.ok((await browse()).includes(later.id));
  // Other campus never sees it.
  const otherCampus = await H.mkCampus('Other University');
  const outsider = await H.mkStudent({ campusRow: otherCampus });
  assert.ok(!(await H.api('GET', '/api/campus-events', outsider.token)).body.events.some((e) => e.id === ok.id));
  assert.equal((await H.api('GET', `/api/campus-events/${ok.id}`, outsider.token)).status, 404);
});

test('#1 discover upcoming events (sections + upcoming order, ended events dropped)', async () => {
  await H.setFlag(true);
  const s = await H.mkStudent();
  const org = await H.mkOrganizer();
  const { event: soon } = await H.mkEvent({ organizer: org, startInH: 5, title: 'Soon Seminar', category: 'SEMINAR' });
  const { event: later } = await H.mkEvent({ organizer: org, startInH: 200, title: 'Later Football', category: 'SPORTS' });
  const r = await H.api('GET', '/api/campus-events?limit=50', s.token);
  assert.equal(r.status, 200);
  const ids = r.body.events.map((e) => e.id);
  assert.ok(ids.indexOf(soon.id) >= 0 && ids.indexOf(later.id) > ids.indexOf(soon.id), 'sorted by start');
  const card = r.body.events.find((e) => e.id === soon.id);
  for (const k of ['title', 'category', 'organizer', 'startAt', 'endAt', 'venue', 'price', 'regClosesAt', 'capacity', 'registrationState']) assert.ok(k in card, k);
  assert.equal(card.price.label, 'FREE');
  assert.equal(card.registrationState, 'OPEN');
  assert.equal(JSON.stringify(card).includes('phone'), false);
  const sec = await H.api('GET', '/api/campus-events/sections', s.token);
  assert.equal(sec.status, 200);
  assert.ok(sec.body.upcoming.some((e) => e.id === soon.id));
  assert.ok(sec.body.sections.find((x) => x.key === 'sports').events.some((e) => e.id === later.id));
  const d = await H.api('GET', `/api/campus-events/${soon.id}`, s.token);
  assert.equal(d.status, 200);
  assert.equal(d.body.event.cta.action, 'REGISTER_NOW');
  // Pagination cursor.
  const p1 = await H.api('GET', '/api/campus-events?limit=1', s.token);
  assert.equal(p1.body.events.length, 1);
  assert.ok(p1.body.nextCursor);
  const p2 = await H.api('GET', `/api/campus-events?limit=1&cursor=${p1.body.nextCursor}`, s.token);
  assert.notEqual(p2.body.events[0].id, p1.body.events[0].id);
  // After it ends it leaves the list.
  H.advance(9 * H.HOUR);
  assert.ok(!(await H.api('GET', '/api/campus-events?limit=50', s.token)).body.events.some((e) => e.id === soon.id));
});

test('#2 filter by date, category and price (+ format, search)', async () => {
  await H.setFlag(true);
  const s = await H.mkStudent();
  const org = await H.mkOrganizer();
  const { event: freeTalk } = await H.mkEvent({ organizer: org, startInH: 30, title: 'Filter Free Talk', category: 'TALK' });
  const { event: paidWs } = await H.mkEvent({ organizer: org, startInH: 100, title: 'Filter Paid Workshop', category: 'WORKSHOP', priceType: 'PAID', price: 99, paymentModes: ['VENUE'] });
  const { event: team } = await H.mkEvent({ organizer: org, startInH: 60, format: 'TEAM', maxTeams: 4, teamMin: 2, teamMax: 5, title: 'Filter Cup' });
  const ids = async (qs) => (await H.api('GET', `/api/campus-events?limit=50&${qs}`, s.token)).body.events.map((e) => e.id);
  let x = await ids('category=TALK');
  assert.ok(x.includes(freeTalk.id) && !x.includes(paidWs.id));
  x = await ids('price=paid');
  assert.ok(x.includes(paidWs.id) && !x.includes(freeTalk.id));
  x = await ids('price=free');
  assert.ok(x.includes(freeTalk.id) && !x.includes(paidWs.id));
  const from = new Date(H.now() + 50 * H.HOUR).toISOString();
  const to = new Date(H.now() + 70 * H.HOUR).toISOString();
  x = await ids(`from=${from}&to=${to}`);
  assert.ok(x.includes(team.id) && !x.includes(freeTalk.id) && !x.includes(paidWs.id));
  x = await ids('format=TEAM');
  assert.deepEqual(x.filter((id) => [freeTalk.id, paidWs.id, team.id].includes(id)), [team.id]);
  x = await ids('q=Paid%20Work');
  assert.ok(x.includes(paidWs.id) && !x.includes(freeTalk.id));
  const card = (await H.api('GET', '/api/campus-events?limit=50&price=paid', s.token)).body.events.find((e) => e.id === paidWs.id);
  assert.equal(card.price.total, 99);
  assert.equal((await H.api('GET', '/api/campus-events?price=cheap', s.token)).status, 400);
  assert.equal((await H.api('GET', '/api/campus-events?category=NOPE', s.token)).status, 400);
});
