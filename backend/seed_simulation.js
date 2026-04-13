const { connectDB, getSequelize } = require('./config/db');

const seed = async () => {
  try {
    await connectDB();
    const sequelize = getSequelize();
    const { Restaurant, MenuItem, DeliveryPartner, User } = sequelize.models;

    console.log('--- NON-DESTRUCTIVE SEEDING ---');

    // 1. Seed User: ram babu
    let [user] = await User.findOrCreate({
      where: { phone: '1234567890' },
      defaults: {
        name: 'ram babu',
        password: 'password123',
        role: 'student',
        walletBalance: 1000,
        address: 'GH-2, Room 105'
      }
    });
    user.password = 'password123';
    await user.save();
    console.log('✅ User ram babu (1234567890) verified');

    // 2. Seed User: Admin
    let [adminUser] = await User.findOrCreate({
      where: { phone: '9391955674' },
      defaults: {
        name: 'Shanmukh Admin',
        password: 'password123',
        role: 'admin',
        walletBalance: 0
      }
    });
    adminUser.password = 'password123';
    adminUser.role = 'admin';
    await adminUser.save();
    console.log('✅ Admin User 9391955674 verified');

    // 3. Seed Restaurant: Nexus Kitchen
    let [restaurant] = await Restaurant.findOrCreate({
      where: { name: 'Nexus Kitchen' },
      defaults: {
        location: 'Main Block, SRM AP',
        lat: 16.5062,
        lon: 80.6480,
        zone: 'Amaravathi_Central',
        imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
        rating: 4.8,
        deliveryTime: 25,
        isActive: true,
        vendorType: 'RESTAURANT',
        tags: ['biryani', 'pizza', 'premium'],
        password: 'password123'
      }
    });
    restaurant.password = 'password123';
    await restaurant.save();
    console.log('✅ Restaurant Nexus Kitchen verified');

    // 4. Seed Menu Items
    const menuItems = [
      { name: 'Nexus Special Biryani', price: 250, category: 'Biryani' },
      { name: 'Classic Margherita', price: 300, category: 'Pizza' },
      { name: 'Dragon Fruit Cooler', price: 120, category: 'Drinks' }
    ];

    for (const item of menuItems) {
      await MenuItem.findOrCreate({
        where: { name: item.name, restaurantId: restaurant.id },
        defaults: {
          ...item,
          description: 'Our signature ' + item.category.toLowerCase(),
          imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
          isAvailable: true,
          isVegetarian: item.category !== 'Biryani'
        }
      });
    }
    console.log('✅ Menu items verified');

    // 5. Seed Delivery Partner
    let [rider] = await DeliveryPartner.findOrCreate({
      where: { phone: '9876543210' },
      defaults: {
        name: 'Test Rider',
        password: 'password123',
        vehicleType: 'Bike',
        isOnline: true,
        walletBalance: 500,
        rating: 5.0
      }
    });
    rider.password = 'password123';
    await rider.save();
    console.log('✅ Delivery Partner 9876543210 verified');

    console.log('--- SEEDING COMPLETE ---');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Failed:', error);
    process.exit(1);
  }
};

seed();
