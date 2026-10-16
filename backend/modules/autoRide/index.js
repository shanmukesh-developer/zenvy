// Zenvy Auto-Ride (shared autos with seat booking + the separate Zenvy Auto Driver app).
// Entry point used by config/db.js and server.js. Invisible to customers until the owner switches
// GlobalConfig AUTO_RIDE_ENABLED on (missing row = off).
const { initAutoRideModels } = require('./models');

let sequelizeRef = null;

const init = (sequelize) => {
  if (!sequelize) return {};
  sequelizeRef = sequelize;
  return initAutoRideModels(sequelize);
};

const getSequelize = () => sequelizeRef;
const getModel = (name) => (sequelizeRef && sequelizeRef.models[name]) || null;

module.exports = { initAutoRideModels: init, getModel, getSequelize };
