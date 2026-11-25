// Lucky Spin every 5 finished orders (owner, 25 Nov 2026; utils/spinRules): the rule and its one constant, the
// once-only carry-over of spins earned under the old every-2 rule (scripts/spin_rule_5_v1), the 5-order refusal
// message, GET /api/rewards/spin-progress, and every order kind counting exactly once (food / grocery Orders by rider
// and by stall, Mega Basket, service booking, In-Campus Booking pickup), never twice on a retry.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

const rules = () => H.r('utils/spinRules');
const User = () => H.ctx.M('User');
const count = async (id) => Number((await User().findByPk(id)).completedOrders) || 0;
let admin;

before(async () => {
  await H.setup();
  const s = H.ctx.sequelize;
  H.r('models/MegaBasket').initMegaBasketModel(s);
  H.r('models/MegaBasketItem').initMegaBasketItemModel(s);
  H.r('models/ServiceBooking').initServiceBookingModel(s);
  H.r('modules/campusBooking').initCampusBookingModels(s);
  await s.sync();
  admin = await H.mkUser({ role: 'admin' });
});
after(H.teardown);

test('one constant: 5 orders per spin; spins = floor(delivered / 5) + carry-over - used, never negative', () => {
  const R = rules();
  assert.equal(R.ORDERS_PER_SPIN, 5);
  assert.equal(R.spinsAvailable({ completedOrders: 4 }), 0);
  assert.equal(R.spinsAvailable({ completedOrders: 5 }), 1);
  assert.equal(R.spinsAvailable({ completedOrders: 14, spinsUsed: 1 }), 1);
  assert.equal(R.spinsAvailable({ completedOrders: 10, spinsUsed: 5 }), 0, 'clamped at 0');
  assert.equal(R.spinsAvailable({ completedOrders: 7, spinBonus: 2, spinsUsed: 1 }), 2);
  assert.match(R.NO_SPINS_MESSAGE, /every 5 delivered orders/i);
  assert.deepEqual(R.progressOf({ completedOrders: 7 }), { deliveredCount: 7, progress: 2, toNext: 3 });
  assert.equal(R.earnedSpinAt(10), true);
  assert.equal(R.earnedSpinAt(11), false);
  assert.equal(R.earnedSpinAt(0), false);
});

test('carry-over (once): nobody loses unused spins from the old every-2 rule; runs only once', async () => {
  const cases = [
    // [completedOrders, spinsUsed] -> unused under the old rule
    [0, 0], [1, 0], [3, 0], [7, 1], [10, 5], [13, 2], [25, 12], [4, 2],
  ];
  const users = [];
  for (const [c, used] of cases) users.push(await H.mkUser({ completedOrders: c, spinsUsed: used }));
  const run = H.r('scripts/spin_rule_5_v1').runSpinRule5Once;
  const first = await run();
  assert.ok(first.usersWithCarry >= 6, JSON.stringify(first));
  for (let i = 0; i < cases.length; i++) {
    const [c, used] = cases[i];
    const row = await User().findByPk(users[i].id);
    const oldUnused = Math.max(0, Math.floor(c / 2) - used);
    assert.equal(rules().spinsAvailable(row), oldUnused, `c=${c} used=${used}: kept ${oldUnused}`);
    assert.equal(Number(row.spinBonus) || 0, Math.floor(c / 2) - Math.floor(c / 5));
  }
  assert.deepEqual(await run(), { skipped: 'already done' });
  const again = await User().findByPk(users[3].id);
  assert.equal(Number(again.spinBonus), 3 - 1, 'not applied twice');
  // After the switch the next spin comes every 5 more orders: 7 (+bonus 2, used 1 -> 2 left) -> 10 gives one more.
  await User().update({ completedOrders: 10 }, { where: { id: users[3].id } });
  assert.equal(rules().spinsAvailable(await User().findByPk(users[3].id)), 3);
});

