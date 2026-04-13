/* eslint-disable */
const { connectDB, getSequelize } = require('./config/db');
const { getRestaurantModel } = require('./models/Restaurant');
const { getMenuItemModel } = require('./models/MenuItem');

async function debug() {
  await connectDB();
  const Restaurant = getRestaurantModel();
  const MenuItem = getMenuItemModel();

  const rests = await Restaurant.findAll();
  const items = await MenuItem.findAll();

  console.log('--- RESTAURANTS ---');
  rests.forEach(r => console.log(`ID: ${r.id}, Name: ${r.name}, Active: ${r.isActive}`));

  console.log('\n--- MENU ITEMS ---');
  items.forEach(i => console.log(`ID: ${i.id}, Name: ${i.name}, RestID: ${i.restaurantId}, Available: ${i.isAvailable}`));

  process.exit(0);
}

debug();
