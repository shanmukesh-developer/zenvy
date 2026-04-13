/* eslint-disable */
const { connectDB, getSequelize } = require('./config/db');
const { getRestaurantModel } = require('./models/Restaurant');
const { getMenuItemModel } = require('./models/MenuItem');
const dotenv = require('dotenv');

dotenv.config();

const seedBismilla = async () => {
  await connectDB();
  const Restaurant = getRestaurantModel();
  const MenuItem = getMenuItemModel();

  console.log('🕌 Seeding Bismilla Restaurant...');

  const [bismilla, created] = await Restaurant.findOrCreate({
    where: { name: 'Bismilla' },
    defaults: {
      location: 'Block B, SRMAP Hostel',
      vendorType: 'MESS',
      rating: 4.8,
      deliveryTime: 25,
      imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop',
      tags: ['biryani', 'halal', 'authentic']
    }
  });

  if (!created) {
    console.log('ℹ️  Bismilla already exists, updating...');
    // Update with proper image
    await bismilla.update({
      imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop',
      rating: 4.8,
      deliveryTime: 25,
      tags: ['biryani', 'halal', 'authentic']
    });
    // Remove old items to re-add fresh
    await MenuItem.destroy({ where: { restaurantId: bismilla.id } });
  }

  const items = [
    {
      name: 'Chicken Biryani',
      price: 180,
      description: 'Aromatic basmati rice cooked with tender chicken pieces, whole spices, saffron, and slow-cooked on dum. Served with garlic raita and salan.',
      category: 'biryani',
      tags: ['biryani', 'chicken', 'halal', 'bestseller'],
      imageUrl: 'https://images.unsplash.com/photo-1563379091339-03246963d651?w=800&auto=format&fit=crop',
      restaurantId: bismilla.id,
      isVegetarian: false,
      isAvailable: true
    },
    {
      name: 'Mutton Biryani',
      price: 250,
      description: 'Slow-cooked fall-off-the-bone mutton layered with fragrant long-grain basmati rice, whole spices, caramelized onions, and fresh saffron. A royal treat.',
      category: 'biryani',
      tags: ['biryani', 'mutton', 'halal', 'premium'],
      imageUrl: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&auto=format&fit=crop',
      restaurantId: bismilla.id,
      isVegetarian: false,
      isAvailable: true
    }
  ];

  for (const item of items) {
    await MenuItem.create(item);
    console.log(`  ✅ Added: ${item.name} @ ₹${item.price}`);
  }

  console.log(`\n🎉 Bismilla Restaurant seeded successfully!`);
  console.log(`   Restaurant ID: ${bismilla.id}`);

  process.exit(0);
};

seedBismilla().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
