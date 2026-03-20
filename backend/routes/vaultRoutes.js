const express = require('express');
const router = express.Router();
const { getVaultItemModel } = require('../models/VaultItem');
const { Op } = require('sequelize');

// @desc    Get all active vault items
// @route   GET /api/vault
router.get('/', async (req, res) => {
  try {
    const VaultItem = getVaultItemModel();
    const items = await VaultItem.findAll({ 
      where: { 
        isActive: true, 
        remainingCount: { [Op.gt]: 0 } 
      } 
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
