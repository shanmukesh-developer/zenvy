const { Sequelize } = require('sequelize');
const path = require('path');

async function inspect() {
  const sqlitePath = path.join(__dirname, 'local_dev.sqlite');
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: sqlitePath,
    logging: false
  });

  try {
    await sequelize.authenticate();
    const [results] = await sequelize.query("SELECT phone, password FROM DeliveryPartners WHERE phone = '0000000000'");
    console.log('RESULTS:', JSON.stringify(results, null, 2));
    
    if (results.length > 0) {
      const bcrypt = require('bcryptjs');
      const isMatch = await bcrypt.compare('srk', results[0].password);
      console.log('bcrypt compare "srk":', isMatch);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

inspect();
