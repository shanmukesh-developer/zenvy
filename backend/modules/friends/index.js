// Zenvy Friends (Campus Buddy > Friends). Entry point used by config/db.js.
// Models are registered on the shared sequelize instance; getModel(name) is how every Friends
// file reads them (sequelize.models.<Name>), so tests can use an in-memory instance.
const foundation = require('./models/foundation');

const PHASES = ['forum', 'pulse', 'tasks', 'connect', 'spaces'];

let sequelizeRef = null;

const initFriendsModels = (sequelize) => {
  if (!sequelize) return {};
  sequelizeRef = sequelize;
  const models = { ...foundation.init(sequelize) };
  for (const phase of PHASES) {
    const mod = require(`./models/${phase}`);
    Object.assign(models, mod.init(sequelize) || {});
  }
  foundation.associate(models);
  for (const phase of PHASES) {
    require(`./models/${phase}`).associate(models);
  }
  return models;
};

const getSequelize = () => sequelizeRef;

/** Friends (or any) model by name from the instance Friends was initialised on. */
const getModel = (name) => (sequelizeRef && sequelizeRef.models[name]) || null;

module.exports = { initFriendsModels, getModel, getSequelize, PHASES };
