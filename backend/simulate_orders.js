/* eslint-disable */
const { connectDB, getSequelize } = require('./config/db');
const { initUserModel } = require('./models/User');

async function simulate() {
  const sequelize = await connectDB();
  const User = initUserModel(sequelize);
  
  // Find a user - we'll target 'Shanmukh' or the first student
  const user = await User.findOne({ where: { role: 'student' } });
  if (user) {
    user.completedOrders = 5;
    user.spinsUsed = 0;
    await user.save();
    console.log(`✅ Simulated 5 orders for user: ${user.name}`);
    console.log(`Spins Available: ${Math.floor(user.completedOrders / 5) - user.spinsUsed}`);
  } else {
    console.log('❌ No student user found to simulate.');
  }
  process.exit(0);
}

simulate().catch(err => {
  console.error(err);
  process.exit(1);
});
