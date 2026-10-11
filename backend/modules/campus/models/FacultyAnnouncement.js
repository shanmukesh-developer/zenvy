const { DataTypes } = require('sequelize');

let FacultyAnnouncement;

const initFacultyAnnouncementModel = (sequelize) => {
  if (!sequelize) return null;

  FacultyAnnouncement = sequelize.define('FacultyAnnouncement', {
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
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    priority: {
      type: DataTypes.STRING(20), // 'normal' | 'deadline' | 'urgent'
      defaultValue: 'normal',
    },
    acks: {
      type: DataTypes.TEXT, // Array of userIds who pressed "Got it"
      defaultValue: '[]',
      get() {
        const val = this.getDataValue('acks');
        try { return val ? JSON.parse(val) : []; } catch { return []; }
      },
      set(val) {
        this.setDataValue('acks', JSON.stringify(val || []));
      }
    },
    seenBy: {
      type: DataTypes.TEXT, // Array of userIds who saw this
      defaultValue: '[]',
      get() {
        const val = this.getDataValue('seenBy');
        try { return val ? JSON.parse(val) : []; } catch { return []; }
      },
      set(val) {
        this.setDataValue('seenBy', JSON.stringify(val || []));
      }
    }
  }, { timestamps: true });

  return FacultyAnnouncement;
};

module.exports = {
  initFacultyAnnouncementModel,
  getFacultyAnnouncementModel: () => FacultyAnnouncement,
};
