const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Models
const Restaurant = require('./models/Restaurant');
const MenuItem = require('./models/MenuItem');

dotenv.config();

const restaurants = [
  {
    "name": "Biryani Hub",
    "imageUrl": "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=400&auto=format&fit=crop",
    "categories": ["Biryani", "Kebabs", "Main Course"],
    "menu": [
      { "name": "Special Mutton Fry", "price": 280, "description": "Tender goat cooked in traditional spices.", "image": "https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?w=400", "category": "Biryani" },
      { "name": "Royal Egg Biryani", "price": 220, "description": "Fragrant rice with double eggs.", "image": "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=400", "category": "Biryani" },
      { "name": "Chicken Tikka Kebab", "price": 180, "description": "Juicy grilled chicken skewers.", "image": "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400", "category": "Kebabs" },
      { "name": "Hyderabadi Dum Biryani", "price": 250, "description": "Classic slow-cooked chicken biryani.", "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?w=400", "category": "Biryani" }
    ]
  },
  {
    "name": "The Burger Club",
    "imageUrl": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400",
    "categories": ["Burgers", "Sides", "Shakes"],
    "menu": [
      { "name": "Classic Cheeseburger", "price": 150, "description": "Juicy patty with melted cheddar.", "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400", "category": "Burgers" },
      { "name": "Peri Peri Fries", "price": 80, "description": "Spicy seasoned crinkle cut fries.", "image": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400", "category": "Sides" }
    ]
  },
  {
    "name": "Pizza Paradise",
    "imageUrl": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400",
    "categories": ["Pizza", "Pasta", "Sides"],
    "menu": [
      { "name": "Margherita Classica", "price": 280, "description": "San Marzano tomatoes & fresh mozzarella.", "image": "https://images.unsplash.com/photo-1574129656617-8be3bb2016eb?q=80&w=400", "category": "Pizza" },
      { "name": "Creamy Alfredo", "price": 260, "description": "White sauce pasta with mushrooms.", "image": "https://images.unsplash.com/photo-1645112481357-3061fc726ae5?q=80&w=400", "category": "Pasta" }
    ]
  }
];

const seed = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) throw new Error('MONGO_URI not found in environment');
    
    await mongoose.connect(mongoUri);
    console.log('Connected to Database');

    await Restaurant.deleteMany({});
    await MenuItem.deleteMany({});
    console.log('Cleared existing collections');

    for (const restData of restaurants) {
      const restaurant = await Restaurant.create({
        name: restData.name,
        location: 'SRM AP Main Campus',
        imageUrl: restData.imageUrl,
        commissionRate: 15,
        commissionType: 'percentage',
        operatingHours: { start: '09:00', end: '22:00' },
        isActive: true,
        tags: restData.categories
      });
      console.log(`Seeded Restaurant: ${restaurant.name}`);

      const menuItems = restData.menu.map(item => ({
        restaurantId: restaurant._id,
        name: item.name,
        price: item.price,
        description: item.description,
        image: item.image,
        category: item.category,
        isAvailable: true,
        isEliteOnly: false
      }));
      await MenuItem.insertMany(menuItems);
      console.log(`Seeded ${menuItems.length} items for ${restaurant.name}`);
    }

    console.log('Nexus Seeding Complete');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seed();
