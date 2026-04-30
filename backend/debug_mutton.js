const { connectDB } = require('./config/db');
const { getMenuItemModel } = require('./models/MenuItem');

const dump = async () => {
  await connectDB();
  const MenuItem = getMenuItemModel();
  const item = await MenuItem.findOne({ where: { name: 'Special Mutton Fry' } });
  console.log(JSON.stringify(item, null, 2));
  process.exit(0);
};

dump();
