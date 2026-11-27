const { DataTypes } = require('sequelize');

// First-order feedback (owner, 27 Nov 2026; routes/feedbackRoutes.js). After a customer's first delivered order the
// app asks once how it went: stars + a comment sent to ZenWe (read in Admin > App feedback). Sending it earns
// +30 ZenWe Points, once per customer. The Play Store review is a separate, unrewarded button (Google Play does not
// allow rewarding store reviews).
//   userId           one row per customer (unique)
//   status           'dismissed' (closed with Maybe later) | 'submitted'
//   rating, comment  what they sent (submitted only)
//   orderId          the delivered order the box was shown for
//   dismissCount     times closed with Maybe later (the box comes back once, after their next delivery)
//   dismissedAtDelivered  how many delivered orders they had when they last closed it
//   pointsAwarded    30 when the reward was credited
//   platform, appVersion  where it came from
let AppFeedback;

const initAppFeedbackModel = (sequelize) => {
  if (!sequelize) return null;
  AppFeedback = sequelize.define('AppFeedback', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'dismissed' },
    rating: { type: DataTypes.INTEGER, allowNull: true },
    comment: { type: DataTypes.TEXT, allowNull: true },
    orderId: { type: DataTypes.STRING(64), allowNull: true },
    dismissCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    dismissedAtDelivered: { type: DataTypes.INTEGER, allowNull: true },
    pointsAwarded: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    platform: { type: DataTypes.STRING(16), allowNull: true },
    appVersion: { type: DataTypes.STRING(24), allowNull: true },
  }, { tableName: 'AppFeedbacks', timestamps: true });
  return AppFeedback;
};

const getAppFeedbackModel = () => AppFeedback;

module.exports = { initAppFeedbackModel, getAppFeedbackModel };
