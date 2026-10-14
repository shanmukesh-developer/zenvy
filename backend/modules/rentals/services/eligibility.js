/**
 * Who may list or rent, decided on the server from the database only (never from client fields):
 * an active (not suspended) student account + campus profile with a campus + verificationStatus
 * 'verified' + that campus active. Same rules as Campus / Friends verification.
 *
 * Feature flag: GlobalConfig VEHICLE_RENTALS_ENABLED (default true), cached 30 s.
 */
const { fail } = require('./util');

const FLAG_KEY = 'VEHICLE_RENTALS_ENABLED';
const FLAG_TTL_MS = 30 * 1000;
let flagCache = { at: 0, value: true };

const readFlag = async ({ fresh = false } = {}) => {
  if (!fresh && Date.now() - flagCache.at < FLAG_TTL_MS) return flagCache.value;
  let value = true;
  try {
    const { getGlobalConfigModel } = require('../../../models/GlobalConfig');
    const GlobalConfig = getGlobalConfigModel();
    const row = GlobalConfig ? await GlobalConfig.findOne({ where: { key: FLAG_KEY } }) : null;
    if (row) {
      const v = row.value;
      value = !(v === false || v === 'false' || v === 0 || (v && typeof v === 'object' && v.enabled === false));
    }
  } catch (err) {
    console.warn('[RENTALS_FLAG_WARN]', err.message);
  }
  flagCache = { at: Date.now(), value };
  return value;
};

const writeFlag = async (enabled) => {
  const { getGlobalConfigModel } = require('../../../models/GlobalConfig');
  const GlobalConfig = getGlobalConfigModel();
  const row = await GlobalConfig.findOne({ where: { key: FLAG_KEY } });
  if (row) await row.update({ value: !!enabled });
  else await GlobalConfig.create({ key: FLAG_KEY, value: !!enabled, description: 'Peer-to-peer student vehicle rentals (Others > Rentals)' });
  flagCache = { at: Date.now(), value: !!enabled };
  return !!enabled;
};

/** Fresh (uncached) eligibility context for one user. */
const loadContext = async (userId) => {
  const { getUserModel } = require('../../../models/User');
  const User = getUserModel();
  const user = userId ? await User.findByPk(userId, { attributes: ['id', 'name', 'phone', 'role', 'isActive', 'profileImage'] }) : null;
  let profile = null;
  let campus = null;
  if (user) {
    const { getCampusProfileModel } = require('../../campus/models/CampusProfile');
    const CampusProfile = getCampusProfileModel();
    profile = CampusProfile ? await CampusProfile.findOne({ where: { userId: user.id }, attributes: ['userId', 'campusId', 'verificationStatus', 'verifiedAt'] }) : null;
    if (profile && profile.campusId) {
      const { getCampusModel } = require('../../campus/models/Campus');
      const Campus = getCampusModel();
      campus = Campus ? await Campus.findByPk(profile.campusId, { attributes: ['id', 'name', 'code', 'isActive'] }) : null;
    }
  }
  const reasons = [];
  if (!user) reasons.push('ACCOUNT_REQUIRED');
  else {
    if (user.isActive === false) reasons.push('ACCOUNT_SUSPENDED');
    if (!profile || !profile.campusId) reasons.push('CAMPUS_REQUIRED');
    if (!profile || profile.verificationStatus !== 'verified') reasons.push('VERIFICATION_REQUIRED');
    if (profile && profile.campusId && (!campus || campus.isActive === false)) reasons.push('CAMPUS_INACTIVE');
  }
  return {
    user,
    profile,
    campus,
    campusId: profile ? profile.campusId || null : null,
    reasons,
    eligible: reasons.length === 0,
  };
};

const REASON_MESSAGES = {
  ACCOUNT_REQUIRED: 'Sign in with your student account to use Rentals.',
  ACCOUNT_SUSPENDED: 'Your account is suspended.',
  CAMPUS_REQUIRED: 'Verify your college to list or rent vehicles.',
  VERIFICATION_REQUIRED: 'Verify your college email or ID to list or rent vehicles.',
  CAMPUS_INACTIVE: 'Rentals are not open for your campus yet.',
};

/** Throws the right error when ctx may not list / rent. */
const assertEligible = (ctx) => {
  if (ctx.eligible) return;
  const reason = ctx.reasons[0];
  if (reason === 'ACCOUNT_SUSPENDED') throw fail(403, 'ACCOUNT_SUSPENDED', REASON_MESSAGES.ACCOUNT_SUSPENDED);
  throw fail(403, 'VERIFICATION_REQUIRED', REASON_MESSAGES[reason] || REASON_MESSAGES.VERIFICATION_REQUIRED, { reason, reasons: ctx.reasons });
};

/** Middleware: feature on (unless opts.allowWhenOff) + eligible (unless opts.signedInOnly). Sets req.rentals.ctx. */
const requireRentals = (opts = {}) => async (req, res, next) => {
  try {
    if (!opts.allowWhenOff && !(await readFlag())) {
      throw fail(403, 'FEATURE_OFF', 'Student vehicle rentals are paused right now. Please check back soon.');
    }
    const ctx = await loadContext(req.user && req.user.id);
    if (!ctx.user) throw fail(403, 'ACCOUNT_REQUIRED', REASON_MESSAGES.ACCOUNT_REQUIRED);
    if (ctx.user.isActive === false) throw fail(403, 'ACCOUNT_SUSPENDED', REASON_MESSAGES.ACCOUNT_SUSPENDED);
    if (!opts.signedInOnly) assertEligible(ctx);
    req.rentals = { ctx };
    return next();
  } catch (err) {
    return require('./util').sendError(res, err, 'RENTALS_GATE');
  }
};

module.exports = { readFlag, writeFlag, loadContext, assertEligible, requireRentals, FLAG_KEY, REASON_MESSAGES };
