const { DataTypes } = require('sequelize');
const { getSequelize } = require('../config/db');

let Restaurant;

const getRestaurantModel = () => {
  if (Restaurant) return Restaurant;
  const sequelize = getSequelize();
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
    tags: { type: DataTypes.JSONB, defaultValue: [] },
    operatingHours: { type: DataTypes.JSONB, defaultValue: { start: '09:00', end: '22:00' } },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, { timestamps: true });

  return Restaurant;
};

module.exports = { getRestaurantModel };
