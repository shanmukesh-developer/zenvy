const { DataTypes } = require('sequelize');
const { getSequelize } = require('../config/db');

let Order;

const getOrderModel = () => {
  if (Order) return Order;
  const sequelize = getSequelize();
  if (!sequelize) return null;

  Order = sequelize.define('Order', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    restaurantId: { type: DataTypes.STRING, allowNull: false },
    deliveryPartnerId: { type: DataTypes.STRING },
    items: { type: DataTypes.JSONB, defaultValue: [] },
    totalPrice: { type: DataTypes.FLOAT, allowNull: false },
    deliveryFee: { type: DataTypes.FLOAT, allowNull: false },
    batchDiscount: { type: DataTypes.FLOAT, defaultValue: 0 },
    gateDiscount: { type: DataTypes.FLOAT, defaultValue: 0 },
    finalPrice: { type: DataTypes.FLOAT, allowNull: false },
    status: {
      type: DataTypes.ENUM('Pending', 'Accepted', 'Preparing', 'PickedUp', 'Delivered', 'Cancelled'),
      defaultValue: 'Pending'
    },
    paymentStatus: {
      type: DataTypes.ENUM('Pending', 'Completed', 'Failed'),
      defaultValue: 'Pending'
    },
    deliverySlot: { type: DataTypes.STRING },
    hostelGateDelivery: { type: DataTypes.BOOLEAN, defaultValue: false },
    rating: { type: DataTypes.FLOAT },
    review: { type: DataTypes.TEXT }
  }, { timestamps: true });

  return Order;
};

module.exports = { getOrderModel };
