const { Sequelize } = require('sequelize');

async function run() {
  // Never hardcode a database URL here (a production URL was once committed in
  // this file and must be treated as public: rotate the Render DB password).
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const dbUrl = process.env.REMOTE_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl || !/^postgres(ql)?:\/\//.test(dbUrl)) {
    console.error('Set REMOTE_DATABASE_URL (or DATABASE_URL) to a Postgres URL in the environment.');
    process.exit(1);
  }
  const sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false
  });

  try {
    await sequelize.authenticate();
    console.log('Connected to remote Postgres.');
    
    // Auto-alter the table to ensure friendCode exists (Sequelize postgres handles alter well)
    const { initUserModel, getUserModel } = require('../models/User');
    initUserModel(sequelize);
    const User = getUserModel();
    
    // Add columns just in case
    await sequelize.query(`ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "friendCode" VARCHAR(255) UNIQUE;`).catch(() => {});
    
    const users = await User.findAll();
    let updated = 0;
    
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (const user of users) {
      if (!user.friendCode) {
        let code = '';
        for (let i = 0; i < 5; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        user.friendCode = 'ZNV-' + code;
        await user.save();
        updated++;
      }
    }
    console.log(`Backfilled ${updated} users on production!`);
  } catch (err) {
    console.error('Failed:', err);
  } finally {
    await sequelize.close();
  }
}

run();
