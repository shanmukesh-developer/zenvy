// Laundry-only launch, once (GlobalConfig SERVICES_LAUNDRY_ONLY_V1_DONE). Owner, 24 Nov 2026: "Currently we are not
// launching PG Stays, Rentals, Campus Events, and Tech & Services except Laundry (Dry Wash). So pause all these
// sections in backend and remove them from the display - we will add them in later versions." Co-Ride (bike pool
// and shared autos) is NOT touched (owner, same day: "Do not remove Co-ride services, keep it as it is").
// It turns the admins' existing switches off; nothing is deleted:
//   PG_STAYS_ENABLED        utils/featureSwitches pgStays       new PG bookings refused
//   VEHICLE_RENTALS_ENABLED modules/rentals eligibility flag    rentals refused
//   CAMPUS_EVENTS_ENABLED   modules/campusEvents flag           browse / register refused
//   TECH_SERVICES_ENABLED   utils/featureSwitches techServices  every service booking except LAUNDRY refused
// GET /api/config/sections reports them, so the customer app hides those sections. It runs once, so the admins can
// switch each one back on later (Admin > Settings > Switches lists where) and a restart leaves it on.
// DISABLE_SERVICES_LAUNDRY_ONLY_ONCE=true switches this script off.
const MARKER = 'SERVICES_LAUNDRY_ONLY_V1_DONE';

const runLaundryOnlyOnce = async () => {
  if (String(process.env.DISABLE_SERVICES_LAUNDRY_ONLY_ONCE || '').toLowerCase() === 'true') return { skipped: 'disabled' };
  const { getSequelize } = require('../config/db');
  const sequelize = getSequelize();
  const GlobalConfig = sequelize && sequelize.models && sequelize.models.GlobalConfig;
  if (!GlobalConfig) return { skipped: 'models not ready' };
  if (await GlobalConfig.findOne({ where: { key: MARKER } })) return { skipped: 'already done' };

  const sw = require('../utils/featureSwitches');
  const steps = {
    pgStays: { read: () => sw.isOn('pgStays', { fresh: true }), off: () => sw.setOn('pgStays', false) },
    techServices: { read: () => sw.isOn('techServices', { fresh: true }), off: () => sw.setOn('techServices', false) },
    rentals: {
      read: () => require('../modules/rentals/services/eligibility').readFlag({ fresh: true }),
      off: () => require('../modules/rentals/services/eligibility').writeFlag(false),
    },
    campusEvents: {
      read: () => require('../modules/campusEvents/services/flag').readFlag({ fresh: true }),
      off: () => require('../modules/campusEvents/services/flag').writeFlag(false),
    },
  };
  const out = {};
  const errors = [];
  for (const [name, step] of Object.entries(steps)) {
    try {
      // Written even when it reads off: Auto-ride and Campus events are off by default only while no row exists
      // (a dev override can read them on), so an explicit "off" row keeps them off until an admin turns them on.
      const wasOn = await step.read();
      await step.off();
      out[name] = wasOn ? 'switched off' : 'was already off';
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
    }
  }
  if (errors.length) return { error: errors.join('; '), ...out }; // no marker: tried again on the next start
  try { await require('../utils/responseCache').invalidate('sections'); } catch { /* cache just expires */ }
  await GlobalConfig.create({ key: MARKER, value: JSON.stringify({ at: new Date().toISOString(), ...out }) });
  return out;
};

module.exports = { runLaundryOnlyOnce, MARKER };
