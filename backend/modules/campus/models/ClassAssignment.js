const { DataTypes } = require('sequelize');

let ClassAssignment;

const initClassAssignmentModel = (sequelize) => {
  if (!sequelize) return null;

  ClassAssignment = sequelize.define('ClassAssignment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    conversationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    facultyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    facultyName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    topic: {
      type: DataTypes.STRING,
      defaultValue: 'General',
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
    },
    dueDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    attachments: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
      get() {
        const val = this.getDataValue('attachments');
        try { return val ? JSON.parse(val) : []; } catch { return []; }
      },
      set(val) {
        this.setDataValue('attachments', JSON.stringify(val || []));
      }
    }
  }, { timestamps: true });

  return ClassAssignment;
};

module.exports = {
  initClassAssignmentModel,
  getClassAssignmentModel: () => ClassAssignment,
};
