// Delivery timing groups (owner, 14 Nov 2026; utils/deliveryGroups) on the real routes:
//  - food: 12:30–1:00 PM (order by 11:30), 7:00–7:15 (by 6:30), 8:00–8:15 (by 7:15), 9:00–9:30 PM (by 8:15)
//  - groceries & fruits: 12–2 PM, order by 7 AM the same day; bakeries, snacks & pickles: 4–6 PM, order by 2 PM
//  - after a cutoff the next window (tomorrow's when today's are closed); a cake's longer lead still applies
//  - the group comes from the product (admin), else the store (admin), else the store's type / name
//  - products of different groups never share an order (400 MIXED_DELIVERY_TIMES)
//  - the admin edits the windows (validated) and the group of a store / product.
process.env.DELIVERY_GROUPS = 'on';
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const T = require('./helpers');

const { H, IST, setNow } = T;
let admin;
before(async () => { await T.setup(); admin = await H.mkUser({ role: 'admin' }); });
after(T.teardown);
afterEach(() => { setNow(null); T.S._resetConfig(); });

const quoteItems = (user, ids) => H.api('POST', '/api/orders/quote', user.token, { ...H.orderBody(ids[0], 'COD'), items: ids.map((menuItemId) => ({ menuItemId, quantity: 1 })) });
const place = (user, item, extra = {}) => H.api('POST', '/api/orders', user.token, H.orderBody(item.id, 'COD', extra));
const view = (ds) => ds.slots.map((s) => `${s.open ? '+' : '-'}${s.label}`);

