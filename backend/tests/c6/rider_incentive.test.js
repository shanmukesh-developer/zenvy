// Rider incentive (owner, 24 Nov 2026): the rider gets a flat ₹3 per order, ZenWe keeps the rest of the delivery +
// platform fee. Fixed on the order when it is placed (Order.riderEarningPaise), so older orders keep the old rule
// (earning = delivery fee) and past statements never change. The customer's bill is unchanged and never shows it.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

const { api } = H;
before(async () => { await H.setup(); });
after(H.teardown);

const RE = () => H.r('utils/riderEarnings');

test('a new order fixes the ₹3 incentive; the rider earns ₹3 and sees the split; the bill is unchanged', async () => {
  const d = await H.mkRider();
  const { item } = await H.mkStore({ price: 100 });
  const u = await H.mkUser();
  const order = await H.placeOrder({ item, user: u });
  const row = await H.ctx.M('Order').findByPk(order.id, { raw: true });
  assert.equal(row.riderEarningPaise, 300);
  assert.equal(RE().earningPaise(row), 300);

  // The customer pays the same delivery + platform fee as before, and never sees rider pay.
  const mine = await api('GET', `/api/orders/${order.id}`, u.token);
  assert.equal(mine.status, 200);
  assert.equal(mine.body.deliveryFee, row.deliveryFee);
  assert.equal('riderEarningPaise' in mine.body, false);
  assert.equal('feeSplit' in mine.body, false);

  const pin = await H.toPickedUp(order.id, d);
  const done = await H.deliver(order.id, d, pin);
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.riderEarning, 3);
  const fees = Number(row.deliveryFee) + Number(row.platformFee || 0);
  assert.deepEqual(done.body.feeSplit, {
    deliveryFee: Number(row.deliveryFee), platformFee: Number(row.platformFee || 0), customerFees: fees,
    zenweShare: Math.round((fees - 3) * 100) / 100, riderIncentive: 3,
  });

  const today = await api('GET', '/api/delivery/stats/today', d.token);
  assert.equal(today.body.earnings, 3);
  const hist = await api('GET', '/api/delivery/orders/history', d.token);
  const rows = Array.isArray(hist.body) ? hist.body : hist.body.orders;
  const h = rows.find((o) => o.id === order.id);
  assert.equal(h.riderEarning, 3);
  assert.equal(h.feeSplit.riderIncentive, 3);
  const partner = await H.ctx.M('DeliveryPartner').findByPk(d.id, { raw: true });
  assert.equal(Number(partner.totalEarnings), 3);
});

test('older orders (no fixed incentive) keep earning the delivery fee and show no split', async () => {
  const old = { deliveryFee: 19, platformFee: 4, fulfilment: 'ZENVY', priceBreakdown: { deliveryFee: 19 }, riderEarningPaise: null };
  assert.equal(RE().earningPaise(old), 1900);
  assert.equal(RE().feeSplit(old), null);
  assert.equal(RE().earningPaise({ ...old, riderEarningPaise: 300 }), 300);
  assert.deepEqual(RE().feeSplit({ ...old, riderEarningPaise: 300 }), { deliveryFee: 19, platformFee: 4, customerFees: 23, zenweShare: 20, riderIncentive: 3 });
  // Stall orders never pay a ZenWe rider.
  assert.equal(RE().earningPaise({ ...old, fulfilment: 'VENDOR', riderEarningPaise: 300 }), 0);
});

test('the incentive follows GlobalConfig RIDER_INCENTIVE_PER_ORDER for new orders only', async () => {
  const { item } = await H.mkStore({ price: 100 });
  const u = await H.mkUser();
  const first = await H.placeOrder({ item, user: u });
  await H.ctx.M('GlobalConfig').upsert({ key: 'RIDER_INCENTIVE_PER_ORDER', value: 5 });
  try {
    const second = await H.placeOrder({ item, user: u });
    const [a, b] = await Promise.all([first, second].map((o) => H.ctx.M('Order').findByPk(o.id, { raw: true })));
    assert.equal(a.riderEarningPaise, 300, 'an order already placed keeps its incentive');
    assert.equal(b.riderEarningPaise, 500);
    // A bad value falls back to the ₹3 default.
    await H.ctx.M('GlobalConfig').upsert({ key: 'RIDER_INCENTIVE_PER_ORDER', value: 'lots' });
    assert.equal(await RE().currentIncentivePaise(), 300);
  } finally {
    await H.ctx.M('GlobalConfig').destroy({ where: { key: 'RIDER_INCENTIVE_PER_ORDER' } });
  }
});
