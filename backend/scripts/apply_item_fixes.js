// One-time item corrections from data/item_fixes.json (correct photos, missing descriptions,
// veg flag). Runs on startup and is idempotent:
//  - each fix is applied once: the item id goes into "MenuItemFixLedger" with the old values,
//    so a later admin edit is never overwritten and the change can be undone from the ledger;
//  - a fix only applies while the item still has the same name (guard against renamed rows).
// Set DISABLE_ITEM_FIXES=true to switch this off.
const fs = require('fs');
const path = require('path');

const FIXES_PATH = path.join(__dirname, '..', 'data', 'item_fixes.json');
const FIELDS = ['imageUrl', 'description', 'isVegetarian', 'category'];

const runItemFixes = async () => {
  if (String(process.env.DISABLE_ITEM_FIXES || '').toLowerCase() === 'true') return { skipped: true };
  if (!fs.existsSync(FIXES_PATH)) return { skipped: 'no item_fixes.json' };
  const { getMenuItemModel } = require('../models/MenuItem');
  const MenuItem = getMenuItemModel && getMenuItemModel();
  if (!MenuItem) return { skipped: 'models not ready' };
  const sequelize = MenuItem.sequelize;
  const fixes = (JSON.parse(fs.readFileSync(FIXES_PATH, 'utf8')).fixes || []).filter((f) => f && f.id && f.name);

  // Both Postgres and SQLite accept this DDL; "itemId" is the primary key so a fix is recorded once.
  await sequelize.query(`CREATE TABLE IF NOT EXISTS "MenuItemFixLedger" (
    "itemId" VARCHAR(64) PRIMARY KEY,
    "previous" TEXT,
    "appliedAt" VARCHAR(40)
  )`);
  const [doneRows] = await sequelize.query('SELECT "itemId" FROM "MenuItemFixLedger"');
  const done = new Set(doneRows.map((r) => String(r.itemId)));

  let applied = 0;
  let skippedRenamed = 0;
  let missing = 0;
  for (const fix of fixes) {
    const id = String(fix.id);
    if (done.has(id)) continue;
    const changes = {};
    for (const k of FIELDS) if (fix[k] !== undefined) changes[k] = fix[k];
    if (!Object.keys(changes).length) continue;
    try {
      await sequelize.transaction(async (transaction) => {
        const item = await MenuItem.findByPk(id, { transaction });
        if (!item) { missing++; return; }
        if (String(item.name) !== String(fix.name)) { skippedRenamed++; return; }
        const previous = {};
        for (const k of Object.keys(changes)) previous[k] = item.get(k);
        // Ledger row first: a concurrent instance hits the primary key and rolls back.
        await sequelize.query(
          'INSERT INTO "MenuItemFixLedger" ("itemId", "previous", "appliedAt") VALUES (:id, :previous, :at)',
          { replacements: { id, previous: JSON.stringify(previous), at: new Date().toISOString() }, transaction }
        );
        await item.update(changes, { transaction });
        applied++;
      });
    } catch (err) {
      if (!/unique|primary|constraint/i.test(String(err && err.message))) throw err;
    }
  }

  if (applied) {
    try { require('../controllers/adminController').clearRestaurantsCache(); } catch { /* cache just expires */ }
  }
  return { applied, skippedRenamed, missing };
};

module.exports = { runItemFixes };
