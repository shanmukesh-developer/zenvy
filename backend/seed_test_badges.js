const { Sequelize } = require('sequelize');
const path = require('path');

async function seedTestBadges() {
  const dbPath = path.join(__dirname, 'local_dev.sqlite');
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false
  });

  try {
    const [results] = await sequelize.query("SELECT id FROM Users LIMIT 1");
    if (results.length > 0) {
      const userId = results[0].id;
      console.log(`Seeding badges for User ID: ${userId}`);
      
      const badges = JSON.stringify(['Nexus Legend', 'Night Owl']);
      await sequelize.query(`UPDATE Users SET badges = '${badges}', completedOrders = 52, zenPoints = 1250 WHERE id = '${userId}'`);
      
      console.log('Test user seeded with badges.');
    } else {
      console.log('No users found to seed.');
    }
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await sequelize.close();
  }
}

seedTestBadges();
