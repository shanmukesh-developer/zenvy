const express = require('express');
const router = express.Router();
const dailyContentController = require('../controllers/dailyContentController');
const { protect, admin } = require('../middleware/authMiddleware');

// Creating daily content is an admin action; reading it stays public.
router.post('/', protect, admin, dailyContentController.createContent);
router.get('/active', dailyContentController.getActiveContent);
router.get('/truth-dare', dailyContentController.getDailyTruthDare);

module.exports = router;
