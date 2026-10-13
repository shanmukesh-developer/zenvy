// Follows / mutes / memberships, verified entities, reactions, karma, badges and per-thread aliases.
const { DataTypes } = require('sequelize');
const { uuidPk, jsonText, userFk, oneOf } = require('./common');
const E = require('./enums');

const init = (sequelize) => {
  const FriendsEdge = sequelize.define('FriendsEdge', {
    id: uuidPk(),
    userId: userFk(false),
    kind: oneOf(E.EDGE_KINDS, undefined, 12),
    targetType: oneOf(E.EDGE_TARGETS, undefined, 16),
    targetId: { type: DataTypes.UUID, allowNull: false },
  }, {
    tableName: 'FriendsEdges',
    timestamps: true,
    indexes: [
      { name: 'fe_uq', unique: true, fields: ['userId', 'kind', 'targetType', 'targetId'] },
      { name: 'fe_target', fields: ['targetType', 'targetId', 'kind'] },
    ],
  });

  // Verified clubs / departments / vendors / official accounts. Created by admins only.
  const FriendsEntity = sequelize.define('FriendsEntity', {
    id: uuidPk(),
    campusId: { type: DataTypes.UUID, allowNull: false },
    type: oneOf(E.ENTITY_TYPES, undefined, 16),
    name: { type: DataTypes.STRING(80), allowNull: false },
    handle: { type: DataTypes.STRING(40), allowNull: false },
    description: { type: DataTypes.STRING(300), allowNull: true },
    avatarUrl: { type: DataTypes.TEXT, allowNull: true },
    verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    managerIds: jsonText('managerIds', []),
    status: oneOf(E.ENTITY_STATUS, 'active', 12),
    createdBy: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'FriendsEntities',
    timestamps: true,
    indexes: [{ name: 'fen_handle_uq', unique: true, fields: ['campusId', 'handle'] }],
  });

  const FriendsReaction = sequelize.define('FriendsReaction', {
    id: uuidPk(),
    userId: userFk(false),
    targetType: oneOf(E.REACTION_TARGETS, undefined, 16),
    targetId: { type: DataTypes.UUID, allowNull: false },
    kind: oneOf(E.REACTION_KINDS, undefined, 12),
  }, {
    tableName: 'FriendsReactions',
    timestamps: true,
    indexes: [
      { name: 'fr_uq', unique: true, fields: ['userId', 'targetType', 'targetId', 'kind'] },
      { name: 'fr_target', fields: ['targetType', 'targetId', 'kind'] },
    ],
  });

  const FriendsKarma = sequelize.define('FriendsKarma', {
    id: uuidPk(),
    userId: userFk(false),
    campusId: { type: DataTypes.UUID, allowNull: true },
    karma: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    helpfulAnswers: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    resourcesShared: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    tasksCompleted: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    taskRatingSum: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    taskRatingCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'FriendsKarma',
    timestamps: true,
    indexes: [{ name: 'fk_user_uq', unique: true, fields: ['userId'] }],
  });

  const FriendsBadge = sequelize.define('FriendsBadge', {
    id: uuidPk(),
    userId: userFk(false),
    code: { type: DataTypes.STRING(40), allowNull: false },
    source: oneOf(E.BADGE_SOURCES, 'auto', 8),
    grantedBy: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'FriendsBadges',
    timestamps: true,
    indexes: [{ name: 'fb_uq', unique: true, fields: ['userId', 'code'] }],
  });

  // Anonymous aliases shared by Pulse and Forum: one alias per (thread, user), unique within a thread.
  // Never serialized; services/alias.js is the only reader.
  const FriendsAlias = sequelize.define('FriendsAlias', {
    id: uuidPk(),
    threadKey: { type: DataTypes.STRING(80), allowNull: false },
    userId: userFk(false),
    alias: { type: DataTypes.STRING(40), allowNull: false },
  }, {
    tableName: 'FriendsAliases',
    timestamps: true,
    indexes: [
      { name: 'fal_uq', unique: true, fields: ['threadKey', 'userId'] },
      { name: 'fal_alias_uq', unique: true, fields: ['threadKey', 'alias'] },
    ],
  });

  return { FriendsEdge, FriendsEntity, FriendsReaction, FriendsKarma, FriendsBadge, FriendsAlias };
};

module.exports = { init };
