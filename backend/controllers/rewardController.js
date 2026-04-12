const { getUserModel } = require('../models/User');

// @desc    Check spin eligibility
const checkSpinEntry = async (req, res) => {
  try {
    const User = getUserModel();
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const spinsEarned = Math.floor((user.completedOrders || 0) / 2);
    const spinsAvailable = Math.max(0, spinsEarned - (user.spinsUsed || 0));

    res.json({
      completedOrders: user.completedOrders || 0,
      spinsUsed: user.spinsUsed || 0,
      spinsAvailable,
      nextMilestoneIn: 2 - ((user.completedOrders || 0) % 2)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Use a spin and record prize
const useSpin = async (req, res) => {
  try {
    const { prizeType, prizeValue } = req.body;
    const User = getUserModel();
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const spinsEarned = Math.floor((user.completedOrders || 0) / 2);
    const spinsAvailable = spinsEarned - (user.spinsUsed || 0);

    if (spinsAvailable <= 0) {
      return res.status(403).json({ message: 'No spins available. Complete more orders!' });
    }

    user.spinsUsed = (user.spinsUsed || 0) + 1;

    // Award prize if it's points
    if (prizeType === 'points') {
      user.zenPoints = (user.zenPoints || 0) + Number(prizeValue);
    }

    // Award prize if it's a coupon
    let awardedCoupon = null;
    if (prizeType === 'coupon') {
      const { getCouponModel } = require('../models/Coupon');
      const Coupon = getCouponModel();
      const code = `ZF-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      awardedCoupon = await Coupon.create({
        code,
        type: prizeValue === 'FREEDEL' ? 'FREEDEL' : 'DISCOUNT',
        userId: user.id,
        isUsed: false,
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days expiry
      });
    }

    await user.save();

    res.json({
      message: 'Spin recorded successfully',
      spinsUsed: user.spinsUsed,
      zenPoints: user.zenPoints,
      coupon: awardedCoupon ? { code: awardedCoupon.code, type: awardedCoupon.type } : null
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get top performers for public leaderboard
const getLeaderboard = async (req, res) => {
  try {
    const User = getUserModel();
    const topUsers = await User.findAll({
      where: { role: 'student' },
      attributes: ['id', 'name', 'badges', 'profileImage', 'zenPoints'],
      order: [['completedOrders', 'DESC']],
      limit: 5
    });

    const leaderboard = topUsers.map(u => {
      const badges = Array.isArray(u.badges) ? u.badges : [];
      let tier = 'Silver';
      if (badges.some(b => b && typeof b === 'string' && b.includes('Platinum'))) tier = 'Platinum';
      else if (badges.some(b => b && typeof b === 'string' && b.includes('Gold'))) tier = 'Gold';

      return {
        id: u.id,
        name: u.name,
        badgeCount: badges.length,
        tier,
        profileImage: u.profileImage,
        zenPoints: u.zenPoints || 0
      };
    });

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getUserCoupons = async (req, res) => {
  try {
    const { getCouponModel } = require('../models/Coupon');
    const Coupon = getCouponModel();
    const coupons = await Coupon.findAll({
      where: { userId: req.user.id, isUsed: false },
      order: [['createdAt', 'DESC']]
    });
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { checkSpinEntry, useSpin, getLeaderboard, getUserCoupons };
