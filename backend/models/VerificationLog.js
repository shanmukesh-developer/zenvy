const { DataTypes } = require('sequelize');

let VerificationLog;

const initVerificationLogModel = (sequelize) => {
  if (!sequelize) return null;

  VerificationLog = sequelize.define('VerificationLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    adminId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    targetId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false
    },
    details: {
      type: DataTypes.STRING
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, { timestamps: false });

  return VerificationLog;
};

const getVerificationLogModel = () => VerificationLog;

module.exports = { initVerificationLogModel, getVerificationLogModel };
