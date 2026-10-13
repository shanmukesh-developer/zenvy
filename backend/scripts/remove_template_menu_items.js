// Idempotent startup cleanup of the template dishes that a deleted bulk-seed script
// (seed_maximum_items_expansion.js) copied into every store: "Special Hyderabadi Dum Biryani (Amma)",
// "Choco Lava Cake (Dhaba)" and so on. They made every restaurant show the same menu.
// Each matching row is first copied into "MenuItemsTemplateBackup" (restorable with
// INSERT INTO "MenuItems" SELECT * FROM "MenuItemsTemplateBackup"), then removed from "MenuItems".
// A row only matches when its name is a template name followed by " (" — real dishes never are.
// Set DISABLE_TEMPLATE_MENU_CLEANUP=true to switch this off.
const TEMPLATE_NAMES = [
  'Special Hyderabadi Dum Biryani',
  'Double Cheese Margherita Pizza',
  'Crispy Chicken Zinger Burger',
  'Ghee Roast Masala Dosa',
  'Veg Schezwan Hakka Noodles',
  'Steamed Chicken Momos (8 pcs)',
  'Kolkata Egg Chicken Roll',
  'Butter Chicken & Garlic Naan Combo',
  'Choco Lava Cake',
  'Fresh Mint Lime Cooler',
  'High-Protein Chicken Breast Bowl',
  'Salmon Quinoa Superfood Bowl',
  'Vegan Tofu Scramble Power Bowl',
];

const runTemplateMenuCleanup = async () => {
  if (String(process.env.DISABLE_TEMPLATE_MENU_CLEANUP || '').toLowerCase() === 'true') return { skipped: true };
  const { getMenuItemModel } = require('../models/MenuItem');
  const MenuItem = getMenuItemModel && getMenuItemModel();
  if (!MenuItem) return { skipped: true };
  const sequelize = MenuItem.sequelize;
  // Both Postgres and SQLite accept double-quoted identifiers.
  const tableName = MenuItem.getTableName();
  const table = `"${typeof tableName === 'string' ? tableName : tableName.tableName}"`;
  const backup = '"MenuItemsTemplateBackup"';
  const name = '"name"';
  const id = '"id"';

  // LIKE treats "_" and "%" specially; none of the template names contain them, "(" and ")" are literal.
  const where = TEMPLATE_NAMES.map((_, i) => `${name} LIKE :p${i}`).join(' OR ');
  const replacements = Object.fromEntries(TEMPLATE_NAMES.map((n, i) => [`p${i}`, `${n} (%`]));

  const [rows] = await sequelize.query(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, { replacements });
  const found = Number(rows?.[0]?.n || 0);
  if (!found) return { removed: 0 };

  await sequelize.transaction(async (transaction) => {
    await sequelize.query(`CREATE TABLE IF NOT EXISTS ${backup} AS SELECT * FROM ${table} WHERE 1 = 0`, { transaction });
    await sequelize.query(
      `INSERT INTO ${backup} SELECT * FROM ${table} WHERE (${where}) AND ${id} NOT IN (SELECT ${id} FROM ${backup})`,
      { replacements, transaction }
    );
    await sequelize.query(`DELETE FROM ${table} WHERE ${where}`, { replacements, transaction });
  });

  try { require('../controllers/adminController').clearRestaurantsCache(); } catch { /* cache just expires */ }
  return { removed: found };
};

module.exports = { runTemplateMenuCleanup, TEMPLATE_NAMES };
