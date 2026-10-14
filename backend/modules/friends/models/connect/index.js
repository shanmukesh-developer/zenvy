// Phase 4 — Connect tables (friends_plan.md §3 "Phase 4 — Connect"). Optional, 18+, same-campus discovery.
//
//  ConnectProfiles  one row per user who gave Connect consent. Created at consent (status 'setup'),
//                   discoverable only when 'active'. Deleting Connect deletes the row outright (no soft
//                   delete; services/connectDeletion.js). Liveness (manual selfie review by default) is
//                   tracked here; the selfie media is deleted as soon as an admin decides.
//  ConnectPhotos    private CampusMedia (purpose 'connect'); pending until an admin approves (D5).
//  ConnectSwipes    like / pass, one per ordered (from, to) pair (cs_uq).
//  ConnectMatches   one per unordered pair, stored ordered (userLowId < userHighId, cm_pair_uq), so two
//                   people can never have two matches, whatever the timing. The chat is an ordinary
//                   Conversation (refType 'connect', refId = match id) authorised by guards/connectGuard.js.
// No column stores GPS / location. Real names never leave the server through Connect payloads.
const { DataTypes } = require('sequelize');
const { uuidPk, jsonText, userFk, oneOf } = require('../foundation/common');
const C = require('./enums');

const init = (sequelize) => {
  const ConnectProfile = sequelize.define('ConnectProfile', {
    id: uuidPk(),
    userId: userFk(false),
    campusId: { type: DataTypes.UUID, allowNull: false },
    status: oneOf(C.PROFILE_STATUS, 'setup', 12),
    modStatus: oneOf(C.MOD_STATUS, 'visible', 16),
    modReason: { type: DataTypes.STRING(300), allowNull: true },
    displayName: { type: DataTypes.STRING(C.DISPLAY_NAME_MAX), allowNull: true },
    bio: { type: DataTypes.STRING(C.BIO_MAX), allowNull: true },
    interests: jsonText('interests', []),
    lookingFor: jsonText('lookingFor', []),
    showYear: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    showBranch: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    hiddenBranches: jsonText('hiddenBranches', []),
    hiddenYears: jsonText('hiddenYears', []),
    consentVersion: { type: DataTypes.INTEGER, allowNull: true },
    consentAt: { type: DataTypes.DATE, allowNull: true },
    ageDeclaredAt: { type: DataTypes.DATE, allowNull: true },
    livenessStatus: oneOf(C.LIVENESS_STATUS, 'none', 12),
    livenessProvider: { type: DataTypes.STRING(20), allowNull: true },
    livenessChallenge: { type: DataTypes.STRING(160), allowNull: true }, // manual mode: the gesture prompt
    livenessChallengeAt: { type: DataTypes.DATE, allowNull: true },
    livenessMediaId: { type: DataTypes.UUID, allowNull: true }, // deleted after the decision
    livenessSubmittedAt: { type: DataTypes.DATE, allowNull: true },
    livenessCheckedAt: { type: DataTypes.DATE, allowNull: true },
    livenessNote: { type: DataTypes.STRING(300), allowNull: true }, // reason shown to the user on a fail
    activatedAt: { type: DataTypes.DATE, allowNull: true },
    pausedAt: { type: DataTypes.DATE, allowNull: true },
    lastActiveAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'ConnectProfiles',
    timestamps: true,
    indexes: [
      { name: 'cp_user_uq', unique: true, fields: ['userId'] },
      { name: 'cp_discover', fields: ['campusId', 'status', 'lastActiveAt'] },
      { name: 'cp_liveness', fields: ['livenessStatus', 'livenessSubmittedAt'] },
    ],
  });

  const ConnectPhoto = sequelize.define('ConnectPhoto', {
    id: uuidPk(),
    userId: userFk(false),
    // Null once the bytes were deleted (rejected photo); the row stays so the user sees why.
    mediaId: { type: DataTypes.UUID, allowNull: true },
    position: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0, max: C.PHOTOS_MAX - 1 } },
    status: oneOf(C.PHOTO_STATUS, 'pending', 12),
    rejectReason: { type: DataTypes.STRING(200), allowNull: true },
    reviewedBy: { type: DataTypes.UUID, allowNull: true },
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'ConnectPhotos',
    timestamps: true,
    indexes: [
      { name: 'cph_uq', unique: true, fields: ['userId', 'position'] },
      { name: 'cph_status', fields: ['status', 'createdAt'] },
    ],
  });

  const ConnectSwipe = sequelize.define('ConnectSwipe', {
    id: uuidPk(),
    fromUserId: userFk(false),
    toUserId: userFk(false),
    campusId: { type: DataTypes.UUID, allowNull: true },
    action: oneOf(C.SWIPE_ACTIONS, undefined, 8),
  }, {
    tableName: 'ConnectSwipes',
    timestamps: true,
    indexes: [
      { name: 'cs_uq', unique: true, fields: ['fromUserId', 'toUserId'] },
      { name: 'cs_to', fields: ['toUserId', 'action'] },
    ],
  });

  const ConnectMatch = sequelize.define('ConnectMatch', {
    id: uuidPk(),
    userLowId: userFk(false),
    userHighId: userFk(false),
    campusId: { type: DataTypes.UUID, allowNull: true },
    status: oneOf(C.MATCH_STATUS, 'active', 12),
    conversationId: { type: DataTypes.UUID, allowNull: true },
    matchedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    endedAt: { type: DataTypes.DATE, allowNull: true },
    endedBy: { type: DataTypes.UUID, allowNull: true }, // server only, never sent to the other person
    purgedAt: { type: DataTypes.DATE, allowNull: true }, // retention: messages deleted
  }, {
    tableName: 'ConnectMatches',
    timestamps: true,
    indexes: [
      { name: 'cm_pair_uq', unique: true, fields: ['userLowId', 'userHighId'] },
      { name: 'cm_low', fields: ['userLowId', 'status'] },
      { name: 'cm_high', fields: ['userHighId', 'status'] },
      { name: 'cm_ended', fields: ['status', 'endedAt'] },
    ],
  });

  return { ConnectProfile, ConnectPhoto, ConnectSwipe, ConnectMatch };
};

// Services query by id and never serialize joins.
const associate = () => {};

module.exports = { init, associate };
