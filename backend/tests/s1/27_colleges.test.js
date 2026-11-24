// Colleges (owner, 24 Nov 2026: SRM AP and Amrita only, VIT AP removed; earlier, 31 Oct 2026: "SRM AP and VIT AP now, Amrita soon; admin can block ordering per college; each
// restaurant visible to its own college, no conflicts"). utils/campuses + GET /api/config/campuses, admin
// GET/PUT /api/admin/campuses, store visibleCampuses (admin save), GET /api/restaurants?college=, and the order /
// quote refusals: a paused or not-yet-open college, or a store that does not serve the student's college.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const H = require('../c5/helpers');

let base; let server; let admin;
test.before(async () => {
  await H.setup();
  const express = require(path.join(H.B, 'node_modules/express'));
  const app = express();
  app.use(express.json());
  app.use('/api/config', H.r('routes/appConfigRoutes'));
  app.use('/api/restaurants', H.r('routes/restaurantRoutes'));
  app.use('/api/catalogue', H.r('routes/catalogueRoutes'));
  server = await require('../listenFree').listenFree(app);
  base = `http://127.0.0.1:${server.address().port}`;
  admin = await H.mkUser({ role: 'admin' });
});
test.after(async () => {
  if (server) await new Promise((res) => server.close(() => res()));
  await H.teardown();
});

const get = async (url) => { const r = await fetch(base + url); return { status: r.status, body: await r.json() }; };
const flush = () => { H.r('utils/campuses')._resetCache(); H.r('utils/responseCache').invalidate('config'); H.r('utils/responseCache').invalidate('catalog'); try { H.r('controllers/adminController').clearRestaurantsCache(); } catch { /* ok */ } };
const setStatus = (key, status, token = admin.token) => H.api('PUT', `/api/admin/campuses/${key}`, token, { status });
const order = (u, itemId, campus, address, extra = {}) => H.api('POST', '/api/orders', u.token, { ...H.orderBody(itemId, 'COD'), campus, deliveryAddress: address, ...extra });
const quote = (u, itemId, campus) => H.api('POST', '/api/orders/quote', u.token, { items: [{ menuItemId: itemId, quantity: 1 }], campus });
const SRM_ADDR = 'Block A, Room 101, SRM AP';
const AMR_ADDR = 'Amrita - Amrita Main Gate';

test('college list: SRM AP and Amrita open by default, VIT AP is gone', async () => {
  flush();
  const r = await get('/api/config/campuses');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.campuses.map((c) => [c.key, c.label, c.status]), [['srmap', 'SRM AP', 'open'], ['amrita', 'Amrita', 'open']]);
  assert.equal((await setStatus('vitap', 'open')).status, 400, 'VIT AP cannot be reopened');
});

test('admin pauses / reopens a college (validated, admins only); the generic config route cannot write it', async () => {
  const student = await H.mkUser();
  assert.equal((await setStatus('srmap', 'paused', student.token)).status, 403);
  assert.equal((await setStatus('harvard', 'paused')).status, 400);
  assert.equal((await setStatus('srmap', 'closed')).status, 400);
  const p = await setStatus('srmap', 'paused');
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal((await get('/api/config/campuses')).body.campuses.find((c) => c.key === 'srmap').status, 'paused', 'public list updated at once');
  const list = await H.api('GET', '/api/admin/campuses', admin.token);
  assert.equal(list.status, 200);
  assert.ok(list.body.campuses.every((c) => Number.isInteger(c.stores)));
  assert.equal((await H.api('POST', '/api/admin/config', admin.token, { key: 'CAMPUS_SERVICE', value: { srmap: 'open' } })).status, 400);
  assert.equal((await setStatus('srmap', 'open')).status, 200);
});

test('ordering: a paused college or a coming-soon one is refused (order and bill), the other college still orders', async () => {
  const { item } = await H.mkStore({ price: 100 });
  const u = await H.mkUser();
  await setStatus('srmap', 'paused');
  const r = await order(u, item.id, 'srmap', SRM_ADDR);
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'CAMPUS_PAUSED');
  assert.match(r.body.message, /SRM AP is paused/);
  assert.equal((await quote(u, item.id, 'srmap')).body.code, 'CAMPUS_PAUSED');
  const am = await order(u, item.id, 'amrita', AMR_ADDR);
  assert.equal(am.status, 201, JSON.stringify(am.body));
  await setStatus('amrita', 'soon');
  const soon = await order(u, item.id, 'amrita', AMR_ADDR);
  assert.equal(soon.status, 400);
  assert.equal(soon.body.code, 'CAMPUS_SOON');
  await setStatus('amrita', 'open');
  const vit = await order(u, item.id, 'vitap', 'Block C, Room 12, VIT AP');
  assert.equal(vit.status, 400);
  assert.equal(vit.body.code, 'CAMPUS_CLOSED');
  await setStatus('srmap', 'open');
  assert.equal((await order(u, item.id, 'srmap', SRM_ADDR)).status, 201);
  assert.equal(await H.ctx.M('Order').count({ where: { userId: u.id } }), 2, 'refused orders were never created');
});

