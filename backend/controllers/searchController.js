const { getRestaurantModel } = require('../models/Restaurant');
const { getMenuItemModel } = require('../models/MenuItem');
const { Op } = require('sequelize');

// @desc    Global search across restaurants and menu items
// @route   GET /api/search
const globalSearch = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ message: 'Search query is required' });

  try {
    const Restaurant = getRestaurantModel();
    const MenuItem = getMenuItemModel();

    // Search Restaurants by name
    const restaurants = await Restaurant.findAll({
      where: {
        name: { [Op.iLike]: `%${q}%` },
        isActive: true
      },
      limit: 5
    });

    // Search Menu Items by name, description, or category
    const menuItems = await MenuItem.findAll({
      where: {
        [Op.and]: [
          { isAvailable: true },
          {
            [Op.or]: [
              { name: { [Op.iLike]: `%${q}%` } },
              { description: { [Op.iLike]: `%${q}%` } },
              { category: { [Op.iLike]: `%${q}%` } }
            ]
          }
        ]
      },
      include: [{
        model: Restaurant,
        as: 'restaurant',
        attributes: ['name', 'imageUrl']
      }],
      limit: 10
    });

    // Transform menuItems to match the expected format (restaurantId.name)
    const items = menuItems.map(item => {
      const itemJSON = item.toJSON();
      return {
        ...itemJSON,
        restaurantId: item.restaurant ? { name: item.restaurant.name, imageUrl: item.restaurant.imageUrl } : item.restaurantId
      };
    });

    res.json({
      restaurants,
      items
    });
  } catch (error) {
    console.error('[SEARCH_ERROR]', error);
    res.status(500).json({ message: 'Error performing search' });
  }
};

module.exports = { globalSearch };
