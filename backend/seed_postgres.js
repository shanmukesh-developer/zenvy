const { Sequelize, DataTypes } = require('sequelize');
const dotenv = require('dotenv');
dotenv.config();

const { connectDB, getSequelize } = require('./config/db');
const { getRestaurantModel } = require('./models/Restaurant');
const { getMenuItemModel } = require('./models/MenuItem');

const mockData = [
  {
    name: "Summer Oasis: Elite",
    imageUrl: "https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?auto=format&fit=crop&q=80&w=800&ts=elite_final",
    categories: ["Coolants", "Traditional", "Ice Creams"],
    menu: [
      { name: "Chilled Tender Coconut", price: 60, description: "Freshly cut natural coconut water.", image: "https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=400", category: "Coolants" }
    ]
  },
  {
    name: "Boutique Bakery",
    imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400",
    categories: ["Artisanal Bakes", "Croissants"],
    menu: [
      { name: "Butter Croissant", price: 80, description: "Flaky french pastry.", image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400", category: "Artisanal Bakes" }
    ]
  },
  {
    name: "Sweet Boutique",
    imageUrl: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400",
    categories: ["Desserts", "Gourmet Treats"],
    menu: [
      { name: "Belgian Chocolate Truffle", price: 120, description: "Rich chocolate dessert.", image: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400", category: "Desserts" }
    ]
  },
  {
    name: "Fresh Harvest",
    imageUrl: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400",
    categories: ["Fruits", "Healthy"],
    menu: [
      { name: "Exotic Fruit Bowl", price: 150, description: "Fresh seasonal fruits cut daily.", image: "https://images.unsplash.com/photo-1490474418585-ba9dd8fd36ea?w=400", category: "Fruits" }
    ]
  },
  {
    "name": "Pizza Paradise",
    "imageUrl": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400",
    "categories": ["Pizza", "Pasta", "Sides"],
    "menu": [
      { "name": "Margherita Classica", "price": 280, "description": "San Marzano tomatoes & fresh mozzarella.", "image": "https://images.unsplash.com/photo-1574129656617-8be3bb2016eb?q=80&w=400", "category": "Pizza" }
    ]
  },
  {
    "name": "Biryani Hub",
    "imageUrl": "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=400&auto=format&fit=crop",
    "categories": ["Biryani", "Kebabs", "Main Course"],
    "menu": [
      { "name": "Special Mutton Fry", "price": 280, "description": "Tender goat cooked in traditional spices.", "image": "https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?w=400", "category": "Biryani" }
    ]
  }
];

const seed = async () => {
  try {
    await connectDB();
    const Restaurant = getRestaurantModel();
    const MenuItem = getMenuItemModel();
    await getSequelize().sync({ alter: true });

    await MenuItem.destroy({ where: {} });
    await Restaurant.destroy({ where: {} });
    console.log('✅ Cleared existing restaurants and menu items.');

    for (const restData of mockData) {
      const restaurant = await Restaurant.create({
        name: restData.name,
        location: 'Main Campus',
        imageUrl: restData.imageUrl,
        commissionRate: 10,
        commissionType: 'percentage',
        operatingHours: { start: '09:00', end: '22:00' },
        isActive: true,
        tags: restData.categories || []
      });

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
      console.log(`✅ Seeded: ${restaurant.name}`);
    }

    console.log('🎉 Seeding Complete. Frontend categories should now populate.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seed();
