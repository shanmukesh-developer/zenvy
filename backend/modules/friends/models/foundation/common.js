// Column helpers shared by every Friends model (SQLite and Postgres behave the same).
const { DataTypes } = require('sequelize');

const uuidPk = () => ({ type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true });

/** JSON stored as TEXT with a getter/setter, like the rest of the codebase (Conversation.participants). */
const jsonText = (name, fallback, extra = {}) => ({
  type: DataTypes.TEXT,
  allowNull: true,
  defaultValue: JSON.stringify(fallback),
  get() {
    const raw = this.getDataValue(name);
    if (raw == null) return JSON.parse(JSON.stringify(fallback));
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return JSON.parse(JSON.stringify(fallback)); }
  },
  set(val) {
    this.setDataValue(name, JSON.stringify(val === undefined || val === null ? fallback : val));
  },
  ...extra,
});

const userFk = (allowNull = false) => ({
  type: DataTypes.UUID,
  allowNull,
  references: { model: 'Users', key: 'id' },
  onDelete: 'CASCADE',
});

const oneOf = (values, defaultValue, len = 16) => ({
  type: DataTypes.STRING(len),
  allowNull: false,
  ...(defaultValue !== undefined ? { defaultValue } : {}),
  validate: { isIn: [values] },
});

module.exports = { uuidPk, jsonText, userFk, oneOf };
