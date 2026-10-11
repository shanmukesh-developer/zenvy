// ── Phase 2+3 Feature Routes ──────────────────────────
// F1: Referral, F5: Reviews, F7: Block Challenges, F8: Pre-order,
// F11: AI Picks, F13: Elite Gifting, F2: Push Campaigns
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');

// ═══════════════════════════════════════════════════════
// F1: REFERRAL SYSTEM
// ═══════════════════════════════════════════════════════

// POST /api/features/referral/apply - Apply a referral code
router.post('/referral/apply', protect, async (req, res) => {
  try {
    const { referralCode } = req.body;
    if (!referralCode) return res.status(400).json({ message: 'Referral code is required' });

    const { getUserModel } = require('../models/User');
    const User = getUserModel();

    const code = String(referralCode).trim().toUpperCase();
    const referrer = await User.findOne({ where: { referralCode: code } });
    if (!referrer) return res.status(404).json({ message: 'Invalid referral code' });

    if (referrer.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot refer yourself' });
    }

    const currentUser = await User.findByPk(req.user.id);
    if (!currentUser) return res.status(404).json({ message: 'User not found' });
    if (currentUser.referredBy) {
      return res.status(400).json({ message: 'You have already used a referral code' });
    }
    if (referrer.referredBy && currentUser.referralCode && referrer.referredBy === currentUser.referralCode) {
      return res.status(400).json({ message: 'You cannot use the code of someone you referred.' });
    }
    // Conditional, atomic claim: a double tap can never pay out twice.
    const { literal } = require('sequelize');
    const [claimed] = await User.update(
      { referredBy: code, referralRewardClaimed: true, zenPoints: literal('COALESCE("zenPoints", 0) + 50') },
      { where: { id: currentUser.id, referredBy: null } }
    );
    if (claimed === 0) return res.status(400).json({ message: 'You have already used a referral code' });
    await User.update(
      { referralCount: literal('COALESCE("referralCount", 0) + 1'), zenPoints: literal('COALESCE("zenPoints", 0) + 50') },
      { where: { id: referrer.id } }
    );
    await currentUser.reload();

    console.log(`[REFERRAL] ${currentUser.name} used code ${referralCode} (referrer: ${referrer.name})`);

    res.json({
      message: 'Referral applied! Both of you earned 50 ZenPoints 🎉',
      yourPoints: currentUser.zenPoints,
      referrerName: referrer.name
    });
  } catch (error) {
    console.error('[REFERRAL_ERROR]', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/features/referral/my-code - Get current user's referral code
router.get('/referral/my-code', protect, async (req, res) => {
  try {
    const { getUserModel } = require('../models/User');
    const User = getUserModel();
    const user = await User.findByPk(req.user.id, {
      attributes: ['referralCode', 'referralCount', 'referredBy']
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      referralCode: user.referralCode,
      referralCount: user.referralCount || 0,
      hasUsedReferral: !!user.referredBy
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ═══════════════════════════════════════════════════════
// F7: BLOCK CHALLENGES
// ═══════════════════════════════════════════════════════

// GET /api/features/challenges/active - Get active weekly challenge
router.get('/challenges/active', async (req, res) => {
  try {
    const { getOrderModel } = require('../models/Order');
    const { getUserModel } = require('../models/User');
    const { Op } = require('sequelize');
    const Order = getOrderModel();
    const User = getUserModel();

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const orders = await Order.findAll({
      where: { status: 'Delivered', createdAt: { [Op.gte]: startOfWeek } }
    });
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const userIds = [...new Set(orders.map(o => o.userId))].filter(id => id && uuidRegex.test(id));
    let users = [];
    if (userIds.length > 0) {
      users = await User.findAll({ where: { id: { [Op.in]: userIds } } });
    }
    const userBlockMap = {};
    users.forEach(u => userBlockMap[u.id] = u.hostelBlock);

    const blockScores = {};
    orders.forEach(order => {
      const block = userBlockMap[order.userId];
      if (block) {
        if (!blockScores[block]) blockScores[block] = { orders: 0, spend: 0, users: new Set() };
        blockScores[block].orders += 1;
        blockScores[block].spend += (order.finalPrice || order.totalPrice || 0);
        blockScores[block].users.add(order.userId);
      }
    });

    const leaderboard = Object.entries(blockScores)
      .map(([block, data]) => ({
        block,
        orders: data.orders,
        spend: Math.round(data.spend),
        participants: data.users.size,
        score: data.orders * 10 + data.users.size * 5 // Weighted score
      }))
      .sort((a, b) => b.score - a.score);

    // Determine challenge type based on week number
    const weekNum = Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
    const challengeTypes = [
      { title: 'Most Orders', metric: 'orders', emoji: '🏆', description: 'Block with the most delivered orders wins!' },
      { title: 'Highest Spend', metric: 'spend', emoji: '💰', description: 'Block that spends the most wins!' },
      { title: 'Most Participants', metric: 'participants', emoji: '👥', description: 'Block with the most unique orderers wins!' }
    ];
    const activeChallenge = challengeTypes[weekNum % 3];

    res.json({
      challenge: activeChallenge,
      leaderboard,
      weekStart: startOfWeek.toISOString(),
      weekEnd: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      totalOrders: orders.length
    });
  } catch (error) {
    console.error('[CHALLENGE_ERROR]', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ═══════════════════════════════════════════════════════
// F11: AI RECOMMENDATION ENGINE (Rule-based "Zenvy Picks")
// ═══════════════════════════════════════════════════════

// GET /api/features/recommendations - Personalized picks
router.get('/recommendations', protect, async (req, res) => {
  try {
    const { getOrderModel } = require('../models/Order');
    const { getUserModel } = require('../models/User');
    const { getMenuItemModel } = require('../models/MenuItem');
    const Order = getOrderModel();
    const User = getUserModel();
    const MenuItem = getMenuItemModel();

    const user = await User.findByPk(req.user.id, {
      attributes: ['dietaryPreference', 'hostelBlock']
    });

    const pastOrders = await Order.findAll({
      where: { userId: req.user.id, status: 'Delivered' },
      order: [['createdAt', 'DESC']],
      limit: 30
    });
    const itemFreq = {};
    const categoryFreq = {};
    const restaurantFreq = {};
    pastOrders.forEach(o => {
      let itemsList = o.items;
      if (typeof itemsList === 'string') {
        try {
          itemsList = JSON.parse(itemsList);
        } catch {
          itemsList = [];
        }
      }
      const items = Array.isArray(itemsList) ? itemsList : [];
      items.forEach(item => {
        const name = item.name || '';
        itemFreq[name] = (itemFreq[name] || 0) + 1;
        if (item.category) categoryFreq[item.category] = (categoryFreq[item.category] || 0) + 1;
      });
      if (o.restaurantId) restaurantFreq[o.restaurantId] = (restaurantFreq[o.restaurantId] || 0) + 1;
    });

    const allItems = await MenuItem.findAll({
      where: { isAvailable: true },
      limit: 200
    });

    const scored = allItems.map(item => {
      let score = 0;
      const itemData = item.toJSON();

      // Boost if user has ordered similar items
      if (itemFreq[itemData.name]) score += itemFreq[itemData.name] * 3;
      if (categoryFreq[itemData.category]) score += categoryFreq[itemData.category] * 2;
      if (restaurantFreq[itemData.restaurantId]) score += restaurantFreq[itemData.restaurantId] * 1;

      // Dietary preference matching
      if (user?.dietaryPreference === 'Veg' && itemData.isVegetarian) score += 5;

      score += Math.random() * 2; 

      return { ...itemData, score };
    });

    const picks = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ score, ...item }) => item);

    res.json({
      picks,
      reason: pastOrders.length > 0 ? 'Based on your order history' : 'Popular on campus right now',
      totalOrdersAnalyzed: pastOrders.length
    });
  } catch (error) {
    console.error('[RECOMMENDATION_ERROR]', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ═══════════════════════════════════════════════════════
// F13: ELITE GIFTING
// ═══════════════════════════════════════════════════════

// POST /api/features/gift - Send a gift (meal voucher) to another user
const giftError = (msg) => Object.assign(new Error(msg), { expose: true });
router.post('/gift', protect, async (req, res) => {
  try {
    const { message } = req.body || {};
    const { normalizePhone } = require('../utils/phoneUtils');
    const recipientPhone = normalizePhone(String(req.body?.recipientPhone || ''));
    const amount = Number(req.body?.amount);
    if (!/^\d{10}$/.test(recipientPhone) || !amount) {
      return res.status(400).json({ message: "Enter your friend's 10-digit phone number and a gift amount." });
    }
    if (!Number.isInteger(amount) || amount < 10 || amount > 500) {
      return res.status(400).json({ message: 'Gift amount must be between ₹10 and ₹500' });
    }

    const { getUserModel } = require('../models/User');
    const User = getUserModel();
    const { getSequelize } = require('../config/db');
    const sequelize = getSequelize();

    let updatedSender;
    let recipientName;

    await sequelize.transaction(async (t) => {
      const sender = await User.findByPk(req.user.id, { transaction: t, lock: true });
      if (!sender) throw giftError('Sender not found');
      if (!sender.isElite) throw giftError('Only Elite members can send gifts');

      const now = new Date();
      if (sender.lastGiftResetDate) {
        const lastReset = new Date(sender.lastGiftResetDate);
        if (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
          sender.eliteGiftsUsedThisMonth = 0;
          sender.lastGiftResetDate = now;
        }
      } else {
        sender.lastGiftResetDate = now;
      }

      if ((sender.eliteGiftsUsedThisMonth || 0) >= 3) {
        throw giftError('Monthly gift limit reached (3/month)');
      }

      if ((sender.walletBalance || 0) < amount) {
        throw giftError('Insufficient wallet balance');
      }

      const recipient = await User.findOne({ where: { phone: recipientPhone }, transaction: t, lock: true });
      if (!recipient) throw giftError('No Zenvy account uses that phone number.');
      if (recipient.id === sender.id) throw giftError('Cannot gift yourself');

      sender.walletBalance = (sender.walletBalance || 0) - amount;
      sender.eliteGiftsUsedThisMonth = (sender.eliteGiftsUsedThisMonth || 0) + 1;
      await sender.save({ transaction: t });

      recipient.walletBalance = (recipient.walletBalance || 0) + amount;
      await recipient.save({ transaction: t });

      updatedSender = sender;
      recipientName = recipient.name;

      // Notify only the recipient (personal socket room joined on connect)
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${recipient.id}`).emit('gift_received', {
          recipientId: recipient.id,
          senderName: sender.name,
          amount,
          message: message || `${sender.name} sent you a meal gift! 🎁`
        });
      }
    });

    console.log(`[GIFT] ${updatedSender.name} → ${recipientName}: ₹${amount}`);
    res.json({
      message: `₹${amount} gift sent to ${recipientName}! 🎁`,
      remainingGifts: 3 - updatedSender.eliteGiftsUsedThisMonth,
      newBalance: updatedSender.walletBalance
    });
  } catch (error) {
    console.error('[GIFT_ERROR]', error);
    if (error.expose) return res.status(400).json({ message: error.message });
    res.status(500).json({ message: 'Could not send the gift right now. Your wallet was not charged.' });
  }
});

// ═══════════════════════════════════════════════════════
// F2: PUSH NOTIFICATION CAMPAIGNS
// ═══════════════════════════════════════════════════════

// POST /api/features/push/campaign - Send a push campaign (Admin only)
router.post('/push/campaign', protect, admin, async (req, res) => {
  try {
    const { title, body, targetType, targetData } = req.body;
    // targetType: 'all', 'elite', 'block', 'abandoned_cart', 'inactive'
    if (!title || !body) return res.status(400).json({ message: 'Title and body are required' });

    const { getUserModel } = require('../models/User');
    const { sendPushToTokens } = require('../utils/push');
    const User = getUserModel();
    const { Op } = require('sequelize');

    let users = [];
    switch (targetType) {
      case 'elite':
        users = await User.findAll({ where: { isElite: true } });
        break;
      case 'block':
        if (targetData?.block) {
          users = await User.findAll({ where: { hostelBlock: targetData.block } });
        }
        break;
      case 'inactive': {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        users = await User.findAll({
          where: { updatedAt: { [Op.lt]: thirtyDaysAgo } }
        });
        break;
      }
      default:
        users = await User.findAll({ where: {} });
    }

    let sentCount = 0;
    for (const user of users) {
      const tokens = user.fcmTokens;
      if (tokens && Array.isArray(tokens) && tokens.length > 0) {
        await sendPushToTokens(tokens, title, body, { type: 'campaign' }, { recipients: [user.id] });
        sentCount++;
      }
    }

    console.log(`[PUSH_CAMPAIGN] "${title}" sent to ${sentCount}/${users.length} users (target: ${targetType})`);
    res.json({
      message: `Campaign sent to ${sentCount} devices`,
      totalUsers: users.length,
      devicesReached: sentCount
    });
  } catch (error) {
    console.error('[PUSH_CAMPAIGN_ERROR]', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Abandoned-cart nudge: customers who ordered 3-10 days ago and not since.
// Called in-process by the daily cron (server.js) and by admins through the route below.
const runAbandonedCartNudge = async () => {
  const { getUserModel } = require('../models/User');
  const { getOrderModel } = require('../models/Order');
  const { sendPushToTokens } = require('../utils/push');
  const { Op } = require('sequelize');
  const User = getUserModel();
  const Order = getOrderModel();

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  const olderOrders = await Order.findAll({
    where: { createdAt: { [Op.between]: [tenDaysAgo, threeDaysAgo] } },
    attributes: ['userId'],
    group: ['userId']
  });
  const recentOrders = await Order.findAll({
    where: { createdAt: { [Op.gt]: threeDaysAgo } },
    attributes: ['userId'],
    group: ['userId']
  });
  const orderedRecently = new Set(recentOrders.map(o => o.userId));
  const targetUserIds = olderOrders.map(o => o.userId).filter(id => id && !orderedRecently.has(id));
  if (targetUserIds.length === 0) return { count: 0 };

  const users = await User.findAll({ where: { id: { [Op.in]: targetUserIds } } });

  let sentCount = 0;
  for (const user of users) {
    const tokens = user.fcmTokens;
    if (tokens && Array.isArray(tokens) && tokens.length > 0) {
      await sendPushToTokens(
        tokens,
        '🍽️ Missing your Zenvy meals?',
        `Hey ${(user.name || 'there').split(' ')[0]}! Your favourite campus spots are open. Order now and earn ZenPoints!`,
        { type: 'abandoned_cart' },
        { recipients: [user.id] }
      );
      sentCount++;
    }
  }
  console.log(`[ABANDONED_CART] Nudged ${sentCount} users`);
  return { count: sentCount };
};

// POST /api/features/push/abandoned-cart - Trigger abandoned cart nudge (Admin only)
router.post('/push/abandoned-cart', protect, admin, async (req, res) => {
  try {
    const { count } = await runAbandonedCartNudge();
    res.json({ message: count ? `Nudged ${count} users` : 'No abandoned cart users found', count });
  } catch (error) {
    console.error('[ABANDONED_CART_ERROR]', error);
    res.status(500).json({ message: 'Could not send the nudge right now.' });
  }
});

// POST /api/features/streak/nudge-trigger - Trigger daily fire streak reminders manually (admin only)
router.post('/streak/nudge-trigger', protect, admin, async (req, res) => {
  try {
    const { runStreakNudgeLogic } = require('../cron/streakNudge');
    await runStreakNudgeLogic();
    res.json({ message: 'Streak nudge checks executed successfully.' });
  } catch (error) {
    console.error('[STREAK_NUDGE_TRIGGER_ERROR]', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
module.exports.runAbandonedCartNudge = runAbandonedCartNudge;
