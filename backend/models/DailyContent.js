const { DataTypes } = require('sequelize');

let DailyContent;

const initDailyContentModel = (sequelize) => {
  if (!sequelize) return null;

  DailyContent = sequelize.define('DailyContent', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    activeDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    }
  }, {
    tableName: 'daily_content',
    timestamps: true,
  });

  return DailyContent;
};

const getDailyContentModel = () => DailyContent;

module.exports = { initDailyContentModel, getDailyContentModel };
