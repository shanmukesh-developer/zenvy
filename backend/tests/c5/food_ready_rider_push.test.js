// Kitchen "Ready" reaches riders (owner, 24 Nov 2026: "rider was not getting notification to collect an order from
// restaurant"; controllers/orderController notifyRidersFoodReady): the assigned rider gets an ORDER_READY push, and an
// order no rider has taken yet is pushed again to the riders (NEW_ORDER).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const H = require('./helpers');

let sent = []; // { tokens, data }
test.before(async () => {
  // Capture pushes before anything loads utils/push (riderDispatch reads sendPushToTokens when it loads).
  const push = require(path.join(H.B, 'utils/push'));
  push.sendPushToTokens = async (tokens, title, body, data) => { sent.push({ tokens: [...(tokens || [])], title, data: data || {} }); return { successCount: (tokens || []).length }; };
  await H.setup();
});
test.after(async () => { await H.teardown(); });

const jwt = () => require(path.join(H.B, 'node_modules/jsonwebtoken'));
const storeToken = (store) => jwt().sign({ id: store.id, role: 'restaurant', tv: 0 }, process.env.JWT_SECRET);
const acceptedOrder = async (store, item, riderId = null) => {
  const u = await H.mkUser({ wallet: 500 });
  const r = await H.api('POST', '/api/orders', u.token, H.orderBody(item.id, 'COD'));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.id || r.body._id || (r.body.order && (r.body.order.id || r.body.order._id));
  await H.ctx.M('Order').update({ status: 'Accepted', acceptedAt: new Date(), deliveryPartnerId: riderId }, { where: { id } });
  return id;
};
const settle = () => new Promise((res) => setTimeout(res, 300));

test('assigned rider gets a "food is ready" push when the kitchen marks it ready', async () => {
  const { store, item } = await H.mkStore();
  const rider = await H.mkRider();
  await rider.update({ fcmTokens: ['tok-assigned'] });
  const id = await acceptedOrder(store, item, rider.id);
  sent = [];
  const r = await H.api('PUT', `/api/orders/${id}/restaurant-ready`, storeToken(store));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await settle();
  const ready = sent.find((p) => p.tokens.includes('tok-assigned') && p.data.type === 'ORDER_READY');
  assert.ok(ready, `assigned rider pushed: ${JSON.stringify(sent.map((p) => [p.tokens, p.data.type]))}`);
  assert.equal(String(ready.data.orderId), String(id));
});

test('an order with no rider yet is pushed to riders again when it is ready', async () => {
  const { store, item } = await H.mkStore();
  const rider = await H.mkRider();
  await rider.update({ fcmTokens: ['tok-pool'], liveLocation: null });
  const id = await acceptedOrder(store, item, null);
  sent = [];
  const r = await H.api('PUT', `/api/orders/${id}/restaurant-ready`, storeToken(store));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await settle();
  const pool = sent.find((p) => p.tokens.includes('tok-pool') && p.data.type === 'NEW_ORDER');
  assert.ok(pool, `pool riders pushed: ${JSON.stringify(sent.map((p) => [p.tokens, p.data.type]))}`);
  assert.equal(String(pool.data.orderId), String(id));
});
