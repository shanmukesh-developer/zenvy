// Home slideshow (owner, 24-25 Nov 2026): admin-picked dishes per diet (GlobalConfig HOME_SLIDESHOW), per-dish slideshow
// image / round-photo / redo cut-out, the store list's new summary fields, and the cut-out worker (utils/cutoutQueue)
// with a stubbed model (the real ONNX model never runs in tests).
// Auto cut-outs are OFF unless CUTOUTS=on (owner, 25 Nov 2026); these tests switch them on, and the last one checks
// that by default nothing runs and no cut-out reaches the app.
process.env.CUTOUTS = 'on';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');
const M = (n) => H.ctx.M(n);

// 1x1 PNG / WebP-ish bytes the stubs hand around (sniffImage only checks the header).
const PNG_1PX = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8cf500f0004fe01fe2e7d1f1b0000000049454e44ae426082', 'hex');
const WEBP_HDR = Buffer.concat([Buffer.from('RIFF'), Buffer.from([30, 0, 0, 0]), Buffer.from('WEBPVP8L'), Buffer.alloc(22, 1)]);

let admin;
let student;
test.before(async () => {
  const ctx = await H.setup();
  // Media rows (custom images, cut-outs) live in CampusMedia.
  const cm = H.r('modules/campus/models/CampusMedia');
  if (!cm.getCampusMediaModel()) cm.initCampusMediaModel(ctx.sequelize);
  await ctx.sequelize.sync();
  admin = await H.mkUser({ role: 'admin' });
  student = await H.mkUser();
});
test.after(async () => { await H.teardown(); });

const mkDish = async (extra = {}) => {
  const { store, item } = await H.mkStore({ price: 100 });
  await item.update({ imageUrl: `https://img.example.com/${item.id}.jpg`, ...extra });
  return { store, item };
};

test('admin sets and reads HOME_SLIDESHOW; validation; public route follows', async () => {
  const a = await mkDish({ dietType: 'nonveg' });
  const b = await mkDish({ dietType: 'nonveg' });
  const v = await mkDish({ dietType: 'veg' });

  let r = await H.api('GET', '/api/admin/home-slideshow', admin.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.ids, { nonveg: [], veg: [] });

  r = await H.api('GET', '/api/config/home-slideshow');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { nonveg: [], veg: [] });

  r = await H.api('PUT', '/api/admin/home-slideshow', admin.token, { nonveg: [b.item.id, a.item.id], veg: [v.item.id] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.ids.nonveg, [b.item.id, a.item.id], 'order kept');
  assert.equal(r.body.nonveg[0].id, b.item.id);
  assert.equal(r.body.nonveg[0].storeName, b.store.name);
  assert.equal(r.body.veg[0].diet, 'veg');

  r = await H.api('GET', '/api/config/home-slideshow');
  assert.deepEqual(r.body, { nonveg: [b.item.id, a.item.id], veg: [v.item.id] }, 'public cache cleared by the change');

  // Only one diet sent: the other is kept.
  r = await H.api('PUT', '/api/admin/home-slideshow', admin.token, { veg: [] });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.ids, { nonveg: [b.item.id, a.item.id], veg: [] });

  // Refusals: too many, duplicates, unknown / missing dish, wrong shape, students.
  const five = [];
  for (let i = 0; i < 5; i++) five.push((await mkDish()).item.id);
  assert.equal((await H.api('PUT', '/api/admin/home-slideshow', admin.token, { nonveg: five })).status, 400);
  assert.equal((await H.api('PUT', '/api/admin/home-slideshow', admin.token, { nonveg: [a.item.id, a.item.id] })).status, 400);
  assert.equal((await H.api('PUT', '/api/admin/home-slideshow', admin.token, { nonveg: ['not-a-uuid'] })).status, 400);
  assert.equal((await H.api('PUT', '/api/admin/home-slideshow', admin.token, { nonveg: ['00000000-0000-4000-8000-000000000000'] })).status, 400);
  assert.equal((await H.api('PUT', '/api/admin/home-slideshow', admin.token, { nonveg: 'x' })).status, 400);
  assert.equal((await H.api('PUT', '/api/admin/home-slideshow', student.token, { nonveg: [] })).status, 403);
  assert.equal((await H.api('GET', '/api/admin/home-slideshow', student.token)).status, 403);

  const audit = await M('VerificationLog').findAll({ where: { action: 'HOME_SLIDESHOW_SET' } });
  assert.equal(audit.length, 2);

  // Search finds dishes by store name, filtered by diet.
  r = await H.api('GET', `/api/admin/home-slideshow/dishes?q=${encodeURIComponent(v.store.name)}&diet=veg`, admin.token);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.dishes.map((d) => d.id), [v.item.id]);
  r = await H.api('GET', `/api/admin/home-slideshow/dishes?q=${encodeURIComponent(v.store.name)}&diet=nonveg`, admin.token);
  assert.deepEqual(r.body.dishes, []);

  await H.api('PUT', '/api/admin/home-slideshow', admin.token, { nonveg: [], veg: [] });
});

