const { DataTypes } = require('sequelize');

let CampusProfile;

const initCampusProfileModel = (sequelize) => {
  if (!sequelize) return null;

  CampusProfile = sequelize.define('CampusProfile', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    campusId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    collegeId: {
      type: DataTypes.STRING(50), // Student Roll / ID
      allowNull: true,
    },
    branch: {
      type: DataTypes.STRING(50), // e.g. CSE, ECE
      allowNull: true,
    },
    year: {
      type: DataTypes.INTEGER, // 1 to 5
      allowNull: true,
      defaultValue: 1,
    },
    section: {
      type: DataTypes.STRING(20), // e.g. A, B, Sec-1
      allowNull: true,
    },
    hostelBlock: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    roomNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    dob: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    // Computed server-side from dob; unknown age is treated as under 18.
    isAdult: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    verificationStatus: {
      type: DataTypes.STRING(20), // 'unverified' | 'pending' | 'verified' | 'rejected'
      defaultValue: 'unverified',
    },
    collegeEmail: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    idCardImageUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    roles: {
      type: DataTypes.TEXT, // JSON array: ['student', 'cr', 'faculty', etc.]
      defaultValue: '["student"]',
      get() {
        const val = this.getDataValue('roles');
        try { return val ? JSON.parse(val) : ['student']; } catch { return ['student']; }
      },
      set(val) {
        this.setDataValue('roles', JSON.stringify(val || ['student']));
      }
    },
    bio: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    interests: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
      get() {
        const val = this.getDataValue('interests');
        try { return val ? JSON.parse(val) : []; } catch { return []; }
      },
      set(val) {
        this.setDataValue('interests', JSON.stringify(val || []));
      }
    },
    buddyPoints: {
      type: DataTypes.INTEGER,
      defaultValue: 100, // Welcome gift points
    },
    // Set when Connect is activated or an admin confirms the DOB; PUT /profile then refuses DOB changes.
    dobLockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    }
  }, { timestamps: true });

  return CampusProfile;
};

module.exports = {
  initCampusProfileModel,
  getCampusProfileModel: () => CampusProfile,
};
