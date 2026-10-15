const { DataTypes } = require('sequelize');

let RoomParticipant;

const initRoomParticipantModel = (sequelize) => {
  if (!sequelize) return null;

  RoomParticipant = sequelize.define('RoomParticipant', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    roomId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('admin', 'member'),
      defaultValue: 'member'
    },
    isMuted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    // Set when a room admin removes the member. The row is kept (not deleted) so the join code
    // cannot be used to walk straight back in; kicked rows are not members anywhere.
    kickedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['roomId', 'userId']
      }
    ]
  });

  return RoomParticipant;
};

module.exports = { initRoomParticipantModel, getRoomParticipantModel: () => RoomParticipant };
