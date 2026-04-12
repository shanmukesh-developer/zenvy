const { Sequelize } = require('sequelize');
const { initUserModel } = require('./models/User');
const { initOrderModel } = require('./models/Order');
const { initRestaurantModel } = require('./models/Restaurant');
const { initDeliveryPartnerModel } = require('./models/DeliveryPartner');
const { initMenuItemModel } = require('./models/MenuItem');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './zenvy_nexus.sqlite'
});

initUserModel(sequelize);
initRestaurantModel(sequelize);
initMenuItemModel(sequelize);
initDeliveryPartnerModel(sequelize);
initOrderModel(sequelize);

async function syncDb() {
  try {
    await sequelize.sync({ alter: true });
    console.log('Database schema synchronized successfully.');
  } catch (err) {
    console.error('Failed to sync DB:', err);
  } finally {
    process.exit();
  }
}

syncDb();
