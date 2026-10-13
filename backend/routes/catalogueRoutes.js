const express = require('express');
const { getTypes, getStores, getItems } = require('../controllers/catalogueController');

const router = express.Router();

// Public, read-only. Prices here are the prices the server charges.
// Short server cache + ETag (key includes the query string), cleared on every store / product write.
const { cacheGet } = require('../utils/responseCache');
const catalogCache = cacheGet('catalog', { ttlMs: 30 * 1000 });
router.get('/types', catalogCache, getTypes);
router.get('/stores', catalogCache, getStores);
router.get('/items', catalogCache, getItems);

module.exports = router;
