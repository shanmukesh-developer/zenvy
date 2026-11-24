// Rider-to-restaurant radius for order pushes (owner, 24 Nov 2026; utils/riderDispatch RIDER_PUSH_RADIUS_KM, 5 km by
// default): a rider whose live GPS fix is farther than the radius from the store is not rung; a rider with no recent
// fix is still rung (cannot be measured); the last escalation round (ignoreRadius) rings everyone.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

let dispatch; let sent;
test.before(async () => {
  await H.setup();
  // Capture pushes instead of calling Firebase: riderDispatch reads sendPushToTokens when it loads.
  const push = H.r('utils/push');
  push.sendPushToTokens = async (tokens) => { sent.push(...tokens); return { successCount: tokens.length }; };
  const p = require.resolve(`${H.B}/utils/riderDispatch`);
  delete require.cache[p];
  dispatch = require(p);
});
test.after(async () => { await H.teardown(); });

const at = async (rider, lat, lng, token) => {
  await rider.update({ liveLocation: lat == null ? null : { lat, lng, ts: new Date().toISOString() }, fcmTokens: [token] });
};

test('only riders within the radius (plus riders with no recent fix) hear about the order', async () => {
  assert.equal(dispatch.RIDER_PUSH_RADIUS_KM, 5, 'default radius is 5 km');
  const { store } = await H.mkStore(); // 16.4632, 80.5064
  await at(await H.mkRider(), 16.4722, 80.5064, 'tok-near-1km');
  await at(await H.mkRider(), 16.5532, 80.5064, 'tok-far-10km');
  await at(await H.mkRider(), null, null, 'tok-no-fix');

  sent = [];
  await dispatch.pushNearestRiders({ restaurant: store, orderId: null, title: 't', body: 'b', limit: 20 });
  assert.ok(sent.includes('tok-near-1km'), 'near rider rung');
  assert.ok(sent.includes('tok-no-fix'), 'rider with no fix still rung');
  assert.ok(!sent.includes('tok-far-10km'), `far rider not rung: ${sent.join(', ')}`);

  sent = [];
  await dispatch.pushNearestRiders({ restaurant: store, orderId: null, title: 't', body: 'b', limit: 20, ignoreRadius: true });
  assert.ok(sent.includes('tok-far-10km'), 'last round reaches riders outside the radius');
});

test('withinRadius: 0 switches the limit off', () => {
  assert.equal(dispatch.withinRadius(4.9), true);
  assert.equal(dispatch.withinRadius(5.1), false);
  assert.equal(dispatch.withinRadius(500, 0), true);
});
