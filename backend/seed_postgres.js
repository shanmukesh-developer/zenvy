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
const { initVaultItemModel, getVaultItemModel } = require('./models/VaultItem');



const mockData = [
  {
    id: "e9eb9d54-3a51-422d-b070-e66975a6b68e",
    name: "Summer Oasis: Elite",
    imageUrl: "https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?auto=format&fit=crop&q=80&w=800",
    categories: ["Coolants", "Traditional", "Ice Creams"],
    menu: [
      { name: "Chilled Tender Coconut", price: 60, description: "Freshly cut natural coconut water.", image: "https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=400", category: "Coolants" },
      { name: "Kesar Badam Milk", price: 90, description: "Saffron infused cold almond milk.", image: "https://images.unsplash.com/photo-1634832506443-4c570af4b680?w=400", category: "Coolants" },
      { name: "Rose Petal Sorbet", price: 120, description: "Handcrafted cooling rose extract base.", image: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400", category: "Ice Creams" }
    ]
  },
  {
    id: "bef0fa4b-1c1d-4f22-ae74-d32df31e2d37",
    name: "Boutique Bakery",
    imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400",
    categories: ["Artisanal Bakes", "Croissants"],
    menu: [
      { name: "Butter Croissant", price: 80, description: "Flaky french pastry.", image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400", category: "Artisanal Bakes" },
      { name: "Pain au Chocolat", price: 110, description: "Rich chocolate filled layered pastry.", image: "https://images.unsplash.com/photo-1530610476181-d83430b64dcd?w=400", category: "Artisanal Bakes" },
      { name: "Blueberry Cheesecake", price: 180, description: "New York style with fresh berries.", image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400", category: "Artisanal Bakes" }
    ]
  },
  {
    id: "ca3f99e1-8f1f-4f3e-a209-ed78ff638cf5",
    name: "Sweet Boutique",
    imageUrl: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400",
    categories: ["Desserts", "Gourmet Treats"],
    menu: [
      { name: "Belgian Chocolate Truffle", price: 120, description: "Rich chocolate dessert.", image: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400", category: "Desserts" },
      { name: "Red Velvet Jar", price: 150, description: "Classic red velvet with cream cheese frosting.", image: "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?w=400", category: "Gourmet Treats" },
      { name: "Assorted Macarons (4pc)", price: 220, description: "Parisian style almond meringues.", image: "https://images.unsplash.com/photo-1569864358642-9d161970296d?w=400", category: "Desserts" }
    ]
  },
  {
    id: "296ec3cf-4eee-44e7-9454-1d4e563e1687",
    name: "Fresh Harvest",
    imageUrl: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400",
    categories: ["Fruits", "Healthy"],
    menu: [
      { name: "Exotic Fruit Bowl", price: 150, description: "Fresh seasonal fruits cut daily.", image: "https://images.unsplash.com/photo-1490474418585-ba9dd8fd36ea?w=400", category: "Fruits" },
      { name: "Avocado Power Toast", price: 240, description: "Mashed avocado on gluten-free bread.", image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400", category: "Healthy" }
    ]
  },
  {
    id: "706822c4-2eb3-43b4-ad86-91a252ea9108",
    name: "Pizza Paradise",
    imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400",
    categories: ["Pizza", "Pasta", "Sides"],
    menu: [
      { name: "Margherita Classica", price: 280, description: "San Marzano tomatoes & fresh mozzarella.", image: "https://images.unsplash.com/photo-1574129656617-8be3bb2016eb?q=80&w=400", category: "Pizza" },
      { name: "Garden Feast Pizza", price: 320, description: "Loaded with colorful bell peppers and olives.", image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400", category: "Pizza" }
    ]
  },
  {
    id: "8467dbf0-1b1b-4ae5-88b6-0fccbfcb1cbb",
    name: "Biryani Hub",
    imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=400&auto=format&fit=crop",
    categories: ["Biryani", "Kebabs", "Main Course"],
    menu: [
      { name: "Special Mutton Fry", price: 280, description: "Tender goat cooked in traditional spices.", image: "https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?w=400", category: "Biryani" }
    ]
  }
];

const seed = async () => {
  try {
    await connectDB();
    const Restaurant = getRestaurantModel();
    const MenuItem = getMenuItemModel();
    const User = getUserModel();
    const DeliveryPartner = getDeliveryPartnerModel();
    const Order = getOrderModel();
    const VaultItem = initVaultItemModel(getSequelize());
    
    await getSequelize().sync({ force: true });

    await MenuItem.destroy({ where: {} });
    await Restaurant.destroy({ where: {} });
    await Order.destroy({ where: {} });
    await User.destroy({ where: {} });
    await DeliveryPartner.destroy({ where: {} });
    await VaultItem.destroy({ where: {} });
    console.log('✅ Cleared existing database.');


    let firstRestaurantId;
    for (const restData of mockData) {
      const restaurant = await Restaurant.create({
        id: restData.id,
        name: restData.name,
        location: 'SRM AP Main Campus',
        imageUrl: restData.imageUrl,
        commissionRate: 15,
        password: 'password123', // Default password for portal access
        commissionType: 'percentage',
        operatingHours: { start: '09:00', end: '22:00' },
        isActive: true,
        tags: restData.categories || []
      });
      if (!firstRestaurantId) firstRestaurantId = restaurant.id;

      if (restData.menu && Array.isArray(restData.menu)) {
        const menuItems = restData.menu.map(item => ({
          restaurantId: restaurant.id,
          name: item.name,
          price: item.price,
          description: item.description,
          image: item.image || item.imageUrl,
          category: item.category,
          isAvailable: true,
          isEliteOnly: false
        }));
        await MenuItem.bulkCreate(menuItems);
      }
      console.log(`✅ Seeded Restaurant: ${restaurant.name}`);
    }

    // --- Seed Mock Orders for Leaderboard ---
    const blocks = ['VEDAVATHI', 'KRISHNA', 'GANGA-A', 'GANGA-B'];
    for (const block of blocks) {
      const user = await User.create({
        name: `SeedUser_${block}`,
        phone: `900000000${blocks.indexOf(block)}`,
        password: 'password123',
        hostelBlock: block,
        roomNumber: '101',
        isElite: true
      });

      const orderCount = Math.floor(Math.random() * 15) + 10;
      for (let i = 0; i < orderCount; i++) {
        await Order.create({
          userId: user.id,
          restaurantId: firstRestaurantId, 
          status: 'Delivered',
          totalPrice: 500,
          deliveryFee: 20,
          finalPrice: 520,
          items: [{ name: 'Mutton Biryani', quantity: 2, price: 250 }],
          paymentMethod: 'COD',
          hostelBlock: block,
          createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
        });
      }
    }

    // --- Seed Mock Delivery Partner ---
    await DeliveryPartner.create({
      name: 'Rider SRK',
      phone: 'driver-1',
      password: 'srk',
      vehicleType: 'Electric Scooter',
      vehicleNumber: 'AP31-ZEN-2024',
      isApproved: true,
      isOnline: true
    });
    console.log('✅ Seeded Delivery Partner: Rider SRK (driver-1)');

    // --- Seed Admin User ---
    await User.create({
      name: 'Nexus Admin',
      phone: '9391955674',
      password: 'zenvy_admin',
      role: 'admin'
    });
    console.log('✅ Seeded Admin User: Nexus Admin (admin-1)');

    // --- Seed Vault Items ---
    const vaultItems = [
      {
        name: 'Silver Origin Coffee',
        price: 149,
        originalPrice: 499,
        remainingCount: 5,
        imageUrl: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?q=80&w=800&auto=format&fit=crop',
        isActive: true,
        streakRequirement: 3
      },
      {
        name: 'Elite Cyber Membership',
        price: 199,
        originalPrice: 999,
        remainingCount: 2,
        imageUrl: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?q=80&w=800&auto=format&fit=crop',
        isActive: true,
        streakRequirement: 7
      }
    ];

    await VaultItem.bulkCreate(vaultItems);
    console.log('✅ Seeded Zenvy Vault Items');


    console.log('🎉 Seeding Complete. Zenvy is now ALIVE.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seed();
