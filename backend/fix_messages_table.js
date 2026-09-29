const { Sequelize } = require('sequelize');
const path = require('path');
const seq = new Sequelize({ dialect: 'sqlite', storage: path.join(__dirname, 'local_dev.sqlite'), logging: false });

async function fix() {
  const [colsM] = await seq.query('PRAGMA table_info(Messages)');
  const colNamesM = colsM.map(c => c.name);
  console.log('Current cols in Messages:', colNamesM);

  if (!colNamesM.includes('replyTo')) {
    await seq.query('ALTER TABLE Messages ADD COLUMN replyTo TEXT');
    console.log('+ Added column replyTo in Messages');
  }
  if (!colNamesM.includes('reactions')) {
    await seq.query('ALTER TABLE Messages ADD COLUMN reactions TEXT');
    console.log('+ Added column reactions in Messages');
  }

  const [colsAfterM] = await seq.query('PRAGMA table_info(Messages)');
  console.log('Updated cols in Messages:', colsAfterM.map(c => c.name));
}

fix().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
