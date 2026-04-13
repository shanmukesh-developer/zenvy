/* eslint-disable */
const { connectDB, getSequelize } = require('./config/db');
const { getMenuItemModel } = require('./models/MenuItem');

const verify = async () => {
  await connectDB();
  const MenuItem = getMenuItemModel();
  const count = await MenuItem.count();
  console.log('COUNT:', count);
  process.exit();
};

verify();
