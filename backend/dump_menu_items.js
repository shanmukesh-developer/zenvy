const { connectDB, getSequelize } = require('./config/db');
const { getMenuItemModel } = require('./models/MenuItem');

async function dump() {
  await connectDB();
  const MenuItem = getMenuItemModel();
  const items = await MenuItem.findAll();
  console.log('MENU_ITEMS_DUMP:');
  console.log(JSON.stringify(items.map(i => ({id: i.id, name: i.name, restaurantId: i.restaurantId, imageUrl: i.imageUrl})), null, 2));
  process.exit(0);
}

dump().catch(err => {
  console.error(err);
  process.exit(1);
});
