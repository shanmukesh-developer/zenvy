const { connectDB, getSequelize } = require('./config/db');
const { getRestaurantModel } = require('./models/Restaurant');
const { getMenuItemModel } = require('./models/MenuItem');
const dotenv = require('dotenv');

dotenv.config();

const seedNexusV5 = async () => {
  await connectDB();
  const sequelize = getSequelize();
  const Restaurant = getRestaurantModel();
  const MenuItem = getMenuItemModel();

  console.log('--- Nexus Omni-Catalog Seeding Initiated ---');

  const [nexusRestaurant] = await Restaurant.findOrCreate({
    where: { name: 'Nexus Omni-Catalog' },
    defaults: {
      location: 'SRMAP Central Hub',
      vendorType: 'GLOBAL_MARKET',
      rating: 5.0,
      deliveryTime: 20,
      imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
      tags: ['elite', 'nexus', 'global']
    }
  });

  const rid = nexusRestaurant.id;
  await MenuItem.destroy({ where: { restaurantId: rid } });

  const sampleProducts = [
    // 🍎 FRUITS
    { name: 'Organic Dragon Fruit', price: 120, category: 'fruits', tags: ['fruits', 'healthy'], imageUrl: 'https://images.unsplash.com/photo-1527325541517-4506b7d44c8c?w=500' },
    { name: 'Red Fuji Apples (4pc)', price: 180, category: 'fruits', tags: ['fruits'], imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6bcd6?w=500' },
    { name: 'Golden Kiwis', price: 150, category: 'fruits', tags: ['fruits', 'seasonal'], imageUrl: 'https://images.unsplash.com/photo-1585059895312-708b21cb995d?w=500' },
    { name: 'Exotic Berries Symphony', price: 599, category: 'fruits', tags: ['fruits', 'elite'], imageUrl: 'https://images.unsplash.com/photo-1464965211904-c72145311ad7?w=500' },

    // 🚗 RENTALS
    { name: 'Nexus E-Bike Pro', price: 50, category: 'rentals', tags: ['rental', 'nexus'], imageUrl: 'https://images.unsplash.com/photo-1571068316344-75bc76f77891?w=500' },
    { name: 'Sport MTB Gear Set', price: 99, category: 'rentals', tags: ['rental'], imageUrl: 'https://images.unsplash.com/photo-1532298229144-0ee0c9e9ad58?w=500' },
    { name: 'Electric Longboard X', price: 75, category: 'rentals', tags: ['rental', 'elite'], imageUrl: 'https://images.unsplash.com/photo-1531565637446-32307b194362?w=500' },

    // 🍩 SWEETS
    { name: 'Artisan Dark ChocolateBox', price: 299, category: 'sweets', tags: ['sweets', 'gift'], imageUrl: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=500' },
    { name: 'Gold Leaf Pralines', price: 699, category: 'sweets', tags: ['sweets', 'elite'], imageUrl: 'https://images.unsplash.com/photo-1581798459219-3385269f0653?w=500' },
    { name: 'Macaron Collection', price: 450, category: 'sweets', tags: ['sweets'], imageUrl: 'https://images.unsplash.com/photo-1569864352342-fd43c330df47?w=500' },

    // 💪 GYM
    { name: 'High-Protein Salmon Bowl', price: 350, category: 'gym', tags: ['gym', 'high-protein', 'healthy'], imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500' },
    { name: 'Quinoa & Avocado Oasis', price: 280, category: 'gym', tags: ['gym', 'healthy'], imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500' },
    { name: 'Himalayan Electrolytes', price: 89, category: 'gym', tags: ['gym', 'healthy'], imageUrl: 'https://images.unsplash.com/photo-1559114683-13831c1ca827?w=500' },

    // 🥤 DRINKS
    { name: 'Iced Caramel Macchiato', price: 160, category: 'drinks', tags: ['drinks'], imageUrl: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=500' },
    { name: 'Matcha Green Tea Latte', price: 140, category: 'drinks', tags: ['drinks', 'healthy'], imageUrl: 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=500' },
    { name: 'Nitro Cold Brew Piston', price: 220, category: 'drinks', tags: ['drinks', 'elite'], imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4bb1dba5?w=500' },

    // 👔 LAUNDRY
    { name: 'Express Dry Cleaning', price: 499, category: 'laundry', tags: ['laundry', 'dry-wash'], imageUrl: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=500' },
    { name: 'Sneaker Deep Restore', price: 250, category: 'laundry', tags: ['laundry'], imageUrl: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500' },

    // 💊 PHARMACY
    { name: 'First Aid Compact Kit', price: 199, category: 'pharmacy', tags: ['pharmacy', 'medicine'], imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500' },
    { name: 'Vitamin C Booster', price: 150, category: 'pharmacy', tags: ['pharmacy', 'healthy'], imageUrl: 'https://images.unsplash.com/photo-1547489432-cf93fa6c71ee?w=500' },

    // 📚 STATIONARY
    { name: 'Executive Journal', price: 599, category: 'stationary', tags: ['stationary', 'books'], imageUrl: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=500' },
    { name: 'Precision Pen Set', price: 850, category: 'stationary', tags: ['stationary'], imageUrl: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=500' },

    // 🎁 SEASONAL
    { name: 'Nexus Holiday Hamper', price: 999, category: 'seasonal', tags: ['seasonal', 'elite'], imageUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=500' },
    { name: 'Limited Edition Mug', price: 299, category: 'seasonal', tags: ['seasonal'], imageUrl: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=500' }
  ];

  for (const product of sampleProducts) {
    await MenuItem.create({
      ...product,
      restaurantId: rid,
      description: `Premium ${product.name} — exclusively for Zenvy Nexus.`
    });
  }

  console.log(`--- Seeding Complete: ${sampleProducts.length} Premium Assets Deployed ---`);
  process.exit();
};

seedNexusV5().catch(process.exit);
