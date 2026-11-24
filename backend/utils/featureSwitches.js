/**
 * C2: kill switches for campus features outside Friends, same mechanism as the Rentals switch
 * (GlobalConfig VEHICLE_RENTALS_ENABLED): one GlobalConfig key per feature, default ON, cached 30 s,
 * toggled from the admin dashboard (PUT /api/campus/mod/switches) and audited there.
 *
 *   CAMPUS_WHISPERS_ENABLED  Campus Whispers (anonymous board, /api/campus/pulse/whispers*)
 *   AFTER_DARK_ENABLED       Zenvy After Dark (legacy /api/chat/*, /api/rooms/*, after-dark sockets)
 *   PG_STAYS_ENABLED         PG stays: new PG bookings (POST /api/pg/:roomId/book)
 *   CO_RIDE_ENABLED          Co-Ride bike pool: browse, post and join rides (/api/bikepool/posts*)
 *   TECH_SERVICES_ENABLED    Service bookings other than laundry (repairs, tailoring, print...: POST /api/services/book)
 *
 * App sections control (owner, 24 Nov 2026: "turn any section of the customer app on or off"; utils/appSections):
 *   FOOD_ENABLED             Restaurant food (delivery timing group 'food'): quotes / orders refused (utils/orderPricing)
 *   GROCERY_ENABLED          Groceries & fruits (timing group 'grocery'): same
 *   BAKERY_ENABLED           Bakeries, snacks & pickles (timing group 'bakery'): same
 *   LOCAL_ENABLED            Local tab: In-Campus Booking (POST /api/campus-booking/bookings) and stall orders (VENDOR)
 *   LAUNDRY_ENABLED          Laundry bookings (POST /api/services/book with LAUNDRY)
 *   MEGA_BASKET_ENABLED      Mega Basket shopping lists (POST /api/mega-basket)
 *   DEALS_ENABLED            Deals & spin: spin (POST /api/rewards/use-spin) and deal claims (POST /api/vault/claim/:id)
 *
 * Owner, 24 Nov 2026: launch with Laundry only; PG stays, Co-Ride, Rentals, Campus events and the non-laundry
 * services are paused (scripts/services_laundry_only_v1.js switches them off once; GET /api/config/sections tells
 * the app). The admins switch each back on from the admin (PUT /api/campus/mod/switches).
 *
 * When off, the API answers 403 { code: 'FEATURE_OFF', feature } and GET /api/campus/features tells
 * the app to hide the entry point.
 */
const TTL_MS = 30 * 1000;

const SWITCHES = Object.freeze({
  whispers: { key: 'CAMPUS_WHISPERS_ENABLED', label: 'Campus Whispers', message: 'Campus Whispers is paused right now. Please check back soon.' },
  afterDark: { key: 'AFTER_DARK_ENABLED', label: 'ZenWe After Dark', message: 'ZenWe After Dark is paused right now. Please check back soon.' },
  pgStays: { key: 'PG_STAYS_ENABLED', label: 'PG stays', message: 'PG stays is not open yet. Please check back soon.' },
  coRide: { key: 'CO_RIDE_ENABLED', label: 'Co-Ride', message: 'Co-Ride is not open yet. Please check back soon.' },
  techServices: { key: 'TECH_SERVICES_ENABLED', label: 'Repairs, tailoring and other services', message: 'Only laundry can be booked right now. Other services open soon.' },
  food: { key: 'FOOD_ENABLED', label: 'Food delivery', message: 'Food delivery is paused right now. Please check back soon.' },
  grocery: { key: 'GROCERY_ENABLED', label: 'Groceries & fruits', message: 'Grocery delivery is paused right now. Please check back soon.' },
  bakery: { key: 'BAKERY_ENABLED', label: 'Bakeries, snacks & pickles', message: 'Bakery, snacks and pickles delivery is paused right now. Please check back soon.' },
  local: { key: 'LOCAL_ENABLED', label: 'Local (In-Campus Booking & stalls)', message: 'Local stalls and In-Campus Booking are paused right now. Please check back soon.' },
  laundry: { key: 'LAUNDRY_ENABLED', label: 'Laundry', message: 'Laundry booking is paused right now. Please check back soon.' },
  megaBasket: { key: 'MEGA_BASKET_ENABLED', label: 'Mega Basket', message: 'Shopping lists (Mega Basket) are paused right now. Please check back soon.' },
  deals: { key: 'DEALS_ENABLED', label: 'Deals & spin', message: 'Deals and spin are paused right now. Please check back soon.' },
});

