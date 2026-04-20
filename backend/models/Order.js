const { DataTypes } = require('sequelize');

let Order;

const initOrderModel = (sequelize) => {
  if (!sequelize) return null;

  Order = sequelize.define('Order', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    restaurantId: { type: DataTypes.UUID, allowNull: false },
    deliveryPartnerId: { type: DataTypes.UUID },
    items: { type: DataTypes.JSON, defaultValue: [] },
    totalPrice: { type: DataTypes.FLOAT, allowNull: false },
    deliveryFee: { type: DataTypes.FLOAT, allowNull: false },
    batchDiscount: { type: DataTypes.FLOAT, defaultValue: 0 },
    gateDiscount: { type: DataTypes.FLOAT, defaultValue: 0 },
    finalPrice: { type: DataTypes.FLOAT, allowNull: false },
    status: {
      type: DataTypes.ENUM('Pending', 'Accepted', 'Preparing', 'ReadyForPickup', 'PickedUp', 'Delivered', 'Cancelled'),
      defaultValue: 'Pending'
    },
    paymentStatus: {
      type: DataTypes.ENUM('Pending', 'Completed', 'Failed'),
      defaultValue: 'Pending'
    },
    paymentMethod: {
      type: DataTypes.ENUM('COD', 'UPI', 'Card'),
      allowNull: false
    },
    deliverySlot: { type: DataTypes.STRING },
    deliveryAddress: { type: DataTypes.TEXT },
    distance: { type: DataTypes.FLOAT },
    estDuration: { type: DataTypes.INTEGER },
    isSurge: { type: DataTypes.BOOLEAN, defaultValue: false },
    hostelGateDelivery: { type: DataTypes.BOOLEAN, defaultValue: false },
    rating: { type: DataTypes.FLOAT },
    review: { type: DataTypes.TEXT },
    deliveryPin: { type: DataTypes.STRING },
    upiUTR: { type: DataTypes.STRING },
    upiScreenshot: { type: DataTypes.STRING },
    upiStatus: {
      type: DataTypes.ENUM('Pending', 'Verified', 'Rejected'),
      defaultValue: 'Pending'
    }
  }, { 
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['status'] },
      { fields: ['createdAt'] }
    ]
  });

  return Order;
};

module.exports = { initOrderModel, getOrderModel: () => Order };
