const express = require('express');
const router = express.Router();
const VaultItem = require('../models/VaultItem');

// @desc    Get all active vault items
// @route   GET /api/vault
router.get('/', async (req, res) => {
  try {
    const items = await VaultItem.find({ isActive: true, remainingCount: { $gt: 0 } });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
