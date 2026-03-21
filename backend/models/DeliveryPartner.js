const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

let DeliveryPartner;

const initDeliveryPartnerModel = (sequelize) => {
  if (!sequelize) return null;

  DeliveryPartner = sequelize.define('DeliveryPartner', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    vehicleType: { type: DataTypes.STRING },
    liveLocation: { type: DataTypes.JSON, defaultValue: { lat: null, lng: null } },
    isOnline: { type: DataTypes.BOOLEAN, defaultValue: false },
    currentOrderId: { type: DataTypes.STRING },
    totalEarnings: { type: DataTypes.FLOAT, defaultValue: 0 },
    zenPoints: { type: DataTypes.INTEGER, defaultValue: 0 },
    averageRating: { type: DataTypes.FLOAT, defaultValue: 5 },
    totalRatings: { type: DataTypes.INTEGER, defaultValue: 0 },
    fcmTokens: { type: DataTypes.JSON, defaultValue: [] },
    isApproved: { type: DataTypes.BOOLEAN, defaultValue: false }
  }, { 
    timestamps: true,
    indexes: [
      { fields: ['phone'] },
      { fields: ['isOnline'] }
    ]
  });

  DeliveryPartner.beforeCreate(async (partner) => {
    partner.password = await bcrypt.hash(partner.password, 10);
  });

  DeliveryPartner.prototype.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  };

  return DeliveryPartner;
};

module.exports = { initDeliveryPartnerModel, getDeliveryPartnerModel: () => DeliveryPartner };
