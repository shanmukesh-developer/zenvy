const { DataTypes } = require('sequelize');

let GlobalConfig;

const initGlobalConfigModel = (sequelize) => {
  if (!sequelize) return null;

  GlobalConfig = sequelize.define('GlobalConfig', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    value: {
      type: DataTypes.JSON,
      allowNull: false
    },
    description: {
      type: DataTypes.STRING
    }
  });

  return GlobalConfig;
};

const getGlobalConfigModel = () => GlobalConfig;

module.exports = { initGlobalConfigModel, getGlobalConfigModel };
