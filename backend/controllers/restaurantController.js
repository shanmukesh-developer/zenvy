const { getRestaurantModel } = require('../models/Restaurant');
const { getMenuItemModel } = require('../models/MenuItem');

// @desc    Get all active restaurants
// @route   GET /api/restaurants
const getRestaurants = async (req, res) => {
  try {
    const Restaurant = getRestaurantModel();
    const restaurants = await Restaurant.findAll({ where: { isActive: true } });
    res.json(restaurants);
  } catch (error) {
    console.error('[RESTAURANT_ERROR]', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get menu for a specific restaurant
// @route   GET /api/restaurants/:id/menu
const getRestaurantMenu = async (req, res) => {
  try {
    const MenuItem = getMenuItemModel();
    const menu = await MenuItem.findAll({ where: { restaurantId: req.params.id, isAvailable: true } });
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
    const Restaurant = getRestaurantModel();
    const restaurant = await Restaurant.create({ name, location, imageUrl, deliveryTime, commissionRate });
    res.status(201).json(restaurant);
  } catch (error) {
    console.error('[CREATE_RESTAURANT_ERROR]', error);
    res.status(400).json({ message: 'Invalid restaurant data' });
  }
};

module.exports = { getRestaurants, getRestaurantMenu, createRestaurant };
