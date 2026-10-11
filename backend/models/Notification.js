const { DataTypes } = require('sequelize');

// In-app notification history. One row per user per push, written by utils/push.js
// whenever a push is sent (even when the user has no device token), so the
// Notifications screen shows everything — including pushes that arrived while the app was closed.
let Notification;

const initNotificationModel = (sequelize) => {
  if (!sequelize) return null;

  Notification = sequelize.define('Notification', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: true },
    // ORDER_UPDATE, GATE_ARRIVAL, SUPPORT_TICKET, PG_BOOKING_STATUS, campaign, global_broadcast, …
    type: { type: DataTypes.STRING(40), allowNull: true },
    orderId: { type: DataTypes.STRING(64), allowNull: true },
    data: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const val = this.getDataValue('data');
        if (!val) return {};
        try { return JSON.parse(val); } catch { return {}; }
      },
      set(val) {
        this.setDataValue('data', val ? JSON.stringify(val) : null);
      },
    },
    readAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    timestamps: true,
    indexes: [
      { fields: ['userId', 'createdAt'] },
    ],
  });

  return Notification;
};

const getNotificationModel = () => {
  if (!Notification) throw new Error('Notification model not initialized. Call initNotificationModel first.');
  return Notification;
};

module.exports = { initNotificationModel, getNotificationModel };
