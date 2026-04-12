const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'local_dev.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Checking Restaurants table in local_dev.sqlite...');

db.all("PRAGMA table_info(Restaurants);", [], (err, rows) => {
  if (err) {
    console.error('Error fetching table info:', err.message);
  } else {
    console.log('Schema for Restaurants:', rows);
  }
});

db.all("SELECT COUNT(*) as count FROM Restaurants;", [], (err, rows) => {
  if (err) {
    console.error('Error counting rows:', err.message);
  } else {
    console.log('Total rows in Restaurants:', rows[0].count);
  }
});

setTimeout(() => {
  db.close();
}, 2000);
