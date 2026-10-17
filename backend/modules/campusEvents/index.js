// Zenvy Campus Events (Others > Campus Events): discovery, registration, slots, teams, tickets, check-in,
// organizer publishing + admin approval. Entry point used by config/db.js and server.js. Invisible to
// customers until the owner switches GlobalConfig CAMPUS_EVENTS_ENABLED on (missing row = off).
const { initCampusEventsModels } = require('./models');

let sequelizeRef = null;

const init = (sequelize) => {
  if (!sequelize) return {};
  sequelizeRef = sequelize;
  return initCampusEventsModels(sequelize);
};

const getSequelize = () => sequelizeRef;
const getModel = (name) => (sequelizeRef && sequelizeRef.models[name]) || null;

module.exports = { initCampusEventsModels: init, getModel, getSequelize };
