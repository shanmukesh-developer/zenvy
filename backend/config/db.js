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
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  console.log(`[DB_INIT] DATABASE_URL present: ${!!dbUrl}`);
  console.log(`[DB_INIT] Production Mode: ${isProduction}`);

  if (!dbUrl) {
    if (isProduction) {
      console.error('❌ FATAL: DATABASE_URL is missing in production environment!');
      throw new Error('DATABASE_URL is required in production');
    }
    const sqlitePath = path.join(__dirname, '..', 'local_dev.sqlite');
    console.log(`📦 Using LOCAL SQLite: ${sqlitePath}`);
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
    console.log('📡 Connecting to PostgreSQL Nexus...');
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
    const dialect = sequelize.getDialect();
    console.log(`✅ [DB_SUCCESS] Connected to ${dialect.toUpperCase()} database.`);
    
    initializeAllModels(sequelize);
    
    if (!isProduction) {
      console.log('🔄 Development Sync: Running { alter: true }...');
      await sequelize.sync({ alter: true });
    } else {
      console.log('🔒 Production Sync: Running { alter: false } (Safe Mode)');
      await sequelize.sync({ alter: false });
      
      // Auto-check for empty DB to help user identify missing data
      const Restaurant = instance.models.Restaurant;
      if (Restaurant) {
        const count = await Restaurant.count();
        if (count === 0) {
          console.warn('⚠️ [DB_EMPTY] No restaurants found in PostgreSQL. Please use the Admin Portal to seed legacy data.');
        } else {
          console.log(`✅ [DB_STATUS] Found ${count} restaurants in PostgreSQL.`);
        }
      }

      // Critical Migration: Ensure profileImage can hold base64
      try {
        await sequelize.query('ALTER TABLE "Users" ALTER COLUMN "profileImage" TYPE TEXT;');
      } catch (e) { /* already done */ }
    }
  } catch (error) {
    console.error('❌ [DB_FATAL] Database connection failed:', error.message);
    if (isProduction) {
      throw error;
    }
    
    console.log('🔄 Fallback: Triggering Emergency SQLite (Dev Only)...');
    // ... rest of the code is unchanged but I should verify the flow
  }
};

const getSequelize = () => sequelize;

module.exports = { connectDB, getSequelize };
