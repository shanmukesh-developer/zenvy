// Phase 5 — Spaces tables (friends_plan.md §3 "Phase 5 — Spaces"). Live audio rooms over plain
// WebRTC (owner decision): media goes peer to peer between the apps; the server only stores the room,
// its members and reminders, and authorizes every signaling message (socket/spaces.js).
//
//  FriendsSpaces          one row per Space. Partial unique fsp_one_live (hostId) WHERE status='live'
//                         (migrations/spaces.js) makes "one live Space per host" a database rule.
//  FriendsSpaceMembers    one row per (Space, user): role, hand, host mute, removal, join / leave times.
//                         Live presence is kept in memory (socket/spacesState.js) and mirrored here.
//  FriendsSpaceReminders  "Remind me", one per (Space, user); sentAt makes the reminder job idempotent.
// There is NO recording column, table or code path: Spaces are never recorded or transcribed.
const { DataTypes } = require('sequelize');
const { uuidPk, userFk, oneOf } = require('../foundation/common');
const S = require('./enums');

const fk = (model) => ({
  type: DataTypes.UUID,
  allowNull: false,
  references: { model, key: 'id' },
  onDelete: 'CASCADE',
});

const init = (sequelize) => {
  const FriendsSpace = sequelize.define('FriendsSpace', {
    id: uuidPk(),
    campusId: { type: DataTypes.UUID, allowNull: false },
    hostId: userFk(false),
    entityId: { type: DataTypes.UUID, allowNull: true }, // hosted as a verified club / department (managers only)
    clientId: { type: DataTypes.UUID, allowNull: true }, // idempotent create
    title: { type: DataTypes.STRING(S.TITLE_MAX), allowNull: false },
    topic: { type: DataTypes.STRING(S.TOPIC_MAX), allowNull: true },
    description: { type: DataTypes.STRING(S.DESCRIPTION_MAX), allowNull: true },
    participation: oneOf(S.PARTICIPATION, 'request', 12),
    visibility: oneOf(S.VISIBILITY, 'campus', 12),
    status: oneOf(S.SPACE_STATUS, 'scheduled', 12),
    modStatus: oneOf(S.MOD_STATUS, 'visible', 16),
    removedReason: { type: DataTypes.STRING(300), allowNull: true },
    scheduledFor: { type: DataTypes.DATE, allowNull: true }, // UTC; the app shows local time
    startedAt: { type: DataTypes.DATE, allowNull: true },
    endedAt: { type: DataTypes.DATE, allowNull: true },
    endReason: { type: DataTypes.STRING(16), allowNull: true, validate: { isIn: [S.END_REASONS] } },
    maxSpeakers: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 6 },
    maxListeners: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 40 },
    peakListeners: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lastActiveAt: { type: DataTypes.DATE, allowNull: true }, // last time someone was in the room (abandoned-room job)
  }, {
    tableName: 'FriendsSpaces',
    timestamps: true,
    indexes: [
      { name: 'fsp_list', fields: ['campusId', 'status', 'scheduledFor'] },
      { name: 'fsp_host', fields: ['hostId', 'status'] },
      { name: 'fsp_due', fields: ['status', 'scheduledFor'] },
      { name: 'fsp_client_uq', unique: true, fields: ['hostId', 'clientId'] },
    ],
  });

  const FriendsSpaceMember = sequelize.define('FriendsSpaceMember', {
    id: uuidPk(),
    spaceId: fk('FriendsSpaces'),
    userId: userFk(false),
    role: oneOf(S.ROLES, 'listener', 12),
    handRaisedAt: { type: DataTypes.DATE, allowNull: true },
    mutedByHost: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    removedAt: { type: DataTypes.DATE, allowNull: true },
    removedBy: { type: DataTypes.UUID, allowNull: true },
    joinedAt: { type: DataTypes.DATE, allowNull: true },
    leftAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'FriendsSpaceMembers',
    timestamps: true,
    indexes: [
      { name: 'fsm_uq', unique: true, fields: ['spaceId', 'userId'] },
      { name: 'fsm_live', fields: ['spaceId', 'leftAt'] },
      { name: 'fsm_user', fields: ['userId', 'createdAt'] },
    ],
  });

  const FriendsSpaceReminder = sequelize.define('FriendsSpaceReminder', {
    id: uuidPk(),
    spaceId: fk('FriendsSpaces'),
    userId: userFk(false),
    sentAt: { type: DataTypes.DATE, allowNull: true },
    skippedReason: { type: DataTypes.STRING(16), allowNull: true, validate: { isIn: [S.REMINDER_SKIP] } },
  }, {
    tableName: 'FriendsSpaceReminders',
    timestamps: true,
    indexes: [
      { name: 'fsr_uq', unique: true, fields: ['spaceId', 'userId'] },
      { name: 'fsr_due', fields: ['sentAt', 'spaceId'] },
    ],
  });

  return { FriendsSpace, FriendsSpaceMember, FriendsSpaceReminder };
};

// Associations stay minimal: the controller queries by id and serializes explicitly.
const associate = () => {};

module.exports = { init, associate, ENUMS: S };
