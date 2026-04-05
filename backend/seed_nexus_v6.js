const { connectDB, getSequelize } = require('./config/db');
const { getRestaurantModel } = require('./models/Restaurant');
const { getMenuItemModel } = require('./models/MenuItem');
const dotenv = require('dotenv');

dotenv.config();

const NEXUS_RID = '77777777-7777-7777-7777-777777777777';

const seedNexusV6 = async () => {
  await connectDB();
  const sequelize = getSequelize();
  const Restaurant = getRestaurantModel();
  const MenuItem = getMenuItemModel();

  console.log('--- Nexus Omni-Catalog V6: Mass Deployment ---');

  // 1. Force Sync to ensure clean state
  await sequelize.sync({ alter: true });

  // 2. Create Global Nexus Provider
  const [nexusRestaurant] = await Restaurant.findOrCreate({
    where: { id: NEXUS_RID },
    defaults: {
       id: NEXUS_RID,
       name: 'Nexus Omni-Catalog',
       location: 'SRMAP Central Hub',
       vendorType: 'GLOBAL_MARKET',
       rating: 5.0,
       deliveryTime: 20,
       imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
       tags: ['elite', 'nexus', 'global']
    }
  });

  // 3. Clear existing global items
  await MenuItem.destroy({ where: { restaurantId: NEXUS_RID } });

  const sampleProducts = [
    // 🍎 FRUITS
    { name: 'Organic Dragon Fruit', price: 120, category: 'fruits', tags: ['fruits', 'healthy'], imageUrl: 'https://images.unsplash.com/photo-1527325541517-4506b7d44c8c?w=500' },
    { name: 'Red Fuji Apples (4pc)', price: 180, category: 'fruits', tags: ['fruits'], imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6bcd6?w=500' },
    { name: 'Golden Kiwis', price: 150, category: 'fruits', tags: ['fruits', 'seasonal'], imageUrl: 'https://images.unsplash.com/photo-1585059895312-708b21cb995d?w=500' },
    { name: 'Exotic Berries Symphony', price: 599, category: 'fruits', tags: ['fruits', 'elite'], imageUrl: 'https://images.unsplash.com/photo-1464965211904-c72145311ad7?w=500' },
    { name: 'Avocado Toast Kit', price: 350, category: 'fruits', tags: ['fruits', 'healthy'], imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500' },

    // 🚗 RENTALS
    { name: 'Nexus E-Bike Pro', price: 50, category: 'rentals', tags: ['rental', 'nexus'], imageUrl: 'https://images.unsplash.com/photo-1571068316344-75bc76f77891?w=500' },
    { name: 'Electric Longboard X', price: 75, category: 'rentals', tags: ['rental', 'elite'], imageUrl: 'https://images.unsplash.com/photo-1531565637446-32307b194362?w=500' },
    { name: 'Classic Campus Cruiser', price: 30, category: 'rentals', tags: ['rental'], imageUrl: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=500' },

    // 🍩 SWEETS
    { name: 'Artisan Dark Chocolate', price: 299, category: 'sweets', tags: ['sweets', 'gift'], imageUrl: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=500' },
    { name: 'Macaron Collection', price: 450, category: 'sweets', tags: ['sweets'], imageUrl: 'https://images.unsplash.com/photo-1569864352342-fd43c330df47?w=500' },
    { name: 'Gold Leaf Pralines', price: 699, category: 'sweets', tags: ['sweets', 'elite'], imageUrl: 'https://images.unsplash.com/photo-1581798459219-3385269f0653?w=500' },

    // 💪 GYM
    { name: 'Protein Salmon Bowl', price: 350, category: 'gym', tags: ['gym', 'high-protein', 'healthy'], imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500' },
    { name: 'Quinoa & Avocado Oasis', price: 280, category: 'gym', tags: ['gym', 'healthy'], imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500' },
    { name: 'Himalayan Electrolytes', price: 89, category: 'gym', tags: ['gym', 'healthy'], imageUrl: 'https://images.unsplash.com/photo-1559114683-13831c1ca827?w=500' },
    { name: 'Vegan Protein Bar', price: 120, category: 'gym', tags: ['gym', 'high-protein'], imageUrl: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=500' },

    // 🥤 DRINKS
    { name: 'Caramel Macchiato', price: 160, category: 'drinks', tags: ['drinks'], imageUrl: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=500' },
    { name: 'Nitro Cold Brew', price: 220, category: 'drinks', tags: ['drinks', 'elite'], imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4bb1dba5?w=500' },

    // 👔 LAUNDRY
    { name: 'Premium Dry Wash', price: 499, category: 'laundry', tags: ['laundry', 'dry-wash'], imageUrl: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=500' },
    { name: 'Sneaker Restore', price: 250, category: 'laundry', tags: ['laundry'], imageUrl: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500' },

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

  await MenuItem.bulkCreate(sampleProducts.map(p => ({
    ...p,
    restaurantId: NEXUS_RID,
    description: `Premium ${p.name} — Class and Mass campus deployment.`
  })));

  const finalCount = await MenuItem.count();
  console.log(`--- Seeding Complete: ${finalCount} Total Assets in Database ---`);
  process.exit();
};

seedNexusV6().catch(process.exit);
