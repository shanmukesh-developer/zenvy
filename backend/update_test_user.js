const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'local_dev.sqlite'),
  logging: false
});

async function updateStreak() {
  try {
    await sequelize.authenticate();
    const [results] = await sequelize.query("UPDATE Users SET streakCount = 10 WHERE phone = '9999999999'");
    console.log('✅ Streak Updated for user 9999999999');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to update streak:', err);
    process.exit(1);
  }
}

updateStreak();
