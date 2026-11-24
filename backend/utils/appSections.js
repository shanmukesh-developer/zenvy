/**
 * App sections control (owner, 24 Nov 2026: "a control section in admin website which we can enable or disable the
 * sections we have"). One list over the switches each section already has, so the admin turns any of them on or off
 * from one place (Admin > Settings > App sections; GET / PUT /api/admin/app-sections). Each entry reads and writes its
 * section's own flag, so the section's own admin page and this list always agree.
 *
 *   food          FOOD_ENABLED              utils/featureSwitches (restaurant food, timing group 'food')
 *   grocery       GROCERY_ENABLED           utils/featureSwitches (groceries & fruits, timing group 'grocery')
 *   bakery        BAKERY_ENABLED            utils/featureSwitches (bakeries, snacks & pickles, timing group 'bakery')
 *   megaBasket    MEGA_BASKET_ENABLED       utils/featureSwitches (Mega Basket shopping lists)
 *   deals         DEALS_ENABLED             utils/featureSwitches (Deals & spin: spin wheel, deal claims)
 *   local         LOCAL_ENABLED             utils/featureSwitches (Local tab: In-Campus Booking and stall orders)
 *   pgStays       PG_STAYS_ENABLED          utils/featureSwitches
 *   coRide        CO_RIDE_ENABLED           utils/featureSwitches (bike & car pool)
 *   autoRide      AUTO_RIDE_ENABLED         modules/autoRide flag (shared autos inside Co-Ride)
 *   rentals       VEHICLE_RENTALS_ENABLED   modules/rentals eligibility flag
 *   campusEvents  CAMPUS_EVENTS_ENABLED     modules/campusEvents flag
 *   laundry       LAUNDRY_ENABLED           utils/featureSwitches (laundry bookings)
 *   techServices  TECH_SERVICES_ENABLED     utils/featureSwitches (repairs, tailoring, print...)
 *   campus        friends master switch     modules/friends featureFlags (Campus: friends, chats, community)
 *   whispers      CAMPUS_WHISPERS_ENABLED   utils/featureSwitches
 *   afterDark     AFTER_DARK_ENABLED        utils/featureSwitches
 *
 * The list is in the admin's group order (Home, Groceries tab, Local tab, Services tab, Campus).
 * The customer app reads them through GET /api/config/sections (cached 60 s; dropped here on every change).
 */
const sw = () => require('./featureSwitches');
const autoRide = () => require('../modules/autoRide/services/flag');
const rentals = () => require('../modules/rentals/services/eligibility');
const events = () => require('../modules/campusEvents/services/flag');
const friends = () => require('../modules/friends/services/featureFlags');

const swEntry = (key, name, label, group, description) => ({
  key, label, group, description,
  read: () => sw().isOn(name, { fresh: true }), write: (on) => sw().setOn(name, on),
});

