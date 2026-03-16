const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');

// @desc    Global search across restaurants and menu items
// @route   GET /api/search
// @access  Public
const globalSearch = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchRegex = new RegExp(q, 'i');

    // Search Restaurants by name
    const restaurants = await Restaurant.find({
      name: searchRegex,
      isActive: true
    }).limit(5);

    // Search Menu Items by name, description, or category
    const menuItems = await MenuItem.find({
      $or: [
        { name: searchRegex },
        { description: searchRegex },
        { category: searchRegex }
      ],
      isAvailable: true
    })
    .populate('restaurantId', 'name imageUrl')
    .limit(10);

    res.json({
      restaurants,
      items: menuItems
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Error performing search' });
  }
};

module.exports = {
  globalSearch
};
