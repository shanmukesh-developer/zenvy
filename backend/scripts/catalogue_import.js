// Catalogue import (runs on every startup from server.js, idempotent).
//
// Creates the stores (Restaurant rows with a non-food vendorType) and products (MenuItem rows)
// listed in data/catalogue_seed.json — the items the customer app used to hardcode.
// Every created row is recorded in CatalogueImportLedger by a stable importKey, and a key that is
// already in the ledger is never touched again. So once imported, the admin dashboard owns the
// data: edits are never overwritten and deleted rows are never re-created.
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const SEED_PATH = path.join(__dirname, '..', 'data', 'catalogue_seed.json');

let legacyIndex = null; // Map<legacyId, Array<{ targetId, name }>>

const loadSeed = () => {
  if (!fs.existsSync(SEED_PATH)) return null;
  return JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
};

const runCatalogueImport = async () => {
  const { getSequelize } = require('../config/db');
  const { getRestaurantModel } = require('../models/Restaurant');
  const { getMenuItemModel } = require('../models/MenuItem');
  const { getCatalogueImportLedgerModel } = require('../models/CatalogueImportLedger');
  const sequelize = getSequelize();
  const Restaurant = getRestaurantModel();
  const MenuItem = getMenuItemModel();
  const Ledger = getCatalogueImportLedgerModel();
  if (!sequelize || !Restaurant || !MenuItem || !Ledger) return { skipped: 'models not ready' };

  const seed = loadSeed();
  if (!seed) return { skipped: 'no catalogue_seed.json' };
  const defaults = seed.defaults || {};

  const ledgerRows = await Ledger.findAll({ attributes: ['importKey', 'targetId'] });
  const done = new Map(ledgerRows.map(r => [r.importKey, r.targetId]));
  let storesCreated = 0;
  let itemsCreated = 0;

  // Creates the ledger row first (unique importKey) and the entity in the same transaction,
  // so two instances booting at once can never both create the same entry.
  const createOnce = async (importKey, kind, extra, createEntity) => {
    const targetId = crypto.randomUUID();
    try {
      await sequelize.transaction(async (t) => {
        await Ledger.create({ importKey, kind, targetId, ...extra }, { transaction: t });
        await createEntity(targetId, t);
      });
      done.set(importKey, targetId);
      return targetId;
    } catch (err) {
      if (err && err.name === 'SequelizeUniqueConstraintError') {
        const row = await Ledger.findOne({ where: { importKey } });
        if (row) done.set(importKey, row.targetId);
        return null;
      }
      throw err;
    }
  };

  for (const store of seed.stores || []) {
    let storeId = done.get(store.key);
    if (!storeId) {
      storeId = await createOnce(store.key, 'store', { storeKey: store.key, name: store.name }, (id, t) => Restaurant.create({
        id,
        name: store.name,
        location: store.location || defaults.location || 'SRM AP Campus',
        ...(Number.isFinite(Number(store.lat)) && store.lat !== null ? { lat: Number(store.lat) } : {}),
        ...(Number.isFinite(Number(store.lon)) && store.lon !== null ? { lon: Number(store.lon) } : {}),
        // Shop contact for riders (never the partner login phone: these shops have no app login).
        ...(store.whatsappNumber ? { whatsappNumber: String(store.whatsappNumber) } : {}),
        zone: defaults.zone || 'Amaravathi_Central',
        campus: store.campus || defaults.campus || null,
        imageUrl: store.imageUrl || null,
        vendorType: store.vendorType,
        rating: 0, // no invented ratings: real ratings come from orders
        deliveryTime: null,
        tags: store.tags || [],
        stallDescription: store.description || null,
        ...(store.operatingHours ? { operatingHours: store.operatingHours } : {}),
        isActive: store.isActive !== false,
        isOpenNow: true,
        // These stores have no vendor app: orders go straight to riders (existing offline-shop flow).
        isOffline: true
      }, { transaction: t }));
      if (storeId) storesCreated++;
      else storeId = done.get(store.key);
    }
    if (!storeId) continue;

    // The owner deleted this store in the admin dashboard → never re-create its products.
    const storeExists = await Restaurant.count({ where: { id: storeId } });
    if (!storeExists) continue;

    for (const item of store.items || []) {
      if (done.has(item.key)) continue;
      const created = await createOnce(item.key, 'item', { storeKey: store.key, name: item.name, legacyIds: item.legacyIds || [] }, (id, t) => MenuItem.create({
        id,
        restaurantId: storeId,
        name: item.name,
        price: item.price,
        description: item.description || null,
        imageUrl: item.imageUrl || null,
        category: item.category || null,
        tags: item.brand ? [item.brand] : [],
        isVegetarian: item.isVegetarian !== false,
        isAvailable: true,
        specs: {
          catalogueKey: item.key,
          ...(item.originalPrice ? { originalPrice: item.originalPrice } : {}),
          ...(item.weight ? { weight: item.weight } : {}),
          ...(item.brand ? { brand: item.brand } : {}),
          ...(item.emoji ? { emoji: item.emoji } : {}),
          ...(item.extraFor ? { extraFor: item.extraFor } : {}),
          ...(item.priceApprox ? { priceApprox: true } : {}),
          ...(store.bookingOnly ? { bookingOnly: true } : {})
        }
      }, { transaction: t }));
      if (created) itemsCreated++;
    }
  }

  legacyIndex = null; // rebuild on next lookup
  if (storesCreated || itemsCreated) {
    try { require('../controllers/adminController').clearRestaurantsCache(); } catch { /* cache not loaded yet */ }
  }
  return { storesCreated, itemsCreated };
};

// Old app builds send hardcoded ids ('groc-1', 'extra-candles', …). Map them to the imported
// MenuItem ids. The same old id was reused for different products in different screens, so an
// ambiguous id is resolved by the product name the app sends with it, or not at all.
const resolveLegacyItemId = async (legacyId, name) => {
  if (!legacyId || typeof legacyId !== 'string') return null;
  if (!legacyIndex) {
    const { getCatalogueImportLedgerModel } = require('../models/CatalogueImportLedger');
    const Ledger = getCatalogueImportLedgerModel();
    if (!Ledger) return null;
    const rows = await Ledger.findAll({ where: { kind: 'item' }, attributes: ['targetId', 'name', 'legacyIds'] });
    const index = new Map();
    for (const r of rows) {
      for (const lid of r.legacyIds || []) {
        if (!index.has(lid)) index.set(lid, []);
        index.get(lid).push({ targetId: r.targetId, name: r.name });
      }
    }
    legacyIndex = index;
  }
  const candidates = legacyIndex.get(legacyId) || [];
  if (candidates.length === 1) return candidates[0].targetId;
  if (candidates.length > 1 && name) {
    const n = String(name).trim().toLowerCase();
    const match = candidates.filter(c => (c.name || '').trim().toLowerCase() === n);
    if (match.length === 1) return match[0].targetId;
  }
  return null;
};

module.exports = { runCatalogueImport, resolveLegacyItemId };

// CLI: node scripts/catalogue_import.js  (uses the same DATABASE_URL as the server)
if (require.main === module) {
  require('dotenv').config();
  (async () => {
    const { connectDB } = require('../config/db');
    await connectDB();
    const result = await runCatalogueImport();
    console.log('[CATALOGUE_IMPORT]', result);
    process.exit(0);
  })().catch((err) => { console.error('[CATALOGUE_IMPORT_FAILED]', err); process.exit(1); });
}
