// ZenWe's public contact email, once (GlobalConfig SUPPORT_EMAIL_V1_DONE). Owner, 24 Nov 2026: "Remove all the mobile
// number ... link our zenwe email zenwecustomer.support@gmail.com ... not only for issues, promotional or
// collaborational mails". The /legal pages read the contact and grievance officer details from GlobalConfig
// LEGAL_SETTINGS (admin Config -> Legal). In saved settings, contactEmail and grievanceOfficer.email that are still the
// old personal address become the support address, and a grievance officer phone that is the old support number is
// cleared. Anything the admins typed themselves is kept; nothing is created when the settings were never saved (the
// code defaults already use the support address). Runs once. DISABLE_SUPPORT_EMAIL_ONCE=true switches it off.
const MARKER = 'SUPPORT_EMAIL_V1_DONE';
const OLD_EMAIL = 'projectshanmukh@gmail.com';
const NEW_EMAIL = 'zenwecustomer.support@gmail.com';
const OLD_PHONE_DIGITS = '9391955674';

const runSupportEmailOnce = async () => {
  if (String(process.env.DISABLE_SUPPORT_EMAIL_ONCE || '').toLowerCase() === 'true') return { skipped: 'disabled' };
  const { getSequelize } = require('../config/db');
  const sequelize = getSequelize();
  const GlobalConfig = sequelize && sequelize.models && sequelize.models.GlobalConfig;
  if (!GlobalConfig) return { skipped: 'models not ready' };
  if (await GlobalConfig.findOne({ where: { key: MARKER } })) return { skipped: 'already done' };

  const legal = require('../utils/legalSettings');
  const row = await GlobalConfig.findOne({ where: { key: legal.KEY } });
  const out = { contactEmail: 'kept', grievanceEmail: 'kept', grievancePhone: 'kept' };
  let changed = false;
  if (!row) {
    Object.assign(out, { contactEmail: 'not saved (default is the support email)', grievanceEmail: 'not saved', grievancePhone: 'not saved' });
  } else {
    const raw = row.value;
    let v = raw;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = null; } }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const next = { ...v };
      const same = (a, b) => String(a || '').trim().toLowerCase() === b;
      if (same(next.contactEmail, OLD_EMAIL)) { next.contactEmail = NEW_EMAIL; out.contactEmail = 'updated'; changed = true; }
      if (next.grievanceOfficer && typeof next.grievanceOfficer === 'object') {
        const g = { ...next.grievanceOfficer };
        if (same(g.email, OLD_EMAIL)) { g.email = NEW_EMAIL; out.grievanceEmail = 'updated'; changed = true; }
        if (String(g.phone || '').replace(/\D/g, '').endsWith(OLD_PHONE_DIGITS)) { g.phone = ''; out.grievancePhone = 'cleared'; changed = true; }
        next.grievanceOfficer = g;
      }
      if (changed) await row.update({ value: typeof raw === 'string' ? JSON.stringify(next) : next });
    }
  }
  try {
    await GlobalConfig.create({ key: MARKER, value: { at: new Date().toISOString(), ...out }, description: 'Once: public contact email (scripts/support_email_v1.js)' });
  } catch (err) { if (!(err && err.name === 'SequelizeUniqueConstraintError')) throw err; }
  if (changed) {
    legal.clearCache();
    try { require('../utils/realtime').publish('config', 'updated', 'legal_settings', { scope: 'legal_settings' }); } catch { /* best effort */ }
  }
  return out;
};

module.exports = { runSupportEmailOnce, MARKER, NEW_EMAIL };
