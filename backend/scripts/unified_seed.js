require('dotenv').config();
const { connectDB } = require('../config/db');
const { getDeliveryPartnerModel } = require('../models/DeliveryPartner');
const { getUserModel } = require('../models/User');
const { getRestaurantModel } = require('../models/Restaurant');
const { getMenuItemModel } = require('../models/MenuItem');

const unifiedSeed = async () => {
  await connectDB();
  const DeliveryPartner = getDeliveryPartnerModel();
  const User = getUserModel();
  const Restaurant = getRestaurantModel();
  const MenuItem = getMenuItemModel();

  console.log('--- Starting Unified Production Seed ---');

  // 1. Seed Riders
  const riders = [
    { id: 'mock-driver-1', name: 'Hostel Hub Rider', phone: '0000000000', password: 'srk', isApproved: true, isOnline: true },
    { id: 'mock-driver-2', name: 'Zenvy Test Rider', phone: '9876543210', password: 'password123', isApproved: true, isOnline: true }
  ];

  for (const r of riders) {
    await DeliveryPartner.destroy({ where: { phone: r.phone } }).catch(() => {});
    await DeliveryPartner.create(r);
    console.log(`✅ Rider: ${r.phone} / ${r.password}`);
  }

  // 2. Seed Users
  const users = [
    { name: 'Sanya Gupta', phone: '9123456789', password: 'password123', role: 'student', isElite: true },
    { name: 'Ram Babu', phone: '1234567890', password: 'password123', role: 'student' },
    { name: 'Shanmukh Admin', phone: '9391955674', password: 'password123', role: 'admin' }
  ];

  for (const u of users) {
    await User.destroy({ where: { phone: u.phone } }).catch(() => {});
    await User.create(u);
    console.log(`✅ User: ${u.phone} / ${u.password}`);
  }

  // 3. Seed A Default Restaurant if none exist
  const count = await Restaurant.count();
  if (count === 0) {
    const res = await Restaurant.create({
      name: 'Nexus Omni-Kitchen',
      location: 'Central Hub',
      vendorType: 'GLOBAL_MARKET',
      rating: 5.0,
      tags: ['elite', 'nexus']
    });
    await MenuItem.create({
      restaurantId: res.id,
      name: 'Nexus Signature Biryani',
      price: 250,
      category: 'Biryani',
      isAvailable: true
    });
    console.log('✅ Created Default Restaurant: Nexus Omni-Kitchen');
  }

  console.log('--- Seeding Complete ---');
  process.exit();
};

unifiedSeed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
