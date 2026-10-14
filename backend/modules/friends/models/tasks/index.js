// Phase 3 — Tasks tables (friends_plan.md §3 "Phase 3 — Tasks"). A commission-free peer gig board:
// Zenvy is not an escrow, processor or guarantor, so NO payment column exists anywhere here (no UPI id,
// no "paid" flag, no fee). The optional UPI link is built on the client from an id the user types and
// is never sent to the server.
//
//  FriendsTasks             one row per task; lifecycle `status` + moderation `modStatus`.
//  FriendsTaskApplications  one row per (task, applicant). Partial unique fta_one_active (taskId) WHERE
//                           status IN ('selected','accepted') makes "one helper per task" a database rule
//                           (created in migrations/tasks.js; SQLite and Postgres both support it).
//  FriendsTaskReviews       mutual ratings after completion, one per (task, reviewer).
// Task chat reuses Conversations (refType 'task', refId = task id); guards/taskGuard.js authorizes it.
const { DataTypes } = require('sequelize');
const { uuidPk, jsonText, userFk, oneOf } = require('../foundation/common');
const T = require('./enums');

const init = (sequelize) => {
  const FriendsTask = sequelize.define('FriendsTask', {
    id: uuidPk(),
    campusId: { type: DataTypes.UUID, allowNull: false },
    posterId: userFk(false),
    clientId: { type: DataTypes.UUID, allowNull: true }, // idempotent create
    title: { type: DataTypes.STRING(T.TITLE_MAX), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false }, // <= 2000, validated in the controller
    category: oneOf(T.CATEGORIES, 'other', 20),
    rewardInr: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: T.REWARD_MIN, max: T.REWARD_MAX } },
    deadlineAt: { type: DataTypes.DATE, allowNull: false },
    skills: jsonText('skills', []),
    fulfillment: oneOf(T.FULFILLMENT, 'either', 12),
    areaHint: { type: DataTypes.STRING(T.AREA_HINT_MAX), allowNull: true }, // never an exact location
    media: jsonText('media', []), // [{ mediaId }]
    status: oneOf(T.TASK_STATUS, 'open', 16),
    modStatus: oneOf(T.MOD_STATUS, 'visible', 16),
    removedReason: { type: DataTypes.STRING(300), allowNull: true },
    // No FK on helperId: deleting a helper's account must not delete the poster's task history.
    helperId: { type: DataTypes.UUID, allowNull: true },
    conversationId: { type: DataTypes.UUID, allowNull: true },
    applicationCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    assignedAt: { type: DataTypes.DATE, allowNull: true },
    startedAt: { type: DataTypes.DATE, allowNull: true },
    submittedAt: { type: DataTypes.DATE, allowNull: true },
    submissionNote: { type: DataTypes.STRING(T.NOTE_MAX), allowNull: true },
    submissionRejections: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lastRejectionNote: { type: DataTypes.STRING(T.REASON_MAX), allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
    autoConfirmed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    chatClosesAt: { type: DataTypes.DATE, allowNull: true },
    cancelledAt: { type: DataTypes.DATE, allowNull: true },
    cancelledBy: { type: DataTypes.STRING(10), allowNull: true }, // poster | helper | moderator | system
    cancelReason: { type: DataTypes.STRING(T.REASON_MAX), allowNull: true },
    expiredAt: { type: DataTypes.DATE, allowNull: true },
    disputedAt: { type: DataTypes.DATE, allowNull: true },
    disputedBy: { type: DataTypes.STRING(10), allowNull: true }, // poster | helper
    disputeReason: { type: DataTypes.STRING(T.REASON_MAX), allowNull: true },
    disputeResolution: { type: DataTypes.STRING(T.REASON_MAX), allowNull: true },
    integrityFlags: jsonText('integrityFlags', []),
    editedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'FriendsTasks',
    timestamps: true,
    indexes: [
      { name: 'ft_board', fields: ['campusId', 'status', 'modStatus', 'createdAt'] },
      { name: 'ft_deadline', fields: ['status', 'deadlineAt'] },
      { name: 'ft_submitted', fields: ['status', 'submittedAt'] },
      { name: 'ft_poster', fields: ['posterId', 'createdAt'] },
      { name: 'ft_helper', fields: ['helperId', 'createdAt'] },
      { name: 'ft_client_uq', unique: true, fields: ['posterId', 'clientId'] },
    ],
  });

  const FriendsTaskApplication = sequelize.define('FriendsTaskApplication', {
    id: uuidPk(),
    taskId: { type: DataTypes.UUID, allowNull: false, references: { model: 'FriendsTasks', key: 'id' }, onDelete: 'CASCADE' },
    applicantId: userFk(false),
    note: { type: DataTypes.STRING(T.NOTE_MAX), allowNull: true },
    status: oneOf(T.APPLICATION_STATUS, 'pending', 12),
    removedByMod: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    selectedAt: { type: DataTypes.DATE, allowNull: true },
    decidedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'FriendsTaskApplications',
    timestamps: true,
    indexes: [
      { name: 'fta_uq', unique: true, fields: ['taskId', 'applicantId'] },
      { name: 'fta_task', fields: ['taskId', 'status', 'createdAt'] },
      { name: 'fta_applicant', fields: ['applicantId', 'createdAt'] },
      // fta_one_active (taskId) WHERE status IN ('selected','accepted') is a partial unique: migrations/tasks.js.
    ],
  });

  const FriendsTaskReview = sequelize.define('FriendsTaskReview', {
    id: uuidPk(),
    taskId: { type: DataTypes.UUID, allowNull: false, references: { model: 'FriendsTasks', key: 'id' }, onDelete: 'CASCADE' },
    reviewerId: userFk(false), // private: never serialized for anyone but the reviewer
    revieweeId: userFk(false),
    revieweeRole: oneOf(['poster', 'helper'], 'helper', 8),
    rating: { type: DataTypes.SMALLINT, allowNull: false, validate: { min: 1, max: 5 } },
    text: { type: DataTypes.STRING(T.REVIEW_TEXT_MAX), allowNull: true },
  }, {
    tableName: 'FriendsTaskReviews',
    timestamps: true,
    indexes: [
      { name: 'ftr_uq', unique: true, fields: ['taskId', 'reviewerId'] },
      { name: 'ftr_reviewee', fields: ['revieweeId', 'createdAt'] },
    ],
  });

  return { FriendsTask, FriendsTaskApplication, FriendsTaskReview };
};

// Associations stay minimal: the controller queries by id and serializes explicitly.
const associate = () => {};

module.exports = { init, associate, ENUMS: T };
