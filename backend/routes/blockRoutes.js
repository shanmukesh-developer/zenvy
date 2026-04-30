const express = require('express');
const router = express.Router();
const { getBlockActivity } = require('../controllers/blockController');


router.get('/activity', getBlockActivity);

module.exports = router;
