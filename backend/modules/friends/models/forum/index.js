// Phase 1 — Forum tables (friends_plan.md §3 "Phase 1 — Forum").
// Communities, scoped community roles, posts, threaded comments, votes, structured reviews,
// review targets and the right-of-reply responses. Anonymous aliases live in the foundation
// (FriendsAlias, thread key "forum:<postId>"). authorId / targetAuthorId are server-only columns:
// services/identity.js is the only place that turns them into payloads, and it never copies them out.
const { DataTypes } = require('sequelize');
const { uuidPk, jsonText, userFk, oneOf } = require('../foundation/common');
const F = require('./enums');

const fk = (model, allowNull = false) => ({
  type: DataTypes.UUID,
  allowNull,
  references: { model, key: 'id' },
  onDelete: 'CASCADE',
});

const init = (sequelize) => {
  const FriendsCommunity = sequelize.define('FriendsCommunity', {
    id: uuidPk(),
    campusId: { type: DataTypes.UUID, allowNull: false },
    slug: { type: DataTypes.STRING(40), allowNull: false },
    name: { type: DataTypes.STRING(60), allowNull: false },
    description: { type: DataTypes.STRING(300), allowNull: true },
    rules: jsonText('rules', []),
    kind: oneOf(F.COMMUNITY_KINDS, 'custom', 12),
    allowAnonymous: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    allowedTypes: jsonText('allowedTypes', F.POST_TYPES),
    status: oneOf(F.COMMUNITY_STATUS, 'active', 12),
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
    createdBy: { type: DataTypes.UUID, allowNull: true },
    memberCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    postCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'FriendsCommunities',
    timestamps: true,
    indexes: [
      { name: 'fcm_slug_uq', unique: true, fields: ['campusId', 'slug'] },
      { name: 'fcm_campus', fields: ['campusId', 'status', 'sortOrder'] },
    ],
  });

  const FriendsCommunityRole = sequelize.define('FriendsCommunityRole', {
    id: uuidPk(),
    communityId: fk('FriendsCommunities'),
    userId: userFk(false),
    role: oneOf(F.COMMUNITY_ROLES, 'moderator', 12),
    grantedBy: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'FriendsCommunityRoles',
    timestamps: true,
    indexes: [
      { name: 'fcr_uq', unique: true, fields: ['communityId', 'userId'] },
      { name: 'fcr_user', fields: ['userId'] },
    ],
  });

  const FriendsForumPost = sequelize.define('FriendsForumPost', {
    id: uuidPk(),
    communityId: fk('FriendsCommunities'),
    campusId: { type: DataTypes.UUID, allowNull: false },
    authorId: userFk(false), // private: never serialized
    clientId: { type: DataTypes.UUID, allowNull: true }, // idempotent create
    isAnonymous: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    aliasName: { type: DataTypes.STRING(40), allowNull: true },
    type: oneOf(F.POST_TYPES, 'discussion', 16),
    title: { type: DataTypes.STRING(150), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: true }, // <= 5000 chars, validated in the controller
    media: jsonText('media', []),
    links: jsonText('links', []),
    isOfficial: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isPinned: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isFreshersGuide: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isLocked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    bestCommentId: { type: DataTypes.UUID, allowNull: true },
    bestCredited: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    resourceCredited: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: oneOf(F.CONTENT_STATUS, 'visible', 16),
    removedReason: { type: DataTypes.STRING(300), allowNull: true },
    upCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    downCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    score: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    commentCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    hotRank: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0 },
    lastActivityAt: { type: DataTypes.DATE, allowNull: true },
    editedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'FriendsForumPosts',
    timestamps: true,
    indexes: [
      { name: 'ffp_new', fields: ['communityId', 'status', 'createdAt', 'id'] },
      { name: 'ffp_hot', fields: ['communityId', 'status', 'hotRank'] },
      { name: 'ffp_top', fields: ['communityId', 'status', 'score'] },
      { name: 'ffp_author', fields: ['authorId'] },
      { name: 'ffp_campus', fields: ['campusId', 'status', 'createdAt'] },
      { name: 'ffp_client_uq', unique: true, fields: ['authorId', 'clientId'] },
    ],
  });

  const FriendsForumComment = sequelize.define('FriendsForumComment', {
    id: uuidPk(),
    postId: fk('FriendsForumPosts'),
    parentId: { type: DataTypes.UUID, allowNull: true },
    depth: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    authorId: userFk(false), // private
    clientId: { type: DataTypes.UUID, allowNull: true },
    isAnonymous: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    aliasName: { type: DataTypes.STRING(40), allowNull: true },
    body: { type: DataTypes.TEXT, allowNull: false }, // <= 3000 chars
    status: oneOf(F.CONTENT_STATUS, 'visible', 16),
    removedReason: { type: DataTypes.STRING(300), allowNull: true },
    upCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    downCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    score: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    isOfficialReply: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    editedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'FriendsForumComments',
    timestamps: true,
    indexes: [
      { name: 'ffc_post', fields: ['postId', 'createdAt'] },
      { name: 'ffc_parent', fields: ['parentId'] },
      { name: 'ffc_author', fields: ['authorId'] },
      { name: 'ffc_client_uq', unique: true, fields: ['authorId', 'clientId'] },
    ],
  });

  // One row per (voter, target). Totals are always recounted from this table, so concurrent votes
  // can never drift. targetAuthorId (named content only) + karmaAwarded drive the karma cap.
  const FriendsVote = sequelize.define('FriendsVote', {
    id: uuidPk(),
    userId: userFk(false),
    targetType: oneOf(F.VOTE_TARGETS, undefined, 16),
    targetId: { type: DataTypes.UUID, allowNull: false },
    value: { type: DataTypes.SMALLINT, allowNull: false, validate: { isIn: [[-1, 1]] } },
    targetAuthorId: { type: DataTypes.UUID, allowNull: true }, // private, null for anonymous content
    karmaAwarded: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, {
    tableName: 'FriendsVotes',
    timestamps: true,
    indexes: [
      { name: 'fv_uq', unique: true, fields: ['userId', 'targetType', 'targetId'] },
      { name: 'fv_target', fields: ['targetType', 'targetId', 'value'] },
      { name: 'fv_karma', fields: ['userId', 'targetAuthorId', 'karmaAwarded', 'updatedAt'] },
    ],
  });

  const FriendsReviewTarget = sequelize.define('FriendsReviewTarget', {
    id: uuidPk(),
    campusId: { type: DataTypes.UUID, allowNull: false },
    kind: oneOf(F.REVIEW_KINDS, undefined, 16),
    name: { type: DataTypes.STRING(120), allowNull: false },
    nameKey: { type: DataTypes.STRING(120), allowNull: false },
    meta: jsonText('meta', {}), // { department?, code?, block?, facultyUserId?, entityId? }
    status: oneOf(F.REVIEW_TARGET_STATUS, 'pending', 12),
    createdBy: { type: DataTypes.UUID, allowNull: true },
    ratingSum: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    reviewCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'FriendsReviewTargets',
    timestamps: true,
    indexes: [
      { name: 'frt_uq', unique: true, fields: ['campusId', 'kind', 'nameKey'] },
      { name: 'frt_list', fields: ['campusId', 'status', 'kind'] },
    ],
  });

  const FriendsReview = sequelize.define('FriendsReview', {
    id: uuidPk(),
    targetId: fk('FriendsReviewTargets'),
    forumPostId: fk('FriendsForumPosts'),
    authorId: userFk(false), // the reviewer: private, never serialized
    rating: { type: DataTypes.SMALLINT, allowNull: false, validate: { min: 1, max: 5 } },
    pros: { type: DataTypes.STRING(500), allowNull: true },
    cons: { type: DataTypes.STRING(500), allowNull: true },
    periodLabel: { type: DataTypes.STRING(40), allowNull: true },
    context: jsonText('context', {}),
    status: oneOf(F.REVIEW_STATUS, 'published', 16),
    flags: jsonText('flags', []),
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    editedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'FriendsReviews',
    timestamps: true,
    indexes: [
      { name: 'frv_post_uq', unique: true, fields: ['forumPostId'] },
      { name: 'frv_target', fields: ['targetId', 'status', 'createdAt'] },
      // frv_active_uq (targetId, authorId) WHERE active is a partial unique: created in migrations/forum.js.
    ],
  });

  const FriendsReviewResponse = sequelize.define('FriendsReviewResponse', {
    id: uuidPk(),
    reviewId: fk('FriendsReviews'),
    responderId: { type: DataTypes.UUID, allowNull: false },
    responderRole: oneOf(F.RESPONDER_ROLES, undefined, 12),
    body: { type: DataTypes.STRING(1500), allowNull: false },
    status: oneOf(F.RESPONSE_STATUS, 'visible', 12),
    editedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'FriendsReviewResponses',
    timestamps: true,
    indexes: [{ name: 'frr_review_uq', unique: true, fields: ['reviewId'] }],
  });

  return {
    FriendsCommunity,
    FriendsCommunityRole,
    FriendsForumPost,
    FriendsForumComment,
    FriendsVote,
    FriendsReviewTarget,
    FriendsReview,
    FriendsReviewResponse,
  };
};

// Associations stay minimal: controllers query by id and serialize explicitly.
const associate = () => {};

module.exports = { init, associate, ENUMS: F };
