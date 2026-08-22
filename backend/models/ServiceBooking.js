const { DataTypes } = require('sequelize');

let ServiceBooking;

const initServiceBookingModel = (sequelize) => {
  if (!sequelize) return null;

  ServiceBooking = sequelize.define('ServiceBooking', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    serviceType: {
      type: DataTypes.ENUM(
        'LAPTOP_REPAIR',
        'MOBILE_REPAIR',
        'PRINTOUT',
        'LAUNDRY',
        'ROOM_SHIFTING',
        'AUTO_RIDE',
        'BIKE_TAXI',
        'CLEANING'
      ),
      allowNull: false,
    },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    specifications: {
      type: DataTypes.JSON,
      defaultValue: {},
      get() {
        const val = this.getDataValue('specifications');
        if (typeof val === 'string') {
          try { return JSON.parse(val); } catch { return {}; }
        }
        return val || {};
      }
    },
    attachmentUrl: { type: DataTypes.TEXT },
    status: {
      type: DataTypes.ENUM(
        'REQUESTED',
        'DIAGNOSED_QUOTED',
        'CONFIRMED',
        'IN_PROGRESS',
        'READY_FOR_DELIVERY',
        'COMPLETED',
        'CANCELLED'
      ),
      defaultValue: 'REQUESTED',
    },
    quotedAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
    finalAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
    paymentStatus: {
      type: DataTypes.ENUM('Pending', 'Paid', 'Failed'),
      defaultValue: 'Pending',
    },
    paymentMethod: {
      type: DataTypes.STRING,
      defaultValue: 'COD',
    },
    pickupSlot: { type: DataTypes.STRING },
    hostelBlock: { type: DataTypes.STRING },
    roomNumber: { type: DataTypes.STRING },
    deliveryAddress: { type: DataTypes.TEXT },
    contactPhone: { type: DataTypes.STRING },
    assignedPartnerId: { type: DataTypes.UUID },
    driverDetails: {
      type: DataTypes.JSON,
      defaultValue: null,
      get() {
        const val = this.getDataValue('driverDetails');
        if (typeof val === 'string') {
          try { return JSON.parse(val); } catch { return null; }
        }
        return val;
      }
    },
    trackingHistory: {
      type: DataTypes.JSON,
      defaultValue: [],
      get() {
        const val = this.getDataValue('trackingHistory');
        if (typeof val === 'string') {
          try { return JSON.parse(val); } catch { return []; }
        }
        return val || [];
      }
    }
  }, {
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['serviceType'] },
      { fields: ['status'] },
      { fields: ['createdAt'] }
    ],
    hooks: {
      beforeCreate: (booking) => {
        if (sequelize.getDialect() === 'sqlite') {
          if (typeof booking.specifications !== 'string') {
            booking.specifications = JSON.stringify(booking.specifications || {});
          }
          if (booking.driverDetails && typeof booking.driverDetails !== 'string') {
            booking.driverDetails = JSON.stringify(booking.driverDetails);
          }
          if (typeof booking.trackingHistory !== 'string') {
            booking.trackingHistory = JSON.stringify(booking.trackingHistory || []);
          }
        }
      },
      beforeUpdate: (booking) => {
        if (sequelize.getDialect() === 'sqlite') {
          if (typeof booking.specifications !== 'string') {
            booking.specifications = JSON.stringify(booking.specifications || {});
          }
          if (booking.driverDetails && typeof booking.driverDetails !== 'string') {
            booking.driverDetails = JSON.stringify(booking.driverDetails);
          }
          if (typeof booking.trackingHistory !== 'string') {
            booking.trackingHistory = JSON.stringify(booking.trackingHistory || []);
          }
        }
      }
    }
  });

  return ServiceBooking;
};

module.exports = {
  initServiceBookingModel,
  getServiceBookingModel: () => ServiceBooking,
};
