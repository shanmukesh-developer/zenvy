// ZenWe Grocery: ZenWe's own house grocery store (owner, 26 Nov 2026). One Restaurant row with vendorType 'GROCERY'
// and isHouseStore true; its products are added only by the admins (Admin > Grocery store,
// /api/admin/house-grocery/*). The customer app's Groceries tab "Grocery store" pill shows only its products.
//
// Categories (the app's category tiles) are admin-managed and kept in GlobalConfig HOUSE_GROCERY_CATEGORIES:
// [{ id, name, imageUrl, order }]. A product's category is its MenuItem.category (the category NAME), so the
// existing catalogue, search and order code read it unchanged; a rename renames the products' category too.
//
// Fulfilment: the store has no partner login (no password) and is not offline-marked. With no password it is a
// rider-purchase store (utils/riderPurchase): its orders skip store acceptance and go straight to ZenWe riders, who
// pick the items up from ZenWe's own store room and deliver them in the grocery delivery window
// (utils/deliveryGroups 'grocery'). Like every rider-purchase store its orders are cash on delivery.
const crypto = require('crypto');

const CONFIG_KEY = 'HOUSE_GROCERY_CATEGORIES';
const STORE_NAME = 'ZenWe Grocery';
const MAX_CATEGORIES = 60;

const models = () => {
  const sequelize = require('../config/db').getSequelize();
  return (sequelize && sequelize.models) || {};
};

/** The house store row (oldest when several), or null. */
const findHouseStore = async (opts = {}) => {
  const { Restaurant } = models();
  if (!Restaurant) return null;
  return Restaurant.findOne({ where: { isHouseStore: true }, order: [['createdAt', 'ASC']], ...opts });
};

/** Default row for the house store: active, online orders, every college, grocery timing, 6 AM – 11 PM. */
const houseStoreDefaults = () => ({
  name: STORE_NAME,
  location: 'ZenWe store room, campus',
  vendorType: 'GROCERY',
  isHouseStore: true,
  shopSection: null,
  isActive: true,
  isOffline: false,
  isOpenNow: true,
  // No partner login: nobody accepts in a partner app; orders go straight to ZenWe riders (utils/riderPurchase).
  password: null,
  phone: null,
  visibleCampuses: [],
  deliveryGroup: 'grocery',
  operatingHours: { start: '06:00', end: '23:00' },
  stallDescription: "ZenWe's own grocery store: daily essentials, picked and delivered by ZenWe riders.",
  tags: ['groceries', 'essentials'],
  commissionRate: 0,
  commissionType: 'percentage',
  packagingFee: 0,
  minOrderValue: 0,
});

/** The house store, created when missing. → { store, created }. */
const ensureHouseStore = async () => {
  const { Restaurant } = models();
  if (!Restaurant) throw new Error('models not ready');
  const existing = await findHouseStore();
  if (existing) return { store: existing, created: false };
  // Store names are unique (partner sign-in): an ordinary store already called "ZenWe Grocery" keeps its name.
  const { fn, col, where: sqlWhere } = require('sequelize');
  const clash = await Restaurant.findOne({ where: sqlWhere(fn('lower', col('name')), STORE_NAME.toLowerCase()), attributes: ['id'] });
  const store = await Restaurant.create({ ...houseStoreDefaults(), ...(clash ? { name: `${STORE_NAME} Store` } : {}) });
  return { store, created: true };
};

const decode = (raw) => {
  let v = raw;
  for (let i = 0; i < 3 && typeof v === 'string'; i++) { try { v = JSON.parse(v); } catch { return []; } }
  return Array.isArray(v) ? v : [];
};

const cleanCategory = (c, i) => {
  if (!c || typeof c !== 'object') return null;
  const name = String(c.name || '').trim();
  if (!name) return null;
  return {
    id: /^[a-z0-9-]{4,64}$/i.test(String(c.id || '')) ? String(c.id) : crypto.randomUUID(),
    name: name.slice(0, 60),
    imageUrl: typeof c.imageUrl === 'string' && c.imageUrl.trim() ? c.imageUrl.trim() : null,
    order: Number.isFinite(Number(c.order)) ? Number(c.order) : i,
  };
};

/** The admin's categories in their order: [{ id, name, imageUrl, order }]. */
const readCategories = async () => {
  const { GlobalConfig } = models();
  if (!GlobalConfig) return [];
  const row = await GlobalConfig.findOne({ where: { key: CONFIG_KEY } });
  return decode(row && row.value).map(cleanCategory).filter(Boolean)
    .sort((a, b) => a.order - b.order)
    .map((c, i) => ({ ...c, order: i }));
};

/** Save the list (renumbered in the given order). */
const writeCategories = async (list) => {
  const { GlobalConfig } = models();
  const value = list.map((c, i) => ({ id: c.id, name: c.name, imageUrl: c.imageUrl || null, order: i }));
  const row = await GlobalConfig.findOne({ where: { key: CONFIG_KEY } });
  if (row) await row.update({ value });
  else await GlobalConfig.create({ key: CONFIG_KEY, value, description: 'ZenWe Grocery categories (utils/houseGrocery)' });
  return value;
};

module.exports = { CONFIG_KEY, STORE_NAME, MAX_CATEGORIES, findHouseStore, ensureHouseStore, houseStoreDefaults, readCategories, writeCategories };
