const express = require('express');
const router = express.Router();
const { globalSearch, searchCacheKey } = require('../controllers/searchController');
const { cacheGet } = require('../utils/responseCache');

// Public read (no per-user data): short server cache keyed by the cleaned query, cleared with the rest
// of the 'catalog' group on every store / product write (adminController.clearRestaurantsCache).
router.get('/', cacheGet('catalog', { ttlMs: 30 * 1000, key: searchCacheKey }), globalSearch);

module.exports = router;
