const { DataTypes } = require('sequelize');

let OtpCode;

/**
 * One row per OTP that was actually sent by SMS.
 * Only an HMAC of the code is stored — never the code itself.
 *   purpose:    'auth' (login / sign-up / Google link), 'reset_password', 'change_phone'
 *   attempts:   wrong guesses so far (max 5, then the code is dead)
 *   consumedAt: set once the code is used, superseded by a newer code, or burned by too many attempts
 *   createdAt:  doubles as "lastSentAt" for the resend cooldown and the daily cap
 */
const initOtpCodeModel = (sequelize) => {
  if (!sequelize) return null;

  OtpCode = sequelize.define('OtpCode', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    phone: { type: DataTypes.STRING(20), allowNull: false },
    purpose: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'auth' },
    codeHash: { type: DataTypes.STRING(128), allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    consumedAt: { type: DataTypes.DATE, allowNull: true },
    ip: { type: DataTypes.STRING(64), allowNull: true }
  }, {
    timestamps: true,
    indexes: [
      { fields: ['phone', 'purpose'] },
      { fields: ['createdAt'] }
    ]
  });

  return OtpCode;
};

const getOtpCodeModel = () => OtpCode;

module.exports = { initOtpCodeModel, getOtpCodeModel };
