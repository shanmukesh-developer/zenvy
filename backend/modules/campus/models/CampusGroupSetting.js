const { DataTypes } = require('sequelize');

// Campus-only settings for a group chat (the Conversation row is shared with the rest of the app).
// discoverable = shows up in GET /api/campus/search and anyone on that campus can join without a code.
let CampusGroupSetting;

const initCampusGroupSettingModel = (sequelize) => {
  if (!sequelize) return null;

  CampusGroupSetting = sequelize.define('CampusGroupSetting', {
    conversationId: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    campusId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    discoverable: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, { timestamps: true, indexes: [{ fields: ['campusId', 'discoverable'] }] });

  return CampusGroupSetting;
};

module.exports = {
  initCampusGroupSettingModel,
  getCampusGroupSettingModel: () => CampusGroupSetting,
};
