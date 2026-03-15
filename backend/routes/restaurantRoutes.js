const express = require('express');
const { getRestaurants, getRestaurantMenu, createRestaurant } = require('../controllers/restaurantController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/', getRestaurants);
router.get('/:id/menu', getRestaurantMenu);
router.post('/', protect, createRestaurant); // Protect for admin role later

module.exports = router;
