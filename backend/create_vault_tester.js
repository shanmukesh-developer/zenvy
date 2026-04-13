/* eslint-disable */
const { Sequelize } = require('sequelize');
const path = require('path');
const bcrypt = require('bcryptjs');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'local_dev.sqlite'),
  logging: false
});

async function createTestUser() {
  try {
    await sequelize.authenticate();
    const hashedPassword = await bcrypt.hash('password', 10);
    const phone = '1122334455';
    
    // Upsert user
    const [results] = await sequelize.query(`
      INSERT OR REPLACE INTO Users (id, name, phone, password, hostelBlock, roomNumber, streakCount, role, createdAt, updatedAt)
      VALUES (
        'test-user-vault-id', 
        'Vault Tester', 
        '${phone}', 
        '${hashedPassword}', 
        'BLOCK-V', 
        '505', 
        10, 
        'student', 
        CURRENT_TIMESTAMP, 
        CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Test User created/updated: 1122334455 / password');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to create test user:', err);
    process.exit(1);
  }
}

createTestUser();