test('per-dish slideshow image, round photo and redo: admin only, audited', async () => {
  const { item } = await mkDish();
  const url = `/api/admin/menu-items/${item.id}/slideshow`;
  assert.equal((await H.api('PUT', url, student.token, { roundPhoto: true })).status, 403);
  assert.equal((await H.api('PUT', url, admin.token, {})).status, 400, 'nothing to change');
  assert.equal((await H.api('PUT', url, admin.token, { roundPhoto: 'yes' })).status, 400);
  assert.equal((await H.api('PUT', '/api/admin/menu-items/00000000-0000-4000-8000-000000000000/slideshow', admin.token, { roundPhoto: true })).status, 404);

  let r = await H.api('PUT', url, admin.token, { slideshowImage: `data:image/png;base64,${PNG_1PX.toString('base64')}` });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.dish.slideshowImageUrl, /\/api\/campus\/media\/[0-9a-f-]{36}$/);
  assert.equal(r.body.dish.shows, 'custom');
  assert.equal(r.body.dish.showsUrl, r.body.dish.slideshowImageUrl);

  r = await H.api('PUT', url, admin.token, { slideshowImage: 'data:text/html;base64,PGgxPg==' });
  assert.equal(r.status, 415, 'not an image');

  r = await H.api('PUT', url, admin.token, { clearSlideshowImage: true, roundPhoto: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.dish.slideshowImageUrl, null);
  assert.equal(r.body.dish.slideshowRoundPhoto, true);
  assert.equal(r.body.dish.shows, 'round');

  await item.reload();
  await item.update({ cutoutUrl: 'https://x.example/c.webp', cutoutSourceUrl: item.imageUrl, cutoutStatus: 'done' });
  r = await H.api('PUT', url, admin.token, { redoCutout: true, roundPhoto: false });
  assert.equal(r.status, 200);
  assert.equal(r.body.dish.cutoutStatus, 'pending');
  await item.reload();
  assert.equal(item.cutoutStatus, 'pending');
  assert.equal(item.cutoutAt, null);

  const audit = await M('VerificationLog').findAll({ where: { action: 'MENU_ITEM_SLIDESHOW', targetId: item.id } });
  assert.equal(audit.length, 3);
});

test('summary store list carries cutoutUrl (current photo only), slideshowImageUrl, slideshowRoundPhoto', async () => {
  const { store, item } = await mkDish();
  const other = await M('MenuItem').create({ restaurantId: store.id, name: 'Plain', price: 50, isAvailable: true, imageUrl: 'https://img.example.com/plain.jpg' });
  await item.update({ cutoutUrl: 'https://x.example/cut.webp', cutoutSourceUrl: item.imageUrl, cutoutStatus: 'done', slideshowImageUrl: 'https://x.example/own.png', slideshowRoundPhoto: true });
  H.r('controllers/adminController').clearRestaurantsCache();
  const find = async () => {
    const r = await H.api('GET', '/api/users/restaurants?fields=summary');
    assert.equal(r.status, 200);
    const s = r.body.find((x) => x.id === store.id);
    return { m: s.menu.find((x) => x.id === item.id), o: s.menu.find((x) => x.id === other.id) };
  };
  let { m, o } = await find();
  assert.equal(m.cutoutUrl, 'https://x.example/cut.webp');
  assert.equal(m.slideshowImageUrl, 'https://x.example/own.png');
  assert.equal(m.slideshowRoundPhoto, true);
  assert.equal(m.cutoutSourceUrl, undefined, 'bookkeeping stays on the server');
  assert.equal(m.cutoutStatus, undefined);
  assert.equal(o.cutoutUrl, undefined);
  assert.equal(o.slideshowRoundPhoto, undefined, 'false is left out');

  // A new photo: the old cut-out is not shown any more.
  await item.update({ imageUrl: 'https://img.example.com/new.jpg' });
  H.r('controllers/adminController').clearRestaurantsCache();
  ({ m } = await find());
  assert.equal(m.cutoutUrl, undefined);
});