test('stores: each college sees only its stores (and the all-colleges ones); a store never takes another college\'s order', async () => {
  const { store: a, item: aItem } = await H.mkStore({ price: 100 });
  const { store: b, item: bItem } = await H.mkStore({ price: 100 });
  const { store: c } = await H.mkStore({ price: 100 });
  const save = (id, visibleCampuses) => H.api('POST', `/api/admin/restaurants/${id}`, admin.token, { visibleCampuses });
  let s = await save(a.id, ['SRM AP']);
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.deepEqual(s.body.visibleCampuses, ['srmap']);
  assert.deepEqual((await save(b.id, 'amrita')).body.visibleCampuses, ['amrita']);
  assert.equal((await save(c.id, ['harvard'])).status, 400, 'unknown college');
  assert.equal((await save(c.id, ['vit'])).status, 400, 'VIT AP is no longer a college');
  assert.equal((await save(c.id, ['srmap', 'amrita'])).body.visibleCampuses, null, 'every college = no limit');
  assert.equal((await save(c.id, [])).body.visibleCampuses, null);
  flush();
  const ids = (body) => body.map((r) => r.id || r._id);
  const srm = ids((await get('/api/restaurants?college=srmap')).body);
  const amr = ids((await get('/api/restaurants?college=amrita')).body);
  const all = ids((await get('/api/restaurants')).body);
  assert.ok(srm.includes(a.id) && srm.includes(c.id) && !srm.includes(b.id), 'SRM: its store + the all-colleges one');
  assert.ok(amr.includes(b.id) && amr.includes(c.id) && !amr.includes(a.id), 'Amrita: its store + the all-colleges one');
  assert.ok([a.id, b.id, c.id].every((id) => all.includes(id)), 'no college asked: every store (older app builds)');
  const u = await H.mkUser();
  const cross = await order(u, bItem.id, 'srmap', SRM_ADDR);
  assert.equal(cross.status, 400);
  assert.equal(cross.body.code, 'STORE_NOT_AT_CAMPUS');
  assert.match(cross.body.message, /delivers to Amrita only/);
  assert.equal((await quote(u, bItem.id, 'srmap')).body.code, 'STORE_NOT_AT_CAMPUS');
  assert.equal((await order(u, bItem.id, 'amrita', AMR_ADDR)).status, 201);
  assert.equal((await order(u, aItem.id, 'srmap', SRM_ADDR)).status, 201);
});

test('every list the app reads is scoped: Home stores, Groceries catalogue (types, stores, items), search', async () => {
  const M = H.ctx.sequelize.models;
  // Search loads each item's store (config/db.js makes this link on the server; the test harness does not).
  if (!M.MenuItem.associations.restaurant) M.MenuItem.belongsTo(M.Restaurant, { foreignKey: 'restaurantId', as: 'restaurant' });
  const hours = { start: '00:00', end: '00:00' };
  const mk = async (name, vendorType, visibleCampuses) => {
    const st = await M.Restaurant.create({ name, location: 'Campus', vendorType, operatingHours: hours, isActive: true, isOpenNow: true, password: 'storepass1', visibleCampuses });
    await M.MenuItem.create({ restaurantId: st.id, name: `${name} Special Thali`, price: 90, isAvailable: true, category: 'Meals' });
    return st;
  };
  const srmFood = await mk('Zeta SRM Mess', 'RESTAURANT', ['srmap']);
  const amrFood = await mk('Zeta AMR Mess', 'RESTAURANT', ['amrita']);
  const srmShop = await mk('Zeta SRM Mart', 'GROCERY', ['srmap']);
  const amrShop = await mk('Zeta AMR Mart', 'GROCERY', ['amrita']);
  flush();
  const ids = (list) => list.map((r) => r.id || r._id);
  // Home (GET /api/users/restaurants, the list the app really reads).
  const home = async (college) => ids((await H.api('GET', `/api/users/restaurants?fields=summary${college ? `&college=${college}` : ''}`)).body);
  const homeSrm = await home('srmap');
  assert.ok(homeSrm.includes(srmFood.id) && !homeSrm.includes(amrFood.id), 'Home: SRM sees its kitchen only');
  const homeAmr = await home('amrita');
  assert.ok(homeAmr.includes(amrFood.id) && !homeAmr.includes(srmFood.id), 'Home: AMR sees its kitchen only');
  const homeAll = await home(null);
  assert.ok(homeAll.includes(srmFood.id) && homeAll.includes(amrFood.id), 'no college asked: all (older builds)');
  // Groceries catalogue.
  const items = async (college) => (await get(`/api/catalogue/items?type=grocery&college=${college}`)).body.items.map((it) => it.restaurantId || (it.store && it.store.id));
  assert.ok((await items('srmap')).includes(srmShop.id) && !(await items('srmap')).includes(amrShop.id), 'items: SRM only');
  assert.ok((await items('amrita')).includes(amrShop.id) && !(await items('amrita')).includes(srmShop.id), 'items: AMR only');
  const stores = ids((await get('/api/catalogue/stores?type=grocery&college=amrita')).body);
  assert.ok(stores.includes(amrShop.id) && !stores.includes(srmShop.id), 'stores: AMR only');
  // Search.
  const search = async (college) => (await H.api('GET', `/api/users/search?q=Zeta&college=${college}`)).body;
  const sSrm = await search('srmap');
  const names = (r) => [...r.restaurants.map((x) => x.name), ...r.items.map((x) => x.restaurantId && x.restaurantId.name)];
  assert.ok(names(sSrm).some((n) => /SRM/.test(n)) && !names(sSrm).some((n) => /AMR/.test(n)), `search SRM: ${names(sSrm).join(', ')}`);
  const sAmr = await search('amrita');
  assert.ok(names(sAmr).some((n) => /AMR/.test(n)) && !names(sAmr).some((n) => /SRM/.test(n)), `search AMR: ${names(sAmr).join(', ')}`);
});
