// Paid amount at pay-before-pickup restaurants (owner, 24 Nov 2026): the rider records what they paid the restaurant
// out of ZenWe's hand cash (amount + bill photo). Shown to the rider and the admin; it never changes the rider's COD
// cash, earnings or the customer's bill.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

const { api } = H;
before(async () => {
  const ctx = await H.setup();
  // Bill photos are stored in the media table (utils/imageStore); the shared c6 harness does not load it.
  if (!ctx.sequelize.models.CampusMedia) {
    H.r('modules/campus/models/CampusMedia').initCampusMediaModel(ctx.sequelize);
    await ctx.sequelize.sync();
  }
});
after(H.teardown);

// 1x1 PNG.
const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

test('rider records the counter payment for a pay-before-pickup order; cash and earnings do not change', async () => {
  const { item } = await H.mkStore({ price: 200, riderBuys: true });
  const u = await H.mkUser();
  const d = await H.mkRider();
  const other = await H.mkRider();
  const order = await H.placeOrder({ item, user: u });
  assert.equal((await H.readyAndClaim(order.id, d)).status, 200);
  const url = `/api/delivery/orders/${order.id}/store-payment`;

  // Shows up as "to record" before anything is saved.
  let mine = await api('GET', '/api/delivery/store-payments', d.token);
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.body.toRecord.map((p) => p.orderId), [order.id]);
  assert.equal(mine.body.total, 0);

  // Validation and ownership.
  assert.equal((await api('PUT', url, d.token, { amount: 0, billPhoto: PHOTO })).body.code, 'BAD_AMOUNT');
  assert.equal((await api('PUT', url, d.token, { amount: 200 })).body.code, 'BILL_REQUIRED');
  assert.equal((await api('PUT', url, other.token, { amount: 200, billPhoto: PHOTO })).status, 404);
  assert.equal((await api('PUT', url, u.token, { amount: 200, billPhoto: PHOTO })).status, 403);

  const ok = await api('PUT', url, d.token, { amount: 205.5, billPhoto: PHOTO });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.payment.amount, 205.5);
  assert.ok(ok.body.payment.billUrl, 'bill photo stored');

  mine = await api('GET', '/api/delivery/store-payments', d.token);
  assert.equal(mine.body.total, 205.5);
  assert.equal(mine.body.paid.length, 1);
  assert.equal(mine.body.toRecord.length, 0);

  // Deliver it: the rider still owes ALL the COD cash; earnings are the ₹3 incentive, untouched by the payment.
  const pin = (await H.ctx.M('Order').findByPk(order.id, { attributes: ['deliveryPin'] })).deliveryPin;
  assert.equal((await api('PUT', `/api/delivery/status/${order.id}`, d.token, { status: 'PickedUp' })).status, 200);
  assert.equal((await H.deliver(order.id, d, pin)).status, 200);
  const row = await H.ctx.M('Order').findByPk(order.id, { raw: true });
  assert.equal(await H.cashHeld(d.id), H.toPaise(row.finalPrice));
  assert.equal(H.r('utils/riderEarnings').earningPaise(row), 300);

  // Admin sees it with the rider; the customer does not.
  const admin = await H.mkUser({ role: 'admin' });
  const list = await api('GET', `/api/admin/rider-store-payments?riderId=${d.id}`, admin.token);
  assert.equal(list.status, 200);
  assert.equal(list.body.total, 205.5);
  assert.equal(list.body.payments[0].rider.id, d.id);
  assert.equal((await api('GET', '/api/admin/rider-store-payments', d.token)).status, 403);
  const cust = await api('GET', `/api/orders/${order.id}`, u.token);
  assert.equal('riderStorePaidPaise' in cust.body, false);
});

test('a normal restaurant (paid by ZenWe on its cycle) has nothing to record', async () => {
  const { item } = await H.mkStore({ price: 150 });
  const u = await H.mkUser();
  const d = await H.mkRider();
  const order = await H.placeOrder({ item, user: u });
  assert.equal((await H.readyAndClaim(order.id, d)).status, 200);
  const r = await api('PUT', `/api/delivery/orders/${order.id}/store-payment`, d.token, { amount: 100, billPhoto: PHOTO });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'NOT_PAY_BEFORE_PICKUP');
  const mine = await api('GET', '/api/delivery/store-payments', d.token);
  assert.equal(mine.body.toRecord.length, 0);
});
