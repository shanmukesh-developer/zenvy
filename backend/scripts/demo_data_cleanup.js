// Idempotent startup cleanup of the demo data that older builds auto-seeded into production
// (scripts/seed_prod.js). Nothing is deleted: demo rows are only switched off.
//  • Demo riders (published password "rider123") are unapproved and set offline, so they can
//    never claim real orders or appear on a customer's tracking screen.
//  • Demo student logins (published password "student123") are suspended.
//  • The invented PG listings (real competitor brand names, fake owners and phones) are hidden.
// A row is only touched while it still looks exactly like the demo seed (same phone AND the
// published password, or same PG name AND seeded email), so real accounts are never affected.
const TEST_PHONE = '1234567890';
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
    // The demo admin (published password "admin123") would give anyone full admin powers.
    // By owner decision it is NOT rotated automatically: startup only logs a warning. Set
    // DEMO_ADMIN_AUTO_ROTATE=true to rotate it, or DEMO_ADMIN_NEW_PASSWORD (12+ chars) in Render
    // env and restart once to choose a new password, then remove the variable.
    const demoAdmin = await User.findOne({ where: { phone: '9999999999', role: 'admin', isActive: true } });
    if (demoAdmin) {
      const wanted = String(process.env.DEMO_ADMIN_NEW_PASSWORD || '');
      // Owner decision (2026-10-13): never auto-change the admin password; only warn.
      if (String(process.env.DEMO_ADMIN_AUTO_ROTATE || '') === 'true' && (await safeCompare(demoAdmin, 'admin123'))) {
        demoAdmin.password = wanted.length >= 12 ? wanted : require('crypto').randomBytes(24).toString('base64url');
        await demoAdmin.save();
        result.demoAdminWarning = true;
        console.warn(`🚨 [DEMO_CLEANUP] Admin 9999999999 used the published password; it was rotated${wanted.length >= 12 ? ' to DEMO_ADMIN_NEW_PASSWORD' : ' to a random value (set DEMO_ADMIN_NEW_PASSWORD in env and restart to choose one)'}.`);
      } else if (wanted.length >= 12 && !(await safeCompare(demoAdmin, wanted))) {
        demoAdmin.password = wanted;
        await demoAdmin.save();
        console.warn('🔐 [DEMO_CLEANUP] Admin 9999999999 password set from DEMO_ADMIN_NEW_PASSWORD. Remove that env variable now.');
      } else if (await safeCompare(demoAdmin, 'admin123')) {
        result.demoAdminWarning = true;
        console.warn('⚠️ [DEMO_CLEANUP] Admin 9999999999 still uses the published password "admin123". Change it when convenient.');
      }
    }

    // E2E test logins (scripts/init_test_accounts.js, password "testpassword").
    const testUser = await User.findOne({ where: { phone: TEST_PHONE, isActive: true } });
    if (testUser && String(testUser.role || '').toLowerCase() !== 'admin' && (await safeCompare(testUser, 'testpassword'))) {
      await testUser.update({ isActive: false });
      result.studentsSuspended++;
    }
  }
  if (DeliveryPartner) {
    const testRider = await DeliveryPartner.findOne({ where: { phone: TEST_PHONE } });
    if (testRider && (testRider.isApproved || testRider.isOnline) && (await safeCompare(testRider, 'testpassword'))) {
      await testRider.update({ isApproved: false, isOnline: false });
      result.ridersDisabled++;
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
