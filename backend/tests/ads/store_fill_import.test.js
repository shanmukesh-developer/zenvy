// scripts/store_fill_import.js on a temp SQLite DB with a temp folder: a store the owner added by hand gets photos,
// descriptions and categories only where they are empty; a field the admin set is never touched; each field is filled
// at most once (a photo the admin later removes stays removed); a renamed store, an unknown dish or an invalid file
// changes nothing; DISABLE_STORE_FILLS switches it off.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const H = require('./helpers');

const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const photo = (tag) => Buffer.concat([JPEG, Buffer.from(`zcs-fill-${tag}`)]);

let ctx;
let dir;
let store;
const write = (name, data, photos = {}) => {
  const imgDir = path.join(dir, data.imagesDir);
  fs.mkdirSync(imgDir, { recursive: true });
  for (const [file, buf] of Object.entries(photos)) fs.writeFileSync(path.join(imgDir, file), buf);
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data));
};
const fill = (over = {}) => ({
  version: 1,
  key: 'store-fill:hand-made',
  storeId: store.id,
  storeName: 'Hand Made Biryani',
  imagesDir: 'images/hand-made',
  storeDescription: 'Biryanis and starters.',
  items: [
    { name: 'chicken  65 ', image: 'chicken-65.jpg', description: 'Fried chicken.', category: 'Starters' },
    { name: 'Veg Biryani', image: 'veg-biryani.jpg', description: 'Veg biryani.', category: 'Biryanis' },
    { name: 'Gavvalu', image: null, description: 'Shell-shaped sweet.', category: 'Sweets' },
    { name: 'Not On The Menu', image: null, description: 'x' },
  ],
  ...over,
});

