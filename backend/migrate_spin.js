const { Sequelize, DataTypes } = require('sequelize');

async function migrate() {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './local_dev.sqlite',
    logging: false
  });

  const queryInterface = sequelize.getQueryInterface();

  try {
    const tableInfo = await queryInterface.describeTable('Users');
    
    if (!tableInfo.completedOrders) {
      await queryInterface.addColumn('Users', 'completedOrders', {
        type: DataTypes.INTEGER,
        defaultValue: 0
      });
      console.log('✅ Added completedOrders column');
    }

    if (!tableInfo.spinsUsed) {
      await queryInterface.addColumn('Users', 'spinsUsed', {
        type: DataTypes.INTEGER,
        defaultValue: 0
      });
      console.log('✅ Added spinsUsed column');
    }

    console.log('🚀 Migration complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    process.exit(0);
  }
}

migrate();
