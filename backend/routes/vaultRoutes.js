const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getUserModel } = require('../models/User');
const { getVaultItemModel } = require('../models/VaultItem');
const { getCouponModel } = require('../models/Coupon');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const istDayKey = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
const endOfIstDay = () => {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  ist.setUTCHours(23, 59, 59, 999);
  return new Date(ist.getTime() - 5.5 * 60 * 60 * 1000);
};
class ClaimError extends Error { constructor(status, message) { super(message); this.status = status; } }
const { Op } = require('sequelize');
const { sendServerError } = require('../utils/httpErrors');

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
    sendServerError(res, error, '[VAULTROUTES_ERROR]');
  }
});

// @desc    Claim a vault item
// @route   POST /api/vault/claim/:id
router.post('/claim/:id', protect, async (req, res) => {
  try {
    const VaultItem = getVaultItemModel();
    const User = getUserModel();
    
    const { getSequelize } = require('../config/db');
    const sequelize = getSequelize();

    if (!UUID_RE.test(String(req.params.id || ''))) return res.status(404).json({ message: 'This deal is no longer available.' });

    let securedItem;
    let coupon;

    await sequelize.transaction(async (t) => {
      // Re-fetch vault item with a row lock (FOR UPDATE)
      const item = await VaultItem.findByPk(req.params.id, { transaction: t, lock: true });
      if (!item || !item.isActive) throw new ClaimError(404, 'This deal is no longer available.');
      if (item.remainingCount <= 0) throw new ClaimError(400, 'Sorry, this deal just sold out. Check back tomorrow!');

      const user = await User.findByPk(req.user.id, { transaction: t, lock: true });
      if (!user) throw new ClaimError(401, 'Your session has expired. Please log in again.');

      if (item.streakRequirement > 0 && (user.streakCount || 0) < item.streakRequirement) {
        throw new ClaimError(400, `This deal unlocks at a ${item.streakRequirement}-day order streak. You're on ${user.streakCount || 0} — keep going!`);
      }

      // One claim per deal per person per day, and the claim gives a real coupon.
      const Coupon = getCouponModel();
      const claimKey = `VAULT-${String(item.id).slice(0, 8).toUpperCase()}-${String(user.id).slice(0, 8).toUpperCase()}-${istDayKey()}`;
      const existing = await Coupon.findOne({ where: { code: claimKey }, transaction: t });
      if (existing) throw new ClaimError(400, "You've already claimed this deal today. It's in Profile → My Coupons.");
      const isFreeDelivery = /free\s*delivery/i.test(item.name || '');
      const value = Math.max(0, Number(item.originalPrice || 0) - Number(item.price || 0));
      if (!isFreeDelivery && !(value > 0)) throw new ClaimError(400, 'This deal is not set up correctly yet. Please try another one.');
      coupon = await Coupon.create({
        code: claimKey,
        type: isFreeDelivery ? 'FREEDEL' : 'DISCOUNT',
        value: isFreeDelivery ? 0 : value,
        userId: user.id,
        isUsed: false,
        expiryDate: endOfIstDay()
      }, { transaction: t });

      // Decrement stock
      item.remainingCount -= 1;
      await item.save({ transaction: t });

      securedItem = {
        id: item.id,
        name: item.name,
        remainingCount: item.remainingCount
      };
    });

    if (securedItem) require('../utils/realtime').publish('coupon', 'updated', securedItem.id, { scope: 'vault' });
    res.json({
      message: coupon.type === 'FREEDEL'
        ? `Deal claimed! Use code ${coupon.code} today for free delivery.`
        : `Deal claimed! Use code ${coupon.code} today for ₹${coupon.value} off.`,
      code: coupon.code,
      coupon: { code: coupon.code, type: coupon.type, value: coupon.value, expiryDate: coupon.expiryDate },
      item: securedItem
    });
  } catch (error) {
    if (error instanceof ClaimError) return res.status(error.status).json({ message: error.message });
    console.error('[VAULT_CLAIM_ERROR]', error);
    res.status(500).json({ message: 'Could not claim this deal right now. Please try again.' });
  }
});

module.exports = router;
