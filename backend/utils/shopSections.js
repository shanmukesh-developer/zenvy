// Groceries tab sections (owner, 26 Nov 2026). The Groceries tab has four pills:
//
//   Grocery store     ZenWe's own house store (Restaurant.isHouseStore; scripts/house_grocery_store_v1.js): its
//                     products only, added by the admins (Admin > Grocery store). GET /api/catalogue/items?house=1
//   Snacks            shops with shopSection 'snacks'          GET /api/catalogue/stores?section=snacks
//   Fruits & pickles  shops with shopSection 'fruits_pickles'  GET /api/catalogue/stores?section=fruits_pickles
//   Bakeries          shops with shopSection 'bakeries'        GET /api/catalogue/stores?section=bakeries
//                     (a BAKERY store with no section set counts as 'bakeries')
//
// The admin sets a shop's section in the store editor ("Groceries tab section"). The house store never has one.
// App sections switches (utils/appSections): grocery off pauses Grocery store, Snacks and Fruits & pickles; bakery off
// pauses Bakeries.

const SHOP_SECTIONS = Object.freeze(['snacks', 'fruits_pickles', 'bakeries']);
const SECTION_LABELS = Object.freeze({ snacks: 'Snacks', fruits_pickles: 'Fruits & pickles', bakeries: 'Bakeries' });
/** The App sections switch (utils/featureSwitches name) each section follows. */
const SECTION_SWITCH = Object.freeze({ snacks: 'grocery', fruits_pickles: 'grocery', bakeries: 'bakery' });

const read = (store, key) => (store && typeof store.get === 'function' ? store.get(key) : store && store[key]);

/** 'fruits & pickles' / 'Fruits_Pickles' / 'fruits-pickles' -> 'fruits_pickles'; '' / null -> null; unknown -> undefined. */
const cleanSection = (v) => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim().toLowerCase().replace(/&/g, ' ').replace(/[^a-z]+/g, '_').replace(/^_+|_+$/g, '');
  if (!t || t === 'none') return null;
  return SHOP_SECTIONS.includes(t) ? t : undefined;
};

/** A store's section: its own (valid) shopSection, else 'bakeries' for a BAKERY store, else null. House store: null. */
const sectionOf = (store) => {
  if (!store || read(store, 'isHouseStore')) return null;
  const own = cleanSection(read(store, 'shopSection'));
  if (own) return own;
  return String(read(store, 'vendorType') || '').toUpperCase() === 'BAKERY' ? 'bakeries' : null;
};

/** Whether a section's App sections switch is on (an unreadable switch counts as on). */
const sectionOn = async (section) => {
  const name = SECTION_SWITCH[section];
  if (!name) return true;
  try { return !!(await require('./featureSwitches').isOn(name)); } catch { return true; }
};

module.exports = { SHOP_SECTIONS, SECTION_LABELS, SECTION_SWITCH, cleanSection, sectionOf, sectionOn };
