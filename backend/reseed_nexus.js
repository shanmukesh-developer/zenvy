/* eslint-disable */
/**
 * reseed_nexus.js - Re-seeds the DB with correct images for all Nexus categories
 * Tags are stored at the RESTAURANT level, not item level.
 */
const { connectDB, getSequelize } = require('./config/db');

const RESTAURANTS = [
  {
    name: "Biryani Hub", location: "Main Campus", vendorType: "RESTAURANT",
    imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=800&auto=format&fit=crop",
    tags: ["restaurant","food"],
    menu: [
      { name: "Special Mutton Fry", price: 280, description: "Tender goat in traditional spices.", imageUrl: "https://images.unsplash.com/photo-1603360946369-dc9bb0258143?q=80&w=600&auto=format&fit=crop", category: "Biryani" },
      { name: "Royal Egg Biryani", price: 220, description: "Fragrant rice with double eggs.", imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=600&auto=format&fit=crop", category: "Biryani" }
    ]
  },
  {
    name: "Pizza Paradise", location: "Main Campus", vendorType: "RESTAURANT",
    imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=800&auto=format&fit=crop",
    tags: ["restaurant","food"],
    menu: [
      { name: "Margherita Classica", price: 280, description: "San Marzano tomatoes & mozzarella.", imageUrl: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?q=80&w=600&auto=format&fit=crop", category: "Pizza" },
      { name: "Garden Feast Pizza", price: 320, description: "Loaded with fresh vegetables and olives.", imageUrl: "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?q=80&w=600&auto=format&fit=crop", category: "Pizza" }
    ]
  },
  {
    name: "Campus MedPoint", location: "Main Campus", vendorType: "PHARMACY",
    imageUrl: "https://images.unsplash.com/photo-1586015555751-63bb77f4322a?q=80&w=800&auto=format&fit=crop",
    tags: ["pharmacy","medicine"],
    menu: [
      { name: "First Aid Compact Kit", price: 199, description: "Essential campus first aid.", imageUrl: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?q=80&w=600&auto=format&fit=crop", category: "First Aid" },
      { name: "Vitamin C Booster", price: 150, description: "Immune support tablets.", imageUrl: "https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?q=80&w=600&auto=format&fit=crop", category: "Vitamins" }
    ]
  },
  {
    name: "Nexus BookHouse", location: "Main Campus", vendorType: "STATIONARY",
    imageUrl: "https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?q=80&w=800&auto=format&fit=crop",
    tags: ["stationary","books","print"],
    menu: [
      { name: "Executive Leather Journal", price: 599, description: "Premium leather-bound A5 journal.", imageUrl: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?q=80&w=600&auto=format&fit=crop", category: "Notebooks" },
      { name: "Precision Pen Set", price: 850, description: "Professional drafting pen collection.", imageUrl: "https://images.unsplash.com/photo-1515545934533-3392437ce43a?q=80&w=600&auto=format&fit=crop", category: "Pens" }
    ]
  },
  {
    name: "FreshPress Laundry", location: "Main Campus", vendorType: "LAUNDRY",
    imageUrl: "https://images.unsplash.com/photo-1545173153-5d4694469bb7?q=80&w=800&auto=format&fit=crop",
    tags: ["laundry","dry-wash"],
    menu: [
      { name: "Express Dry Cleaning (Suit)", price: 499, description: "Premium dry wash for formal wear.", imageUrl: "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?q=80&w=600&auto=format&fit=crop", category: "Dry Wash" },
      { name: "Sneaker Deep Restore", price: 250, description: "Full sneaker cleaning & whitening.", imageUrl: "https://images.unsplash.com/photo-1514989940723-e8e51635b782?q=80&w=600&auto=format&fit=crop", category: "Sneaker Care" }
    ]
  },
  {
    name: "Iron Kitchen: Pro Meals", location: "Main Campus", vendorType: "GYM",
    imageUrl: "https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800&auto=format&fit=crop",
    tags: ["gym","high-protein","healthy"],
    menu: [
      { name: "High-Protein Salmon Bowl", price: 350, description: "30g protein with quinoa & avocado.", imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=600&auto=format&fit=crop", category: "Protein Bowls" },
      { name: "Whey Isolate Shake", price: 199, description: "Vanilla whey isolate, 25g protein.", imageUrl: "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?q=80&w=600&auto=format&fit=crop", category: "Shakes" }
    ]
  },
  {
    name: "Zenvy Brew Bar", location: "Main Campus", vendorType: "DRINKS",
    imageUrl: "https://images.unsplash.com/photo-1497515114629-f71d768fd07c?q=80&w=800&auto=format&fit=crop",
    tags: ["drinks"],
    menu: [
      { name: "Iced Caramel Macchiato", price: 160, description: "Double-shot espresso with caramel.", imageUrl: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=600&auto=format&fit=crop", category: "Coffee" },
      { name: "Matcha Green Tea Latte", price: 140, description: "Premium matcha with steamed milk.", imageUrl: "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?q=80&w=600&auto=format&fit=crop", category: "Tea" }
    ]
  },
  {
    name: "Nexus Gift Lounge", location: "Main Campus", vendorType: "SEASONAL",
    imageUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=800&auto=format&fit=crop",
    tags: ["seasonal"],
    menu: [
      { name: "Nexus Holiday Hamper", price: 999, description: "Curated premium gift box.", imageUrl: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=600&auto=format&fit=crop", category: "Hampers" },
      { name: "Limited Edition Campus Mug", price: 299, description: "Collector's edition SRMAP mug.", imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=600&auto=format&fit=crop", category: "Merch" }
    ]
  },
  {
    name: "Nexus Campus Fleet", location: "Main Campus", vendorType: "RENTAL",
    imageUrl: "https://images.unsplash.com/photo-1614165939096-45ef13bcbc0e?q=80&w=800&auto=format&fit=crop",
    tags: ["rental"],
    menu: [
      { name: "Nexus E-Bike Pro (Hourly)", price: 50, description: "Electric bike rental per hour.", imageUrl: "https://images.unsplash.com/photo-1593764592116-bfb2a97c642a?q=80&w=600&auto=format&fit=crop", category: "E-Bikes" },
      { name: "Electric Longboard X", price: 75, description: "Premium electric longboard.", imageUrl: "https://images.unsplash.com/photo-1547444801-f99a9f60e392?q=80&w=600&auto=format&fit=crop", category: "Boards" }
    ]
  },
  {
    name: "Fresh Harvest Hub", location: "Main Campus", vendorType: "GROCERY",
    imageUrl: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=800&auto=format&fit=crop",
    tags: ["fruits","grocery","healthy"],
    menu: [
      { name: "Organic Dragon Fruit", price: 120, description: "Premium imported dragon fruit.", imageUrl: "https://images.unsplash.com/photo-1527325241048-218156277fbb?q=80&w=600&auto=format&fit=crop", category: "Exotic" },
      { name: "Exotic Berries Symphony", price: 599, description: "Mixed premium berry box.", imageUrl: "https://images.unsplash.com/photo-1629815049187-b952a2333061?q=80&w=600&auto=format&fit=crop", category: "Exotic" }
    ]
  },
  {
    name: "Le Macaron Boutique", location: "Main Campus", vendorType: "SWEETS",
    imageUrl: "https://images.unsplash.com/photo-1551024601-bec78aea704b?q=80&w=800&auto=format&fit=crop",
    tags: ["sweets"],
    menu: [
      { name: "Gold Leaf Belgian Pralines", price: 699, description: "Handcrafted gold leaf chocolates.", imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=600&auto=format&fit=crop", category: "Pralines" },
      { name: "Macaron Collection (12 pcs)", price: 450, description: "Assorted French macarons.", imageUrl: "https://images.unsplash.com/photo-1551024506-0bccd828d307?q=80&w=600&auto=format&fit=crop", category: "Pastries" }
    ]
  }
];

async function reseed() {
  await connectDB();
  await connectDB();
  const sequelize = getSequelize();
  const { getRestaurantModel } = require('./models/Restaurant');
  const { getMenuItemModel } = require('./models/MenuItem');
  const Restaurant = getRestaurantModel();
  const MenuItem = getMenuItemModel();
  const { getOrderModel } = require('./models/Order');
  const Order = getOrderModel();

  // Clear existing data
  await Order.destroy({ where: {} });
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
