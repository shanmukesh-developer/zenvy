const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');

// Mode check
const isMock = () => process.env.MOCK_DATABASE === 'true';

// @desc    Global search across restaurants and menu items
// @route   GET /api/search
const globalSearch = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ message: 'Search query is required' });

  if (isMock()) {
    return res.json({
      restaurants: [
        { id: '1', name: 'Elite Bistro', rating: '4.8', imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b', isActive: true }
      ],
      items: [
        { id: 'm1', name: 'Signature Pasta', price: 250, rating: '4.9', isAvailable: true, restaurantId: { name: 'Elite Bistro' } }
      ]
    });
  }

  try {
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
    console.error('[SEARCH_ERROR]', error);
    res.status(500).json({ message: 'Error performing search' });
  }
};

module.exports = { globalSearch };
