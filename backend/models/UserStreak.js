const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const UserStreak = sequelize.define('UserStreak', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  currentStreak: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  longestStreak: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  lastActiveDate: {
    type: DataTypes.DATEONLY, // YYYY-MM-DD
    allowNull: true,
  }
}, {
  tableName: 'user_streaks',
  timestamps: true,
});

module.exports = UserStreak;
