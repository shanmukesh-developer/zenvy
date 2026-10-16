// Kill switch, role isolation (customer <-> driver <-> admin), session revocation, privacy of phones /
// PINs / registration numbers / documents, rate limits and account lockout.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

const { api } = H;
let flag;

before(async () => {
  await H.setup({ label: 'ar-security' });
  flag = H.r('modules/autoRide/services/flag');
});
after(H.teardown);

test('kill switch: missing GlobalConfig row = OFF, lifecycle job idle and cheap', async () => {
  flag.clearCache();
  assert.equal(await H.ctx.M('GlobalConfig').count({ where: { key: 'AUTO_RIDE_ENABLED' } }), 0);
  assert.equal(await flag.readFlag({ fresh: true }), false);
  const out = await H.r('modules/autoRide/jobs').runAutoRideJobs(new Date(H.now()));
  assert.deepEqual(out, { idle: true });
  const u = await H.mkUser();
  const s = await api('GET', '/api/auto-ride/status', u.token);
  assert.equal(s.status, 200);
  assert.equal(s.body.enabled, false);
  for (const [m, url] of [['GET', '/api/auto-ride/trips'], ['GET', '/api/auto-ride/routes'], ['GET', '/api/auto-ride/pickup-points']]) {
    const r = await api(m, url, u.token);
    assert.equal(r.status, 403, url);
    assert.equal(r.body.code, 'FEATURE_OFF');
  }
});

test('AUTO_RIDE_DEV_ENABLE=1 turns it on outside production only; a row always wins', async () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, AUTO_RIDE_DEV_ENABLE: process.env.AUTO_RIDE_DEV_ENABLE, RENDER: process.env.RENDER };
  try {
    process.env.AUTO_RIDE_DEV_ENABLE = '1';
    process.env.NODE_ENV = 'production';
    flag.clearCache();
    assert.equal(await flag.readFlag({ fresh: true }), false, 'never in production');
    process.env.NODE_ENV = 'development';
    process.env.RENDER = 'true';
    assert.equal(await flag.readFlag({ fresh: true }), false, 'never on Render');
    delete process.env.RENDER;
    assert.equal(await flag.readFlag({ fresh: true }), true, 'dev override');
    await flag.writeFlag(false);
    assert.equal(await flag.readFlag({ fresh: true }), false, 'an explicit row wins');
    await H.ctx.M('GlobalConfig').destroy({ where: { key: 'AUTO_RIDE_ENABLED' } });
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    flag.clearCache();
  }
});

