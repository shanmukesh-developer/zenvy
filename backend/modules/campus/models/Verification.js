const { DataTypes } = require('sequelize');

let Verification;

const initVerificationModel = (sequelize) => {
  if (!sequelize) return null;

  Verification = sequelize.define('CampusVerification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    campusId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    type: {
      type: DataTypes.STRING(20), // 'email_otp' | 'id_card'
      allowNull: false,
      defaultValue: 'email_otp',
    },
    collegeEmail: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    otp: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    otpExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    idCardImageUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20), // 'pending' | 'approved' | 'rejected'
      defaultValue: 'pending',
    },
    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    reviewNotes: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, { timestamps: true });

  return Verification;
};

module.exports = {
  initVerificationModel,
  getVerificationModel: () => Verification,
};
