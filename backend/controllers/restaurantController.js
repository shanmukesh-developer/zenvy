const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');

// Mode check
const isMock = () => process.env.MOCK_DATABASE === 'true';

// @desc    Get all active restaurants
// @route   GET /api/restaurants
const getRestaurants = async (req, res) => {
  if (isMock()) {
     return res.json([
       { id: '1', name: 'Elite Bistro', rating: '4.8', imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b', time: '1h Prep', isActive: true },
       { id: '2', name: 'Campus Canteen', rating: '4.2', imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5', time: '1h Prep', isActive: true },
       { id: 'boutique-sweets-elite', name: 'Royal Sweet Boutique', rating: '4.9', imageUrl: 'https://images.unsplash.com/photo-1532301141943-d758bd602856', time: '1h Prep', isActive: true }
     ]);
  }
  try {
    const restaurants = await Restaurant.find({ isActive: true });
    res.json(restaurants);
  } catch (error) {
    console.error('[RESTAURANT_ERROR]', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get menu for a specific restaurant
// @route   GET /api/restaurants/:id/menu
const getRestaurantMenu = async (req, res) => {
  if (isMock()) {
    return res.json([
      { id: 'm1', name: 'Signature Pasta', price: 250, rating: '4.9', isAvailable: true },
      { id: 'm2', name: 'Elite Burger', price: 180, rating: '4.7', isAvailable: true }
    ]);
  }
  try {
    const menu = await MenuItem.find({ restaurantId: req.params.id, isAvailable: true });
    res.json(menu);
  } catch (error) {
    console.error('[MENU_ERROR]', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a new restaurant (Admin only)
// @route   POST /api/restaurants
const createRestaurant = async (req, res) => {
  const { name, location, imageUrl, deliveryTime, commissionRate } = req.body;
  try {
    const restaurant = await Restaurant.create({ name, location, imageUrl, deliveryTime, commissionRate });
    res.status(201).json(restaurant);
  } catch (error) {
    console.error('[CREATE_RESTAURANT_ERROR]', error);
    res.status(400).json({ message: 'Invalid restaurant data' });
  }
};

module.exports = { getRestaurants, getRestaurantMenu, createRestaurant };
