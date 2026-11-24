// App sections control (owner, 24 Nov 2026; utils/appSections, GET / PUT /api/admin/app-sections): one list of every
// app section's on/off switch, admins only, each change written to the section's own flag and audited.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

let admin;
test.before(async () => { await H.setup(); admin = await H.mkUser({ role: 'admin' }); });
test.after(async () => { await H.teardown(); });

const list = async (token = admin.token) => H.api('GET', '/api/admin/app-sections', token);
const set = (key, enabled, token = admin.token) => H.api('PUT', `/api/admin/app-sections/${key}`, token, { enabled });
const state = (body, key) => body.sections.find((s) => s.key === key).enabled;

test('lists every section with its state', async () => {
  const r = await list();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.sections.map((s) => s.key), [
    'food', 'grocery', 'bakery', 'megaBasket', 'deals', 'local',
    'pgStays', 'coRide', 'autoRide', 'rentals', 'campusEvents', 'laundry', 'techServices',
    'campus', 'whispers', 'afterDark',
  ]);
  // Grouped in the app's order: Home, Groceries tab, Local tab, Services tab, Campus.
  assert.deepEqual([...new Set(r.body.sections.map((s) => s.group))], ['Home', 'Groceries tab', 'Local tab', 'Services tab', 'Campus']);
  for (const key of ['food', 'grocery', 'bakery', 'megaBasket', 'deals', 'local', 'laundry', 'whispers', 'afterDark']) assert.equal(state(r.body, key), true, `${key} defaults on`);
  for (const s of r.body.sections) assert.ok(typeof s.label === 'string' && s.label && typeof s.description === 'string');
});

test('an admin turns sections off and on; each writes the section\'s own flag', async () => {
  for (const key of ['pgStays', 'coRide', 'autoRide', 'rentals', 'campusEvents', 'techServices', 'food', 'grocery', 'bakery', 'local', 'laundry', 'megaBasket', 'deals', 'whispers', 'afterDark']) {
    let r = await set(key, false);
    assert.equal(r.status, 200, `${key}: ${JSON.stringify(r.body)}`);
    assert.equal(r.body.section.enabled, false, key);
    assert.equal(state(r.body, key), false, key);
    r = await set(key, true);
    assert.equal(r.body.section.enabled, true, key);
  }
  assert.equal(await H.r('utils/featureSwitches').isOn('coRide', { fresh: true }), true);
  await set('rentals', false);
  assert.equal(await H.r('modules/rentals/services/eligibility').readFlag({ fresh: true }), false, 'rentals page sees the same flag');
  await set('rentals', true);
});

test('refuses students, unknown sections and a missing value', async () => {
  const student = await H.mkUser();
  assert.equal((await list(student.token)).status, 403);
  assert.equal((await set('pgStays', true, student.token)).status, 403);
  assert.equal((await set('nope', true)).status, 404);
  assert.equal((await H.api('PUT', '/api/admin/app-sections/pgStays', admin.token, { enabled: 'yes' })).status, 400);
});

test('new switches reach GET /api/config/sections (on unless switched off)', async () => {
  let r = await H.api('GET', '/api/config/sections');
  assert.equal(r.status, 200);
  for (const key of ['food', 'grocery', 'bakery', 'local', 'laundry', 'megaBasket', 'deals']) assert.equal(r.body.sections[key].on, true, key);
  assert.equal(r.body.sections.services.laundry, true);
  await set('food', false);
  await set('laundry', false);
  r = await H.api('GET', '/api/config/sections');
  assert.equal(r.body.sections.food.on, false);
  assert.equal(r.body.sections.services.laundry, false);
  assert.equal(r.body.sections.pg.on !== undefined, true, 'older fields kept');
  await set('food', true);
  await set('laundry', true);
});

test('a food quote is refused while food is off and allowed when on', async () => {
  const { item } = await H.mkStore({ price: 100 });
  const u = await H.mkUser({ wallet: 0 });
  const quote = () => H.api('POST', '/api/orders/quote', u.token, H.orderBody(item.id, 'COD'));
  let q = await quote();
  assert.equal(q.status, 200, JSON.stringify(q.body));
  await set('food', false);
  q = await quote();
  assert.equal(q.status, 400, JSON.stringify(q.body));
  assert.equal(q.body.code, 'SECTION_PAUSED');
  assert.equal(q.body.section, 'food');
  assert.match(q.body.message, /Food delivery is paused/);
  const o = await H.api('POST', '/api/orders', u.token, H.orderBody(item.id, 'COD'));
  assert.equal(o.body.code, 'SECTION_PAUSED', 'order create refused too');
  // Another section's switch does not touch food.
  await set('food', true);
  await set('grocery', false);
  q = await quote();
  assert.equal(q.status, 200, JSON.stringify(q.body));
  await set('grocery', true);
});

test('laundry booking, spins, deal claims and new shopping lists answer 403 FEATURE_OFF while paused', async () => {
  const u = await H.mkUser();
  await set('laundry', false);
  await set('deals', false);
  await set('megaBasket', false);
  try {
    const lb = await H.api('POST', '/api/services/book', u.token, { serviceType: 'LAUNDRY' });
    assert.equal(lb.status, 403, JSON.stringify(lb.body));
    assert.equal(lb.body.code, 'FEATURE_OFF');
    assert.equal(lb.body.feature, 'laundry');
    const sp = await H.api('POST', '/api/rewards/use-spin', u.token, {});
    assert.equal(sp.status, 403);
    assert.equal(sp.body.feature, 'deals');
    const mb = await H.api('POST', '/api/mega-basket', u.token, { items: [] });
    assert.equal(mb.status, 403);
    assert.equal(mb.body.feature, 'megaBasket');
    // Reading stays open.
    assert.notEqual((await H.api('GET', '/api/rewards/coupons', u.token)).status, 403);
    assert.notEqual((await H.api('GET', '/api/mega-basket', u.token)).status, 403);
  } finally {
    await set('laundry', true);
    await set('deals', true);
    await set('megaBasket', true);
  }
  const lb = await H.api('POST', '/api/services/book', u.token, { serviceType: 'LAUNDRY' });
  assert.notEqual(lb.body.code, 'FEATURE_OFF', 'laundry switch back on');
});
