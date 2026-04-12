const { connectDB, getSequelize } = require('./config/db');

async function update() {
  await connectDB();
  const sequelize = getSequelize();
  const { getRestaurantModel } = require('./models/Restaurant');
  const { getMenuItemModel } = require('./models/MenuItem');
  const Restaurant = getRestaurantModel();
  const MenuItem = getMenuItemModel();

  const restaurants = await Restaurant.findAll();
  for (const r of restaurants) {
    if (r.imageUrl && r.imageUrl.includes('unsplash.com')) {
      const seed = r.name.toLowerCase().replace(/[^a-z]/g, '-');
      r.imageUrl = `https://picsum.photos/seed/${seed}/400/300`;
      await r.save();
      console.log(`Updated Restaurant: ${r.name}`);
    }
  }

  const items = await MenuItem.findAll();
  for (const item of items) {
    if (item.imageUrl && item.imageUrl.includes('unsplash.com')) {
      const seed = item.name.toLowerCase().replace(/[^a-z]/g, '-');
      item.imageUrl = `https://picsum.photos/seed/${seed}/400/300`;
      await item.save();
      console.log(`Updated MenuItem: ${item.name}`);
    }
  }

  console.log('✅ Live update complete.');
  process.exit(0);
}

update().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
