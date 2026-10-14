// Zenvy Rentals (Others > Rentals > Student vehicles): peer-to-peer vehicle rentals between
// college-verified students. Entry point used by config/db.js and server.js.
const { initRentalsModels } = require('./models');

let sequelizeRef = null;

const init = (sequelize) => {
  if (!sequelize) return {};
  sequelizeRef = sequelize;
  return initRentalsModels(sequelize);
};

const getSequelize = () => sequelizeRef;
const getModel = (name) => (sequelizeRef && sequelizeRef.models[name]) || null;

module.exports = { initRentalsModels: init, getModel, getSequelize };
