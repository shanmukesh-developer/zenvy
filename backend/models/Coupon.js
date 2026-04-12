const { DataTypes } = require('sequelize');

let Coupon;

const initCouponModel = (sequelize) => {
  if (!sequelize) return null;

  Coupon = sequelize.define('Coupon', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    type: { type: DataTypes.ENUM('FREEDEL', 'DISCOUNT'), defaultValue: 'FREEDEL' },
    value: { type: DataTypes.FLOAT, defaultValue: 0 },
    userId: { type: DataTypes.UUID, allowNull: false },
    isUsed: { type: DataTypes.BOOLEAN, defaultValue: false },
    expiryDate: { type: DataTypes.DATE }
  }, { timestamps: true });

  return Coupon;
};

module.exports = { initCouponModel, getCouponModel: () => Coupon };
