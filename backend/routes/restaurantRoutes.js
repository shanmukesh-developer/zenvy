const express = require('express');
const { getRestaurants, getRestaurantMenu, createRestaurant, restaurantLogin, getRestaurantOrders, toggleMenuItemAvailability, updateMenuItemTags } = require('../controllers/restaurantController');
const { protect, admin } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/', getRestaurants);
router.get('/:id/menu', getRestaurantMenu);
router.post('/login', restaurantLogin);
router.get('/:id/orders', protect, getRestaurantOrders); 
router.put('/menu/:itemId/toggle', protect, toggleMenuItemAvailability);
router.put('/menu/:itemId/tags', protect, updateMenuItemTags);
router.post('/', protect, admin, createRestaurant);

module.exports = router;
