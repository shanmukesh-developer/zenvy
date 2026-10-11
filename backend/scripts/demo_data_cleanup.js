// Idempotent startup cleanup of the demo data that older builds auto-seeded into production
// (scripts/seed_prod.js). Nothing is deleted: demo rows are only switched off.
//  • Demo riders (published password "rider123") are unapproved and set offline, so they can
//    never claim real orders or appear on a customer's tracking screen.
//  • Demo student logins (published password "student123") are suspended.
//  • The invented PG listings (real competitor brand names, fake owners and phones) are hidden.
// A row is only touched while it still looks exactly like the demo seed (same phone AND the
// published password, or same PG name AND seeded email), so real accounts are never affected.
const DEMO_RIDER_PHONES = ['8765432100', '8765432101', '8765432102'];
const DEMO_STUDENT_PHONES = ['9876543210', '9876543211', '9876543212', '9876543213'];
const DEMO_PGS = [
  { name: 'Stanza Living Rome', email: 'hello@stanzarome.com' },
  { name: 'Olive Premium PG', email: 'admin@olivepg.com' },
  { name: 'Zolo Scholar House', email: 'support@zolostays.com' },
  { name: 'Nexus Elite PG', email: 'concierge@nexuselite.com' },
];

const safeCompare = async (row, password) => {
  try {
    return !!row?.password && (await row.comparePassword(password));
  } catch {
    return false;
  }
};

const runDemoDataCleanup = async () => {
  const result = { ridersDisabled: 0, studentsSuspended: 0, pgsHidden: 0, demoAdminWarning: false };
  const { Op } = require('sequelize');

  const { getDeliveryPartnerModel } = require('../models/DeliveryPartner');
  const DeliveryPartner = getDeliveryPartnerModel && getDeliveryPartnerModel();
  if (DeliveryPartner) {
    const riders = await DeliveryPartner.findAll({
      where: { phone: { [Op.in]: DEMO_RIDER_PHONES }, [Op.or]: [{ isApproved: true }, { isOnline: true }] },
    });
    for (const r of riders) {
      if (await safeCompare(r, 'rider123')) {
        await r.update({ isApproved: false, isOnline: false });
        result.ridersDisabled++;
      }
    }
  }

  const { getUserModel } = require('../models/User');
  const User = getUserModel && getUserModel();
  if (User) {
    const students = await User.findAll({ where: { phone: { [Op.in]: DEMO_STUDENT_PHONES }, isActive: true } });
    for (const u of students) {
      if (String(u.role || '').toLowerCase() !== 'admin' && (await safeCompare(u, 'student123'))) {
        await u.update({ isActive: false });
        result.studentsSuspended++;
      }
    }
    // The demo admin is never switched off automatically (the owner may still use it), but it is flagged loudly.
    const demoAdmin = await User.findOne({ where: { phone: '9999999999', role: 'admin', isActive: true } });
    if (demoAdmin && (await safeCompare(demoAdmin, 'admin123'))) {
      result.demoAdminWarning = true;
      console.warn('🚨 [DEMO_CLEANUP] Admin 9999999999 still uses the published password "admin123". Change it in the dashboard now.');
    }
  }

  const { getPGHostelModel } = require('../models/PGHostel');
  const PGHostel = getPGHostelModel && getPGHostelModel();
  if (PGHostel) {
    const pgs = await PGHostel.findAll({ where: { name: { [Op.in]: DEMO_PGS.map((p) => p.name) }, isActive: true } });
    for (const pg of pgs) {
      const seeded = DEMO_PGS.find((p) => p.name === pg.name);
      const email = String(pg.contactInfo?.email || '').toLowerCase();
      if (seeded && email === seeded.email) {
        await pg.update({ isActive: false });
        result.pgsHidden++;
      }
    }
  }

  return result;
};

module.exports = { runDemoDataCleanup };
