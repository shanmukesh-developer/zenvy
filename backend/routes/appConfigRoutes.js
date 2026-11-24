const express = require('express');
const router = express.Router();
const appConfigController = require('../controllers/appConfigController');
const { protect, admin } = require('../middleware/authMiddleware');

// Get global app configuration (public, used by web & mobile)
// Short server cache + ETag; PUT below publishes 'config', which clears it (utils/realtime).
// A signed-in live admin always reads the database (no-store): the dashboard reads the banner list,
// edits it and PUTs the whole list back, so a cached copy (up to 60 s old, or from another cluster
// worker whose cache was not cleared) could wipe a banner added moments earlier.
const { cacheGet, liveAdminBypass } = require('../utils/responseCache');
router.get('/', cacheGet('config', { ttlMs: 60 * 1000, bypass: liveAdminBypass }), appConfigController.getConfig);

// C3 force-update: one app's version policy (public, no auth). ?app=customer|rider|restaurant|vendor|autodriver
// Cached 30 s per app; an admin change (PUT /api/admin/app-versions) publishes 'config', which clears it.
router.get('/app-version', cacheGet('config', { ttlMs: 30 * 1000 }), require('../controllers/appVersionController').getPublicAppVersion);

// C4 legal: current policy version + absolute links to Terms / Privacy / Refunds / Grievance / Guidelines.
router.get('/legal', cacheGet('config', { ttlMs: 30 * 1000 }), require('../controllers/legalController').getPublicLegal);
// Colleges ZCS serves and whether each is open, paused or coming soon (utils/campuses; refreshed by an admin change).
router.get('/campuses', cacheGet('config', { ttlMs: 30 * 1000 }), async (req, res) => {
  try {
    res.json({ campuses: await require('../utils/campuses').listCampuses() });
  } catch (err) {
    console.error('[CAMPUSES_ERROR]', err.message);
    res.status(500).json({ message: 'Could not load the colleges right now.' });
  }
});

// Which "Others" sections have live listings right now (PG stays, Co-Ride, Rentals). The app hides a
// section with nothing in it and shows it again as soon as there is a listing (cached 60 s). Food,
// groceries and services always show. A count that cannot be read is null: the app keeps that section.
// campus: the admin's Campus (Friends) master switch (Admin > Friends app > Switches); off hides the Home
// "Campus" button and its promo (owner, 31 Oct 2026: "block the Campus feature for now from the admin").
// pg / coride / rentals / events .on, autoRide.on and services.techServices: the launch switches (see below).
// food / grocery / bakery / local / laundry / megaBasket / deals .on: the app sections control (utils/appSections).
// introSound: the admins' Intro sound switch (Admin > Settings > Switches, INTRO_SOUND_ENABLED; on unless set off).
// The app keeps the last answer and applies it from its next start.
router.get('/sections', cacheGet('sections', { ttlMs: 60 * 1000 }), async (req, res) => {
  const { getSequelize } = require('../config/db');
  const { Op } = require('sequelize');
  const models = () => { const s = getSequelize(); return (s && s.models) || {}; };
  const count = async (name, where) => {
    try {
      const M = models()[name];
      return M ? await M.count({ where }) : null;
    } catch {
      return null;
    }
  };
  const [pg, coride, rentals] = await Promise.all([
    count('PGHostel', { isActive: true }),
    count('BikePool', { status: 'Available', departureTime: { [Op.gt]: new Date() } }),
    count('RentalListing', { status: 'ACTIVE' }),
  ]);
  const one = (n) => ({ count: n, live: n === null ? true : n > 0 });
  // PG stays always shows (owner, 2 Nov 2026: "i want pg section"): with no listing yet the app's PG page says
  // "No PGs listed yet", so the section is never hidden for being empty. count stays the real number.
  const always = (n) => ({ count: n, live: true });
  let campusLive = true;
  try { campusLive = !!(await require('../modules/friends/services/featureFlags').getConfig()).enabled; } catch { /* unknown: keep it */ }
  let introSound = true;
  try {
    const row = await models().GlobalConfig?.findOne({ where: { key: 'INTRO_SOUND_ENABLED' }, attributes: ['value'] });
    if (row && row.value === false) introSound = false;
  } catch { /* unknown: keep it on */ }
  // Launch switches (owner, 24 Nov 2026: launch with Laundry only; scripts/services_laundry_only_v1.js turned the
  // rest off once). on: the admins' switch for the section; the app shows PG stays, Co-Ride, Rentals, Campus events
  // and the non-laundry services ONLY when on is true (an older server without it keeps them hidden). A paused
  // section is also live:false, so older app builds that only read live hide PG / Co-Ride / Rentals too.
  // A switch that cannot be read counts as on (the server gates refuse nothing they cannot read either).
  const read = async (fn) => { try { return !!(await fn()); } catch { return true; } };
  const sw = require('../utils/featureSwitches');
  const [pgOn, corideOn, autoRideOn, rentalsOn, eventsOn, techOn] = await Promise.all([
    read(() => sw.isOn('pgStays')),
    read(() => sw.isOn('coRide')),
    read(() => require('../modules/autoRide/services/flag').readFlag()),
    read(() => require('../modules/rentals/services/eligibility').readFlag()),
    read(() => require('../modules/campusEvents/services/flag').readFlag()),
    read(() => sw.isOn('techServices')),
  ]);
  // App sections control (owner, 24 Nov 2026; utils/appSections): core sections the admins can pause. Unlike the
  // launch switches above, the app shows these unless on is false (an older server or no answer keeps them).
  const CORE = ['food', 'grocery', 'bakery', 'local', 'laundry', 'megaBasket', 'deals'];
  const coreOn = await Promise.all(CORE.map((name) => read(() => sw.isOn(name))));
  const core = Object.fromEntries(CORE.map((name, i) => [name, { on: coreOn[i] }]));
  const gate = (on, s) => ({ ...s, live: on && s.live, on });
  res.json({
    sections: {
      pg: gate(pgOn, always(pg)),
      coride: gate(corideOn, one(coride)),
      rentals: gate(rentalsOn, one(rentals)),
      events: { live: eventsOn, on: eventsOn },
      autoRide: { on: autoRideOn },
      // laundry: the Laundry switch; techServices.on adds repairs, tailoring, print and the store shelves (gadgets, room).
      // live / on stay true while either is open (older builds read them).
      services: { live: core.laundry.on || techOn, on: core.laundry.on || techOn, laundry: core.laundry.on, techServices: techOn },
      campus: { live: campusLive },
      introSound: { on: introSound },
      ...core,
    },
  });
});

// Update global app configuration (admin only)
router.put('/', protect, admin, appConfigController.updateConfig);

// Add/update or remove ONE Home banner atomically (store "Home banner" toggle, store hide/delete).
router.post('/banners', protect, admin, appConfigController.upsertBanner);
router.delete('/banners', protect, admin, appConfigController.removeBanner);

module.exports = router;
