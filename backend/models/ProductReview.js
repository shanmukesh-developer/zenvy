const { DataTypes } = require('sequelize');

let ProductReview;

const initProductReviewModel = (sequelize) => {
  if (!sequelize) return null;

  ProductReview = sequelize.define('ProductReview', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    productId: { type: DataTypes.STRING, allowNull: false },
    productName: { type: DataTypes.STRING, allowNull: true },
    orderId: { type: DataTypes.STRING, allowNull: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    userName: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Verified Student' },
    userBlock: { type: DataTypes.STRING, allowNull: true, defaultValue: 'Campus Resident' },
    rating: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
    comment: { type: DataTypes.TEXT, allowNull: true },
    tags: { type: DataTypes.JSON, defaultValue: [] },
    verified: { type: DataTypes.BOOLEAN, defaultValue: true },
    helpfulCount: { type: DataTypes.INTEGER, defaultValue: 0 }
  }, {
    timestamps: true,
    indexes: [
      { fields: ['productId'] },
      { fields: ['userId'] },
      { fields: ['orderId'] }
    ]
  });

  return ProductReview;
};

module.exports = { initProductReviewModel, getProductReviewModel: () => ProductReview };
