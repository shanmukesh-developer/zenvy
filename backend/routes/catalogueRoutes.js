const express = require('express');
const { getTypes, getStores, getItems } = require('../controllers/catalogueController');

const router = express.Router();

// Public, read-only. Prices here are the prices the server charges.
router.get('/types', getTypes);
router.get('/stores', getStores);
router.get('/items', getItems);

module.exports = router;
