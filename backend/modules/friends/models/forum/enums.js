// Allowed values for Forum status / kind columns. migrations/forum.js builds Postgres CHECKs from these.
module.exports = {
  COMMUNITY_KINDS: ['default', 'custom'],
  COMMUNITY_STATUS: ['active', 'pending', 'archived'],
  COMMUNITY_ROLES: ['owner', 'moderator'],
  POST_TYPES: ['question', 'discussion', 'review', 'resource', 'guidance', 'campus_info'],
  CONTENT_STATUS: ['visible', 'pending_review', 'hidden', 'removed', 'deleted'],
  VOTE_TARGETS: ['forum_post', 'forum_comment'],
  REVIEW_KINDS: ['course', 'professor', 'hostel', 'mess', 'club', 'placement'],
  REVIEW_TARGET_STATUS: ['active', 'pending', 'hidden'],
  REVIEW_STATUS: ['published', 'pending_review', 'hidden', 'removed'],
  RESPONDER_ROLES: ['faculty', 'official', 'admin'],
  RESPONSE_STATUS: ['visible', 'hidden', 'removed', 'deleted'],
  MAX_DEPTH: 5,
};
