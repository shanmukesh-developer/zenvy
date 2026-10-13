// Phase 0 foundation tables (see friends_plan.md §3 "Foundation tables").
const settings = require('./settings');
const social = require('./social');
const moderation = require('./moderation');

const init = (sequelize) => ({
  ...settings.init(sequelize),
  ...social.init(sequelize),
  ...moderation.init(sequelize),
});

// Associations are kept minimal on purpose: services query by id and never serialize joins.
const associate = (models) => {
  const { FriendsAppeal, FriendsModAction } = models;
  if (FriendsAppeal && FriendsModAction) {
    FriendsAppeal.belongsTo(FriendsModAction, { foreignKey: 'actionId', as: 'action' });
  }
};

module.exports = { init, associate, DEFAULT_NOTIF_PREFS: settings.DEFAULT_NOTIF_PREFS };
