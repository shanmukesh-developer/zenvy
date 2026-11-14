// Delivery timing groups (owner, 14 Nov 2026): WHEN each kind of product is delivered, set by the admin per product.
//
//   food     Restaurants, tiffins and fast food
//              lunch    12:30–1:00 PM   order by 11:30 AM   (kept, owner's choice 14 Nov)
//              evening  7:00–7:15 PM    order by 6:30 PM
//                       8:00–8:15 PM    order by 7:15 PM
//                       9:00–9:30 PM    order by 8:15 PM
//   grocery  Groceries and fruits          12:00–2:00 PM   order by 7:00 AM the same day
//   bakery   Bakeries, snacks and pickles  4:00–6:00 PM    order by 2:00 PM the same day
//   (laundry and other services are booked with the customer's own pickup time: services, not slots)
// After a cutoff the order books the next window (tomorrow's when today's are all closed).
//
// A product's group: MenuItem.deliveryGroup (set by the admin per product) else Restaurant.deliveryGroup (the
// store's default, admin) else a default from the store: BAKERY stores and stores named bakery / pickles / sweets /
// snacks -> bakery, grocery and other shops -> grocery, everything else (restaurants) -> food.
// The windows themselves are editable in the admin (GlobalConfig DELIVERY_GROUPS, cached 30 s with the slot config).
// Env DELIVERY_GROUPS=off switches back to the single three-slot table of utils/deliverySlots (rollback switch;
// the older test suites run with it off).

const GROUP_IDS = Object.freeze(['food', 'grocery', 'bakery']);
const CONFIG_KEY = 'DELIVERY_GROUPS';
const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const DEFAULT_GROUPS = Object.freeze({
  food: Object.freeze({
    label: 'Restaurants, tiffins & fast food',
    slots: Object.freeze([
      Object.freeze({ id: 'F1', start: '12:30', end: '13:00', cutoff: '11:30' }),
      Object.freeze({ id: 'F2', start: '19:00', end: '19:15', cutoff: '18:30' }),
      Object.freeze({ id: 'F3', start: '20:00', end: '20:15', cutoff: '19:15' }),
      Object.freeze({ id: 'F4', start: '21:00', end: '21:30', cutoff: '20:15' }),
    ]),
  }),
  grocery: Object.freeze({
    label: 'Groceries & fruits',
    slots: Object.freeze([Object.freeze({ id: 'G1', start: '12:00', end: '14:00', cutoff: '07:00' })]),
  }),
  bakery: Object.freeze({
    label: 'Bakeries, snacks & pickles',
    slots: Object.freeze([Object.freeze({ id: 'B1', start: '16:00', end: '18:00', cutoff: '14:00' })]),
  }),
});
const ID_PREFIX = { food: 'F', grocery: 'G', bakery: 'B' };

const toMin = (hhmm) => {
  const m = HHMM_RE.exec(String(hhmm || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const pad = (hhmm) => String(hhmm).trim().padStart(5, '0');

/**
 * One group's windows from the admin: 1–6 windows, each start < end on the same day, cutoff at or before the start
 * (same day), sorted, no overlap. Ids are given here (F1.., G1.., B1..), never taken from the request. Returns the
 * clean list, or throws an Error whose message the admin sees.
 */
const normalizeGroupSlots = (group, slots) => {
  if (!GROUP_IDS.includes(group)) throw new Error(`Unknown delivery group "${group}".`);
  if (!Array.isArray(slots) || !slots.length) throw new Error('Add at least one delivery window.');
  if (slots.length > 6) throw new Error('At most 6 delivery windows per group.');
  const rows = slots.map((s, i) => {
    const a = toMin(s && s.start);
    const b = toMin(s && s.end);
    const c = toMin(s && s.cutoff);
    const n = i + 1;
    if (a === null || b === null || c === null) throw new Error(`Window ${n}: use HH:MM times (24-hour), e.g. 19:00.`);
    if (a >= b) throw new Error(`Window ${n}: the delivery must end after it starts.`);
    if (c > a) throw new Error(`Window ${n}: the order cutoff must be at or before the delivery start.`);
    return { start: pad(s.start), end: pad(s.end), cutoff: pad(s.cutoff), a, b };
  }).sort((x, y) => x.a - y.a);
  for (let i = 1; i < rows.length; i++) if (rows[i].a < rows[i - 1].b) throw new Error('Delivery windows must not overlap.');
  return rows.map((r, i) => Object.freeze({ id: `${ID_PREFIX[group]}${i + 1}`, start: r.start, end: r.end, cutoff: r.cutoff }));
};

/** The full config with the admin's edits over the defaults (invalid parts fall back to the defaults). Never throws. */
const mergeConfig = (value) => {
  const out = {};
  for (const g of GROUP_IDS) {
    let slots = DEFAULT_GROUPS[g].slots;
    const v = value && typeof value === 'object' && value[g];
    if (v && Array.isArray(v.slots)) {
      try { slots = normalizeGroupSlots(g, v.slots); } catch (e) { console.warn(`[DELIVERY_GROUPS] ${g}: ${e.message}; using the defaults.`); }
    }
    out[g] = Object.freeze({ label: DEFAULT_GROUPS[g].label, slots });
  }
  return Object.freeze(out);
};

const groupsOff = () => ['0', 'off', 'false', 'no'].includes(String(process.env.DELIVERY_GROUPS || '').trim().toLowerCase());

// ── Which group a product / store is in ────────────────────────────────────────────────────────
const cleanGroup = (v) => {
  const g = String(v || '').trim().toLowerCase();
  return GROUP_IDS.includes(g) ? g : null;
};
const BAKERY_NAME_RE = /\b(bakery|bakers?|bake|cakes?|pickles?|snacks?|sweets?|namkeen|home ?foods?)\b/i;
const GROCERY_TYPES = ['GROCERY', 'ELECTRONICS', 'HOME_ESSENTIALS', 'STATIONERY', 'STATIONARY', 'PHARMACY', 'TOYS', 'SEEDS', 'EXTRAS'];
const plain = (x) => (x && typeof x.get === 'function' ? x.get({ plain: true }) : x || {});

/** The store's default group: the admin's choice, else from its type / name. */
const storeGroup = (store) => {
  const s = plain(store);
  const set = cleanGroup(s.deliveryGroup);
  if (set) return set;
  const type = String(s.vendorType || '').toUpperCase();
  if (type === 'BAKERY' || BAKERY_NAME_RE.test(String(s.name || ''))) return 'bakery';
  if (GROCERY_TYPES.includes(type)) return 'grocery';
  return 'food';
};
/** A product's group: its own (admin), else its store's. */
const itemGroup = (item, store) => cleanGroup(plain(item).deliveryGroup) || storeGroup(store);

/** Distinct groups of a basket's products, in first-seen order. */
const groupsOfItems = (items, store) => {
  const seen = [];
  for (const it of Array.isArray(items) ? items : []) {
    const g = itemGroup(it, store);
    if (!seen.includes(g)) seen.push(g);
  }
  return seen.length ? seen : [storeGroup(store)];
};

module.exports = {
  GROUP_IDS,
  CONFIG_KEY,
  DEFAULT_GROUPS,
  normalizeGroupSlots,
  mergeConfig,
  groupsOff,
  cleanGroup,
  storeGroup,
  itemGroup,
  groupsOfItems,
};
