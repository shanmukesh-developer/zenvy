const { Sequelize } = require('sequelize');

let sequelize;

const connectDB = async () => {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.warn('⚠️  DATABASE_URL missing! Running in MOCK MODE.');
    process.env.MOCK_DATABASE = 'true';
    return;
  }

  sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Required for Render
      }
    },
    logging: false
  });

  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL Connected via Sequelize.');
    await sequelize.sync({ alter: true });
    console.log('✅ All tables synced.');
  } catch (error) {
    console.warn(`⚠️ PostgreSQL connection failed (${error.code || error.message}). Falling back to Local SQLite.`);
    
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: './local_dev.sqlite',
      logging: false
    });

    await sequelize.authenticate();
    console.log('✅ SQLite Fallback Connected.');
    await sequelize.sync({ alter: true });
    console.log('✅ SQLite tables synced.');
  }
};

const getSequelize = () => sequelize;

module.exports = { connectDB, getSequelize };
