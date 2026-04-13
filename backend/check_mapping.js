/* eslint-disable */
const { connectDB, getSequelize } = require('./config/db');
async function check() {
  await connectDB();
  const sequelize = getSequelize();
  const { getRestaurantModel } = require('./models/Restaurant');
  const { getMenuItemModel } = require('./models/MenuItem');
  const Restaurant = getRestaurantModel();
  const MenuItem = getMenuItemModel();
  
  const restaurants = await Restaurant.findAll();
  const items = await MenuItem.findAll();
  
  console.log(`Restaurants found: ${restaurants.length}`);
  console.log(`MenuItems found: ${items.length}`);
  
  const mapping = {};
  restaurants.forEach(r => mapping[r.id] = { name: r.name, items: 0 });
  items.forEach(m => {
    if (mapping[m.restaurantId]) {
      mapping[m.restaurantId].items++;
    } else {
      console.log(`⚠️ Orphan Item: ${m.name} (restaurantId: ${m.restaurantId})`);
    }
  });
  
  console.log("Restaurant Mapping Table:", JSON.stringify(mapping, null, 2));
  process.exit(0);
}
check();
