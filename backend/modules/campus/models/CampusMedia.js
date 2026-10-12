const { DataTypes } = require('sequelize');

// Uploaded campus images (ID cards, chat photos, lost & found, avatars) stored as bytes in the
// main database, so they survive Render deploys without any paid storage. Served by
// GET /api/campus/media/:id with long cache headers.
let CampusMedia;

const initCampusMediaModel = (sequelize) => {
  if (!sequelize) return null;

  CampusMedia = sequelize.define('CampusMedia', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    // 'id_card' | 'chat' | 'lost_found' | 'avatar' | 'post' | 'other'
    purpose: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'other',
    },
    mime: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sha256: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    // Only visible to the owner and admins (ID cards). Everything else is public by its unguessable id.
    isPrivate: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    bytes: {
      type: DataTypes.BLOB,
      allowNull: false,
    },
  }, {
    timestamps: true,
    tableName: 'CampusMedia',
    indexes: [{ fields: ['ownerId'] }, { fields: ['ownerId', 'sha256'] }],
  });

  return CampusMedia;
};

module.exports = {
  initCampusMediaModel,
  getCampusMediaModel: () => CampusMedia,
};
