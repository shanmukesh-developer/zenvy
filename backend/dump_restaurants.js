const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'local_dev.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Dumping Restaurants data from local_dev.sqlite...');

db.all("SELECT * FROM Restaurants;", [], (err, rows) => {
  if (err) {
    console.error('Error querying Restaurants:', err.message);
  } else {
    console.log('Restaurants:', JSON.stringify(rows, null, 2));
  }
});

setTimeout(() => {
  db.close();
}, 2000);
