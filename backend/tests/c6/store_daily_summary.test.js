// Partner apps' "Last 7 days" (GET /api/restaurants/:id/daily-summary): counted on the server, so a busy
// store is not cut short by the 200-row orders list. Same rules as the apps' local math: orders placed that
// IST day (not Cancelled), delivered food value by the day placed, cash collected by the day delivered.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

const { api } = H;
before(async () => { await H.setup(); });
after(H.teardown);

const DAY = 24 * 60 * 60 * 1000;
const IST = 5.5 * 60 * 60 * 1000;
const istKey = (ms) => new Date(ms + IST).toISOString().slice(0, 10);
// Noon IST of the day `back` days ago: never near a day edge whatever time the test runs.
const noonIst = (back) => {
  const k = istKey(Date.now() - back * DAY);
  return new Date(`${k}T12:00:00+05:30`).getTime();
};

const mkOrder = async (store, user, { placedAt, status = 'Delivered', method = 'Wallet', price = 100, fee = 20, deliveredAt = null }) => {
  const o = await H.ctx.M('Order').create({
    userId: user.id, restaurantId: store.id, items: [], totalPrice: price, deliveryFee: fee, finalPrice: price + fee,
    paymentMethod: method, paymentStatus: status === 'Delivered' ? 'Completed' : 'Pending', status, fulfilment: 'ZENVY',
    deliveredAt: status === 'Delivered' ? new Date(deliveredAt ?? placedAt) : null,
  });
  await H.ctx.M('Order').update({ createdAt: new Date(placedAt) }, { where: { id: o.id }, silent: true });
  return o;
};

test('daily-summary: counts every order in 7 IST days, past the 200-row orders list', async () => {
  const { store } = await H.mkStore();
  const { store: other } = await H.mkStore();
  const u = await H.mkUser();

  // 250 delivered wallet orders 5 days ago: more than the orders list returns.
  const rows = [];
  for (let i = 0; i < 250; i++) rows.push({
    userId: u.id, restaurantId: store.id, items: [], totalPrice: 100, deliveryFee: 20, finalPrice: 120, paymentMethod: 'Wallet',
    paymentStatus: 'Completed', status: 'Delivered', fulfilment: 'ZENVY', deliveredAt: new Date(noonIst(5)),
  });
  const made = await H.ctx.M('Order').bulkCreate(rows);
  await H.ctx.M('Order').update({ createdAt: new Date(noonIst(5)) }, { where: { id: made.map((m) => m.id) }, silent: true });

  // Two days ago: a delivered COD order, a still-open order (counted, no money), a cancelled one (ignored).
  await mkOrder(store, u, { placedAt: noonIst(2), method: 'COD', price: 200, fee: 30 });
  await mkOrder(store, u, { placedAt: noonIst(2), status: 'Accepted' });
  await mkOrder(store, u, { placedAt: noonIst(2), status: 'Cancelled' });
  // Placed yesterday, cash collected today: an order of yesterday, cash of today.
  await mkOrder(store, u, { placedAt: noonIst(1), method: 'COD', price: 50, fee: 10, deliveredAt: Date.now() - 60 * 1000 });
  // Outside the window and another store's order: neither counts.
  await mkOrder(store, u, { placedAt: noonIst(10) });
  await mkOrder(other, u, { placedAt: noonIst(2), method: 'COD' });

  const list = await api('GET', `/api/restaurants/${store.id}/orders`, store.token);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 200, 'the orders list stops at 200 rows (why the summary exists)');

  const res = await api('GET', `/api/restaurants/${store.id}/daily-summary`, store.token);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const days = res.body.days;
  assert.equal(days.length, 7);
  assert.deepEqual(days.map((d) => d.day), [6, 5, 4, 3, 2, 1, 0].map((b) => istKey(Date.now() - b * DAY)));
  const by = Object.fromEntries(days.map((d) => [d.day, d]));
  const k = (b) => istKey(Date.now() - b * DAY);

  assert.deepEqual(by[k(5)], { day: k(5), orders: 250, deliveredSales: 25000, cashCollected: 0 });
  assert.deepEqual(by[k(2)], { day: k(2), orders: 2, deliveredSales: 200, cashCollected: 230 });
  assert.deepEqual(by[k(1)], { day: k(1), orders: 1, deliveredSales: 50, cashCollected: 0 });
  assert.deepEqual(by[k(0)], { day: k(0), orders: 0, deliveredSales: 0, cashCollected: 60 });
  for (const b of [6, 4, 3]) assert.deepEqual(by[k(b)], { day: k(b), orders: 0, deliveredSales: 0, cashCollected: 0 });
});

test('daily-summary: only the store itself or an admin', async () => {
  const { store } = await H.mkStore();
  const { store: other } = await H.mkStore();
  const student = await H.mkUser();
  const admin = await H.mkUser({ role: 'admin' });

  assert.equal((await api('GET', `/api/restaurants/${store.id}/daily-summary`)).status, 401);
  assert.equal((await api('GET', `/api/restaurants/${store.id}/daily-summary`, other.token)).status, 403);
  assert.equal((await api('GET', `/api/restaurants/${store.id}/daily-summary`, student.token)).status, 403);
  const own = await api('GET', `/api/restaurants/${store.id}/daily-summary`, store.token);
  assert.equal(own.status, 200);
  assert.ok(own.body.days.every((d) => d.orders === 0 && d.deliveredSales === 0 && d.cashCollected === 0));
  assert.equal((await api('GET', `/api/restaurants/${store.id}/daily-summary`, admin.token)).status, 200);
});
