require('dotenv').config();
const { connectDB } = require('./config/db');
const { getUserModel } = require('./models/User');
const { getRestaurantModel } = require('./models/Restaurant');

async function check() {
  await connectDB();
  const User = getUserModel();
  const Restaurant = getRestaurantModel();
  
  const userCount = await User.count();
  const restCount = await Restaurant.count();
  
  console.log(`--- DB STATUS ---`);
  console.log(`Users in DB: ${userCount}`);
  console.log(`Restaurants in DB: ${restCount}`);
  
  const allUsers = await User.findAll({ attributes: ['name', 'phone', 'role'] });
  console.log('All Users:', JSON.stringify(allUsers, null, 2));
  
  process.exit(0);
}

check();
