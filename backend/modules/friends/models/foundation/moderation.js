// Reports, the moderation/audit log, sanctions and appeals.
// Reporter / actor columns carry no FK so evidence survives account deletion.
const { DataTypes } = require('sequelize');
const { uuidPk, jsonText, userFk, oneOf } = require('./common');
const E = require('./enums');

const init = (sequelize) => {
  const FriendsReport = sequelize.define('FriendsReport', {
    id: uuidPk(),
    campusId: { type: DataTypes.UUID, allowNull: true },
    reporterId: { type: DataTypes.UUID, allowNull: false },
    targetType: oneOf(E.REPORT_TARGETS, undefined, 24),
    targetId: { type: DataTypes.UUID, allowNull: false },
    targetOwnerId: { type: DataTypes.UUID, allowNull: true }, // server only, never serialized to users
    subTab: oneOf(E.SUB_TABS, 'chat', 12),
    category: oneOf(E.REPORT_CATEGORIES, undefined, 24),
    note: { type: DataTypes.STRING(500), allowNull: true },
    snapshot: jsonText('snapshot', {}),
    severity: oneOf(E.SEVERITIES, 'low', 12),
    status: oneOf(E.REPORT_STATUS, 'open', 12),
    isSystem: { type: DataTypes.BOOLEAN, defaultValue: false },
    assignedTo: { type: DataTypes.UUID, allowNull: true },
    slaDueAt: { type: DataTypes.DATE, allowNull: true },
    resolvedBy: { type: DataTypes.UUID, allowNull: true },
    resolvedAt: { type: DataTypes.DATE, allowNull: true },
    decision: { type: DataTypes.STRING(16), allowNull: true },
    resolution: { type: DataTypes.STRING(500), allowNull: true },
    actionId: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'FriendsReports',
    timestamps: true,
    indexes: [
      { name: 'frp_dedupe', unique: true, fields: ['reporterId', 'targetType', 'targetId'] },
      { name: 'frp_queue', fields: ['status', 'severity', 'createdAt'] },
      { name: 'frp_target', fields: ['targetType', 'targetId'] },
      { name: 'frp_campus', fields: ['campusId', 'status'] },
    ],
  });

  // Moderation log and the Friends audit trail in one table.
  const FriendsModAction = sequelize.define('FriendsModAction', {
    id: uuidPk(),
    actorId: { type: DataTypes.UUID, allowNull: true }, // null for system actions
    actorRole: oneOf(E.ACTOR_ROLES, undefined, 16),
    action: oneOf(E.MOD_ACTIONS, undefined, 24),
    targetType: { type: DataTypes.STRING(24), allowNull: true },
    targetId: { type: DataTypes.UUID, allowNull: true },
    subjectUserId: { type: DataTypes.UUID, allowNull: true }, // the user the action affects (appeals)
    communityId: { type: DataTypes.UUID, allowNull: true },
    reportId: { type: DataTypes.UUID, allowNull: true },
    reason: { type: DataTypes.STRING(500), allowNull: true },
    meta: jsonText('meta', {}),
  }, {
    tableName: 'FriendsModActions',
    timestamps: true,
    indexes: [
      { name: 'fma_target', fields: ['targetType', 'targetId'] },
      { name: 'fma_actor', fields: ['actorId', 'createdAt'] },
      { name: 'fma_action', fields: ['action', 'createdAt'] },
      { name: 'fma_subject', fields: ['subjectUserId', 'createdAt'] },
    ],
  });

  const FriendsSanction = sequelize.define('FriendsSanction', {
    id: uuidPk(),
    userId: userFk(false),
    scope: oneOf(E.SANCTION_SCOPES, 'friends', 12),
    until: { type: DataTypes.DATE, allowNull: true }, // null = permanent
    reason: { type: DataTypes.STRING(500), allowNull: true },
    actionId: { type: DataTypes.UUID, allowNull: true },
    createdBy: { type: DataTypes.UUID, allowNull: true },
    liftedAt: { type: DataTypes.DATE, allowNull: true },
    liftedBy: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'FriendsSanctions',
    timestamps: true,
    indexes: [{ name: 'fsn_user', fields: ['userId', 'scope'] }],
  });

  const FriendsAppeal = sequelize.define('FriendsAppeal', {
    id: uuidPk(),
    userId: userFk(false),
    actionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'FriendsModActions', key: 'id' },
      onDelete: 'CASCADE',
    },
    text: { type: DataTypes.STRING(1000), allowNull: false },
    status: oneOf(E.APPEAL_STATUS, 'open', 12),
    reviewedBy: { type: DataTypes.UUID, allowNull: true },
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
    note: { type: DataTypes.STRING(500), allowNull: true },
  }, {
    tableName: 'FriendsAppeals',
    timestamps: true,
    indexes: [
      { name: 'fap_uq', unique: true, fields: ['userId', 'actionId'] },
      { name: 'fap_status', fields: ['status', 'createdAt'] },
    ],
  });

  // C2: moderation state of campus content that has no status column of its own (whispers, community
  // posts, lost & found, campus spot messages, groups, polls). No row = visible. Lists filter on it.
  const FriendsContentState = sequelize.define('FriendsContentState', {
    id: uuidPk(),
    targetType: { type: DataTypes.STRING(24), allowNull: false },
    targetId: { type: DataTypes.UUID, allowNull: false },
    status: oneOf(E.CONTENT_STATES, 'pending_review', 16),
    ownerId: { type: DataTypes.UUID, allowNull: true }, // server only
    updatedBy: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'FriendsContentStates',
    timestamps: true,
    indexes: [
      { name: 'fcs_target_uq', unique: true, fields: ['targetType', 'targetId'] },
      { name: 'fcs_status', fields: ['targetType', 'status'] },
    ],
  });

  return { FriendsReport, FriendsModAction, FriendsSanction, FriendsAppeal, FriendsContentState };
};

module.exports = { init };
