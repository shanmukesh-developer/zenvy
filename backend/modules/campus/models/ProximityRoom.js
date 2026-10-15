const { DataTypes } = require('sequelize');

let ProximityRoom = null;
let ProximityMessage = null;

const initProximityModels = (sequelize) => {
  ProximityRoom = sequelize.define('ProximityRoom', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    subtitle: {
      type: DataTypes.STRING,
      defaultValue: '',
    },
    icon: {
      type: DataTypes.STRING,
      defaultValue: 'MapPin',
    },
    category: {
      // library, dining, sports, hostel, academic, common
      type: DataTypes.STRING,
      defaultValue: 'common',
    },
    // Optional emoji shown on the spot card (admin-set); falls back to the icon.
    emoji: {
      type: DataTypes.STRING(16),
      allowNull: true,
    },
    // Admin ordering in the app (lower first).
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    // Optional geofence center point (the app does not use location today).
    latitude: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    // Geofence radius in meters
    radiusMeters: {
      type: DataTypes.INTEGER,
      defaultValue: 150,
    },
    campusId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Auto-close after hours of inactivity
    autoCloseHours: {
      type: DataTypes.INTEGER,
      defaultValue: 0, // 0 = always open
    },
    // Current active user count (denormalized for perf)
    activeUserCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName: 'proximity_rooms',
    timestamps: true,
  });

  ProximityMessage = sequelize.define('ProximityMessage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    roomId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    senderName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      defaultValue: 'text', // text, image, system
    },
    // Messages expire after 24h for privacy
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'proximity_messages',
    timestamps: true,
  });

  // Associations
  ProximityRoom.hasMany(ProximityMessage, { foreignKey: 'roomId', as: 'messages' });
  ProximityMessage.belongsTo(ProximityRoom, { foreignKey: 'roomId', as: 'room' });

  return { ProximityRoom, ProximityMessage };
};

const getProximityRoomModel = () => {
  if (!ProximityRoom) throw new Error('ProximityRoom model not initialized');
  return ProximityRoom;
};

const getProximityMessageModel = () => {
  if (!ProximityMessage) throw new Error('ProximityMessage model not initialized');
  return ProximityMessage;
};

module.exports = {
  initProximityModels,
  getProximityRoomModel,
  getProximityMessageModel,
};
