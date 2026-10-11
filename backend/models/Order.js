const { DataTypes } = require('sequelize');

let Order;

const initOrderModel = (sequelize) => {
  if (!sequelize) return null;

  Order = sequelize.define('Order', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    restaurantId: { type: DataTypes.UUID, allowNull: false },
    deliveryPartnerId: { type: DataTypes.UUID },
    items: { 
      type: DataTypes.JSON, 
      defaultValue: [],
      get() {
        const rawValue = this.getDataValue('items');
        if (typeof rawValue === 'string') {
          try { return JSON.parse(rawValue); } catch { return []; }
        }
        return rawValue || [];
      }
    },
    totalPrice: { type: DataTypes.FLOAT, allowNull: false },
    deliveryFee: { type: DataTypes.FLOAT, allowNull: false },
    batchDiscount: { type: DataTypes.FLOAT, defaultValue: 0 },
    gateDiscount: { type: DataTypes.FLOAT, defaultValue: 0 },
    finalPrice: { type: DataTypes.FLOAT, allowNull: false },
    // Server-computed bill shown to the customer: { subtotal, deliveryFee, packagingFee, taxes, discounts[], totalDiscount, finalPrice, couponCode }
    priceBreakdown: { type: DataTypes.JSON, allowNull: true },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'Pending',
      validate: {
        isIn: [['Pending', 'Accepted', 'Preparing', 'ReadyForPickup', 'Picking', 'PickedUp', 'ArrivedAtGate', 'Delivered', 'Cancelled']]
      }
    },
    cancellationReason: { type: DataTypes.STRING },
    paymentStatus: {
      type: DataTypes.ENUM('Pending', 'Completed', 'Failed'),
      defaultValue: 'Pending'
    },
    // New orders: 'COD' or 'Wallet' only (validated in createOrder). 'UPI'/'Card' stay for old rows.
    paymentMethod: {
      type: DataTypes.ENUM('COD', 'UPI', 'Card', 'Wallet'),
      allowNull: false
    },
    deliverySlot: { type: DataTypes.STRING },
    deliveryAddress: { type: DataTypes.TEXT },
    // Customer's delivery notes, e.g. ["Call on arrival", "No plastic cutlery"] (also kept in deliveryAddress for older rider apps)
    deliveryInstructions: { type: DataTypes.JSON, allowNull: true },
    distance: { type: DataTypes.FLOAT },
    // When the order was actually handed over (set by the Delivered flip). Older rows: null, readers fall back to updatedAt.
    deliveredAt: { type: DataTypes.DATE, allowNull: true },
    estDuration: { type: DataTypes.INTEGER },
    isSurge: { type: DataTypes.BOOLEAN, defaultValue: false },
    hostelGateDelivery: { type: DataTypes.BOOLEAN, defaultValue: false },
    rating: { type: DataTypes.FLOAT },
    review: { type: DataTypes.TEXT },
    deliveryPin: { type: DataTypes.STRING },
    deliveryPinAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // wrong PINs entered by the rider
    upiUTR: { type: DataTypes.STRING },
    upiScreenshot: { type: DataTypes.TEXT },
    upiStatus: {
      type: DataTypes.ENUM('Pending', 'Verified', 'Rejected'),
      defaultValue: 'Pending'
    },
    proofImage: { type: DataTypes.TEXT },
    proofTimestamp: { type: DataTypes.DATE },
    payoutSettled: { type: DataTypes.BOOLEAN, defaultValue: false },
    riderPayoutSettled: { type: DataTypes.BOOLEAN, defaultValue: false },
    
    // Mega Basket & Kirana pre-purchase approval properties
    isPurchasingApprovedByCustomer: { type: DataTypes.BOOLEAN, defaultValue: false },
    itemPhotoUrl: { type: DataTypes.TEXT },
    billProofUrl: { type: DataTypes.TEXT },
    billAmount: { type: DataTypes.FLOAT },
    isBillApproved: { type: DataTypes.BOOLEAN, defaultValue: false },
    
    // Categories and multi-restaurant stops properties
    category: { type: DataTypes.STRING, defaultValue: 'Food' },
    isMultiRestaurant: { type: DataTypes.BOOLEAN, defaultValue: false },
    pickupStops: {
      type: DataTypes.JSON,
      defaultValue: [],
      get() {
        const rawValue = this.getDataValue('pickupStops');
        if (typeof rawValue === 'string') {
          try { return JSON.parse(rawValue); } catch { return []; }
        }
        return rawValue || [];
      }
    }
  }, { 
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['status'] },
      { fields: ['createdAt'] }
    ],
    hooks: {
      beforeCreate: (order) => {
        if (sequelize.getDialect() === 'sqlite') {
          if (typeof order.items !== 'string') {
            order.items = JSON.stringify(order.items);
          }
          if (typeof order.pickupStops !== 'string') {
            order.pickupStops = JSON.stringify(order.pickupStops || []);
          }
        }
      },
      beforeUpdate: (order) => {
        if (sequelize.getDialect() === 'sqlite') {
          if (typeof order.items !== 'string') {
            order.items = JSON.stringify(order.items);
          }
          if (typeof order.pickupStops !== 'string') {
            order.pickupStops = JSON.stringify(order.pickupStops || []);
          }
        }
      }
    }
  });

  return Order;
};

module.exports = { initOrderModel, getOrderModel: () => Order };
