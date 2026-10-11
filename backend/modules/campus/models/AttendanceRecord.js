const { DataTypes } = require('sequelize');

let AttendanceRecord;

const initAttendanceRecordModel = (sequelize) => {
  if (!sequelize) return null;

  AttendanceRecord = sequelize.define('CampusAttendanceRecord', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    courseCode: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    courseName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    totalClasses: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    attendedClasses: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    threshold: {
      type: DataTypes.INTEGER,
      defaultValue: 75, // 75% minimum attendance rule
    }
  }, { timestamps: true });

  return AttendanceRecord;
};

module.exports = {
  initAttendanceRecordModel,
  getAttendanceRecordModel: () => AttendanceRecord,
};
