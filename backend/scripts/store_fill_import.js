// Store fills (runs on startup from server.js, idempotent): photos, descriptions and categories for stores the owner
// added BY HAND in the admin dashboard, whose dishes came in with no photo, text or category.
//
// Owner, 14 Nov 2026: "work on star resturent which description and images are not there", "and sri balaji home
// foods also and categorize them in snacks". scripts/owner_menu_import.js only fills stores it created itself, so
// these stores get their own file: data/store-fills/<store>-v1-<date>.json with photos in data/store-fills/images/.
// Same photo and text rules as the owner menus (data/owner-menus/README.md): real licensed photos only, credits in
// sources.json, facts only.
// Rules:
//  - the store is found by its id AND its name (a renamed or deleted store is left alone);
//  - a dish is found by its name (case and spaces ignored) in that store; a dish the file does not know is left alone;
//  - each field (photo, description, category, the store's description) is filled ONLY while it is empty, and at
//    most once (CatalogueImportLedger key per field): a photo, text or category the admin set or cleared is never
//    touched again;
//  - nothing is filled unless the whole file is valid (every listed photo present and a real JPEG / PNG / WEBP).
// DISABLE_STORE_FILLS=true switches it off.
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data', 'store-fills');
const KIND = 'store-fill';

const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const empty = (v) => v === null || v === undefined || String(v).trim() === '';

const loadFills = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [])
  .map((f) => ({ file: f, data: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));

/** Problems that stop a fill file (an incomplete file never half-fills a store). */
const fillProblems = (data, dir) => {
  const out = [];
  if (!data || !data.key || !data.storeId || !data.storeName || !data.imagesDir) out.push('key / storeId / storeName / imagesDir missing');
  const imgDir = path.join(dir, String((data && data.imagesDir) || ''));
  const names = new Set();
  for (const it of (data && data.items) || []) {
    if (!it || empty(it.name)) { out.push('item without name'); continue; }
    if (names.has(norm(it.name))) out.push(`duplicate item ${it.name}`);
    names.add(norm(it.name));
    if (it.image !== undefined && it.image !== null) {
      const p = path.join(imgDir, String(it.image));
      if (!fs.existsSync(p)) { out.push(`${it.name}: photo missing: ${it.image}`); continue; }
      const head = fs.readFileSync(p).subarray(0, 12);
      const ok = (head[0] === 0xff && head[1] === 0xd8) || head.subarray(0, 4).toString('hex') === '89504e47' || head.subarray(8, 12).toString() === 'WEBP';
      if (!ok) out.push(`${it.name}: not a JPEG / PNG / WEBP photo: ${it.image}`);
    }
    if (it.category !== undefined && empty(it.category)) out.push(`${it.name}: empty category`);
  }
  if (!names.size) out.push('no items');
  return out;
};

const runStoreFillImport = async ({ dataDir = DATA_DIR } = {}) => {
  if (String(process.env.DISABLE_STORE_FILLS || '').toLowerCase() === 'true') return { skipped: 'disabled' };
  const { getRestaurantModel } = require('../models/Restaurant');
  const { getMenuItemModel } = require('../models/MenuItem');
  const { getCatalogueImportLedgerModel } = require('../models/CatalogueImportLedger');
  const Restaurant = getRestaurantModel();
  const MenuItem = getMenuItemModel();
  const Ledger = getCatalogueImportLedgerModel();
  if (!Restaurant || !MenuItem || !Ledger) return { skipped: 'models not ready' };
  const fills = loadFills(dataDir);
  if (!fills.length) return { skipped: 'no store fills' };
  const { saveImageBytes } = require('../utils/imageStore');
  const { apiUrl } = require('../utils/publicUrl');

  const result = { files: fills.length, photos: 0, texts: 0, categories: 0, storeTexts: 0, storeMissing: 0, unknownDishes: 0, invalid: [] };
  for (const { file, data } of fills) {
    const problems = fillProblems(data, dataDir);
    if (problems.length) { result.invalid.push({ file, problems: problems.slice(0, 5) }); continue; }
    const store = await Restaurant.findByPk(data.storeId, { attributes: ['id', 'name', 'stallDescription'] });
    if (!store || norm(store.name) !== norm(data.storeName)) { result.storeMissing++; continue; }

    const keys = [`${data.key}:store-text`, ...data.items.flatMap((it) => ['image', 'text', 'category'].map((f) => `${data.key}:${norm(it.name)}:${f}`))];
    const done = new Set((await Ledger.findAll({ where: { importKey: keys }, attributes: ['importKey'] })).map((r) => r.importKey));
    // The ledger row is written first: two instances starting together never both fill a field.
    const claim = async (importKey, targetId, name) => {
      if (done.has(importKey)) return false;
      try {
        await Ledger.create({ importKey, kind: KIND, targetId, storeKey: data.key, name: String(name || '').slice(0, 250) });
        done.add(importKey);
        return true;
      } catch (err) {
        if (err && err.name === 'SequelizeUniqueConstraintError') { done.add(importKey); return false; }
        throw err;
      }
    };

    if (!empty(data.storeDescription) && empty(store.stallDescription) && await claim(`${data.key}:store-text`, store.id, store.name)) {
      await Restaurant.update({ stallDescription: data.storeDescription }, { where: { id: store.id } });
      result.storeTexts++;
    }

    const rows = await MenuItem.findAll({ where: { restaurantId: store.id }, attributes: ['id', 'name', 'imageUrl', 'description', 'category'] });
    const byName = new Map();
    for (const r of rows) if (!byName.has(norm(r.name))) byName.set(norm(r.name), r);
    for (const it of data.items) {
      const row = byName.get(norm(it.name));
      if (!row) { result.unknownDishes++; continue; }
      const k = (f) => `${data.key}:${norm(it.name)}:${f}`;
      const patch = {};
      if (it.image && empty(row.imageUrl) && await claim(k('image'), row.id, row.name)) {
        const saved = await saveImageBytes(fs.readFileSync(path.join(dataDir, data.imagesDir, it.image)), { purpose: 'menu' });
        patch.imageUrl = apiUrl(null, `/api/campus/media/${saved.id}`, { renderFallback: true });
        result.photos++;
      }
      if (!empty(it.description) && empty(row.description) && await claim(k('text'), row.id, row.name)) { patch.description = it.description; result.texts++; }
      if (!empty(it.category) && empty(row.category) && await claim(k('category'), row.id, row.name)) { patch.category = it.category; result.categories++; }
      if (Object.keys(patch).length) await MenuItem.update(patch, { where: { id: row.id } });
    }
  }
  if (result.photos || result.texts || result.categories || result.storeTexts) {
    try { require('../controllers/adminController').clearRestaurantsCache(); } catch { /* cache just expires */ }
  }
  return result;
};

module.exports = { runStoreFillImport, fillProblems, loadFills, DATA_DIR };

// CLI: node scripts/store_fill_import.js  (uses the same DATABASE_URL as the server)
if (require.main === module) {
  require('dotenv').config();
  (async () => {
    const { connectDB } = require('../config/db');
    await connectDB();
    console.log('[STORE_FILLS]', await runStoreFillImport());
    process.exit(0);
  })().catch((err) => { console.error('[STORE_FILLS_FAILED]', err); process.exit(1); });
}
