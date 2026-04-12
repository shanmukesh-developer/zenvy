const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'local_dev.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Cleaning up local_dev.sqlite...');

db.serialize(() => {
  db.run("DROP TABLE IF EXISTS Restaurants_backup;", (err) => {
    if (err) {
      console.error('Error dropping Restaurants_backup:', err.message);
    } else {
      console.log('✅ Dropped Restaurants_backup if it existed.');
    }
  });
  
  // Also drop other potential backup tables
  const backups = ['MenuItems_backup', 'Orders_backup', 'Users_backup', 'DeliveryPartners_backup'];
  backups.forEach(table => {
    db.run(`DROP TABLE IF EXISTS ${table};`, (err) => {
      if (!err) console.log(`✅ Dropped ${table} if it existed.`);
    });
  });
});

setTimeout(() => {
  db.close();
}, 2000);