const cache = new Map(); // name -> { at, value }
// B1: a switch flipped on one instance is re-read by every instance at once (utils/cacheBus).
const cacheBus = require('./cacheBus');
// Marked stale (not deleted): peek() keeps answering the last known value while it re-reads.
const markStale = (name) => {
  for (const [k, hit] of cache) if (!name || k === name) cache.set(k, { at: 0, value: hit.value });
};
cacheBus.register('flags.switches', markStale, { resync: () => markStale() });

const configModel = () => {
  try { return require('../models/GlobalConfig').getGlobalConfigModel(); } catch { return null; }
};

const parseOn = (v) => {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { /* plain string */ } }
  return !(v === false || v === 'false' || v === 0 || v === '0' || v === 'off' || (v && typeof v === 'object' && v.enabled === false));
};

/** Is the feature on? Never throws (a read error keeps the last known value, default on). */
const isOn = async (name, { fresh = false } = {}) => {
  const sw = SWITCHES[name];
  if (!sw) return true;
  const hit = cache.get(name);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.value;
  let value = hit ? hit.value : true;
  try {
    const GlobalConfig = configModel();
    const row = GlobalConfig ? await GlobalConfig.findOne({ where: { key: sw.key } }) : null;
    value = row ? parseOn(row.value) : true;
  } catch (err) {
    console.warn('[FEATURE_SWITCH_WARN]', sw.key, err.message);
  }
  cache.set(name, { at: Date.now(), value });
  return value;
};

/** Last known value without I/O (refreshes in the background when stale). For sync socket checks. */
const peek = (name) => {
  const hit = cache.get(name);
  if (!hit || Date.now() - hit.at >= TTL_MS) isOn(name).catch(() => {});
  return hit ? hit.value : true;
};

const setOn = async (name, enabled) => {
  const sw = SWITCHES[name];
  if (!sw) throw new Error(`unknown switch ${name}`);
  const GlobalConfig = configModel();
  if (!GlobalConfig) throw new Error('config storage is not available');
  const row = await GlobalConfig.findOne({ where: { key: sw.key } });
  if (row) await row.update({ value: !!enabled });
  else await GlobalConfig.create({ key: sw.key, value: !!enabled, description: `${sw.label} on/off (admin switch)` });
  cache.set(name, { at: Date.now(), value: !!enabled });
  cacheBus.broadcast('flags.switches', name);
  // GET /api/config/sections reports these switches (the app hides paused sections): show the change at once.
  try { Promise.resolve(require('./responseCache').invalidate('sections')).catch(() => {}); } catch { /* cache just expires */ }
  // The catalogue leaves out stores of a paused grocery / bakery section (controllers/catalogueController).
  if (name === 'grocery' || name === 'bakery') {
    try { Promise.resolve(require('./responseCache').invalidate('catalog')).catch(() => {}); } catch { /* cache just expires */ }
  }
  try { require('./realtime').publish('config', 'updated', sw.key, { scope: 'global' }); } catch { /* cache just expires */ }
  return !!enabled;
};

const all = async () => {
  const out = {};
  for (const name of Object.keys(SWITCHES)) out[name] = await isOn(name);
  return out;
};

const offBody = (name) => ({ code: 'FEATURE_OFF', feature: name, message: (SWITCHES[name] || {}).message || 'This feature is paused right now.' });

/** Express middleware: 403 FEATURE_OFF while the switch is off. */
const requireOn = (name) => async (req, res, next) => {
  if (await isOn(name)) return next();
  return res.status(403).json(offBody(name));
};

const clearCache = () => cache.clear();

module.exports = { SWITCHES, isOn, peek, setOn, all, offBody, requireOn, clearCache };
