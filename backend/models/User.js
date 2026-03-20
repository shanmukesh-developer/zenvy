const { DataTypes } = require('sequelize');
const { getSequelize } = require('../config/db');
const bcrypt = require('bcryptjs');

let User;

const getUserModel = () => {
  if (User) return User;
  const sequelize = getSequelize();
  if (!sequelize) return null;

  User = sequelize.define('User', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    hostelBlock: { type: DataTypes.STRING, allowNull: false },
    roomNumber: { type: DataTypes.STRING, allowNull: false },
    walletBalance: { type: DataTypes.FLOAT, defaultValue: 0 },
    streakCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    lastOrderDate: { type: DataTypes.DATE },
    totalOrders: { type: DataTypes.INTEGER, defaultValue: 0 },
    role: { type: DataTypes.ENUM('student', 'admin'), defaultValue: 'student' },
    zenPoints: { type: DataTypes.INTEGER, defaultValue: 0 },
    isElite: { type: DataTypes.BOOLEAN, defaultValue: false },
    fcmTokens: { type: DataTypes.JSONB, defaultValue: [] }
  }, { timestamps: true });

  User.beforeCreate(async (user) => {
    user.password = await bcrypt.hash(user.password, 10);
  });

  User.prototype.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  };

  return User;
};

module.exports = { getUserModel };
