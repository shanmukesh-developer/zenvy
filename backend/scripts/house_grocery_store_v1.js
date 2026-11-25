// ZenWe Grocery, ZenWe's own house grocery store (owner, 26 Nov 2026: "ZenWe's own Grocery store ... products only
// the admin adds, like Blinkit / BigBasket"), created once (GlobalConfig HOUSE_GROCERY_STORE_V1_DONE) when no store
// with isHouseStore exists: vendorType GROCERY, active, online orders (not offline-marked), every college, grocery
// delivery timing, 6 AM – 11 PM, no partner login (its orders go straight to ZenWe riders: utils/houseGrocery).
// Its products and categories are added from Admin > Grocery store. After the marker it never runs again, so a store
// the admins delete later is not brought back (Admin > Grocery store can set it up again).
// DISABLE_HOUSE_GROCERY_STORE_ONCE=true switches it off.
const MARKER = 'HOUSE_GROCERY_STORE_V1_DONE';

const runHouseGroceryStoreOnce = async () => {
  if (String(process.env.DISABLE_HOUSE_GROCERY_STORE_ONCE || '').toLowerCase() === 'true') return { skipped: 'disabled' };
  const { getSequelize } = require('../config/db');
  const sequelize = getSequelize();
  const GlobalConfig = sequelize && sequelize.models && sequelize.models.GlobalConfig;
  if (!GlobalConfig || !sequelize.models.Restaurant) return { skipped: 'models not ready' };
  if (await GlobalConfig.findOne({ where: { key: MARKER } })) return { skipped: 'already done' };

  const { ensureHouseStore } = require('../utils/houseGrocery');
  const { store, created } = await ensureHouseStore();
  const out = { storeId: store.id, created };
  try {
    await GlobalConfig.create({ key: MARKER, value: { at: new Date().toISOString(), ...out }, description: 'Once: ZenWe Grocery house store (scripts/house_grocery_store_v1.js)' });
  } catch (err) { if (!(err && err.name === 'SequelizeUniqueConstraintError')) throw err; }
  if (created) {
    try { require('../controllers/adminController').clearRestaurantsCache(); } catch { /* caches expire in 30 s */ }
  }
  return out;
};

module.exports = { runHouseGroceryStoreOnce, MARKER };
