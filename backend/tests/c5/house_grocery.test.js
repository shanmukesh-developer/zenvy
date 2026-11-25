// ZenWe Grocery + Groceries tab sections (owner, 26 Nov 2026; utils/houseGrocery, utils/shopSections,
// scripts/house_grocery_store_v1.js, controllers/houseGroceryController, catalogue ?house=1 / ?section=).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

let admin;
let student;
let house;
const hours = { start: '00:00', end: '00:00' };
test.before(async () => {
  await H.setup();
  admin = await H.mkUser({ role: 'admin' });
  student = await H.mkUser();
});
test.after(async () => { await H.teardown(); });

const A = (method, url, body) => H.api(method, `/api/admin/house-grocery${url}`, admin.token, body);
const mkShop = async (extra) => H.ctx.M('Restaurant').create({ name: `HG Shop ${Math.random().toString(36).slice(2, 8)}`, location: 'Near campus', password: 'storepass1', operatingHours: hours, isActive: true, isOpenNow: true, ...extra });
const responseCache = () => H.r('utils/responseCache');
const fresh = async () => { try { await responseCache().invalidate('catalog'); } catch { /* none */ } };
const setSection = (key, enabled) => H.api('PUT', `/api/admin/app-sections/${key}`, admin.token, { enabled });

test('boot script creates ZenWe Grocery once', async () => {
  const s = H.r('scripts/house_grocery_store_v1');
  const first = await s.runHouseGroceryStoreOnce();
  assert.equal(first.created, true, JSON.stringify(first));
  const again = await s.runHouseGroceryStoreOnce();
  assert.equal(again.skipped, 'already done');
  const rows = await H.ctx.M('Restaurant').findAll({ where: { isHouseStore: true } });
  assert.equal(rows.length, 1);
  house = rows[0];
  assert.equal(house.name, 'ZenWe Grocery');
  assert.equal(house.vendorType, 'GROCERY');
  assert.equal(house.isActive, true);
  assert.equal(!!house.isOffline, false);
  assert.equal(house.password, null, 'no partner login: orders go straight to ZenWe riders');
  assert.equal(H.r('utils/riderPurchase').isRiderPurchaseStore(house, 'test'), true);
  assert.equal(house.deliveryGroup, 'grocery');
  // Setup from the admin page is a no-op while it exists.
  const r = await A('POST', '/setup');
  assert.equal(r.status, 200);
  assert.equal(r.body.created, false);
});

