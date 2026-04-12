const { Sequelize } = require('sequelize');
const sequelize = new Sequelize({ dialect: 'sqlite', storage: './local_dev.sqlite' });

async function addColumn() {
  try {
    await sequelize.query("ALTER TABLE Users ADD COLUMN dietaryPreference VARCHAR(255) DEFAULT 'None'");
    console.log('Column dietaryPreference added successfully!');
  } catch (e) {
    if (e.message.includes('duplicate column name')) {
      console.log('Column dietaryPreference already exists.');
    } else {
      console.error('Error adding column:', e.message);
    }
  } finally {
    process.exit();
  }
}

addColumn();