test('kill switch OFF: booking + publish refused; own bookings, driver onboarding and admin keep working', async () => {
  await H.setFlag(true);
  const t = await H.mkTrip({ capacity: 6, seatFare: 30, fullAutoFare: 300, privateBookingEnabled: true });
  const mine = await H.book(t.trip.id, { seatCount: 1 });
  const held = await api('POST', `/api/auto-ride/trips/${t.trip.id}/holds`, (await H.mkUser()).token, { seatCount: 1 });
  const { route, pickup } = await H.mkRoute();
  const d2 = await H.mkDriver({ capacity: 3 });
  const draft = await api('POST', '/api/auto-ride/driver/trips', d2.token, { vehicleId: d2.vehicle.id, routeId: route.id, pickupPointId: pickup.id, departureAt: new Date(H.now() + 90 * H.MIN).toISOString(), seatFare: 30 });
  const pr = await api('POST', `/api/auto-ride/trips/${(await H.mkTrip({ capacity: 3, seatFare: 30, fullAutoFare: 200, privateBookingEnabled: true })).trip.id}/private-requests`, (await H.mkUser()).token, { passengers: 1 });
  assert.equal(pr.status, 201);
  const admin = await H.mkAdmin();
  const off = await api('PUT', '/api/admin/auto-ride/settings', admin.token, { enabled: false });
  assert.equal(off.status, 200);
  assert.equal(off.body.enabled, false);
  const u = await H.mkUser();
  assert.equal((await api('POST', `/api/auto-ride/trips/${t.trip.id}/holds`, u.token, { seatCount: 1 })).body.code, 'FEATURE_OFF');
  assert.equal((await api('POST', `/api/auto-ride/trips/${t.trip.id}/private-requests`, u.token, { passengers: 1 })).body.code, 'FEATURE_OFF');
  assert.equal((await api('POST', `/api/auto-ride/bookings/${held.body.booking.id}/confirm`, held.body && u.token, {})).status, 403);
  assert.equal((await api('POST', `/api/auto-ride/driver/trips/${draft.body.trip.id}/publish`, d2.token)).body.code, 'FEATURE_OFF');
  assert.equal((await api('POST', `/api/auto-ride/driver/private-requests/${pr.body.request.id}/accept`, (await H.ctx.M('AutoDriver').findByPk(pr.body.request && (await H.ctx.M('AutoPrivateRequest').findByPk(pr.body.request.id)).driverId)) && H.driverToken(await H.ctx.M('AutoDriver').findByPk((await H.ctx.M('AutoPrivateRequest').findByPk(pr.body.request.id)).driverId)))).body.code, 'FEATURE_OFF');
  // Still working while OFF:
  const list = await api('GET', '/api/auto-ride/bookings', mine.user.token);
  assert.equal(list.status, 200);
  assert.equal(list.body.bookings.length, 1);
  assert.equal((await api('GET', `/api/auto-ride/bookings/${mine.booking.id}`, mine.user.token)).status, 200);
  const c = await api('POST', `/api/auto-ride/bookings/${mine.booking.id}/cancel`, mine.user.token, {});
  assert.equal(c.status, 200);
  assert.equal(c.body.booking.status, 'CANCELLED');
  for (const [m, url, body] of [['GET', '/api/auto-ride/driver/me'], ['GET', '/api/auto-ride/driver/vehicles'], ['GET', '/api/auto-ride/driver/routes'], ['PATCH', '/api/auto-ride/driver/me/profile', { badgeNumber: 'B-1' }], ['POST', '/api/auto-ride/driver/trips', { vehicleId: d2.vehicle.id, routeId: route.id, pickupPointId: pickup.id, departureAt: new Date(H.now() + 120 * H.MIN).toISOString(), seatFare: 31 }]]) {
    const r = await api(m, url, d2.token, body);
    assert.ok(r.status === 200 || r.status === 201, `${m} ${url} -> ${r.status} ${JSON.stringify(r.body)}`);
  }
  // Running trips can still be finished while OFF (driver actions other than publish).
  assert.equal((await api('POST', `/api/auto-ride/driver/trips/${t.trip.id}/actions/delay`, t.token, { minutes: 5 })).status, 200);
  for (const url of ['/api/admin/auto-ride/summary', '/api/admin/auto-ride/drivers?status=ALL', '/api/admin/auto-ride/trips', '/api/admin/auto-ride/settings']) {
    assert.equal((await api('GET', url, admin.token)).status, 200, url);
  }
  await H.setFlag(true);
});

test('role isolation: customer, driver, admin and other tokens never cross', async () => {
  await H.setFlag(true);
  const u = await H.mkUser();
  const admin = await H.mkAdmin();
  const d = await H.mkDriver({ capacity: 3 });
  const jwt = require(require('path').join(__dirname, '..', '..', '..', 'node_modules/jsonwebtoken'));
  const rider = jwt.sign({ id: u.id, role: 'rider', tv: 0 }, process.env.JWT_SECRET);
  const forgedDriver = jwt.sign({ id: u.id, role: 'auto_driver', tv: 0 }, process.env.JWT_SECRET);
  const forgedAdmin = jwt.sign({ id: d.driver.id, role: 'admin', tv: 0 }, process.env.JWT_SECRET);
  const wrongSecret = jwt.sign({ id: d.driver.id, role: 'auto_driver', tv: 0 }, 'not-the-secret');
  const cases = [
    ['driver token -> customer API', 'GET', '/api/auto-ride/bookings', d.token, 401],
    ['driver token -> admin API', 'GET', '/api/admin/auto-ride/summary', d.token, 401],
    ['customer token -> driver API', 'GET', '/api/auto-ride/driver/me', u.token, 401],
    ['customer token -> admin API', 'GET', '/api/admin/auto-ride/summary', u.token, 403],
    ['admin token -> driver API', 'GET', '/api/auto-ride/driver/me', admin.token, 401],
    ['rider-role token -> driver API', 'GET', '/api/auto-ride/driver/me', rider, 401],
    ['forged auto_driver role on a user id', 'GET', '/api/auto-ride/driver/me', forgedDriver, 401],
    ['forged admin role on a driver id', 'GET', '/api/admin/auto-ride/summary', forgedAdmin, 401],
    ['wrong signature', 'GET', '/api/auto-ride/driver/me', wrongSecret, 401],
    ['no token (customer)', 'GET', '/api/auto-ride/status', null, 401],
    ['no token (driver)', 'GET', '/api/auto-ride/driver/home', null, 401],
    ['no token (admin)', 'GET', '/api/admin/auto-ride/settings', null, 401],
    ['customer -> admin write', 'PUT', '/api/admin/auto-ride/settings', u.token, 403],
  ];
  for (const [label, m, url, tok, want] of cases) {
    const r = await api(m, url, tok, m === 'GET' ? undefined : { enabled: true });
    assert.equal(r.status, want, `${label}: ${r.status}`);
  }
  assert.equal((await api('GET', '/api/auto-ride/driver/me', d.token)).status, 200);
  assert.equal((await api('GET', '/api/admin/auto-ride/summary', admin.token)).status, 200);
});

