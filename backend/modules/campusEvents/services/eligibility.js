/**
 * Who may register / join a team, decided on the server from the database only (never client fields):
 *   base:  active account + CampusProfile with a campus + verificationStatus 'verified' + campus active
 *          (same rules as Rentals / Friends verification).
 *   event: same campus as the event; event.eligibility { years: [..], branches: [..], adultOnly } checked
 *          against the profile (unknown year / branch never passes a restricted event; unknown age = minor).
 */
const { fail } = require('./util');

const REASON_MESSAGES = {
  ACCOUNT_REQUIRED: 'Sign in with your student account to use Campus Events.',
  ACCOUNT_SUSPENDED: 'Your account is suspended.',
  CAMPUS_REQUIRED: 'Verify your college to register for campus events.',
  VERIFICATION_REQUIRED: 'Verify your college email or ID to register for campus events.',
  CAMPUS_INACTIVE: 'Campus Events is not open for your campus yet.',
  OTHER_CAMPUS: 'This event is only for students of another campus.',
  YEAR_NOT_ELIGIBLE: 'This event is not open to your year of study.',
  BRANCH_NOT_ELIGIBLE: 'This event is not open to your branch.',
  ADULT_ONLY: 'This event is only for students aged 18 or over.',
};

/** Fresh (uncached) context for one user. */
const loadContext = async (userId) => {
  const { getUserModel } = require('../../../models/User');
  const User = getUserModel();
  const user = userId ? await User.findByPk(userId, { attributes: ['id', 'name', 'role', 'isActive', 'profileImage'] }) : null;
  let profile = null;
  let campus = null;
  if (user) {
    const { getCampusProfileModel } = require('../../campus/models/CampusProfile');
    const CampusProfile = getCampusProfileModel();
    profile = CampusProfile ? await CampusProfile.findOne({ where: { userId: user.id }, attributes: ['userId', 'campusId', 'verificationStatus', 'year', 'branch', 'isAdult'] }) : null;
    if (profile && profile.campusId) {
      const { getCampusModel } = require('../../campus/models/Campus');
      const Campus = getCampusModel();
      campus = Campus ? await Campus.findByPk(profile.campusId, { attributes: ['id', 'name', 'isActive'] }) : null;
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
  return { user, profile, campus, campusId: profile ? profile.campusId || null : null, reasons, eligible: reasons.length === 0 };
};

/** Reasons this (already loaded) context may not register for `event` (empty = eligible). */
const eventReasons = (ctx, event) => {
  const reasons = [...ctx.reasons];
  if (!reasons.length) {
    if (event.campusId && String(event.campusId) !== String(ctx.campusId)) reasons.push('OTHER_CAMPUS');
    const el = event.eligibility && typeof event.eligibility === 'object' ? event.eligibility : {};
    const years = Array.isArray(el.years) ? el.years.map(Number).filter(Number.isInteger) : [];
    if (years.length && !years.includes(Number(ctx.profile.year))) reasons.push('YEAR_NOT_ELIGIBLE');
    const branches = Array.isArray(el.branches) ? el.branches.map((b) => String(b).trim().toUpperCase()).filter(Boolean) : [];
    if (branches.length && !branches.includes(String(ctx.profile.branch || '').trim().toUpperCase())) reasons.push('BRANCH_NOT_ELIGIBLE');
    if (el.adultOnly === true && ctx.profile.isAdult !== true) reasons.push('ADULT_ONLY');
  }
  return reasons;
};

const throwFor = (reasons) => {
  const reason = reasons[0];
  if (reason === 'ACCOUNT_SUSPENDED') throw fail(403, 'ACCOUNT_SUSPENDED', REASON_MESSAGES.ACCOUNT_SUSPENDED);
  if (['OTHER_CAMPUS', 'YEAR_NOT_ELIGIBLE', 'BRANCH_NOT_ELIGIBLE', 'ADULT_ONLY'].includes(reason)) {
    throw fail(403, 'NOT_ELIGIBLE', REASON_MESSAGES[reason], { reason, reasons });
  }
  throw fail(403, 'VERIFICATION_REQUIRED', REASON_MESSAGES[reason] || REASON_MESSAGES.VERIFICATION_REQUIRED, { reason, reasons });
};

const assertEligible = (ctx) => { if (!ctx.eligible) throwFor(ctx.reasons); };
const assertEventEligible = (ctx, event) => {
  // Events of another campus are invisible (404), never "not eligible".
  if (ctx.campusId && event.campusId && String(event.campusId) !== String(ctx.campusId)) throw fail(404, 'NOT_FOUND', 'This event was not found.');
  const r = eventReasons(ctx, event);
  if (r.length) throwFor(r);
};

/** Loads + checks a user for an event in one go (team invitees, joiners, submit re-checks). */
const checkUserForEvent = async (userId, event) => {
  const ctx = await loadContext(userId);
  return { ctx, reasons: eventReasons(ctx, event) };
};

module.exports = { loadContext, eventReasons, assertEligible, assertEventEligible, checkUserForEvent, REASON_MESSAGES };
