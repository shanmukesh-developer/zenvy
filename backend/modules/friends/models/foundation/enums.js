// Every allowed value for Friends status / kind columns. Migrations build Postgres CHECKs from these.
module.exports = {
  PROFILE_VISIBILITY: ['campus', 'followers'],
  EDGE_KINDS: ['follow', 'mute', 'member'],
  EDGE_TARGETS: ['user', 'entity', 'community', 'hashtag'],
  ENTITY_TYPES: ['club', 'department', 'vendor', 'official'],
  ENTITY_STATUS: ['active', 'disabled'],
  REACTION_TARGETS: ['post', 'forum_post'],
  REACTION_KINDS: ['like', 'repost', 'bookmark'],
  REPORT_TARGETS: [
    'post', 'reply', 'forum_post', 'forum_comment', 'review', 'review_response', 'profile', 'message',
    'task', 'task_application', 'space', 'connect_profile', 'connect_photo', 'community',
  ],
  SUB_TABS: ['pulse', 'forum', 'tasks', 'connect', 'spaces', 'chat'],
  REPORT_CATEGORIES: [
    'spam', 'impersonation', 'harassment', 'threat', 'privacy', 'sexual', 'hate',
    'academic_integrity', 'defamation', 'self_harm', 'other',
  ],
  SEVERITIES: ['low', 'medium', 'high', 'critical'],
  REPORT_STATUS: ['open', 'in_review', 'actioned', 'dismissed', 'escalated'],
  ACTOR_ROLES: ['admin', 'community_mod', 'system', 'self'],
  MOD_ACTIONS: [
    'remove', 'restore', 'hide', 'hide_pending', 'warn', 'sanction', 'lift_sanction', 'pin', 'unpin', 'lock', 'unlock',
    'best_answer', 'assign', 'resolve', 'dismiss', 'escalate', 'reveal_author', 'view_connect', 'view_private_chat',
    'role_grant', 'role_revoke', 'edit_self', 'delete_self', 'space_mute', 'space_remove', 'space_end',
    'approve', 'reject', 'appeal_upheld', 'appeal_reversed', 'config_update', 'entity_create', 'entity_update',
    'badge_grant', 'badge_revoke',
  ],
  SANCTION_SCOPES: ['friends', 'pulse', 'forum', 'tasks', 'connect', 'spaces'],
  APPEAL_STATUS: ['open', 'upheld', 'reversed'],
  CONSENT_KINDS: ['guidelines', 'connect', 'connect_age_declaration', 'liveness'],
  BADGE_SOURCES: ['auto', 'admin'],
  FEATURES: ['pulse', 'forum', 'tasks', 'connect', 'spaces'],
};