test('driver sessions: password change revokes old tokens; suspended drivers refused (API + socket auth)', async () => {
  const bcrypt = require(require('path').join(__dirname, '..', '..', '..', 'node_modules/bcryptjs'));
  const d = await H.mkDriver({ capacity: 3 });
  await d.driver.update({ password: await bcrypt.hash('OldPassw0rd', 4) });
  const ch = await api('POST', '/api/auto-ride/driver/auth/password', d.token, { currentPassword: 'OldPassw0rd', newPassword: 'NewPassw0rd' });
  assert.equal(ch.status, 200);
  const old = await api('GET', '/api/auto-ride/driver/me', d.token);
  assert.equal(old.status, 401);
  assert.equal(old.body.code, 'SESSION_REVOKED');
  assert.equal((await api('GET', '/api/auto-ride/driver/me', ch.body.token)).status, 200);
  const ref = await api('POST', '/api/auto-ride/driver/auth/refresh', ch.body.token);
  assert.equal(ref.status, 200);
  // Socket auth: the real loadSocketAccount from server.js, run against this database.
  const fs = require('fs');
  const path = require('path');
  const B = path.join(__dirname, '..', '..', '..');
  const src = fs.readFileSync(path.join(B, 'server.js'), 'utf8');
  const start = src.indexOf('async function loadSocketAccount(decoded) {');
  const m = /\r?\n\}\r?\n/.exec(src.slice(start));
  const fnSrc = src.slice(start, start + m.index + m[0].length).trim();
  const req = (p) => require(p.startsWith('./') ? path.join(B, p) : p);
  const loadSocketAccount = new Function('require', `return (${fnSrc});`)(req);
  const fresh = await H.ctx.M('AutoDriver').findByPk(d.driver.id);
  assert.deepEqual(await loadSocketAccount({ id: fresh.id, role: 'auto_driver', tv: fresh.tokenVersion }), { id: fresh.id, role: 'auto_driver', suspended: false });
  assert.equal(await loadSocketAccount({ id: fresh.id, role: 'auto_driver', tv: 0 }), null, 'old token version refused on sockets');
  const admin = await H.mkAdmin();
  const s = await api('POST', `/api/admin/auto-ride/drivers/${d.driver.id}/suspend`, admin.token, { reason: 'Safety complaint under review' });
  assert.equal(s.status, 200);
  const after2 = await H.ctx.M('AutoDriver').findByPk(d.driver.id);
  assert.equal((await loadSocketAccount({ id: after2.id, role: 'auto_driver', tv: after2.tokenVersion })).suspended, true, 'suspended socket refused');
  const me = await api('GET', '/api/auto-ride/driver/me', H.driverToken(after2));
  assert.equal(me.status, 403);
  assert.equal(me.body.code, 'DRIVER_SUSPENDED');
  const login = await api('POST', '/api/auto-ride/driver/auth/login', null, { phone: after2.phone, password: 'NewPassw0rd' });
  assert.equal(login.status, 403);
  assert.equal(login.body.code, 'DRIVER_SUSPENDED');
  const audit = await H.ctx.M('VerificationLog').findAll({ where: { targetId: d.driver.id } });
  assert.ok(audit.some((a) => a.action === 'AUTO_DRIVER_SUSPENDED'));
  const un = await api('POST', `/api/admin/auto-ride/drivers/${d.driver.id}/unsuspend`, admin.token, {});
  assert.equal(un.body.driver.status, 'VERIFIED');
});

