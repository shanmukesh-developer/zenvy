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
    // TEXT: JSON details often exceed 255 chars (Postgres VARCHAR(255) rejected the insert and the
    // audit row was lost). Existing tables are widened in config/sweepMigrations.js.
    details: {
      type: DataTypes.TEXT
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
