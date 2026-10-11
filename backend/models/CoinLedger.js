const { DataTypes } = require('sequelize');

let CoinLedger;

const initCoinLedgerModel = (sequelize) => {
  if (!sequelize) return null;
  CoinLedger = sequelize.define('CoinLedger', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    }
  }, {
    tableName: 'coin_ledger',
    timestamps: true,
    updatedAt: false,
  });
  return CoinLedger;
};

const getCoinLedgerModel = () => CoinLedger;

module.exports = { initCoinLedgerModel, getCoinLedgerModel };
