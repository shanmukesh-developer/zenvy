const { Sequelize } = require('sequelize');
const path = require('path');

async function checkProduct() {
  const dbPath = path.join(__dirname, 'backend', 'database.sqlite');
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false
  });

  try {
    const [results] = await sequelize.query("SELECT name, isAvailable FROM MenuItems WHERE id='26797077-b045-4cee-8af9-0e5caa005819'");
    console.log('MenuItems Result:', JSON.stringify(results));
    
    const [vaultResults] = await sequelize.query("SELECT name FROM VaultItems WHERE id='26797077-b045-4cee-8af9-0e5caa005819'");
    console.log('VaultItems Result:', JSON.stringify(vaultResults));
  } catch (err) {
    console.error('Query Error:', err.message);
  } finally {
    await sequelize.close();
  }
}

checkProduct();