test('privacy: driver never sees passenger phone / id / PIN; customer sees driver phone only when confirmed; plate masked', async () => {
  await H.setFlag(true);
  const t = await H.mkTrip({ capacity: 6, seatFare: 30 });
  const fullUser = await H.mkUser({ name: 'Priya Lakshmi Reddy' });
  const b = await H.book(t.trip.id, { seatCount: 2, user: fullUser });
  const holder = await H.mkUser({ name: 'Arjun Varma' });
  const h = await api('POST', `/api/auto-ride/trips/${t.trip.id}/holds`, holder.token, { seatCount: 1 });
  const list = await api('GET', `/api/auto-ride/driver/trips/${t.trip.id}/bookings`, t.token);
  const raw = JSON.stringify(list.body);
  assert.ok(!raw.includes(fullUser.phone) && !raw.includes(holder.phone), 'no customer phone');
  assert.ok(!raw.includes(fullUser.id) && !raw.includes(holder.id), 'no customer id');
  assert.ok(!raw.includes('Lakshmi') && !raw.includes('Reddy'), 'first name only');
  assert.ok(!raw.includes(b.booking.boardingPin) || !/"boardingPin"/.test(raw), 'no PIN');
  assert.ok(!/boardingPin/.test(raw));
  const pb = list.body.bookings.find((x) => x.id === b.booking.id);
  assert.equal(pb.passengerName, 'Priya');
  assert.equal(pb.bookingCode, b.booking.bookingCode);
  assert.equal(pb.seatCount, 2);
  assert.equal(pb.cashToCollect, 60);
  const drv = await H.ctx.M('AutoDriver').findByPk(t.driver.id);
  const veh = await H.ctx.M('AutoVehicle').findByPk(t.vehicle.id);
  const card = await api('GET', `/api/auto-ride/trips/${t.trip.id}`, holder.token);
  const rawCard = JSON.stringify(card.body);
  assert.ok(!rawCard.includes(drv.phone), 'no driver phone on the card');
  assert.ok(!rawCard.includes(veh.registrationNumber), 'no full plate on the card');
  const held = await api('GET', `/api/auto-ride/bookings/${h.body.booking.id}`, holder.token);
  assert.equal(held.body.booking.driverPhone, null, 'a hold does not reveal the driver phone');
  assert.equal(held.body.booking.boardingPin, null, 'no PIN before confirmation');
  assert.equal(held.body.booking.trip.vehicle.registrationMasked, true);
  const conf = await api('GET', `/api/auto-ride/bookings/${b.booking.id}`, fullUser.token);
  assert.equal(conf.body.booking.driverPhone, drv.phone);
  assert.equal(conf.body.booking.trip.vehicle.registrationMasked, false);
  assert.ok(!JSON.stringify(conf.body).includes('documents'), 'no driver documents for customers');
  await api('POST', `/api/auto-ride/driver/trips/${t.trip.id}/actions/cancel`, t.token, { reason: 'Puncture' });
  const after = await api('GET', `/api/auto-ride/bookings/${b.booking.id}`, fullUser.token);
  assert.equal(after.body.booking.driverPhone, null, 'phone hidden once the trip ended');
  assert.equal(after.body.booking.status, 'CANCELLED');
  const notes = await H.notificationsFor(fullUser.id);
  assert.ok(notes.some((n) => n.type === 'AUTO_TRIP_CANCELLED'), 'passenger told the driver cancelled');
  assert.ok(H.emitted.filter((e) => e.ev === 'autoride:changed').every((e) => !JSON.stringify(e.p).match(/phone|name|pin/i)), 'socket payloads ids only');
});

test('rate limits: hold flood -> 429; driver login lockout after 5 wrong passwords; auth limiter', async () => {
  await H.setFlag(true);
  H.r('modules/autoRide/services/util').resetLimits();
  const u = await H.mkUser();
  const trips = [];
  for (let i = 0; i < 3; i++) trips.push((await H.mkTrip({ capacity: 3, seatFare: 30 })).trip.id);
  let last;
  for (let i = 0; i < 21; i++) {
    last = await api('POST', `/api/auto-ride/trips/${trips[i % 3]}/holds`, u.token, { seatCount: 1 });
    if (last.status === 429 && last.body.code === 'RATE_LIMITED') break;
  }
  assert.equal(last.status, 429);
  assert.equal(last.body.code, 'RATE_LIMITED');
  const d = await H.mkDriver({ capacity: 3 });
  for (let i = 0; i < 5; i++) {
    const r = await api('POST', '/api/auto-ride/driver/auth/login', null, { phone: d.driver.phone, password: `wrong-${i}` });
    assert.equal(r.status, 401);
  }
  const locked = await api('POST', '/api/auto-ride/driver/auth/login', null, { phone: d.driver.phone, password: 'Passw0rd!' });
  assert.equal(locked.status, 429, 'locked out even with the right password');
  process.env.RATE_LIMIT_ENFORCE = '1';
  try {
    let hit = null;
    for (let i = 0; i < 40 && !hit; i++) {
      const r = await api('POST', '/api/auto-ride/driver/auth/login', null, { phone: `98${String(10000000 + i)}`, password: 'x' });
      if (r.status === 429 && r.body.code === 'RATE_LIMITED') hit = i;
    }
    assert.ok(hit !== null && hit <= 31, `auth limiter kicked in (${hit})`);
  } finally {
    delete process.env.RATE_LIMIT_ENFORCE;
  }
});
