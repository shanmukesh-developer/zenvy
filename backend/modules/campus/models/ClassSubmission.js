const { DataTypes } = require('sequelize');

let ClassSubmission;

const initClassSubmissionModel = (sequelize) => {
  if (!sequelize) return null;

  ClassSubmission = sequelize.define('ClassSubmission', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    assignmentId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    studentId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    studentName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20), // 'turned_in' | 'late' | 'graded' | 'missing'
      defaultValue: 'turned_in',
    },
    submissionText: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fileUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    grade: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    privateFeedback: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    turnedInAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    }
  }, { timestamps: true });

  return ClassSubmission;
};

module.exports = {
  initClassSubmissionModel,
  getClassSubmissionModel: () => ClassSubmission,
};