test('use-spin refuses with the 5-order message when none is left, and spins when 5 orders are in', async () => {
  const u = await H.mkUser({ completedOrders: 4 });
  const r = await H.api('POST', '/api/rewards/use-spin', u.token, {});
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'NO_SPINS');
  assert.match(r.body.message, /every 5 delivered orders/i);
  await User().update({ completedOrders: 5 }, { where: { id: u.id } });
  const ok = await H.api('POST', '/api/rewards/use-spin', u.token, {});
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.spinsAvailable, 0);
  const e = await H.api('GET', '/api/rewards/spin-eligibility', u.token);
  assert.equal(e.body.ordersPerSpin, 5);
  assert.equal(e.body.nextMilestoneIn, 5);
});

test('GET /api/rewards/spin-progress: the numbers the pop-up shows', async () => {
  const u = await H.mkUser({ completedOrders: 7, spinsUsed: 0 });
  let r = await H.api('GET', '/api/rewards/spin-progress', u.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ordersPerSpin, 5);
  assert.equal(r.body.deliveredCount, 7);
  assert.equal(r.body.progress, 2);
  assert.equal(r.body.toNext, 3);
  assert.equal(r.body.spinsAvailable, 1);
  assert.equal(r.body.justEarnedSpin, false);
  assert.equal(r.body.lastDeliveredOrderId, null);
  await User().update({ completedOrders: 10, lastCompletedRef: 'basket:abc', lastCompletedAt: new Date() }, { where: { id: u.id } });
  r = await H.api('GET', '/api/rewards/spin-progress', u.token);
  assert.deepEqual([r.body.progress, r.body.toNext, r.body.spinsAvailable, r.body.justEarnedSpin], [0, 5, 2, true]);
  assert.deepEqual([r.body.lastDeliveredKind, r.body.lastDeliveredOrderId], ['basket', 'abc']);
  assert.ok(r.body.lastDeliveredAt);
  assert.equal((await H.api('GET', '/api/rewards/spin-progress', null)).status, 401);
});

test('food / grocery order delivered by the rider counts once (a second Delivered tap does not)', async () => {
  const u = await H.mkUser();
  const d = await H.mkRider();
  const { store } = await H.mkStore({ price: 100 });
  const o = await H.ctx.M('Order').create({ userId: u.id, restaurantId: store.id, items: [], totalPrice: 100, deliveryFee: 0, finalPrice: 100, paymentMethod: 'UPI', paymentStatus: 'Completed', status: 'PickedUp', deliveryPartnerId: d.id });
  const a = await H.api('PUT', `/api/delivery/status/${o.id}`, d.token, { status: 'Delivered' });
  assert.equal(a.status, 200, JSON.stringify(a.body).slice(0, 300));
  const b = await H.api('PUT', `/api/delivery/status/${o.id}`, d.token, { status: 'Delivered' });
  assert.notEqual(b.status, 200);
  assert.equal(await count(u.id), 1);
  const p = await H.api('GET', '/api/rewards/spin-progress', u.token);
  assert.deepEqual([p.body.deliveredCount, p.body.toNext, p.body.lastDeliveredKind, p.body.lastDeliveredOrderId], [1, 4, 'order', String(o.id)]);
});

test('order completed by support (admin) counts once, a repeat does not', async () => {
  const u = await H.mkUser();
  const { store } = await H.mkStore({ price: 100 });
  const o = await H.ctx.M('Order').create({ userId: u.id, restaurantId: store.id, items: [], totalPrice: 100, deliveryFee: 0, finalPrice: 100, paymentMethod: 'UPI', paymentStatus: 'Completed', status: 'PickedUp' });
  const a = await H.api('PUT', `/api/orders/${o.id}/status`, admin.token, { status: 'Delivered' });
  assert.equal(a.status, 200, JSON.stringify(a.body).slice(0, 300));
  await H.api('PUT', `/api/orders/${o.id}/status`, admin.token, { status: 'Delivered' });
  assert.equal(await count(u.id), 1);
});