test('cut-out queue: makes cut-outs with a stubbed model, failures stay failed, priorities, CUTOUTS=off', async () => {
  const Q = H.r('utils/cutoutQueue');
  const MenuItem = M('MenuItem');
  // Earlier tests' dishes: mark them all done so this test sees only its own.
  for (const row of await MenuItem.findAll()) await row.update({ cutoutStatus: 'done', cutoutSourceUrl: row.imageUrl, cutoutAt: new Date() });

  const plain = (await mkDish()).item;
  const discounted = (await mkDish({ originalPrice: 150 })).item;
  const broken = (await mkDish()).item;
  await broken.update({ imageUrl: 'https://img.example.com/broken.jpg' });

  const seen = [];
  const sharp = require('sharp');
  const photo = await sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 200, g: 50, b: 50 } } }).jpeg().toBuffer();
  const fetchImpl = async (url) => {
    seen.push(url);
    return url.includes('broken') ? { ok: false, code: 'IMAGE_LINK_NOT_FOUND' } : { ok: true, buf: photo };
  };
  const make = async (buf) => {
    const meta = await sharp(buf).metadata();
    assert.ok(meta.width <= 1600);
    return { buffer: WEBP_HDR, width: 10, height: 10, coverage: 0.5 };
  };
  const logs = [];
  let r = await Q.runCutoutQueue({ make, fetchImpl, log: (m) => logs.push(m) });
  assert.deepEqual(r, { done: 2, failed: 1, lost: 0 });
  assert.equal(seen[0], discounted.imageUrl, 'a dish on discount goes first');

  await discounted.reload();
  assert.equal(discounted.cutoutStatus, 'done');
  assert.equal(discounted.cutoutSourceUrl, discounted.imageUrl);
  assert.match(discounted.cutoutUrl, /\/api\/campus\/media\/[0-9a-f-]{36}$/);
  const media = await M('CampusMedia').findByPk(discounted.cutoutUrl.split('/').pop());
  assert.equal(media.mime, 'image/webp');
  assert.equal(media.purpose, 'menu');
  await broken.reload();
  assert.equal(broken.cutoutStatus, 'failed');
  assert.ok(logs.some((l) => /IMAGE_LINK_NOT_FOUND/.test(l)));
  await plain.reload();
  assert.equal(plain.cutoutStatus, 'done');

  // Nothing left; the failed one is not retried.
  r = await Q.runCutoutQueue({ make, fetchImpl });
  assert.deepEqual(r, { done: 0, failed: 0, lost: 0 });

  // A new photo is made again; admin-picked dishes and redo requests come before the rest.
  await plain.update({ imageUrl: 'https://img.example.com/plain-2.jpg' });
  const picked = (await mkDish()).item;
  await H.api('PUT', '/api/admin/home-slideshow', admin.token, { nonveg: [picked.id] });
  H.r('utils/homeSlideshow').clearCache();
  await H.api('PUT', `/api/admin/menu-items/${broken.id}/slideshow`, admin.token, { redoCutout: true });
  seen.length = 0;
  r = await Q.runCutoutQueue({ make, fetchImpl, maxItems: 2 });
  assert.equal(r.done + r.failed, 2);
  assert.deepEqual(seen, [broken.imageUrl, picked.imageUrl], 'redo first, then the admin\'s pick');
  r = await Q.runCutoutQueue({ make, fetchImpl });
  assert.equal(r.done, 1);
  await plain.reload();
  assert.equal(plain.cutoutSourceUrl, 'https://img.example.com/plain-2.jpg');

  // A fresh claim by another run is left alone; a stale one (process died) is taken over.
  const busy = (await mkDish()).item;
  await busy.update({ cutoutStatus: 'pending', cutoutAt: new Date() });
  r = await Q.runCutoutQueue({ make, fetchImpl });
  assert.equal(r.done, 0);
  await busy.update({ cutoutAt: new Date(Date.now() - Q.STALE_MS - 1000) });
  r = await Q.runCutoutQueue({ make, fetchImpl });
  assert.equal(r.done, 1);

  // A model that gives up (null) marks the dish failed.
  const hard = (await mkDish()).item;
  r = await Q.runCutoutQueue({ make: async () => null, fetchImpl });
  assert.equal(r.failed, 1);
  await hard.reload();
  assert.equal(hard.cutoutStatus, 'failed');

  // CUTOUTS=off: nothing runs.
  await (await mkDish()).item.reload();
  process.env.CUTOUTS = 'off';
  try {
    r = await Q.runCutoutQueue({ make, fetchImpl });
    assert.equal(r.skipped, 'off');
  } finally { process.env.CUTOUTS = 'on'; }

  await H.api('PUT', '/api/admin/home-slideshow', admin.token, { nonveg: [], veg: [] });
});

test('default (CUTOUTS not set): no background cut-outs and the app gets no cut-out, only the round photo', async () => {
  const Q = H.r('utils/cutoutQueue');
  const { item } = await mkDish();
  await item.update({ cutoutUrl: 'https://x.example/old-cut.webp', cutoutSourceUrl: item.imageUrl, cutoutStatus: 'done' });
  delete process.env.CUTOUTS;
  try {
    assert.equal(Q.enabled(), false);
    assert.equal((await Q.runCutoutQueue({ make: async () => null, fetchImpl: async () => null })).skipped, 'off');
    const row = await M('MenuItem').findByPk(item.id);
    assert.equal(Q.currentCutout(row.get({ plain: true })), null);
    assert.equal(Q.slideImageOf(row.get({ plain: true })).shows, 'round');
  } finally { process.env.CUTOUTS = 'on'; }
});
