const { DataTypes } = require('sequelize');

// C1-6: platform-wide SMS budget, one row per IST day (utils/smsBudget.js). Shared by every server
// process, so the daily cap holds across deploy overlap / 2+ instances.
//   day        'YYYY-MM-DD' (IST), primary key
//   count      SMS reserved today (incremented atomically: count = count + 1 WHERE count < cap)
//   alertedAt  set once (conditional update) when the cap is first hit: admins are pushed once a day
let SmsDailyCount;

const initSmsDailyCountModel = (sequelize) => {
  if (!sequelize) return null;
  SmsDailyCount = sequelize.define('SmsDailyCount', {
    day: { type: DataTypes.STRING(10), primaryKey: true },
    count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    alertedAt: { type: DataTypes.DATE, allowNull: true },
  }, { tableName: 'SmsDailyCounts', timestamps: true });
  return SmsDailyCount;
};

const getSmsDailyCountModel = () => SmsDailyCount;

module.exports = { initSmsDailyCountModel, getSmsDailyCountModel };
