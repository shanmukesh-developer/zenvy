const { connectDB, getSequelize } = require('./config/db');
const { getRestaurantModel } = require('./models/Restaurant');
const { getMenuItemModel } = require('./models/MenuItem');

async function debug() {
  await connectDB();
  const Restaurant = getRestaurantModel();
  const MenuItem = getMenuItemModel();

  const rests = await Restaurant.findAll({ where: { isActive: true } });
  const items = await MenuItem.findAll();

  console.log('--- ACTIVE RESTAURANTS ---');
  rests.forEach(r => console.log(`ID: ${r.id}, Name: ${r.name}`));

  if (rests.length > 0) {
    const firstId = rests[0].id;
    console.log(`\nAttempting to link all ${items.length} items to: ${rests[0].name} (${firstId})`);
    
    for (const item of items) {
      await item.update({ restaurantId: firstId });
    }
    console.log('✅ All items linked.');
  }

  process.exit(0);
}

debug();
