const { Sequelize } = require('sequelize');
const path = require('path');

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
const { initCouponModel } = require('../models/Coupon');

const initializeAllModels = (instance) => {
  initUserModel(instance);
  initRestaurantModel(instance);
  initMenuItemModel(instance);
  initOrderModel(instance);
  initDeliveryPartnerModel(instance);
  initVaultItemModel(instance);
  initGlobalConfigModel(instance);
  initVerificationLogModel(instance);
  initCouponModel(instance);

  // Define Associations
  const Restaurant = instance.models.Restaurant;
  const MenuItem = instance.models.MenuItem;
  const Order = instance.models.Order;
  const User = instance.models.User;

  if (Restaurant && MenuItem) {
    Restaurant.hasMany(MenuItem, { foreignKey: 'restaurantId', as: 'menuItems' });
    MenuItem.belongsTo(Restaurant, { foreignKey: 'restaurantId', as: 'restaurant' });
  }

  if (Order && Restaurant) {
    Order.belongsTo(Restaurant, { foreignKey: 'restaurantId', as: 'restaurant' });
  }

  const DeliveryPartner = instance.models.DeliveryPartner;
  if (Order && DeliveryPartner) {
    Order.belongsTo(DeliveryPartner, { foreignKey: 'deliveryPartnerId', as: 'deliveryPartner' });
    DeliveryPartner.hasMany(Order, { foreignKey: 'deliveryPartnerId', as: 'orders' });
  }

  if (Order && User) {
    Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
    User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
  }

  const Coupon = instance.models.Coupon;
  if (Coupon && User) {
    Coupon.belongsTo(User, { foreignKey: 'userId', as: 'user' });
    User.hasMany(Coupon, { foreignKey: 'userId', as: 'coupons' });
  }
};

const connectDB = async () => {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    const sqlitePath = 'C:\\hostel-bite\\backend\\local_dev.sqlite';
    console.log(`📦 Using SQLite: ${sqlitePath}`);
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: sqlitePath,
      logging: false,
      dialectOptions: {
        pragmas: {
          journal_mode: 'WAL',
          busy_timeout: 5000,
          synchronous: 'NORMAL',
          cache_size: -10000
        }
      }
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
    const isSqlite = sequelize.getDialect() === 'sqlite';
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: !isSqlite });
      console.log(`✅ All tables synced (${isSqlite ? 'Basic' : 'Altered'}).`);
    } else {
      console.log(`✅ Skipping slow sync in production (tables assumed ready).`);
    }
  } catch (error) {
    console.warn('⚠️ PostgreSQL connection failed. Error details:', error.message);
    
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ FATAL: Database connection failed in production. SQLite fallback disabled.');
      throw error;
    }

    console.log('🔄 Attempting fallback to Local SQLite...');
    
    const sqlitePath = path.join(__dirname, '..', 'local_dev.sqlite');
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: sqlitePath,
      logging: false,
      dialectOptions: {
        pragmas: {
          journal_mode: 'WAL',
          busy_timeout: 5000,
          synchronous: 'NORMAL',
          cache_size: -10000
        }
      }
    });

    await sequelize.authenticate();
    console.log('✅ SQLite Fallback Connected.');
    initializeAllModels(sequelize);
    await sequelize.sync({ force: false });
    console.log('✅ SQLite tables synced (Basic).');
  }
};

const getSequelize = () => sequelize;

module.exports = { connectDB, getSequelize };
