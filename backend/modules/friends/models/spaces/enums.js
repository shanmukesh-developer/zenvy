// Allowed values for Spaces status / role columns. migrations/spaces.js builds Postgres CHECKs from these.
const intEnv = (name, fallback, min, max) => {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

module.exports = {
  SPACE_STATUS: ['scheduled', 'live', 'ended', 'cancelled', 'expired'],
  OPEN_STATUS: ['scheduled', 'live'],
  // Moderation state, separate from the lifecycle. Anything but 'visible' hides the Space from
  // everyone except its host (and admins); hidden / removed also end or cancel it.
  MOD_STATUS: ['visible', 'pending_review', 'hidden', 'removed'],
  // request: hosts accept raised hands; open: a raised hand takes a free speaker seat at once.
  PARTICIPATION: ['request', 'open'],
  VISIBILITY: ['campus'],
  ROLES: ['host', 'cohost', 'speaker', 'listener'],
  SPEAKING_ROLES: ['host', 'cohost', 'speaker'],
  END_REASONS: ['host_ended', 'host_left', 'empty', 'server_restart', 'moderation', 'admin', 'cancelled', 'expired'],
  REMINDER_SKIP: ['missed', 'cancelled'],

  TITLE_MIN: 3,
  TITLE_MAX: 80,
  TOPIC_MAX: 40,
  DESCRIPTION_MAX: 300,
  SCHEDULE_MIN_MINUTES: 5, // a scheduled start must be at least this far ahead
  SCHEDULE_MAX_DAYS: 30,
  EXPIRE_AFTER_MINUTES: 60, // a scheduled Space nobody started this long after its time -> expired
  REMINDER_LEAD_MINUTES: 10,
  SIGNAL_MAX_BYTES: 16 * 1024,

  // Caps (env, read when a Space is created and stored on its row).
  maxSpeakers: () => intEnv('SPACES_MAX_SPEAKERS', 6, 2, 12),
  maxListeners: () => intEnv('SPACES_MAX_LISTENERS', 40, 1, 200),
  // Timers (env so tests can shorten them).
  graceMs: () => intEnv('SPACES_RECONNECT_GRACE_MS', 20 * 1000, 100, 5 * 60 * 1000),
  hostGoneMs: () => intEnv('SPACES_HOST_GONE_MS', 2 * 60 * 1000, 100, 60 * 60 * 1000),
  emptyMs: () => intEnv('SPACES_EMPTY_MS', 5 * 60 * 1000, 100, 60 * 60 * 1000),
};