test('food: lunch plus the three evening windows, each with its own cutoff', async () => {
  const u = await H.mkUser();
  const { item } = await T.mkStore({ name: 'Chicken Dum Biryani' });
  setNow(IST('2026-11-14T18:29:00'));
  let q = await quoteItems(u, [item.id]);
  assert.equal(q.status, 200, JSON.stringify(q.body));
  assert.equal(q.body.deliverySlots.group, 'food');
  assert.deepEqual(view(q.body.deliverySlots), [
    '-Today 12:30–1:00 PM', '+Today 7:00–7:15 PM', '+Today 8:00–8:15 PM', '+Today 9:00–9:30 PM',
    '+Tomorrow 12:30–1:00 PM', '+Tomorrow 7:00–7:15 PM', '+Tomorrow 8:00–8:15 PM', '+Tomorrow 9:00–9:30 PM',
  ]);
  assert.equal(q.body.deliverySlots.defaultSlotId, '2026-11-14|F2');
  assert.equal(q.body.deliverySlots.slots[1].closesAtLabel, '6:30 PM');
  setNow(IST('2026-11-14T18:30:00'));
  q = await quoteItems(u, [item.id]);
  assert.equal(q.body.deliverySlots.defaultSlotId, '2026-11-14|F3'); // 6:30–7:15 PM -> 8:00–8:15
  setNow(IST('2026-11-14T19:15:00'));
  q = await quoteItems(u, [item.id]);
  assert.equal(q.body.deliverySlots.defaultSlotId, '2026-11-14|F4'); // 7:15–8:15 PM -> 9:00–9:30
  setNow(IST('2026-11-14T20:15:00'));
  q = await quoteItems(u, [item.id]);
  assert.equal(q.body.deliverySlots.defaultSlotId, '2026-11-15|F1'); // after 8:15 PM -> tomorrow's lunch
  // the order keeps the window
  setNow(IST('2026-11-14T18:40:00'));
  const r = await place(u, item, { deliverySlot: '2026-11-14|F3' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.deliverySlot, 'Sat 14 Nov, 8:00–8:15 PM');
  const late = await place(u, item, { deliverySlot: '2026-11-14|F2' });
  assert.equal(late.status, 409, JSON.stringify(late.body));
  assert.match(late.body.message, /closed at 6:30 PM/);
});

test('groceries & fruits by 7 AM for 12–2 PM; bakeries, snacks & pickles by 2 PM for 4–6 PM; else tomorrow', async () => {
  const u = await H.mkUser();
  const { item: rice } = await T.mkStore({ name: 'Sona Masoori Rice 1 kg', store: { vendorType: 'GROCERY' } });
  const { item: pickle } = await T.mkStore({ name: 'Mango Pickle', store: { name: 'Sri Test Home made Pickles' } });
  setNow(IST('2026-11-14T06:59:00'));
  let q = await quoteItems(u, [rice.id]);
  assert.equal(q.body.deliverySlots.group, 'grocery');
  assert.deepEqual(view(q.body.deliverySlots), ['+Today 12:00–2:00 PM', '+Tomorrow 12:00–2:00 PM']);
  setNow(IST('2026-11-14T07:00:00'));
  q = await quoteItems(u, [rice.id]);
  assert.deepEqual(view(q.body.deliverySlots), ['-Today 12:00–2:00 PM', '+Tomorrow 12:00–2:00 PM']);
  setNow(IST('2026-11-14T13:59:00'));
  q = await quoteItems(u, [pickle.id]);
  assert.equal(q.body.deliverySlots.group, 'bakery');
  assert.deepEqual(view(q.body.deliverySlots), ['+Today 4:00–6:00 PM', '+Tomorrow 4:00–6:00 PM']);
  setNow(IST('2026-11-14T14:00:00'));
  q = await quoteItems(u, [pickle.id]);
  assert.equal(q.body.deliverySlots.defaultSlotId, '2026-11-15|B1');
});

test('a specialized cake still needs 2½ hours: the 4 PM window closes at 1:30 PM', async () => {
  const u = await H.mkUser();
  const { item } = await T.mkStore({ name: 'Photo Cake', store: { vendorType: 'BAKERY' }, item: { isSpecializedCake: true } });
  setNow(IST('2026-11-14T13:31:00'));
  const q = await quoteItems(u, [item.id]);
  assert.equal(q.body.deliverySlots.slots[0].open, false);
  assert.equal(q.body.deliverySlots.slots[0].closedText, 'Closed at 1:30 PM');
});

test('a product the admin moves to another group is delivered then; different groups never share an order', async () => {
  const u = await H.mkUser();
  const { store, item: meal } = await T.mkStore({ name: 'Veg Meals' });
  const r = await H.api('POST', '/api/admin/menu-items/new', admin.token, { restaurantId: store.id, name: 'Fruit Bowl', price: 90, deliveryGroup: 'grocery' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const fruit = await H.ctx.M('MenuItem').findOne({ where: { restaurantId: store.id, name: 'Fruit Bowl' } });
  assert.equal(fruit.deliveryGroup, 'grocery');
  setNow(IST('2026-11-14T06:00:00'));
  let q = await quoteItems(u, [fruit.id]);
  assert.equal(q.body.deliverySlots.group, 'grocery');
  q = await quoteItems(u, [meal.id, fruit.id]);
  assert.equal(q.status, 400, JSON.stringify(q.body));
  assert.equal(q.body.code, 'MIXED_DELIVERY_TIMES');
  assert.match(q.body.message, /Veg Meals .*and Fruit Bowl/);
  // a bad group is refused; empty = the store's
  let bad = await H.api('POST', `/api/admin/menu-items/${fruit.id}`, admin.token, { deliveryGroup: 'midnight' });
  assert.equal(bad.status, 400, JSON.stringify(bad.body));
  bad = await H.api('POST', `/api/admin/menu-items/${fruit.id}`, admin.token, { deliveryGroup: '' });
  assert.equal(bad.status, 200, JSON.stringify(bad.body));
  assert.equal((await H.ctx.M('MenuItem').findByPk(fruit.id)).deliveryGroup, null);
  // the store's own group
  const s = await H.api('POST', `/api/admin/restaurants/${store.id}`, admin.token, { deliveryGroup: 'bakery' });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  q = await quoteItems(u, [meal.id]);
  assert.equal(q.body.deliverySlots.group, 'bakery');
});

test('the admin edits the windows (validated); the new windows apply at once', async () => {
  let r = await H.api('GET', '/api/admin/delivery-groups', admin.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.groups.grocery.slots.map((s) => [s.id, s.start, s.end, s.cutoff]), [['G1', '12:00', '14:00', '07:00']]);
  const post = (value) => H.api('POST', '/api/admin/config', admin.token, { key: 'DELIVERY_GROUPS', value });
  r = await post({ grocery: { slots: [{ start: '12:00', end: '14:00', cutoff: '12:30' }] } });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /cutoff must be at or before/);
  r = await post({ grocery: { slots: [{ start: '10:00', end: '12:00', cutoff: '08:00' }, { start: '11:00', end: '13:00', cutoff: '09:00' }] } });
  assert.match(r.body.message, /must not overlap/);
  r = await post({ grocery: { slots: [{ start: '17:00', end: '18:00', cutoff: '15:00' }, { start: '9:00', end: '11:00', cutoff: '7:00' }] } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.groups.grocery.slots.map((s) => [s.id, s.start, s.cutoff]), [['G1', '09:00', '07:00'], ['G2', '17:00', '15:00']]);
  assert.equal(r.body.groups.food.slots.length, 4, 'groups left out keep their windows');
  const u = await H.mkUser();
  const { item } = await T.mkStore({ name: 'Toor Dal 1 kg', store: { vendorType: 'GROCERY' } });
  setNow(IST('2026-11-14T10:00:00'));
  const q = await quoteItems(u, [item.id]);
  assert.equal(q.body.deliverySlots.defaultSlotId, '2026-11-14|G2');
  await H.ctx.M('GlobalConfig').destroy({ where: { key: 'DELIVERY_GROUPS' } });
});
