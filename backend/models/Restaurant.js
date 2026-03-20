const { DataTypes } = require('sequelize');

let Restaurant;

const initRestaurantModel = (sequelize) => {
  if (!sequelize) return null;

  Restaurant = sequelize.define('Restaurant', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    location: { type: DataTypes.STRING, allowNull: false },
    imageUrl: { type: DataTypes.STRING },
    rating: { type: DataTypes.FLOAT, defaultValue: 0 },
    deliveryTime: { type: DataTypes.INTEGER },
    commissionRate: { type: DataTypes.FLOAT, defaultValue: 10 },
    commissionType: { type: DataTypes.ENUM('percentage', 'flat'), defaultValue: 'percentage' },
    tags: { type: DataTypes.JSON, defaultValue: [] },
    operatingHours: { type: DataTypes.JSON, defaultValue: { start: '09:00', end: '22:00' } },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, { timestamps: true });

  return Restaurant;
};

module.exports = { initRestaurantModel, getRestaurantModel: () => Restaurant };