const SECTIONS = Object.freeze([
  swEntry('food', 'food', 'Food delivery (restaurants)', 'Home',
    'Restaurant food on Home. Off: Home shows "Food delivery is paused" and new food orders are refused.'),
  swEntry('grocery', 'grocery', 'Groceries & fruits', 'Groceries tab',
    'Grocery and fruit stores. Off: their stores and products are hidden and new grocery orders are refused.'),
  swEntry('bakery', 'bakery', 'Bakeries, snacks & pickles', 'Groceries tab',
    'Bakery, snacks and pickle stores. Off: their stores and products are hidden and new orders are refused.'),
  swEntry('megaBasket', 'megaBasket', 'Mega Basket (shopping lists)', 'Groceries tab',
    'Free-text shopping lists a rider buys for you. Off: new shopping lists are refused; existing ones stay visible.'),
  swEntry('deals', 'deals', 'Deals & spin', 'Groceries tab',
    'Daily deals, the spin wheel and rewards. Off: hidden in the app, and spins and deal claims are refused. Coupons already won still work.'),
  swEntry('local', 'local', 'Local tab (In-Campus Booking & stalls)', 'Local tab',
    'In-Campus Booking and the stalls near campus. Off: the Local tab is hidden and new stall orders and bookings are refused.'),
  {
    key: 'pgStays', label: 'PG stays', group: 'Services tab',
    description: 'PG rooms near campus. Off: hidden in the app and new PG bookings are refused.',
    read: () => sw().isOn('pgStays', { fresh: true }), write: (on) => sw().setOn('pgStays', on),
  },
  {
    key: 'coRide', label: 'Co-Ride (bike & car pool)', group: 'Services tab',
    description: 'Students share bike and car rides. Off: hidden, and finding, posting and joining rides are refused.',
    read: () => sw().isOn('coRide', { fresh: true }), write: (on) => sw().setOn('coRide', on),
  },
  {
    key: 'autoRide', label: 'Shared autos', group: 'Services tab',
    description: 'Shared auto bookings inside Co-Ride. Off: the auto option is hidden and bookings are refused.',
    read: () => autoRide().readFlag({ fresh: true }), write: (on) => autoRide().writeFlag(on),
  },
  {
    key: 'rentals', label: 'Vehicle rentals', group: 'Services tab',
    description: 'Renting bikes and cars between students. Off: hidden and rentals are refused.',
    read: () => rentals().readFlag({ fresh: true }), write: (on) => rentals().writeFlag(on),
  },
  {
    key: 'campusEvents', label: 'Campus events', group: 'Services tab',
    description: 'Event listings, registrations and tickets. Off: hidden and registrations are refused.',
    read: () => events().readFlag({ fresh: true }), write: (on) => events().writeFlag(on),
  },
  swEntry('laundry', 'laundry', 'Laundry', 'Services tab',
    'Laundry pickup bookings. Off: laundry cannot be booked; with repairs also off the Services section says services are paused.'),
  {
    key: 'techServices', label: 'Repairs, tailoring & other services', group: 'Services tab',
    description: 'On: the services section is "Tech & repairs" with every service. Off: only laundry can be booked (when Laundry is on).',
    read: () => sw().isOn('techServices', { fresh: true }), write: (on) => sw().setOn('techServices', on),
  },
  {
    key: 'campus', label: 'Campus (friends & community)', group: 'Campus',
    description: 'The Campus area: friends, chats and community. Off: the Campus button and its pages are hidden.',
    read: async () => !!(await friends().getConfig({ fresh: true })).enabled,
    write: async (on) => {
      const r = await friends().setConfig({ enabled: !!on });
      if (r && r.errors) throw new Error(r.errors.join('; '));
    },
  },
  swEntry('whispers', 'whispers', 'Campus Whispers', 'Campus',
    'The anonymous campus board. Off: hidden and new posts are refused.'),
  swEntry('afterDark', 'afterDark', 'ZenWe After Dark', 'Campus',
    'Late-night chat rooms. Off: hidden and chats are refused.'),
]);
const byKey = new Map(SECTIONS.map((s) => [s.key, s]));

const dropAppCache = () => {
  try { Promise.resolve(require('./responseCache').invalidate('sections')).catch(() => {}); } catch { /* expires in 60 s */ }
};

/** Every section with its current state: [{ key, label, group, description, enabled }]. A read error shows null. */
const listSections = async () => Promise.all(SECTIONS.map(async (s) => {
  let enabled = null;
  try { enabled = !!(await s.read()); } catch (err) { console.warn('[APP_SECTIONS_READ_WARN]', s.key, err.message); }
  return { key: s.key, label: s.label, group: s.group, description: s.description, enabled };
}));

/** Turn one section on or off. → { section } or { error, status }. */
const setSection = async (key, enabled) => {
  const s = byKey.get(String(key || ''));
  if (!s) return { status: 404, error: 'Unknown section.' };
  if (typeof enabled !== 'boolean') return { status: 400, error: 'Send enabled: true or false.' };
  await s.write(enabled);
  dropAppCache();
  const now = !!(await s.read());
  return { section: { key: s.key, label: s.label, group: s.group, description: s.description, enabled: now } };
};

module.exports = { SECTIONS, listSections, setSection };
