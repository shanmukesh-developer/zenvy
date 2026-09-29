const express = require('express');
const router = express.Router();
const dailyContentController = require('../controllers/dailyContentController');

router.post('/', dailyContentController.createContent);
router.get('/active', dailyContentController.getActiveContent);
router.get('/truth-dare', dailyContentController.getDailyTruthDare);

module.exports = router;
