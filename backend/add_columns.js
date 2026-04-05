const S = require('sequelize');
const s = new S.Sequelize({ dialect: 'sqlite', storage: './local_dev.sqlite', logging: false });

(async () => {
  try {
    await s.query('ALTER TABLE MenuItems ADD COLUMN tags TEXT DEFAULT "[]"');
    console.log('Added tags column');
  } catch(e) {
    console.log('tags:', e.message);
  }
  try {
    await s.query('ALTER TABLE MenuItems ADD COLUMN isVegetarian INTEGER DEFAULT 1');
    console.log('Added isVegetarian column');
  } catch(e) {
    console.log('isVegetarian:', e.message);
  }
  process.exit();
})();
