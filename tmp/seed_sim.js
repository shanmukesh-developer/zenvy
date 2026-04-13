const { connectDB, getSequelize } = require('../backend/config/db');
const { getRestaurantModel } = require('../backend/models/Restaurant');
const { getMenuItemModel } = require('../backend/models/MenuItem');
const { getUserModel } = require('../backend/models/User');
const { getDeliveryPartnerModel } = require('../backend/models/DeliveryPartner');

const seedSim = async () => {
  try {
    await connectDB();
    const sequelize = getSequelize();
    
    // Create test user
    const User = sequelize.models.User;
    const testUser = await User.upsert({
      name: 'Test Customer',
      phone: '1234567890',
      password: 'password123',
      hostelBlock: 'VEDAVATHI',
      roomNumber: '101',
      walletBalance: 1000
    });
    console.log('✅ Test User created/updated');

    // Create test delivery partner
    const DeliveryPartner = sequelize.models.DeliveryPartner;
    const testRider = await DeliveryPartner.upsert({
      name: 'Test Rider',
      phone: '9876543210',
      password: 'password123',
      vehicleType: 'EV-Bike',
      vehicleNumber: 'AP-123',
      isApproved: true,
      isOnline: true
    });
    console.log('✅ Test Rider created/updated');

    // Ensure at least one restaurant exists
    const Restaurant = sequelize.models.Restaurant;
    const restaurantCount = await Restaurant.count();
    if (restaurantCount === 0) {
      const rest = await Restaurant.create({
        name: 'Nexus Kitchen',
        location: 'Main Block',
        imageUrl: 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?w=400',
        isActive: true,
        operatingHours: { start: '00:00', end: '23:59' }
      });
      console.log('✅ Test Restaurant created');
      
      const MenuItem = sequelize.models.MenuItem;
      await MenuItem.create({
        restaurantId: rest.id,
        name: 'Classic Burger',
        price: 99,
        category: 'Fast Food',
        isAvailable: true
      });
      console.log('✅ Test Menu Item created');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Simulation seeding failed:', err);
    process.exit(1);
  }
};

seedSim();
