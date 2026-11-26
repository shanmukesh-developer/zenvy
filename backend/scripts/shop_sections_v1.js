// Groceries tab sections saved on the existing shops, once (GlobalConfig SHOP_SECTIONS_V1_DONE). Owner, 26 Nov 2026:
// the admin store editor now adds shops as "Snacks" or "Fruits & pickles" instead of "Grocery / Kirana", and the
// shops already listed must stay in their sections. Every shop with no shopSection whose section can be read from its
// name / tags (utils/shopSections inferredSection: snack -> snacks; fruit, juice or pickle -> fruits_pickles) gets it
// saved, so the store editor shows the right tile. Only Grocery shops: restaurants, campus stalls, bakeries, other
// shop types, the house store and shops with a section already set are never touched. Updates and the marker in one transaction. DISABLE_SHOP_SECTIONS_ONCE=true skips it.
const MARKER = 'SHOP_SECTIONS_V1_DONE';

const runShopSectionsOnce = async () => {
  if (String(process.env.DISABLE_SHOP_SECTIONS_ONCE || '').toLowerCase() === 'true') return { skipped: 'disabled' };
  const { getSequelize } = require('../config/db');
  const sequelize = getSequelize();
  const GlobalConfig = sequelize && sequelize.models && sequelize.models.GlobalConfig;
  if (!GlobalConfig) return { skipped: 'models not ready' };
  if (await GlobalConfig.findOne({ where: { key: MARKER } })) return { skipped: 'already done' };
  const Restaurant = require('../models/Restaurant').getRestaurantModel();
  const { sectionOf, cleanSection } = require('../utils/shopSections');

  const saved = [];
  await sequelize.transaction(async (t) => {
    if (await GlobalConfig.findOne({ where: { key: MARKER }, transaction: t })) return;
    const stores = await Restaurant.findAll({ attributes: ['id', 'name', 'vendorType', 'tags', 'shopSection', 'isHouseStore'], transaction: t });
    for (const s of stores) {
      if (cleanSection(s.shopSection)) continue;
      if (String(s.vendorType || '').toUpperCase() !== 'GROCERY') continue;
      const sec = sectionOf(s);
      if (!sec) continue;
      await Restaurant.update({ shopSection: sec }, { where: { id: s.id }, transaction: t, hooks: false });
      saved.push(`${s.name} -> ${sec}`);
    }
    await GlobalConfig.create({
      key: MARKER,
      value: { at: new Date().toISOString(), saved },
      description: 'Once: Groceries tab sections saved on existing shops (scripts/shop_sections_v1.js)',
    }, { transaction: t });
  });
  return { saved };
};

module.exports = { runShopSectionsOnce, MARKER };
