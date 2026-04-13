/* eslint-disable */
/**
 * reseed_nexus.js - Re-seeds the DB with correct images for all Nexus categories
 * Tags are stored at the RESTAURANT level, not item level.
 */
const { connectDB, getSequelize } = require('./config/db');

const RESTAURANTS = [
  {
    name: "Biryani Hub", location: "Main Campus", vendorType: "RESTAURANT",
    imageUrl: "https://picsum.photos/seed/biryani/400/300",
    tags: ["restaurant","food"],
    menu: [
      { name: "Special Mutton Fry", price: 280, description: "Tender goat in traditional spices.", imageUrl: "https://picsum.photos/seed/mutton/400/300", category: "Biryani" },
      { name: "Royal Egg Biryani", price: 220, description: "Fragrant rice with double eggs.", imageUrl: "https://picsum.photos/seed/egg/400/300", category: "Biryani" }
    ]
  },
  {
    name: "Pizza Paradise", location: "Main Campus", vendorType: "RESTAURANT",
    imageUrl: "https://picsum.photos/seed/pizza-hub/400/300",
    tags: ["restaurant","food"],
    menu: [
      { name: "Margherita Classica", price: 280, description: "San Marzano tomatoes & mozzarella.", imageUrl: "https://picsum.photos/seed/pizza/400/300", category: "Pizza" }
    ]
  },
  {
    name: "Campus MedPoint", location: "Main Campus", vendorType: "PHARMACY",
    imageUrl: "https://picsum.photos/seed/pharmacy/400/300",
    tags: ["pharmacy","medicine"],
    menu: [
      { name: "First Aid Compact Kit", price: 199, description: "Essential campus first aid.", imageUrl: "https://picsum.photos/seed/health/400/300", category: "First Aid" },
      { name: "Vitamin C Booster", price: 150, description: "Immune support tablets.", imageUrl: "https://picsum.photos/seed/vitamins/400/300", category: "Vitamins" },
      { name: "Hand Sanitizer Pack", price: 80, description: "Alcohol-based sanitizer 3-pack.", imageUrl: "https://picsum.photos/seed/hygiene/400/300", category: "Hygiene" }
    ]
  },
  {
    name: "Nexus BookHouse", location: "Main Campus", vendorType: "STATIONARY",
    imageUrl: "https://picsum.photos/seed/books/400/300",
    tags: ["stationary","books","print"],
    menu: [
      { name: "Executive Leather Journal", price: 599, description: "Premium leather-bound A5 journal.", imageUrl: "https://picsum.photos/seed/journal/400/300", category: "Notebooks" },
      { name: "Precision Pen Set", price: 850, description: "Professional drafting pen collection.", imageUrl: "https://picsum.photos/seed/pen/400/300", category: "Pens" },
      { name: "Graph Pad A4 (Pack of 5)", price: 120, description: "Engineering graph paper pads.", imageUrl: "https://picsum.photos/seed/pad/400/300", category: "Drafting" }
    ]
  },
  {
    name: "FreshPress Laundry", location: "Main Campus", vendorType: "LAUNDRY",
    imageUrl: "https://picsum.photos/seed/laundry/400/300",
    tags: ["laundry","dry-wash"],
    menu: [
      { name: "Express Dry Cleaning (Suit)", price: 499, description: "Premium dry wash for formal wear.", imageUrl: "https://picsum.photos/seed/suit/400/300", category: "Dry Wash" },
      { name: "Sneaker Deep Restore", price: 250, description: "Full sneaker cleaning & whitening.", imageUrl: "https://picsum.photos/seed/sneaker/400/300", category: "Sneaker Care" },
      { name: "Weekly Ironing Pack (10 pcs)", price: 150, description: "Iron & fold service.", imageUrl: "https://picsum.photos/seed/iron/400/300", category: "Ironing" }
    ]
  },
  {
    name: "Iron Kitchen: Pro Meals", location: "Main Campus", vendorType: "GYM",
    imageUrl: "https://picsum.photos/seed/gym-meals/400/300",
    tags: ["gym","high-protein","healthy"],
    menu: [
      { name: "High-Protein Salmon Bowl", price: 350, description: "30g protein with quinoa & avocado.", imageUrl: "https://picsum.photos/seed/salmon/400/300", category: "Protein Bowls" },
      { name: "Whey Isolate Shake", price: 199, description: "Vanilla whey isolate, 25g protein.", imageUrl: "https://picsum.photos/seed/whey/400/300", category: "Shakes" },
      { name: "Vegan Protein Crisp Bar", price: 120, description: "Plant-based protein bar.", imageUrl: "https://picsum.photos/seed/protein-bar/400/300", category: "Supplements" }
    ]
  },
  {
    name: "Zenvy Brew Bar", location: "Main Campus", vendorType: "DRINKS",
    imageUrl: "https://picsum.photos/seed/coffee-shop/400/300",
    tags: ["drinks"],
    menu: [
      { name: "Iced Caramel Macchiato", price: 160, description: "Double-shot espresso with caramel.", imageUrl: "https://picsum.photos/seed/macchiato/400/300", category: "Coffee" },
      { name: "Matcha Green Tea Latte", price: 140, description: "Premium matcha with steamed milk.", imageUrl: "https://picsum.photos/seed/matcha/400/300", category: "Tea" },
      { name: "Nitro Cold Brew", price: 220, description: "Nitrogen-infused cold brew coffee.", imageUrl: "https://picsum.photos/seed/cold-brew/400/300", category: "Coffee" }
    ]
  },
  {
    name: "Nexus Gift Lounge", location: "Main Campus", vendorType: "SEASONAL",
    imageUrl: "https://picsum.photos/seed/gift/400/300",
    tags: ["seasonal"],
    menu: [
      { name: "Nexus Holiday Hamper", price: 999, description: "Curated premium gift box.", imageUrl: "https://picsum.photos/seed/hamper/400/300", category: "Hampers" },
      { name: "Limited Edition Campus Mug", price: 299, description: "Collector's edition SRMAP mug.", imageUrl: "https://picsum.photos/seed/mug/400/300", category: "Merch" },
      { name: "Golden Kiwis", price: 150, description: "Premium golden kiwi fruit.", imageUrl: "https://picsum.photos/seed/kiwi/400/300", category: "Seasonal Fruits" }
    ]
  },
  {
    name: "Nexus Campus Fleet", location: "Main Campus", vendorType: "RENTAL",
    imageUrl: "https://picsum.photos/seed/ebike/400/300",
    tags: ["rental"],
    menu: [
      { name: "Nexus E-Bike Pro (Hourly)", price: 50, description: "Electric bike rental per hour.", imageUrl: "https://picsum.photos/seed/bike/400/300", category: "E-Bikes" },
      { name: "Electric Longboard X", price: 75, description: "Premium electric longboard.", imageUrl: "https://picsum.photos/seed/board/400/300", category: "Boards" },
      { name: "Classic Campus Cruiser", price: 30, description: "Standard bicycle rental.", imageUrl: "https://picsum.photos/seed/bicycle/400/300", category: "E-Bikes" }
    ]
  },
  {
    name: "Fresh Harvest Hub", location: "Main Campus", vendorType: "GROCERY",
    imageUrl: "https://picsum.photos/seed/grocery/400/300",
    tags: ["fruits","grocery","healthy"],
    menu: [
      { name: "Organic Dragon Fruit", price: 120, description: "Premium imported dragon fruit.", imageUrl: "https://picsum.photos/seed/dragon-fruit/400/300", category: "Exotic" },
      { name: "Exotic Berries Symphony", price: 599, description: "Mixed premium berry box.", imageUrl: "https://picsum.photos/seed/berries/400/300", category: "Exotic" },
      { name: "Avocado Toast Kit", price: 350, description: "Perfect avocado toast ingredients.", imageUrl: "https://picsum.photos/seed/avocados/400/300", category: "Bundles" }
    ]
  },
  {
    name: "Le Macaron Boutique", location: "Main Campus", vendorType: "SWEETS",
    imageUrl: "https://picsum.photos/seed/macaron/400/300",
    tags: ["sweets"],
    menu: [
      { name: "Gold Leaf Belgian Pralines", price: 699, description: "Handcrafted gold leaf chocolates.", imageUrl: "https://picsum.photos/seed/chocolate/400/300", category: "Pralines" },
      { name: "Macaron Collection (12 pcs)", price: 450, description: "Assorted French macarons.", imageUrl: "https://picsum.photos/seed/pastry/400/300", category: "Pastries" },
      { name: "Artisan Dark Chocolate Box", price: 299, description: "Single-origin 72% dark chocolate.", imageUrl: "https://picsum.photos/seed/dark/400/300", category: "Chocolates" }
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
