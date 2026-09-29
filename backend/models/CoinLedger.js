const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CoinLedger = sequelize.define('CoinLedger', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.STRING, // Depending on User.js ID type, usually string/uuid
    allowNull: false,
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  source: {
    type: DataTypes.STRING, // e.g., 'daily_drop', 'campus_quiz', 'mess_vote'
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  tableName: 'coin_ledger',
  timestamps: true,
  updatedAt: false, // Only need createdAt for a ledger
});

module.exports = CoinLedger;
