/* eslint-disable */
/**
 * fix_images.js - Fixes mismatched product images in the database
 * Run: node fix_images.js
 */
const { connectDB, getSequelize } = require('./config/db');

// Image mapping: item name -> correct image URL
const IMAGE_FIX_MAP = {
  // Sweets
  'Gold Leaf Belgian Pralines': 'https://images.unsplash.com/photo-1581798459219-3385269f0653?w=400',
  'Macaron Collection (12 pcs)': 'https://images.unsplash.com/photo-1569864352342-fd43c330df47?w=400',
  'Artisan Dark Chocolate Box': 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400',
  // Drinks
  'Iced Caramel Macchiato': 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400',
  'Matcha Green Tea Latte': 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=400',
  'Nitro Cold Brew': 'https://images.unsplash.com/photo-1517701550927-30cf4bb1dba5?w=400',
  // Gym
  'High-Protein Salmon Bowl': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
  'Whey Isolate Shake': 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400',
  'Vegan Protein Crisp Bar': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400',
  'Whey Protein Bowl': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
  // Pharmacy
  'First Aid Compact Kit': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400',
  'Vitamin C Booster': 'https://images.unsplash.com/photo-1547489432-cf93fa6c71ee?w=400',
  'Hand Sanitizer Pack': 'https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=400',
  // Stationary
  'Executive Leather Journal': 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400',
  'Precision Pen Set': 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=400',
  'Graph Pad A4 (Pack of 5)': 'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=400',
  // Laundry
  'Express Dry Cleaning (Suit)': 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=400',
  'Sneaker Deep Restore': 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400',
  'Weekly Ironing Pack (10 pcs)': 'https://images.unsplash.com/photo-1567113463300-102a7eb3cb26?w=400',
  // Seasonal
  'Nexus Holiday Hamper': 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400',
  'Limited Edition Campus Mug': 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400',
  // Rental
  'Nexus E-Bike Pro (Hourly)': 'https://images.unsplash.com/photo-1571068316344-75bc76f77891?w=400',
  'Electric Longboard X': 'https://images.unsplash.com/photo-1531565637446-32307b194362?w=400',
  'Classic Campus Cruiser': 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=400',
  // Fruits
  'Organic Dragon Fruit': 'https://images.unsplash.com/photo-1527325541517-4506b7d44c8c?w=400',
  'Exotic Berries Symphony': 'https://images.unsplash.com/photo-1464965211904-c72145311ad7?w=400',
  'Avocado Toast Kit': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400',
};

async function fixImages() {
  await connectDB();
  const sequelize = getSequelize();
  const { getMenuItemModel } = require('./models/MenuItem');
  const MenuItem = getMenuItemModel();

  let fixed = 0;
  for (const [name, imageUrl] of Object.entries(IMAGE_FIX_MAP)) {
    const [count] = await MenuItem.update(
      { imageUrl },
      { where: { name } }
    );
    if (count > 0) {
      console.log(`  ✅ ${name}`);
      fixed += count;
    }
  }

  console.log(`\n🎯 Fixed ${fixed} items total.`);
  process.exit(0);
}

fixImages().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
