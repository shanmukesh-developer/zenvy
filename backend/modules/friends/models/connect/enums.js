// Allowed values and limits for Connect (Phase 4). migrations/connect.js builds Postgres CHECKs from these.
module.exports = {
  // setup = consent given, profile being built (never discoverable); active = discoverable; paused = hidden.
  PROFILE_STATUS: ['setup', 'active', 'paused'],
  // Moderation state of the Connect profile, separate from the user's own status.
  MOD_STATUS: ['visible', 'pending_review', 'hidden', 'removed'],
  LIVENESS_STATUS: ['none', 'pending', 'passed', 'failed'],
  PHOTO_STATUS: ['pending', 'approved', 'rejected'],
  SWIPE_ACTIONS: ['like', 'pass'],
  MATCH_STATUS: ['active', 'unmatched', 'blocked'],
  LOOKING_FOR: ['dating', 'friends', 'study', 'event'],
  LOOKING_FOR_LABELS: { dating: 'Dating', friends: 'Friends', study: 'Study buddy', event: 'Event buddy' },

  DISPLAY_NAME_MIN: 2,
  DISPLAY_NAME_MAX: 30,
  BIO_MAX: 300,
  INTERESTS_MAX: 10,
  INTEREST_MIN: 2,
  INTEREST_MAX: 30,
  HIDDEN_BRANCHES_MAX: 20,
  HIDDEN_YEARS_MAX: 6,
  YEAR_MIN: 1,
  YEAR_MAX: 6,
  PHOTOS_MAX: 6, // positions 0..5
  DISCOVER_PAGE: 20,
  MIN_AGE: 18,
};
