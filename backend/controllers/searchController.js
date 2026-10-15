const { getRestaurantModel } = require('../models/Restaurant');
const { getMenuItemModel } = require('../models/MenuItem');
const { Op } = require('sequelize');
const { stripItemSecrets } = require('../utils/publicFields');

// Real rating only (0 = not rated yet → null, the app shows "New").
const realRating = (r) => (Number(r) > 0 ? Number(r) : null);
// LIKE wildcards typed by users are treated as plain spaces.
const cleanQuery = (q) => String(q || '').replace(/[%_]/g, ' ').trim().slice(0, 60);

// @desc    Global search across restaurants and menu items
// @route   GET /api/search
const globalSearch = async (req, res) => {
  const q = cleanQuery(req.query.q);
  
  try {
    const Restaurant = getRestaurantModel();
    const MenuItem = getMenuItemModel();
    
    // Check dialect to use appropriate case-insensitive operator
    const dialect = Restaurant.sequelize.getDialect();
    const likeOp = dialect === 'postgres' ? Op.iLike : Op.like;

    if (!q || q.trim().length < 2) {
      // Return Trending/Featured if no query
      const trendingRestaurants = await Restaurant.findAll({
        where: { isActive: true },
        order: [['rating', 'DESC NULLS LAST']], // Postgres puts NULL first on plain DESC
        limit: 4
      });
      const trendingItems = await MenuItem.findAll({
        where: { isAvailable: true },
        limit: 6,
        include: [{ model: Restaurant, as: 'restaurant', attributes: ['id', 'name', 'imageUrl', 'vendorType'], where: { isActive: true } }]
      });

      return res.json({
        restaurants: trendingRestaurants.map(r => ({
          _id: r.id, id: r.id, name: r.name, location: r.location, imageUrl: r.imageUrl, vendorType: r.vendorType, rating: realRating(r.rating)
        })),
        items: trendingItems.map(item => {
          const itemJSON = stripItemSecrets(item.toJSON());
          return {
            ...itemJSON,
            _id: itemJSON.id,
            restaurantId: { _id: itemJSON.restaurantId, name: itemJSON.restaurant ? itemJSON.restaurant.name : null, vendorType: itemJSON.restaurant ? itemJSON.restaurant.vendorType : null }
          };
        }),
        isTrending: true
      });
    }

    // Search Restaurants by name
    const restaurants = await Restaurant.findAll({
      where: {
        name: { [likeOp]: `%${q}%` },
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
              { name: { [likeOp]: `%${q}%` } },
              { description: { [likeOp]: `%${q}%` } },
              { category: { [likeOp]: `%${q}%` } }
            ]
          }
        ]
      },
      include: [{ model: Restaurant, as: 'restaurant', attributes: ['id', 'name', 'imageUrl', 'vendorType'], where: { isActive: true } }],
      limit: 15
    });

    // Transform menuItems to match the expected format
    const items = menuItems.map(item => {
      const itemJSON = stripItemSecrets(item.toJSON());
      return {
        ...itemJSON,
        _id: itemJSON.id,
        restaurantId: {
          _id: itemJSON.restaurantId,
          name: itemJSON.restaurant ? itemJSON.restaurant.name : null,
          vendorType: itemJSON.restaurant ? itemJSON.restaurant.vendorType : null
        }
      };
    });

    res.json({
      restaurants: restaurants.map(r => ({
        _id: r.id,
        id: r.id,
        name: r.name,
        location: r.location,
        imageUrl: r.imageUrl,
        vendorType: r.vendorType,
        rating: realRating(r.rating)
      })),
      items
    });
  } catch (error) {
    console.error('[SEARCH_ERROR]', error);
    res.status(500).json({ message: 'Search is having a moment. Please try again.' });
  }
};

module.exports = { globalSearch };
