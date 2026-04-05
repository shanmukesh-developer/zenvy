const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getUserModel } = require('../models/User');
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

// @desc    Claim a vault item
// @route   POST /api/vault/claim/:id
router.post('/claim/:id', protect, async (req, res) => {
  try {
    const VaultItem = getVaultItemModel();
    const User = getUserModel();
    
    const item = await VaultItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Vault item not found' });
    
    if (item.remainingCount <= 0) {
      return res.status(400).json({ message: 'Sequence terminated: Item out of stock' });
    }
    
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    if (item.streakRequirement > 0 && (user.streakCount || 0) < item.streakRequirement) {
      return res.status(403).json({ message: `Insufficient streak: ${item.streakRequirement} days required` });
    }
    
    // Decrement stock
    item.remainingCount -= 1;
    await item.save();
    
    res.json({ 
      message: 'ACCESS GRANTED: Item secured in your vault.',
      item: {
        id: item.id,
        name: item.name,
        remainingCount: item.remainingCount
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
