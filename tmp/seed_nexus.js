const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const { connectDB, getSequelize } = require('../backend/config/db');
const { getRestaurantModel } = require('../backend/models/Restaurant');
const { getMenuItemModel } = require('../backend/models/MenuItem');

const restaurants = [
  {
    "name": "Biryani Hub",
    "lat": 16.5062, "lon": 80.6480, "zone": "Amaravathi_Central",
    "imageUrl": "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=400&auto=format&fit=crop",
    "categories": ["Biryani", "Kebabs"],
    "menu": [
      { "name": "Special Mutton Fry", "price": 280, "description": "Tender goat cooked in traditional spices.", "image": "https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?w=400", "category": "Biryani" },
      { "name": "Hyderabadi Dum Biryani", "price": 250, "description": "Classic slow-cooked chicken biryani.", "image": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400", "category": "Biryani" }
    ]
  },
  {
    "name": "The Burger Club",
    "lat": 16.4632, "lon": 80.5064, "zone": "SRM_North",
    "imageUrl": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400",
    "categories": ["Burgers", "Shakes"],
    "menu": [
      { "name": "Classic Cheeseburger", "price": 150, "description": "Juicy patty with melted cheddar.", "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400", "category": "Burgers" }
    ]
  },
  {
    "name": "Nezumi Sushi",
    "lat": 16.4338, "lon": 80.5616, "zone": "Amaravathi_East",
    "imageUrl": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=400",
    "categories": ["Sushi", "Japanese"],
    "menu": [
      { "name": "Salmon Nigiri", "price": 450, "description": "Fresh salmon on vinegared rice.", "image": "https://images.unsplash.com/photo-1583623025817-d180a2221d0a?w=400", "category": "Sushi" }
    ]
  }
];

const seed = async () => {
  try {
    await connectDB();
    console.log('Connected to Database');

    const sequelize = getSequelize();
    const Restaurant = getRestaurantModel();
    const MenuItem = getMenuItemModel();

    await Restaurant.destroy({ where: {} });
    await MenuItem.destroy({ where: {} });
    console.log('Cleared existing collections');

    for (const restData of restaurants) {
      const restaurant = await Restaurant.create({
        name: restData.name,
        location: restData.zone.replace('_', ' '),
        lat: restData.lat,
        lon: restData.lon,
        zone: restData.zone,
        imageUrl: restData.imageUrl,
        commissionRate: 15,
        isActive: true,
        tags: restData.categories
      });
      console.log(`Seeded Restaurant: ${restaurant.name} at ${restaurant.zone}`);

      const menuItems = restData.menu.map(item => ({
        restaurantId: restaurant.id,
        name: item.name,
        price: item.price,
        description: item.description,
        imageUrl: item.image,
        category: item.category,
        isAvailable: true
      }));
      await MenuItem.bulkCreate(menuItems);
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
