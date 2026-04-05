/**
 * reseed_nexus.js - Re-seeds the DB with correct images for all Nexus categories
 * Tags are stored at the RESTAURANT level, not item level.
 */
const { connectDB, getSequelize } = require('./config/db');

const RESTAURANTS = [
  {
    name: "Biryani Hub", location: "Main Campus", vendorType: "RESTAURANT",
    imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400",
    tags: ["restaurant","food"],
    menu: [
      { name: "Special Mutton Fry", price: 280, description: "Tender goat in traditional spices.", imageUrl: "https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?w=400", category: "Biryani" },
      { name: "Royal Egg Biryani", price: 220, description: "Fragrant rice with double eggs.", imageUrl: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=400", category: "Biryani" }
    ]
  },
  {
    name: "Pizza Paradise", location: "Main Campus", vendorType: "RESTAURANT",
    imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400",
    tags: ["restaurant","food"],
    menu: [
      { name: "Margherita Classica", price: 280, description: "San Marzano tomatoes & mozzarella.", imageUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400", category: "Pizza" }
    ]
  },
  {
    name: "Campus MedPoint", location: "Main Campus", vendorType: "PHARMACY",
    imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400",
    tags: ["pharmacy","medicine"],
    menu: [
      { name: "First Aid Compact Kit", price: 199, description: "Essential campus first aid.", imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400", category: "First Aid" },
      { name: "Vitamin C Booster", price: 150, description: "Immune support tablets.", imageUrl: "https://images.unsplash.com/photo-1547489432-cf93fa6c71ee?w=400", category: "Vitamins" },
      { name: "Hand Sanitizer Pack", price: 80, description: "Alcohol-based sanitizer 3-pack.", imageUrl: "https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=400", category: "Hygiene" }
    ]
  },
  {
    name: "Nexus BookHouse", location: "Main Campus", vendorType: "STATIONARY",
    imageUrl: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400",
    tags: ["stationary","books","print"],
    menu: [
      { name: "Executive Leather Journal", price: 599, description: "Premium leather-bound A5 journal.", imageUrl: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400", category: "Notebooks" },
      { name: "Precision Pen Set", price: 850, description: "Professional drafting pen collection.", imageUrl: "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=400", category: "Pens" },
      { name: "Graph Pad A4 (Pack of 5)", price: 120, description: "Engineering graph paper pads.", imageUrl: "https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=400", category: "Drafting" }
    ]
  },
  {
    name: "FreshPress Laundry", location: "Main Campus", vendorType: "LAUNDRY",
    imageUrl: "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=400",
    tags: ["laundry","dry-wash"],
    menu: [
      { name: "Express Dry Cleaning (Suit)", price: 499, description: "Premium dry wash for formal wear.", imageUrl: "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=400", category: "Dry Wash" },
      { name: "Sneaker Deep Restore", price: 250, description: "Full sneaker cleaning & whitening.", imageUrl: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400", category: "Sneaker Care" },
      { name: "Weekly Ironing Pack (10 pcs)", price: 150, description: "Iron & fold service.", imageUrl: "https://images.unsplash.com/photo-1567113463300-102a7eb3cb26?w=400", category: "Ironing" }
    ]
  },
  {
    name: "Iron Kitchen: Pro Meals", location: "Main Campus", vendorType: "GYM",
    imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400",
    tags: ["gym","high-protein","healthy"],
    menu: [
      { name: "High-Protein Salmon Bowl", price: 350, description: "30g protein with quinoa & avocado.", imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400", category: "Protein Bowls" },
      { name: "Whey Isolate Shake", price: 199, description: "Vanilla whey isolate, 25g protein.", imageUrl: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400", category: "Shakes" },
      { name: "Vegan Protein Crisp Bar", price: 120, description: "Plant-based protein bar.", imageUrl: "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400", category: "Supplements" }
    ]
  },
  {
    name: "Zenvy Brew Bar", location: "Main Campus", vendorType: "DRINKS",
    imageUrl: "https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=400",
    tags: ["drinks"],
    menu: [
      { name: "Iced Caramel Macchiato", price: 160, description: "Double-shot espresso with caramel.", imageUrl: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400", category: "Coffee" },
      { name: "Matcha Green Tea Latte", price: 140, description: "Premium matcha with steamed milk.", imageUrl: "https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=400", category: "Tea" },
      { name: "Nitro Cold Brew", price: 220, description: "Nitrogen-infused cold brew coffee.", imageUrl: "https://images.unsplash.com/photo-1517701550927-30cf4bb1dba5?w=400", category: "Coffee" }
    ]
  },
  {
    name: "Nexus Gift Lounge", location: "Main Campus", vendorType: "SEASONAL",
    imageUrl: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400",
    tags: ["seasonal"],
    menu: [
      { name: "Nexus Holiday Hamper", price: 999, description: "Curated premium gift box.", imageUrl: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400", category: "Hampers" },
      { name: "Limited Edition Campus Mug", price: 299, description: "Collector's edition SRMAP mug.", imageUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400", category: "Merch" },
      { name: "Golden Kiwis", price: 150, description: "Premium golden kiwi fruit.", imageUrl: "https://images.unsplash.com/photo-1585059895524-72f9d1fba02b?w=400", category: "Seasonal Fruits" }
    ]
  },
  {
    name: "Nexus Campus Fleet", location: "Main Campus", vendorType: "RENTAL",
    imageUrl: "https://images.unsplash.com/photo-1571068316344-75bc76f77891?w=400",
    tags: ["rental"],
    menu: [
      { name: "Nexus E-Bike Pro (Hourly)", price: 50, description: "Electric bike rental per hour.", imageUrl: "https://images.unsplash.com/photo-1571068316344-75bc76f77891?w=400", category: "E-Bikes" },
      { name: "Electric Longboard X", price: 75, description: "Premium electric longboard.", imageUrl: "https://images.unsplash.com/photo-1531565637446-32307b194362?w=400", category: "Boards" },
      { name: "Classic Campus Cruiser", price: 30, description: "Standard bicycle rental.", imageUrl: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=400", category: "E-Bikes" }
    ]
  },
  {
    name: "Fresh Harvest Hub", location: "Main Campus", vendorType: "GROCERY",
    imageUrl: "https://images.unsplash.com/photo-1464965211904-c72145311ad7?w=400",
    tags: ["fruits","grocery","healthy"],
    menu: [
      { name: "Organic Dragon Fruit", price: 120, description: "Premium imported dragon fruit.", imageUrl: "https://images.unsplash.com/photo-1527325541517-4506b7d44c8c?w=400", category: "Exotic" },
      { name: "Exotic Berries Symphony", price: 599, description: "Mixed premium berry box.", imageUrl: "https://images.unsplash.com/photo-1464965211904-c72145311ad7?w=400", category: "Exotic" },
      { name: "Avocado Toast Kit", price: 350, description: "Perfect avocado toast ingredients.", imageUrl: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400", category: "Bundles" }
    ]
  },
  {
    name: "Le Macaron Boutique", location: "Main Campus", vendorType: "SWEETS",
    imageUrl: "https://images.unsplash.com/photo-1569864352342-fd43c330df47?w=400",
    tags: ["sweets"],
    menu: [
      { name: "Gold Leaf Belgian Pralines", price: 699, description: "Handcrafted gold leaf chocolates.", imageUrl: "https://images.unsplash.com/photo-1581798459219-3385269f0653?w=400", category: "Pralines" },
      { name: "Macaron Collection (12 pcs)", price: 450, description: "Assorted French macarons.", imageUrl: "https://images.unsplash.com/photo-1569864352342-fd43c330df47?w=400", category: "Pastries" },
      { name: "Artisan Dark Chocolate Box", price: 299, description: "Single-origin 72% dark chocolate.", imageUrl: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400", category: "Chocolates" }
    ]
  }
];

async function reseed() {
  await connectDB();
  const sequelize = getSequelize();
  const { getRestaurantModel } = require('./models/Restaurant');
  const { getMenuItemModel } = require('./models/MenuItem');
  const Restaurant = getRestaurantModel();
  const MenuItem = getMenuItemModel();

  // Clear existing data
  await MenuItem.destroy({ where: {} });
  await Restaurant.destroy({ where: {} });
  console.log('🗑️  Cleared old data.');

  for (const r of RESTAURANTS) {
    const restaurant = await Restaurant.create({
      name: r.name,
      location: r.location,
      imageUrl: r.imageUrl,
      vendorType: r.vendorType,
      commissionRate: 10,
      commissionType: 'percentage',
      operatingHours: JSON.stringify({ start: '09:00', end: '22:00' }),
      isActive: true,
      tags: JSON.stringify(r.tags)
    });

    for (const item of r.menu) {
      await MenuItem.create({
        restaurantId: restaurant.id,
        name: item.name,
        price: item.price,
        description: item.description,
        imageUrl: item.imageUrl,
        category: item.category,
        isAvailable: true,
        isEliteOnly: false
      });
    }
    console.log(`✅ ${r.name} (${r.vendorType}) — ${r.menu.length} items`);
  }

  console.log(`\n🎯 Seeded ${RESTAURANTS.length} restaurants with ${RESTAURANTS.reduce((a,r) => a + r.menu.length, 0)} total items.`);
  process.exit(0);
}

reseed().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
