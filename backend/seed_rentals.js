/* eslint-disable */
const { connectDB, getSequelize } = require('./config/db');
const { getRestaurantModel } = require('./models/Restaurant');
const { getMenuItemModel } = require('./models/MenuItem');
const dotenv = require('dotenv');
dotenv.config();

const seedRentals = async () => {
  try {
    await connectDB();
    const Restaurant = getRestaurantModel();
    const MenuItem = getMenuItemModel();

    // 1. Create or Find the Rental Vendor
    const [vendor, created] = await Restaurant.findOrCreate({
      where: { name: 'Nexus Rentals' },
      defaults: {
        location: 'SRM AP Central Hub',
        imageUrl: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800',
        vendorType: 'RENTAL',
        commissionRate: 10,
        commissionType: 'percentage',
        operatingHours: { start: '06:00', end: '22:00' },
        isActive: true,
        tags: ['rentals', 'mobility'],
        rating: 4.8
      }
    });

    if (created) {
      console.log('✅ Created Vendor: Nexus Rentals');
    } else {
      console.log('ℹ️ Nexus Rentals already exists. Updating items...');
    }

    // 2. Clear existing items and add new ones (or just add new ones)
    // For simplicity in this one-off seed, we'll just ensure the items exist
    const items = [
      {
        name: "Electric Scooter S1",
        price: 49,
        description: "Premium electric scooter for campus mobility. High-speed, long-range.",
        imageUrl: "https://images.unsplash.com/photo-1597075254133-7e4468f2372f?w=400",
        category: "Rentals",
        tags: ["rental", "electric", "eco"],
        isVegetarian: false,
        isAvailable: true,
        isEliteOnly: false
      },
      {
        name: "Mountain Cycle XR",
        price: 25,
        description: "Rugged mountain cycle for all terrains. 21-speed gears.",
        imageUrl: "https://images.unsplash.com/photo-1532298229144-0ee0c9e9ad58?w=400",
        category: "Rentals",
        tags: ["rental", "fitness", "manual"],
        isVegetarian: false,
        isAvailable: true,
        isEliteOnly: false
      }
    ];

    for (const itemData of items) {
       const [item, itemCreated] = await MenuItem.findOrCreate({
         where: { name: itemData.name, restaurantId: vendor.id },
         defaults: {
           ...itemData,
           restaurantId: vendor.id
         }
       });
       if (itemCreated) {
         console.log(`✅ Seeded Item: ${itemData.name}`);
       } else {
         console.log(`ℹ️ Item already exists: ${itemData.name}`);
       }
    }

    console.log('🎉 Rental Seeding Complete.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedRentals();
