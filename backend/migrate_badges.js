const { Sequelize } = require('sequelize');
const path = require('path');

async function migrate() {
  const dbPath = path.join(__dirname, 'local_dev.sqlite');
  console.log('Migrating database at:', dbPath);
  
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false
  });

  try {
    const queryInterface = sequelize.getQueryInterface();
    const tableInfo = await queryInterface.describeTable('Users');

    if (!tableInfo.badges) {
      console.log('Adding "badges" column...');
      await queryInterface.addColumn('Users', 'badges', {
        type: Sequelize.JSON,
        defaultValue: []
      });
    }

    if (!tableInfo.lateNightOrders) {
      console.log('Adding "lateNightOrders" column...');
      await queryInterface.addColumn('Users', 'lateNightOrders', {
        type: Sequelize.INTEGER,
        defaultValue: 0
      });
    }

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sequelize.close();
  }
}

migrate();
