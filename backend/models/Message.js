const { DataTypes } = require('sequelize');

let Message;

const initMessageModel = (sequelize) => {
  if (!sequelize) return null;

  Message = sequelize.define('Message', {
    id: { 
      type: DataTypes.UUID, 
      defaultValue: DataTypes.UUIDV4, 
      primaryKey: true 
    },
    conversationId: { 
      type: DataTypes.UUID, 
      allowNull: false 
    },
    senderId: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    senderName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    text: { 
      type: DataTypes.TEXT, 
      allowNull: false 
    },
    isSystemMessage: {
      type: DataTypes.BOOLEAN,
      defaultValue: false // Used for "Zenvy After Dark Opens" or "Call Started" markers
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    attachmentUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    replyTo: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    reactions: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    clientMsgId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    type: {
      type: DataTypes.STRING(20),
      defaultValue: 'text' // 'text', 'image', 'video', 'audio', 'doc', 'poll', 'system'
    },
    mediaUrl: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    mediaMetadata: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '{}'
    },
    readBy: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
      get() {
        const val = this.getDataValue('readBy');
        try { return val ? JSON.parse(val) : []; } catch { return []; }
      },
      set(val) {
        this.setDataValue('readBy', JSON.stringify(val || []));
      }
    },
    deliveredTo: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
      get() {
        const val = this.getDataValue('deliveredTo');
        try { return val ? JSON.parse(val) : []; } catch { return []; }
      },
      set(val) {
        this.setDataValue('deliveredTo', JSON.stringify(val || []));
      }
    },
    isEdited: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    editedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    isDeletedForEveryone: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    // JSON array of user ids who chose 'Delete for me'
    deletedFor: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '[]'
    },
    isPinned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, { timestamps: true });

  return Message;
};

module.exports = { initMessageModel, getMessageModel: () => Message };
