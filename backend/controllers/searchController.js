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

    // Use Op.like (case-insensitive on SQLite by default, works on both Postgres & SQLite)
    const likeOp = Op.like;

    // Search Restaurants by name
    const restaurants = await Restaurant.findAll({
      where: {
        name: { [likeOp]: `%${q}%` },
        isActive: true
      },
      limit: 5
    });

    // Build restaurant ID-to-name map for manual join
    const allRestaurants = await Restaurant.findAll({ attributes: ['id', 'name', 'imageUrl'] });
    const restMap = Object.fromEntries(allRestaurants.map(r => [r.id, { name: r.name, imageUrl: r.imageUrl }]));

    // Search Menu Items by name, description, or category
    const menuItems = await MenuItem.findAll({
      where: {
        [Op.and]: [
          { isAvailable: true },
          {
            [Op.or]: [
              { name: { [likeOp]: `%${q}%` } },
              { description: { [likeOp]: `%${q}%` } },
              { category: { [likeOp]: `%${q}%` } }
            ]
          }
        ]
      },
      limit: 10
    });

    // Transform menuItems to match the expected format
    const items = menuItems.map(item => {
      const itemJSON = item.toJSON();
      const rest = restMap[itemJSON.restaurantId];
      return {
        ...itemJSON,
        restaurantId: rest ? { _id: itemJSON.restaurantId, name: rest.name, imageUrl: rest.imageUrl } : { _id: itemJSON.restaurantId, name: 'Unknown' }
      };
    });

    res.json({
      restaurants: restaurants.map(r => ({
        _id: r.id,
        name: r.name,
        location: r.location,
        imageUrl: r.imageUrl,
        rating: r.rating || 4.5
      })),
      items
    });
  } catch (error) {
    console.error('[SEARCH_ERROR]', error);
    res.status(500).json({ message: 'Error performing search', error: error.message });
  }
};

module.exports = { globalSearch };
