const { DataTypes } = require('sequelize');

let CampusPoll;

const initCampusPollModel = (sequelize) => {
  if (!sequelize) return null;

  CampusPoll = sequelize.define('CampusPoll', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    conversationId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    creatorId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    question: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    options: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
      get() {
        const val = this.getDataValue('options');
        try { return val ? JSON.parse(val) : []; } catch { return []; }
      },
      set(val) {
        this.setDataValue('options', JSON.stringify(val || []));
      }
    },
    isAnonymous: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isMulti: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    votes: {
      type: DataTypes.TEXT,
      defaultValue: '{}',
      get() {
        const val = this.getDataValue('votes');
        try { return val ? JSON.parse(val) : {}; } catch { return {}; }
      },
      set(val) {
        this.setDataValue('votes', JSON.stringify(val || {}));
      }
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    }
  }, { timestamps: true });

  return CampusPoll;
};

module.exports = {
  initCampusPollModel,
  getCampusPollModel: () => CampusPoll,
};
