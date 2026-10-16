const { DataTypes } = require('sequelize');

// One row per client retry key (Idempotency-Key header / body field) of a money / booking POST
// (utils/idempotency.js). Shared by every server process, so a retry that lands on another process
// (deploy overlap, 2+ instances) still gets 409 while the first request runs and the stored answer
// after it finished.
//   scope + userId + key   unique (named index "idempotency_keys_scope_user_key")
//   status                 'in_progress' while the first request runs, 'done' once it answered
//   token                  random per claim: only the claimer may finish / release its row
//   responseStatus/Body    the stored answer (JSON text, size-capped; NULL when it was too big:
//                          the route's own durable check answers the retry then)
//   expiresAt              in_progress: a stuck claim frees itself; done: end of the replay window.
//                          Expired rows are deleted by the 'idempotency.cleanup' job (jobs/index.js).
let IdempotencyKey;

const initIdempotencyKeyModel = (sequelize) => {
  if (!sequelize) return null;

  IdempotencyKey = sequelize.define('IdempotencyKey', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    scope: { type: DataTypes.STRING(40), allowNull: false },
    userId: { type: DataTypes.STRING(64), allowNull: false },
    key: { type: DataTypes.STRING(120), allowNull: false },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'in_progress' },
    token: { type: DataTypes.STRING(64), allowNull: false },
    responseStatus: { type: DataTypes.INTEGER, allowNull: true },
    responseBody: { type: DataTypes.TEXT, allowNull: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
  }, {
    tableName: 'IdempotencyKeys',
    timestamps: true,
    indexes: [
      { name: 'idempotency_keys_scope_user_key', unique: true, fields: ['scope', 'userId', 'key'] },
      { name: 'idempotency_keys_expires_at', fields: ['expiresAt'] },
    ],
  });

  return IdempotencyKey;
};

const getIdempotencyKeyModel = () => IdempotencyKey;

module.exports = { initIdempotencyKeyModel, getIdempotencyKeyModel };
