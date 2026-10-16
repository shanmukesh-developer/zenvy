// Table-driven state machine tests: every (status x driver action) pair through the real API, plus the
// unit table itself (terminal states have no exits, actors are enforced, DELAYED resumes correctly).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

const { api } = H;
let E;
let SM;

before(async () => {
  await H.setup({ label: 'ar-sm' });
  await H.setFlag(true);
  E = H.r('modules/autoRide/enums');
  SM = H.r('modules/autoRide/services/stateMachine');
});
after(H.teardown);

test('transition table: terminal states are dead ends, every target is a known status, actors enforced', () => {
  const all = Object.values(E.TRIP_STATUS);
  for (const [from, row] of Object.entries(E.TRANSITIONS)) {
    assert.ok(all.includes(from));
    for (const [to, actors] of Object.entries(row)) {
      assert.ok(all.includes(to), `${from}->${to}`);
      assert.ok(actors.length && actors.every((a) => ['driver', 'system', 'admin'].includes(a)));
    }
  }
  for (const s of E.TERMINAL_TRIP_STATUSES) assert.deepEqual(Object.keys(E.TRANSITIONS[s]), [], `${s} is terminal`);
  assert.equal(E.canTransition('COMPLETED', 'IN_PROGRESS', 'driver'), false);
  assert.equal(E.canTransition('OPEN_FOR_BOOKING', 'FULL', 'driver'), false, 'only the system marks FULL');
  assert.equal(E.canTransition('OPEN_FOR_BOOKING', 'FULL', 'system'), true);
  assert.equal(E.canTransition('OPEN_FOR_BOOKING', 'DRIVER_CONFIRMED', 'driver'), false, 'cannot depart below the minimum');
  assert.equal(E.canTransition('IN_PROGRESS', 'CANCELLED', 'driver'), false);
  assert.equal(E.canTransition('DRAFT', 'IN_PROGRESS', 'driver'), false);
});

const ACTION_TARGET = {
  'confirm-departure': ['DRIVER_CONFIRMED', { ready: true }],
  'start-boarding': ['BOARDING', {}],
  start: ['IN_PROGRESS', { safetyConfirmed: true }],
  complete: ['COMPLETED', {}],
  delay: ['DELAYED', { minutes: 10, reason: 'Traffic' }],
  cancel: ['CANCELLED', { reason: 'Engine trouble' }],
  unavailable: ['DRIVER_UNAVAILABLE', { kind: 'DRIVER', reason: 'Feeling unwell' }],
};

test('every status x every driver action: impossible ones are 409 INVALID_TRANSITION, allowed ones pass the table', async () => {
  const t = await H.mkTrip({ capacity: 3, seatFare: 30 });
  const Trip = H.ctx.M('AutoTrip');
  const results = [];
  for (const status of Object.values(E.TRIP_STATUS)) {
    for (const [action, [target, body]] of Object.entries(ACTION_TARGET)) {
      await Trip.update({ status, statusBeforeDelay: status === 'DELAYED' ? 'OPEN_FOR_BOOKING' : null, seatsBoarded: 1, departureAt: new Date(H.now() + 30 * H.MIN) }, { where: { id: t.trip.id } });
      const r = await api('POST', `/api/auto-ride/driver/trips/${t.trip.id}/actions/${action}`, t.token, body);
      const allowed = E.canTransition(status, target, 'driver');
      results.push({ status, action, code: r.status, err: r.body && r.body.code });
      if (!allowed) {
        assert.equal(r.status, 409, `${status} --${action}--> must be refused (got ${r.status} ${JSON.stringify(r.body)})`);
        assert.ok(['INVALID_TRANSITION', 'TRIP_CHANGED'].includes(r.body.code), `${status} ${action}: ${r.body.code}`);
        const after = await Trip.findByPk(t.trip.id);
        assert.equal(after.status, status, 'status unchanged after a refused transition');
      } else {
        assert.notEqual(r.body && r.body.code, 'INVALID_TRANSITION', `${status} --${action}--> should be allowed: ${JSON.stringify(r.body)}`);
        assert.equal(r.status, 200, `${status} ${action}: ${JSON.stringify(r.body)}`);
        assert.equal(r.body.trip.status, target);
      }
    }
  }
  assert.equal(results.length, Object.values(E.TRIP_STATUS).length * Object.keys(ACTION_TARGET).length);
});

test('transitionTrip refuses unauthorised actors and records history in the same transaction', async () => {
  const t = await H.mkTrip({ capacity: 3, seatFare: 30 });
  const Trip = H.ctx.M('AutoTrip');
  const locks = H.r('modules/autoRide/services/locks');
  await assert.rejects(locks.withTripLock(t.trip.id, (tx, trip) => SM.transitionTrip(trip, 'FULL', { actor: 'driver', t: tx })), (e) => e.code === 'INVALID_TRANSITION');
  await assert.rejects(locks.withTripLock(t.trip.id, (tx, trip) => SM.transitionTrip(trip, 'COMPLETED', { actor: 'admin', t: tx })), (e) => e.code === 'INVALID_TRANSITION');
  const before = await H.ctx.M('AutoTripEvent').count({ where: { tripId: t.trip.id } });
  // A failing step after the transition rolls the status AND the event back together.
  await assert.rejects(locks.withTripLock(t.trip.id, async (tx, trip) => {
    await SM.transitionTrip(trip, 'DELAYED', { actor: 'driver', t: tx });
    throw new Error('boom');
  }), /boom/);
  assert.equal((await Trip.findByPk(t.trip.id)).status, 'OPEN_FOR_BOOKING');
  assert.equal(await H.ctx.M('AutoTripEvent').count({ where: { tripId: t.trip.id } }), before);
});

test('DELAYED resumes to the status it came from (FULL stays FULL, departure time moved)', async () => {
  const t = await H.mkTrip({ capacity: 3, seatFare: 30 });
  await H.book(t.trip.id, { seatCount: 3 });
  const before = await api('GET', `/api/auto-ride/driver/trips/${t.trip.id}`, t.token);
  assert.equal(before.body.trip.status, 'FULL');
  const d = await api('POST', `/api/auto-ride/driver/trips/${t.trip.id}/actions/delay`, t.token, { minutes: 20 });
  assert.equal(d.body.trip.status, 'DELAYED');
  assert.equal(new Date(d.body.trip.departureAt).getTime() - new Date(before.body.trip.departureAt).getTime(), 20 * H.MIN);
  const bad = await api('POST', `/api/auto-ride/driver/trips/${t.trip.id}/actions/delay`, t.token, { minutes: 500 });
  assert.equal(bad.status, 400);
  const r = await api('POST', `/api/auto-ride/driver/trips/${t.trip.id}/actions/resume`, t.token, {});
  assert.equal(r.body.trip.status, 'FULL');
  assert.equal(r.body.trip.originalDepartureAt, before.body.trip.departureAt);
});

test('published trips are locked: fare / capacity cannot be edited after publish', async () => {
  const t = await H.mkTrip({ capacity: 6, seatFare: 30 });
  const r = await api('PATCH', `/api/auto-ride/driver/trips/${t.trip.id}`, t.token, { seatFare: 99, capacity: 3 });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'TRIP_LOCKED');
  const trip = await H.ctx.M('AutoTrip').findByPk(t.trip.id);
  assert.equal(trip.seatFare, 30);
  assert.equal(trip.capacity, 6);
});
