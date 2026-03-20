const { Sequelize } = require('sequelize');

let sequelize;

// Import init functions
const { initUserModel } = require('../models/User');
const { initRestaurantModel } = require('../models/Restaurant');
const { initMenuItemModel } = require('../models/MenuItem');
const { initOrderModel } = require('../models/Order');
const { initDeliveryPartnerModel } = require('../models/DeliveryPartner');
const { initVaultItemModel } = require('../models/VaultItem');
const { initGlobalConfigModel } = require('../models/GlobalConfig');
const { initVerificationLogModel } = require('../models/VerificationLog');

const initializeAllModels = (instance) => {
  initUserModel(instance);
  initRestaurantModel(instance);
  initMenuItemModel(instance);
  initOrderModel(instance);
  initDeliveryPartnerModel(instance);
  initVaultItemModel(instance);
  initGlobalConfigModel(instance);
  initVerificationLogModel(instance);
};

const connectDB = async () => {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.warn('⚠️ DATABASE_URL missing! Defaulting to Local SQLite...');
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: process.env.NODE_ENV === 'production' ? '/tmp/local_dev.sqlite' : './local_dev.sqlite',
      logging: false
    });
  } else {
    sequelize = new Sequelize(dbUrl, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: false
    });
  }

  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL Connected via Sequelize.');
    initializeAllModels(sequelize);
    await sequelize.sync();
    console.log('✅ All tables synced.');
  } catch (error) {
    console.warn('⚠️ PostgreSQL connection failed. Error details:', error.message);
    
    console.log('🔄 Attempting fallback to Local SQLite...');
    
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: '/tmp/local_dev.sqlite',
      logging: false
    });

    await sequelize.authenticate();
    console.log('✅ SQLite Fallback Connected.');
    initializeAllModels(sequelize);
    await sequelize.sync({ alter: true });
    console.log('✅ SQLite tables synced.');
  }
};

const getSequelize = () => sequelize;

module.exports = { connectDB, getSequelize };
