// FriendsSettings (one row per user) and FriendsConsent (guideline / Connect consent records).
const { DataTypes } = require('sequelize');
const { uuidPk, jsonText, userFk, oneOf } = require('./common');
const E = require('./enums');

const DEFAULT_NOTIF_PREFS = {
  replies: true,
  mentions: true,
  follows: true,
  forum: true,
  spaces: true,
  tasks: true,
  connect: true,
  moderation: true,
  lockScreenPreviews: false,
};

const init = (sequelize) => {
  const FriendsSettings = sequelize.define('FriendsSettings', {
    id: uuidPk(),
    userId: userFk(false),
    guidelinesVersion: { type: DataTypes.INTEGER, allowNull: true },
    guidelinesAcceptedAt: { type: DataTypes.DATE, allowNull: true },
    profileVisibility: oneOf(E.PROFILE_VISIBILITY, 'campus'),
    showYear: { type: DataTypes.BOOLEAN, defaultValue: true },
    showBranch: { type: DataTypes.BOOLEAN, defaultValue: true },
    defaultAnonymous: { type: DataTypes.BOOLEAN, defaultValue: false },
    notifPrefs: jsonText('notifPrefs', DEFAULT_NOTIF_PREFS),
  }, {
    tableName: 'FriendsSettings',
    timestamps: true,
    indexes: [{ name: 'fs_user_uq', unique: true, fields: ['userId'] }],
  });

  // No FK on userId: consent records are evidence and outlive the settings row.
  const FriendsConsent = sequelize.define('FriendsConsent', {
    id: uuidPk(),
    userId: { type: DataTypes.UUID, allowNull: false },
    kind: oneOf(E.CONSENT_KINDS, undefined, 32),
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    acceptedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    withdrawnAt: { type: DataTypes.DATE, allowNull: true },
    ipHash: { type: DataTypes.STRING(64), allowNull: true },
  }, {
    tableName: 'FriendsConsents',
    timestamps: true,
    indexes: [{ name: 'fc_user', fields: ['userId', 'kind'] }],
  });

  return { FriendsSettings, FriendsConsent };
};

module.exports = { init, DEFAULT_NOTIF_PREFS };
