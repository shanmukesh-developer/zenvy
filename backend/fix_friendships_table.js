const { Sequelize } = require('sequelize');
const path = require('path');
const seq = new Sequelize({ dialect: 'sqlite', storage: path.join(__dirname, 'local_dev.sqlite'), logging: false });

async function fix() {
  const [cols] = await seq.query('PRAGMA table_info(Friendships)');
  const colNames = cols.map(c => c.name);
  console.log('Current cols in Friendships:', colNames);

  if (!colNames.includes('vibe')) {
    await seq.query("ALTER TABLE Friendships ADD COLUMN vibe VARCHAR(255) DEFAULT 'Roomie'");
    console.log('+ Added column vibe');
  }
  if (!colNames.includes('icebreaker')) {
    await seq.query("ALTER TABLE Friendships ADD COLUMN icebreaker TEXT");
    console.log('+ Added column icebreaker');
  }

  const [colsAfter] = await seq.query('PRAGMA table_info(Friendships)');
  console.log('Updated cols in Friendships:', colsAfter.map(c => c.name));
}

fix().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
