// Phase 2 — Pulse tables (friends_plan.md §3 "Phase 2 — Pulse").
// Posts and replies (one table; rootId/parentId build the thread), Space cards (kind 'space_card',
// written by the Spaces phase), polls + one vote per user, per-campus hashtags and the post<->hashtag
// links that trends are computed from. Likes, reposts and bookmarks reuse the foundation table
// FriendsReactions (targetType 'post'); follows and mutes reuse FriendsEdges; anonymous aliases reuse
// FriendsAliases (thread key "pulse:<rootId>").
// authorId is a server-only column: services/identity.js is the only place that turns it into a
// payload, and it never copies it out (anonymous posts become { anonymous, alias, isMine? }).
const { DataTypes } = require('sequelize');
const { uuidPk, jsonText, userFk, oneOf } = require('../foundation/common');
const P = require('./enums');

const fk = (model, allowNull = false) => ({
  type: DataTypes.UUID,
  allowNull,
  references: { model, key: 'id' },
  onDelete: 'CASCADE',
});

const init = (sequelize) => {
  const FriendsPost = sequelize.define('FriendsPost', {
    id: uuidPk(),
    campusId: { type: DataTypes.UUID, allowNull: false },
    authorId: userFk(false), // private: never serialized
    entityId: { type: DataTypes.UUID, allowNull: true }, // posted as a verified club / department / official account
    clientId: { type: DataTypes.UUID, allowNull: true }, // idempotent create (and the whisper id for imported whispers)
    source: oneOf(P.POST_SOURCES, 'app', 12),
    isAnonymous: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    aliasName: { type: DataTypes.STRING(40), allowNull: true },
    kind: oneOf(P.POST_KINDS, 'post', 12),
    rootId: { type: DataTypes.UUID, allowNull: true }, // null = this is a root post
    parentId: { type: DataTypes.UUID, allowNull: true },
    spaceId: { type: DataTypes.UUID, allowNull: true }, // kind 'space_card' only
    text: { type: DataTypes.TEXT, allowNull: true }, // <= 280, validated in the controller
    media: jsonText('media', []), // [{ mediaId }]
    link: jsonText('link', null), // { url, host } | null
    pollId: { type: DataTypes.UUID, allowNull: true },
    replyPolicy: oneOf(P.REPLY_POLICIES, 'everyone', 12),
    status: oneOf(P.POST_STATUS, 'visible', 16),
    removedReason: { type: DataTypes.STRING(300), allowNull: true },
    likeCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    replyCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    repostCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    editedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'FriendsPosts',
    timestamps: true,
    indexes: [
      { name: 'fpo_feed', fields: ['campusId', 'status', 'createdAt', 'id'] },
      { name: 'fpo_root', fields: ['rootId', 'createdAt'] },
      { name: 'fpo_parent', fields: ['parentId', 'createdAt'] },
      { name: 'fpo_author', fields: ['authorId', 'createdAt'] },
      { name: 'fpo_entity', fields: ['entityId', 'createdAt'] },
      { name: 'fpo_space', fields: ['spaceId'] },
      { name: 'fpo_client_uq', unique: true, fields: ['authorId', 'clientId'] },
    ],
  });

  // postId has no FK on purpose: the poll row is written first so a post is never visible without
  // its poll (see pulseController.createPost); fpl_post_uq keeps it one poll per post.
  const FriendsPoll = sequelize.define('FriendsPoll', {
    id: uuidPk(),
    postId: { type: DataTypes.UUID, allowNull: false },
    options: jsonText('options', []), // 2..4 labels, <= 40 chars each
    closesAt: { type: DataTypes.DATE, allowNull: false },
  }, {
    tableName: 'FriendsPolls',
    timestamps: true,
    indexes: [{ name: 'fpl_post_uq', unique: true, fields: ['postId'] }],
  });

  const FriendsPollVote = sequelize.define('FriendsPollVote', {
    id: uuidPk(),
    pollId: fk('FriendsPolls'),
    userId: userFk(false),
    optionIdx: { type: DataTypes.SMALLINT, allowNull: false, validate: { min: 0, max: P.POLL_MAX_OPTIONS - 1 } },
  }, {
    tableName: 'FriendsPollVotes',
    timestamps: true,
    indexes: [
      { name: 'fpv_uq', unique: true, fields: ['pollId', 'userId'] },
      { name: 'fpv_poll', fields: ['pollId', 'optionIdx'] },
    ],
  });

  const FriendsHashtag = sequelize.define('FriendsHashtag', {
    id: uuidPk(),
    campusId: { type: DataTypes.UUID, allowNull: false },
    tag: { type: DataTypes.STRING(P.HASHTAG_MAX), allowNull: false }, // lower case, no '#'
    postCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lastUsedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'FriendsHashtags',
    timestamps: true,
    indexes: [
      { name: 'fht_uq', unique: true, fields: ['campusId', 'tag'] },
      { name: 'fht_recent', fields: ['campusId', 'lastUsedAt'] },
    ],
  });

  // authorId is copied here (private) so trends can count distinct authors without a join.
  const FriendsPostHashtag = sequelize.define('FriendsPostHashtag', {
    id: uuidPk(),
    postId: fk('FriendsPosts'),
    hashtagId: fk('FriendsHashtags'),
    campusId: { type: DataTypes.UUID, allowNull: false },
    authorId: { type: DataTypes.UUID, allowNull: false },
  }, {
    tableName: 'FriendsPostHashtags',
    timestamps: true,
    indexes: [
      { name: 'fph_uq', unique: true, fields: ['postId', 'hashtagId'] },
      { name: 'fph_trend', fields: ['campusId', 'createdAt'] },
      { name: 'fph_tag', fields: ['hashtagId', 'createdAt'] },
    ],
  });

  return { FriendsPost, FriendsPoll, FriendsPollVote, FriendsHashtag, FriendsPostHashtag };
};

// Associations stay minimal: the controller queries by id and serializes explicitly.
const associate = () => {};

module.exports = { init, associate, ENUMS: P };
