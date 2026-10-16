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
    // C1-1: setting a new password for seed-password admins (from ADMIN_RESET_PASSWORD, else
    // DEMO_ADMIN_NEW_PASSWORD) and the boot warning live in scripts/admin_seed_reset.js, which runs
    // right after this cleanup. Both only ever touch an account WHILE it still uses a seed password,
    // so a password the owner chose is never rewritten (the old "differs from DEMO_ADMIN_NEW_PASSWORD
    // -> set it again" branch here re-set it, and bumped tokenVersion, on every boot).
    // Kept here: the opt-in DEMO_ADMIN_AUTO_ROTATE=true random rotation, only while it is still
    // "admin123" and only when no valid reset password is configured (then admin_seed_reset sets that).
    const demoAdmin = await User.findOne({ where: { phone: '9999999999', role: 'admin', isActive: true } });
    if (demoAdmin && (await safeCompare(demoAdmin, 'admin123'))) {
      result.demoAdminWarning = true;
      const { SEED_ADMIN_PASSWORDS, RESET_ENV_NAMES } = require('./admin_seed_reset');
      const hasResetPassword = RESET_ENV_NAMES.some((n) => {
        const v = process.env[n];
        return typeof v === 'string' && v.length >= 12 && !SEED_ADMIN_PASSWORDS.includes(v);
      });
      if (String(process.env.DEMO_ADMIN_AUTO_ROTATE || '') === 'true' && !hasResetPassword) {
        demoAdmin.password = require('crypto').randomBytes(24).toString('base64url');
        await demoAdmin.save();
        console.warn('🚨 [DEMO_CLEANUP] Admin ****9999 used the published password; it was rotated to a random value (DEMO_ADMIN_AUTO_ROTATE=true). Set ADMIN_RESET_PASSWORD next time to choose one.');
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