test('admin category CRUD: add, rename (moves products), reorder, delete only when empty; validated', async () => {
  let r = await A('POST', '/categories', { name: 'Staples', imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const staples = r.body.category;
  r = await A('POST', '/categories', { name: 'Dairy' });
  assert.equal(r.status, 201);
  const dairy = r.body.category;
  r = await A('POST', '/categories', { name: 'Snacks' });
  const snacks = r.body.category;
  assert.equal((await A('POST', '/categories', { name: 'staples' })).status, 409, 'duplicate name refused');
  assert.equal((await A('POST', '/categories', { name: '  ' })).status, 400, 'empty name refused');
  assert.equal((await A('POST', '/categories', { name: 'x'.repeat(61) })).status, 400, 'long name refused');

  // A product in Dairy, then rename Dairy -> Dairy & eggs: the product moves along.
  r = await A('POST', '/products', { name: 'Amul Milk', price: 30, originalPrice: 32, packSize: '500 ml', category: 'Dairy', dietType: 'veg' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const milk = r.body.product;
  r = await A('PUT', `/categories/${dairy.id}`, { name: 'Dairy & eggs' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.productsMoved, 1);
  assert.equal((await H.ctx.M('MenuItem').findByPk(milk.id)).category, 'Dairy & eggs');

  r = await A('PUT', '/categories/order', { ids: [snacks.id, dairy.id, staples.id] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.categories.map((c) => c.name), ['Snacks', 'Dairy & eggs', 'Staples']);
  assert.equal((await A('PUT', '/categories/order', { ids: [snacks.id] })).status, 400, 'partial order refused');

  r = await A('DELETE', `/categories/${dairy.id}`);
  assert.equal(r.status, 409, 'not empty');
  assert.equal(r.body.code, 'CATEGORY_NOT_EMPTY');
  r = await A('DELETE', `/categories/${snacks.id}`);
  assert.equal(r.status, 200);
  r = await A('GET', '');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.categories.map((c) => [c.name, c.itemCount]), [['Dairy & eggs', 1], ['Staples', 0]]);
  assert.equal(r.body.store.id, house.id);

  const logs = await H.ctx.M('VerificationLog').findAll({ where: { adminId: String(admin.id) } });
  const actions = new Set(logs.map((l) => l.action));
  for (const a of ['HOUSE_GROCERY_CATEGORY_ADD', 'HOUSE_GROCERY_CATEGORY_UPDATE', 'HOUSE_GROCERY_CATEGORY_REORDER', 'HOUSE_GROCERY_CATEGORY_DELETE', 'HOUSE_GROCERY_PRODUCT_ADD']) assert.ok(actions.has(a), `audited ${a}`);
});

test('admin product CRUD + bulk stock, validated', async () => {
  let r = await A('POST', '/products', { name: 'Sona Masoori Rice', price: 65, originalPrice: 72, packSize: '1 kg', category: 'Staples', description: 'Everyday rice' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const rice = r.body.product;
  assert.equal(rice.packSize, '1 kg');
  assert.equal(rice.originalPrice, 72);
  assert.equal(rice.isAvailable, true);
  const row = await H.ctx.M('MenuItem').findByPk(rice.id);
  assert.equal(row.restaurantId, house.id);
  const specs = typeof row.specs === 'string' ? JSON.parse(row.specs) : row.specs;
  assert.equal(specs.weight, '1 kg');
  assert.equal(specs.autoWeights, false, 'a sealed pack, no automatic weights');

  for (const bad of [
    { name: '', price: 10, category: 'Staples' },
    { name: 'X', price: 0, category: 'Staples' },
    { name: 'X', price: 'abc', category: 'Staples' },
    { name: 'X', price: 10, category: 'Nope' },
    { name: 'X', price: 10, originalPrice: 5, category: 'Staples' },
    { name: 'X', price: 10, dietType: 'meat', category: 'Staples' },
    { name: 'X', price: 10, packSize: 'y'.repeat(41), category: 'Staples' },
    { name: 'X', price: 10, category: 'Staples', imageUrl: 'javascript:alert(1)' },
  ]) {
    const b = await A('POST', '/products', bad);
    assert.equal(b.status, 400, `${JSON.stringify(bad)} -> ${JSON.stringify(b.body)}`);
  }

  r = await A('PUT', `/products/${rice.id}`, { price: 60, isAvailable: false, packSize: '' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.product.price, 60);
  assert.equal(r.body.product.isAvailable, false);
  assert.equal(r.body.product.packSize, null);
  assert.equal((await A('PUT', `/products/${rice.id}`, { originalPrice: 50 })).status, 400, 'MRP below price');

  r = await A('GET', '/products?q=rice');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.products.map((p) => p.name), ['Sona Masoori Rice']);
  r = await A('GET', `/products?category=${encodeURIComponent('Dairy & eggs')}`);
  assert.deepEqual(r.body.products.map((p) => p.name), ['Amul Milk']);

  r = await A('POST', '/products/stock', { ids: [rice.id], isAvailable: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.updated, 1);
  assert.equal((await H.ctx.M('MenuItem').findByPk(rice.id)).isAvailable, true);
  assert.equal((await A('POST', '/products/stock', { ids: ['nope'], isAvailable: true })).status, 400);

  // Another store's product can never be edited here.
  const { item: other } = await H.mkStore();
  assert.equal((await A('PUT', `/products/${other.id}`, { price: 1 })).status, 404);
  assert.equal((await A('DELETE', `/products/${other.id}`)).status, 404);

  const tmp = (await A('POST', '/products', { name: 'Temp', price: 5, category: 'Staples' })).body.product;
  assert.equal((await A('DELETE', `/products/${tmp.id}`)).status, 200);
  assert.equal(await H.ctx.M('MenuItem').findByPk(tmp.id), null);
});

test('admin endpoints are admins only', async () => {
  for (const [m, u, b] of [['GET', '', undefined], ['POST', '/categories', { name: 'Z' }], ['GET', '/products', undefined], ['POST', '/products', { name: 'Z', price: 5, category: 'Staples' }], ['POST', '/setup', {}]]) {
    assert.equal((await H.api(m, `/api/admin/house-grocery${u}`, student.token, b)).status, 403, `${m} ${u} student`);
    assert.equal((await H.api(m, `/api/admin/house-grocery${u}`, null, b)).status, 401, `${m} ${u} anonymous`);
  }
});

test('catalogue ?house=1 lists only ZenWe Grocery products; /house gives its categories', async () => {
  const other = await mkShop({ vendorType: 'GROCERY' });
  await H.ctx.M('MenuItem').create({ restaurantId: other.id, name: 'Other shop chips', price: 20, isAvailable: true });
  await fresh();
  let r = await H.api('GET', '/api/catalogue/items?house=1');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.items.length >= 2);
  assert.ok(r.body.items.every((i) => i.restaurantId === house.id), 'house store only');
  const milk = r.body.items.find((i) => i.name === 'Amul Milk');
  assert.equal(milk.weight, '500 ml');
  assert.equal(milk.originalPrice, 32);
  assert.equal(milk.options, undefined, 'no automatic weight choices');
  assert.equal(r.body.stores.length, 1);
  assert.equal(r.body.stores[0].isHouseStore, true);
  // ?type=grocery (older app builds) still lists every grocery store.
  r = await H.api('GET', '/api/catalogue/items?type=grocery');
  assert.ok(r.body.items.some((i) => i.name === 'Other shop chips'));
  r = await H.api('GET', '/api/catalogue/house');
  assert.equal(r.status, 200);
  assert.equal(r.body.store.id, house.id);
  assert.deepEqual(r.body.categories.map((c) => [c.name, c.itemCount]), [['Dairy & eggs', 1], ['Staples', 1]]);
});

test('?section= lists the shops of a Groceries tab pill; BAKERY defaults to bakeries; house store never', async () => {
  const snacksShop = await mkShop({ vendorType: 'GROCERY', shopSection: 'snacks' });
  const fruitShop = await mkShop({ vendorType: 'GROCERY', shopSection: 'fruits_pickles' });
  const bakery = await mkShop({ vendorType: 'BAKERY' });
  const bakeryAsSnacks = await mkShop({ vendorType: 'BAKERY', shopSection: 'snacks' });
  const plain = await mkShop({ vendorType: 'GROCERY' });
  await fresh();
  const ids = async (section) => (await H.api('GET', `/api/catalogue/stores?section=${section}`)).body.map((s) => s.id);
  const snacks = await ids('snacks');
  assert.ok(snacks.includes(snacksShop.id) && snacks.includes(bakeryAsSnacks.id));
  assert.ok(!snacks.includes(plain.id) && !snacks.includes(house.id) && !snacks.includes(bakery.id));
  assert.deepEqual(await ids('fruits_pickles'), [fruitShop.id]);
  const bakeries = await ids('bakeries');
  assert.ok(bakeries.includes(bakery.id), 'BAKERY with no section = bakeries');
  assert.ok(!bakeries.includes(bakeryAsSnacks.id));
  assert.deepEqual(await ids('nope'), []);
  const card = (await H.api('GET', '/api/catalogue/stores?section=bakeries')).body.find((s) => s.id === bakery.id);
  assert.equal(card.shopSection, 'bakeries');

  // The admin sets the section in the store editor (validated).
  let r = await H.api('POST', `/api/admin/restaurants/${plain.id}`, admin.token, { shopSection: 'Fruits & pickles' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await H.ctx.M('Restaurant').findByPk(plain.id)).shopSection, 'fruits_pickles');
  r = await H.api('POST', `/api/admin/restaurants/${plain.id}`, admin.token, { shopSection: 'toys' });
  assert.equal(r.status, 400);
});

test('App sections: grocery off hides Grocery store, Snacks, Fruits & pickles; bakery off hides Bakeries', async () => {
  const sec = async (s) => (await H.api('GET', `/api/catalogue/stores?section=${s}`)).body.length;
  const houseItems = async () => (await H.api('GET', '/api/catalogue/items?house=1')).body.items.length;
  await setSection('grocery', false);
  await fresh();
  assert.equal(await houseItems(), 0);
  assert.equal((await H.api('GET', '/api/catalogue/house')).body.store, null);
  assert.equal(await sec('snacks'), 0);
  assert.equal(await sec('fruits_pickles'), 0);
  assert.ok(await sec('bakeries') > 0, 'bakeries stay');
  await setSection('grocery', true);
  await setSection('bakery', false);
  await fresh();
  assert.ok(await houseItems() > 0);
  assert.ok(await sec('snacks') > 0);
  assert.equal(await sec('bakeries'), 0);
  await setSection('bakery', true);
});

test('an order from ZenWe Grocery goes the rider-purchase way (no store acceptance, cash on delivery)', async () => {
  const rice = (await A('GET', '/products?q=rice')).body.products[0];
  await house.update({ operatingHours: hours }); // open all day for the test (the real store: 6 AM – 11 PM)
  const u = await H.mkUser({ wallet: 500 });
  const wallet = await H.api('POST', '/api/orders', u.token, H.orderBody(rice.id, 'Wallet'));
  assert.equal(wallet.status, 400, JSON.stringify(wallet.body));
  assert.equal(wallet.body.code, 'STALL_COD_ONLY');
  const o = await H.api('POST', '/api/orders', u.token, H.orderBody(rice.id, 'COD'));
  assert.ok(o.status === 201 || o.status === 200, JSON.stringify(o.body));
  const order = await H.ctx.M('Order').findByPk(o.body.id || o.body._id || (o.body.order && (o.body.order.id || o.body.order._id)));
  assert.ok(order, 'order saved');
  assert.equal(order.restaurantId, house.id);
  assert.equal(!!order.storePaidByRider, true, 'buy-at-store: straight to riders');
});
