const { DataTypes } = require('sequelize');

let Friendship;

const initFriendshipModel = (sequelize) => {
  if (!sequelize) return null;

  Friendship = sequelize.define('Friendship', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    requesterId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    recipientId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'blocked'),
      defaultValue: 'pending'
    },
    streakCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    lastInteractionAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    theme: {
      type: DataTypes.STRING,
      defaultValue: 'friendship'
    },
    nickname: {
      type: DataTypes.STRING,
      allowNull: true
    },
    vibe: {
      type: DataTypes.STRING,
      defaultValue: 'Roomie'
    },
    icebreaker: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Who blocked (status 'blocked'). Only this user can unblock; the block applies both ways.
    blockedBy: {
      type: DataTypes.UUID,
      allowNull: true
    },
    // Every current blocker and where they blocked from: {"<userId>": "friends"|"connect"} (JSON).
    // Null on rows written before directional blocks: blockedBy is then the only blocker.
    blockMeta: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Private nickname per viewer: {"<viewerId>": "nickname"} (JSON). The legacy shared
    // `nickname` column is no longer shown (it leaked one side's nickname to the other).
    nicknames: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['requesterId', 'recipientId']
      }
    ]
  });

  return Friendship;
};

module.exports = { initFriendshipModel, getFriendshipModel: () => Friendship };
