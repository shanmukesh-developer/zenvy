const { DataTypes } = require('sequelize');

let VaultItem;

const initVaultItemModel = (sequelize) => {
  if (!sequelize) return null;

  VaultItem = sequelize.define('VaultItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    originalPrice: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    remainingCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    imageUrl: {
      type: DataTypes.STRING
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    resetAt: {
      type: DataTypes.DATE
    },
    streakRequirement: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, { timestamps: true });

  return VaultItem;
};

const getVaultItemModel = () => VaultItem;

module.exports = { initVaultItemModel, getVaultItemModel };
