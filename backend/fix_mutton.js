const { connectDB } = require('./config/db');
const { getMenuItemModel } = require('./models/MenuItem');

const fix = async () => {
  await connectDB();
  const MenuItem = getMenuItemModel();
  const item = await MenuItem.findOne({ where: { name: 'Special Mutton Fry' } });
  if (item) {
    await item.update({ 
      image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400",
      isVegetarian: false // Also fix this!
    });
    console.log('✅ Special Mutton Fry fixed in DB');
  } else {
    console.log('❌ Item not found');
  }
  process.exit(0);
};

fix();