before(async () => {
  ctx = await H.setup();
  H.r('models/CatalogueImportLedger').initCatalogueImportLedgerModel(ctx.sequelize);
  await ctx.M('CatalogueImportLedger').sync();
  dir = path.join(os.tmpdir(), `store-fills-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
  fs.mkdirSync(dir, { recursive: true });
  store = await ctx.M('Restaurant').create({ name: 'Hand Made Biryani', location: 'Mangalagiri', vendorType: 'RESTAURANT', operatingHours: { start: '11:00', end: '23:00' } });
  const MI = ctx.M('MenuItem');
  await MI.create({ restaurantId: store.id, name: 'Chicken 65', price: 350, dietType: 'nonveg', isVegetarian: false });
  await MI.create({ restaurantId: store.id, name: 'Veg Biryani', price: 240, dietType: 'veg', isVegetarian: true, imageUrl: 'https://admin.example/own.jpg', description: 'Written by the owner.' });
  await MI.create({ restaurantId: store.id, name: 'Gavvalu', price: 45, dietType: 'veg', isVegetarian: true, category: 'Snacks' });
});
after(async () => {
  delete process.env.DISABLE_STORE_FILLS;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* gone */ }
  await H.teardown();
});

const item = (name) => ctx.M('MenuItem').findOne({ where: { restaurantId: store.id, name } });

test('fillProblems: missing / non-image photos, duplicate dishes and an empty category are caught', () => {
  const { fillProblems } = H.r('scripts/store_fill_import');
  const d = fill({ imagesDir: 'images/problems' });
  write('p.json', d, { 'chicken-65.jpg': Buffer.from('not an image') });
  const p = fillProblems({ ...d, items: [...d.items, { name: 'CHICKEN 65', category: '' }] }, dir);
  assert.ok(p.some((x) => /not a JPEG/.test(x)), p.join(' | '));
  assert.ok(p.some((x) => /photo missing: veg-biryani.jpg/.test(x)));
  assert.ok(p.some((x) => /duplicate item/.test(x)));
  assert.ok(p.some((x) => /empty category/.test(x)));
  fs.unlinkSync(path.join(dir, 'p.json'));
});

test('an invalid file fills nothing; a complete one fills only empty fields, with photos in the media store', async () => {
  const { runStoreFillImport } = H.r('scripts/store_fill_import');
  write('hand.json', fill(), { 'chicken-65.jpg': photo('c65') }); // veg-biryani.jpg missing
  let r = await runStoreFillImport({ dataDir: dir });
  assert.strictEqual(r.invalid.length, 1, JSON.stringify(r));
  assert.strictEqual((await item('Chicken 65')).imageUrl, null, 'an incomplete file changes nothing');

  fs.writeFileSync(path.join(dir, 'images/hand-made/veg-biryani.jpg'), photo('veg'));
  r = await runStoreFillImport({ dataDir: dir });
  assert.deepStrictEqual([r.photos, r.texts, r.categories, r.storeTexts, r.unknownDishes, r.invalid.length], [1, 2, 2, 1, 1, 0], JSON.stringify(r));
  const c65 = await item('Chicken 65');
  assert.match(c65.imageUrl, /\/api\/campus\/media\/[0-9a-f-]{36}$/, 'saved in the media store, matched by name ignoring case and spaces');
  assert.deepStrictEqual([c65.description, c65.category], ['Fried chicken.', 'Starters']);
  const veg = await item('Veg Biryani');
  assert.deepStrictEqual([veg.imageUrl, veg.description, veg.category], ['https://admin.example/own.jpg', 'Written by the owner.', 'Biryanis'], 'owner photo and text kept; empty category filled');
  const gav = await item('Gavvalu');
  assert.deepStrictEqual([gav.imageUrl, gav.description, gav.category], [null, 'Shell-shaped sweet.', 'Snacks'], 'the admin category is kept');
  assert.strictEqual((await ctx.M('Restaurant').findByPk(store.id)).stallDescription, 'Biryanis and starters.');
});

test('each field is filled once: what the admin later clears stays cleared; rerun changes nothing', async () => {
  const { runStoreFillImport } = H.r('scripts/store_fill_import');
  await ctx.M('MenuItem').update({ imageUrl: null, description: null }, { where: { restaurantId: store.id, name: 'Chicken 65' } });
  const r = await runStoreFillImport({ dataDir: dir });
  assert.deepStrictEqual([r.photos, r.texts, r.categories, r.storeTexts], [0, 0, 0, 0], JSON.stringify(r));
  const c65 = await item('Chicken 65');
  assert.deepStrictEqual([c65.imageUrl, c65.description], [null, null]);
});

test('a renamed store is left alone; DISABLE_STORE_FILLS switches it off', async () => {
  const { runStoreFillImport } = H.r('scripts/store_fill_import');
  await ctx.M('Restaurant').update({ name: 'Someone Else' }, { where: { id: store.id } });
  write('other.json', fill({ key: 'store-fill:other', items: [{ name: 'Gavvalu', description: 'x' }] }));
  const r = await runStoreFillImport({ dataDir: dir });
  assert.strictEqual(r.storeMissing, 2);
  process.env.DISABLE_STORE_FILLS = 'true';
  assert.deepStrictEqual(await runStoreFillImport({ dataDir: dir }), { skipped: 'disabled' });
});

test('categoryRenames moves dishes still under the old category, once; an admin change is kept', async () => {
  const { runStoreFillImport, fillProblems } = H.r('scripts/store_fill_import');
  delete process.env.DISABLE_STORE_FILLS;
  assert.ok(fillProblems(fill({ categoryRenames: { Starters: '' } }), dir).some((x) => /categoryRenames/.test(x)));
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) fs.unlinkSync(path.join(dir, f));
  const s2 = await ctx.M('Restaurant').create({ name: 'Snack Shop', location: 'Mangalagiri', vendorType: 'GROCERY', operatingHours: { start: '09:00', end: '21:00' } });
  const MI = ctx.M('MenuItem');
  await MI.create({ restaurantId: s2.id, name: 'Mixture', price: 60, dietType: 'veg', isVegetarian: true, category: 'Namkeen & Snacks' });
  await MI.create({ restaurantId: s2.id, name: 'Chekkalu', price: 60, dietType: 'veg', isVegetarian: true }); // filled, then renamed in the same run
  await MI.create({ restaurantId: s2.id, name: 'Laddu', price: 80, dietType: 'veg', isVegetarian: true, category: 'Sweets' });
  write('snack.json', { version: 1, key: 'store-fill:snack', storeId: s2.id, storeName: 'Snack Shop', imagesDir: 'images/snack', categoryRenames: { 'Namkeen & Snacks': 'Snacks' }, items: [{ name: 'Chekkalu', category: 'Namkeen & Snacks' }] });
  const get = (n) => MI.findOne({ where: { restaurantId: s2.id, name: n } });
  let r = await runStoreFillImport({ dataDir: dir });
  assert.strictEqual(r.renamed, 2, JSON.stringify(r));
  assert.deepStrictEqual([(await get('Mixture')).category, (await get('Chekkalu')).category, (await get('Laddu')).category], ['Snacks', 'Snacks', 'Sweets']);
  await MI.update({ category: 'Namkeen & Snacks' }, { where: { restaurantId: s2.id, name: 'Mixture' } }); // the admin moves it back
  r = await runStoreFillImport({ dataDir: dir });
  assert.strictEqual(r.renamed, 0, JSON.stringify(r));
  assert.strictEqual((await get('Mixture')).category, 'Namkeen & Snacks', 'renamed once only');
});
