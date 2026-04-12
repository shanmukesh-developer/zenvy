const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'local_dev.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Listing all tables in local_dev.sqlite...');

db.all("SELECT name FROM sqlite_master WHERE type='table';", [], (err, rows) => {
  if (err) {
    console.error('Error listing tables:', err.message);
  } else {
    console.log('Tables:', rows.map(r => r.name));
    
    // Check if Restaurants_backup exists and has data
    if (rows.some(r => r.name === 'Restaurants_backup')) {
      db.all("SELECT COUNT(*) as count FROM Restaurants_backup;", [], (err2, rows2) => {
        if (!err2) {
          console.log('Total rows in Restaurants_backup:', rows2[0].count);
        }
      });
    }
  }
});

setTimeout(() => {
  db.close();
}, 2000);
