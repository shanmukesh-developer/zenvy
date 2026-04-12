const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../local_dev.sqlite');
const db = new sqlite3.Database(dbPath);

const sqls = [
  'ALTER TABLE Orders ADD COLUMN upiUTR TEXT;',
  'ALTER TABLE Orders ADD COLUMN upiScreenshot TEXT;',
  'ALTER TABLE Orders ADD COLUMN upiStatus TEXT DEFAULT "Pending";'
];

db.serialize(() => {
  sqls.forEach(sql => {
    db.run(sql, (err) => {
      if (err) {
        if (err.message.includes('duplicate column name')) {
          console.log(`Column in "${sql}" already exists, skipping...`);
        } else {
          console.error('Error running SQL:', sql, err.message);
        }
      } else {
        console.log('Successfully ran:', sql);
      }
    });
  });
});

db.close();
