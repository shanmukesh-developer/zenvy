/* eslint-disable */
const { connectDB, getSequelize } = require('./config/db');
async function check() {
  await connectDB();
  const sequelize = getSequelize();
  const { getMenuItemModel } = require('./models/MenuItem');
  const MenuItem = getMenuItemModel();
  const items = await MenuItem.findAll({ limit: 5 });
  console.log(JSON.stringify(items.map(i => ({ name: i.name, imageUrl: i.imageUrl })), null, 2));
  process.exit(0);
}
check();
