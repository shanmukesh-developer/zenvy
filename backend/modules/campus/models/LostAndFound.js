const { DataTypes } = require('sequelize');

let LostAndFound;

const initLostAndFoundModel = (sequelize) => {
  if (!sequelize) return null;

  LostAndFound = sequelize.define('CampusLostAndFound', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(10), // 'lost' | 'found'
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    imageUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20), // 'open' | 'claimed' | 'resolved'
      defaultValue: 'open',
    },
    claimContact: {
      type: DataTypes.STRING,
      allowNull: true,
    }
  }, { timestamps: true });

  return LostAndFound;
};

module.exports = {
  initLostAndFoundModel,
  getLostAndFoundModel: () => LostAndFound,
};
