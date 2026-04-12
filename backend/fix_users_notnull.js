const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'local_dev.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- Migrating Users Schema: Removing NOT NULL from address fields (Sequential) ---');

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function migrate() {
  try {
    // 0. Drop backup if exists
    await runAsync(`DROP TABLE IF EXISTS Users_Backup`);

    // 1. Create a backup table with new schema
    console.log('1. Creating backup table...');
    await runAsync(`
      CREATE TABLE Users_Backup (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        hostelBlock VARCHAR(255),
        roomNumber VARCHAR(255),
        walletBalance FLOAT DEFAULT 0,
        streakCount INTEGER DEFAULT 0,
        lastOrderDate DATETIME,
        totalOrders INTEGER DEFAULT 0,
        role VARCHAR(255) DEFAULT 'student',
        zenPoints INTEGER DEFAULT 0,
        isElite TINYINT(1) DEFAULT 0,
        address VARCHAR(255),
        city VARCHAR(255) DEFAULT 'Amaravathi',
        profileImage VARCHAR(255),
        fcmTokens JSON DEFAULT '[]',
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        completedOrders INTEGER DEFAULT 0,
        spinsUsed INTEGER DEFAULT 0,
        badges JSON DEFAULT '[]',
        lateNightOrders INTEGER DEFAULT 0
      )
    `);

    // 2. Copy data
    console.log('2. Copying data...');
    await runAsync(`
      INSERT INTO Users_Backup (
        id, name, phone, password, hostelBlock, roomNumber, walletBalance, streakCount,
        lastOrderDate, totalOrders, role, zenPoints, isElite, address, city, 
        profileImage, fcmTokens, createdAt, updatedAt, completedOrders, 
        spinsUsed, badges, lateNightOrders
      )
      SELECT 
        id, name, phone, password, hostelBlock, roomNumber, walletBalance, streakCount,
        lastOrderDate, totalOrders, role, zenPoints, isElite, address, city, 
        profileImage, fcmTokens, createdAt, updatedAt, completedOrders, 
        spinsUsed, badges, lateNightOrders
      FROM Users
    `);

    // 3. Drop old table
    console.log('3. Dropping old table...');
    await runAsync(`DROP TABLE Users`);

    // 4. Rename
    console.log('4. Renaming backup to Users...');
    await runAsync(`ALTER TABLE Users_Backup RENAME TO Users`);

    console.log('🎉 Migration Complete!');
  } catch (err) {
    console.error('❌ Migration Failed:', err.message);
  } finally {
    db.close();
  }
}

migrate();
