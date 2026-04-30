const { connectDB } = require('./config/db');


async function dump() {
  await connectDB();
  const { getSequelize } = require('./config/db');
  getSequelize();
  const { getRestaurantModel } = require('./models/Restaurant');
  const Restaurant = getRestaurantModel();
  const restaurants = await Restaurant.findAll();
  console.log('RESTAURANTS_DUMP:');
  console.log(JSON.stringify(restaurants.map(r => ({id: r.id, name: r.name})), null, 2));
  process.exit(0);
}

dump().catch(err => {
  console.error(err);
  process.exit(1);
});