test('Mega Basket delivered counts once (a repeated PIN does not)', async () => {
  const u = await H.mkUser();
  const d = await H.mkRider();
  const basket = await H.ctx.M('MegaBasket').create({ userId: u.id, deliveryPartnerId: d.id, status: 'Delivering', estimatedTotal: 200, actualTotal: 200, deliveryAddress: 'Block A 101', deliveryPin: '4321' });
  const a = await H.api('POST', `/api/mega-basket/${basket.id}/complete-delivery`, d.token, { deliveryPin: '4321' });
  assert.equal(a.status, 200, JSON.stringify(a.body).slice(0, 300));
  const b = await H.api('POST', `/api/mega-basket/${basket.id}/complete-delivery`, d.token, { deliveryPin: '4321' });
  assert.equal(b.status, 409);
  assert.equal(await count(u.id), 1);
  assert.equal((await User().findByPk(u.id)).lastCompletedRef, `basket:${basket.id}`);
});

test('service (laundry) booking completed counts once; a cancelled one never counts', async () => {
  const u = await H.mkUser();
  const sb = await H.ctx.M('ServiceBooking').create({ userId: u.id, serviceType: 'LAUNDRY', title: 'Laundry', status: 'READY_FOR_DELIVERY', quotedAmount: 50, finalAmount: 50 });
  const a = await H.api('PATCH', `/api/services/${sb.id}/status`, admin.token, { status: 'COMPLETED' });
  assert.equal(a.status, 200, JSON.stringify(a.body).slice(0, 300));
  const b = await H.api('PATCH', `/api/services/${sb.id}/status`, admin.token, { status: 'COMPLETED' });
  assert.notEqual(b.status, 200);
  assert.equal(await count(u.id), 1);
  const sc = await H.ctx.M('ServiceBooking').create({ userId: u.id, serviceType: 'LAUNDRY', title: 'Laundry', status: 'CONFIRMED', quotedAmount: 50 });
  await H.api('PATCH', `/api/services/${sc.id}/status`, admin.token, { status: 'CANCELLED' });
  assert.equal(await count(u.id), 1);
});

test('In-Campus Booking collected counts once (a second collect is refused, nothing more counted)', async () => {
  const u = await H.mkUser();
  const { store } = await H.mkStore({ price: 100 });
  const Booking = H.ctx.M('CampusBooking');
  const B = H.r('modules/campusBooking/services/bookings');
  const mk = (ref) => Booking.create({ ref, userId: u.id, restaurantId: store.id, items: [], itemCount: 1, amountPaise: 5000, status: 'READY', pickupCode: 'AB12', createdAt: new Date(Date.now() - 3600000) });
  const bk = await mk('CBTST1');
  const done = await B.vendorCollect(bk, { code: 'AB12' });
  assert.equal(done.status, 'COLLECTED');
  await assert.rejects(() => B.vendorCollect(bk, { code: 'AB12' }));
  await assert.rejects(() => B.vendorCollect(done, { code: 'AB12' }));
  assert.equal(await count(u.id), 1);
  assert.equal((await User().findByPk(u.id)).lastCompletedRef, `campus:${bk.id}`);
});

test('every kind adds to the same counter: the 5th finished order makes a spin available', async () => {
  const u = await H.mkUser({ completedOrders: 4 });
  const sb = await H.ctx.M('ServiceBooking').create({ userId: u.id, serviceType: 'LAUNDRY', title: 'Laundry', status: 'READY_FOR_DELIVERY', quotedAmount: 50, finalAmount: 50 });
  assert.equal((await H.api('PATCH', `/api/services/${sb.id}/status`, admin.token, { status: 'COMPLETED' })).status, 200);
  const p = await H.api('GET', '/api/rewards/spin-progress', u.token);
  assert.deepEqual([p.body.deliveredCount, p.body.progress, p.body.spinsAvailable, p.body.justEarnedSpin], [5, 0, 1, true]);
});
