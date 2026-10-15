const { DataTypes } = require('sequelize');

// One row per (post, user) like (B14). Same shape as WallLike; the named unique index makes a
// double tap / two devices count once. CommunityPost.likes is a cached count of these rows.
let CommunityPostLike;

const initCommunityPostLikeModel = (sequelize) => {
  if (!sequelize) return null;

  CommunityPostLike = sequelize.define('CommunityPostLike', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    postId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.STRING, allowNull: false }
  }, {
    timestamps: true,
    indexes: [
      { name: 'community_post_likes_post_user_unique', unique: true, fields: ['postId', 'userId'] },
      { name: 'community_post_likes_user', fields: ['userId'] }
    ]
  });

  return CommunityPostLike;
};

module.exports = { initCommunityPostLikeModel, getCommunityPostLikeModel: () => CommunityPostLike };
