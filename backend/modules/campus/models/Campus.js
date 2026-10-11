const { DataTypes } = require('sequelize');

let Campus;

const initCampusModel = (sequelize) => {
  if (!sequelize) return null;

  Campus = sequelize.define('Campus', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    emailDomains: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
      get() {
        const val = this.getDataValue('emailDomains');
        try { return val ? JSON.parse(val) : []; } catch { return []; }
      },
      set(val) {
        this.setDataValue('emailDomains', JSON.stringify(val || []));
      }
    },
    city: {
      type: DataTypes.STRING,
      defaultValue: 'Amaravathi',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    settings: {
      type: DataTypes.TEXT,
      defaultValue: '{}',
      get() {
        const val = this.getDataValue('settings');
        try { return val ? JSON.parse(val) : {}; } catch { return {}; }
      },
      set(val) {
        this.setDataValue('settings', JSON.stringify(val || {}));
      }
    }
  }, { timestamps: true });

  return Campus;
};

module.exports = {
  initCampusModel,
  getCampusModel: () => Campus
};
