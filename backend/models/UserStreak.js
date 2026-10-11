const { DataTypes } = require('sequelize');

let UserStreak;

const initUserStreakModel = (sequelize) => {
  if (!sequelize) return null;
  UserStreak = sequelize.define('UserStreak', {
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
      type: DataTypes.DATEONLY,
      allowNull: true,
    }
  }, {
    tableName: 'user_streaks',
    timestamps: true,
  });
  return UserStreak;
};

const getUserStreakModel = () => UserStreak;

module.exports = { initUserStreakModel, getUserStreakModel };
