/* eslint-disable */
const { Sequelize, DataTypes } = require('sequelize');
const dotenv = require('dotenv');
dotenv.config();

const { connectDB, getSequelize } = require('./config/db');
const { getRestaurantModel } = require('./models/Restaurant');
const { getMenuItemModel } = require('./models/MenuItem');
const { getOrderModel } = require('./models/Order');
const { getUserModel } = require('./models/User');
const { getDeliveryPartnerModel } = require('./models/DeliveryPartner');

const mockVendors = [
  {
    name: "Cacao Culture",
    imageUrl: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800",
    vendorType: 'FOOD',
    tags: ["desserts", "sweets"],
    menu: [
      { name: "Belgian Chocolate Truffles", price: 450, category: "Desserts", tags: ["sweets", "seasonal"], image: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400" },
      { name: "Red Velvet Jar", price: 180, category: "Desserts", tags: ["sweets", "bakery"], image: "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?w=400" }
    ]
  },
  {
    name: "Gym Rats Nutrition",
    imageUrl: "https://images.unsplash.com/photo-1583454110551-21f2fa2ec617?w=800",
    vendorType: 'GYM',
    tags: ["gym", "healthy", "supplements"],
    menu: [
      { name: "Whey Protein Isolate (1kg)", price: 2400, category: "Supplements", tags: ["gym", "high-protein"], image: "https://images.unsplash.com/photo-1593095191850-2a76a5da242?w=400" },
      { name: "Steel-Cut Rolled Oats", price: 350, category: "Breakfast", tags: ["gym", "healthy", "low-calorie"], image: "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=400" }
    ]
  },
  {
    name: "Liquid Luxury",
    imageUrl: "https://images.unsplash.com/photo-1544145945-f904253d0c7b?w=800",
    vendorType: 'DRINKS',
    tags: ["drinks", "beverages"],
    menu: [
      { name: "Sparkling Blue Mocktail", price: 220, category: "Beverages", tags: ["drinks", "seasonal"], image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400" },
      { name: "Cold Brew Coffee", price: 180, category: "Beverages", tags: ["drinks", "energy"], image: "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=400" }
    ]
  }
];

const seed = async () => {
  try {
    await connectDB();
    const Restaurant = getRestaurantModel();
    const MenuItem = getMenuItemModel();
    const Order = getOrderModel();
    const User = getUserModel();
    const DeliveryPartner = getDeliveryPartnerModel();
    
    // DANGER: Never use { force: true } in a global seed script that might be run on production.
    await getSequelize().sync({ alter: true });

    await Order.destroy({ where: {} });
    await MenuItem.destroy({ where: {} });
    await Restaurant.destroy({ where: {} });
    await User.destroy({ where: {} });
    await DeliveryPartner.destroy({ where: {} });
    console.log('✅ Cleared existing database.');

    for (const vendorData of mockVendors) {
      const vendor = await Restaurant.create({
        name: vendorData.name,
        location: 'SRM AP Campus',
        imageUrl: vendorData.imageUrl,
        vendorType: vendorData.vendorType,
        commissionRate: 15,
        commissionType: 'percentage',
        operatingHours: { start: '08:00', end: '23:00' },
        isActive: true,
        tags: vendorData.tags || []
      });

      if (vendorData.menu && Array.isArray(vendorData.menu)) {
        const menuItems = vendorData.menu.map(item => ({
          restaurantId: vendor.id,
          name: item.name,
          price: item.price,
          description: `Premium ${item.name} for the Zenvy community.`,
          imageUrl: item.image,
          category: item.category,
          tags: item.tags || [],
          isVegetarian: item.tags.includes('veg') || item.tags.includes('fruits'),
          isAvailable: true,
          isEliteOnly: false
        }));
        await MenuItem.bulkCreate(menuItems);
      }
      console.log(`✅ Seeded Vendor: ${vendor.name}`);
    }

    // Create a demo user for bypass testing (Standard)
    await User.create({
      name: 'Tester',
      phone: '1234567890',
      password: 'password123',
      hostelBlock: 'VEDAVATHI',
      roomNumber: '101',
      isElite: true
    });

    // Create a demo user for error_discovery.js
    await User.create({
      name: 'E2E Tester',
      phone: '9999999999',
      password: 'password123',
      hostelBlock: 'BRAHMAPUTRA',
      roomNumber: '505',
      isElite: true
    });

    // Create a demo rider for bypass testing
    await DeliveryPartner.create({
      name: 'Rider Tester',
      phone: '1234567890',
      password: 'password123',
      isApproved: true,
      isOnline: true
    });

    // Create a demo rider for error_discovery.js
    await DeliveryPartner.create({
      name: 'E2E Rider',
      phone: '8888888888',
      password: 'password123',
      isApproved: true,
      isOnline: true
    });

    console.log('🎉 Seeding Complete. Zenvy Evolution is ready.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seed();
