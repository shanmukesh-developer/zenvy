// Allowed values for Pulse status / kind columns. migrations/pulse.js builds Postgres CHECKs from these.
module.exports = {
  POST_KINDS: ['post', 'reply', 'space_card'],
  POST_STATUS: ['visible', 'pending_review', 'hidden', 'removed', 'deleted'],
  REPLY_POLICIES: ['everyone', 'following', 'none'],
  POST_SOURCES: ['app', 'whisper', 'system'],
  MAX_TEXT: 280,
  MAX_IMPORTED_TEXT: 400, // old whispers allowed 400 characters; they are imported unchanged
  MAX_MEDIA: 4,
  POLL_MIN_OPTIONS: 2,
  POLL_MAX_OPTIONS: 4,
  POLL_OPTION_MAX: 40,
  POLL_MIN_HOURS: 1,
  POLL_MAX_HOURS: 168,
  MAX_HASHTAGS: 10,
  HASHTAG_MAX: 40,
};
