/**
 * BadgeService.js
 * Centralized logic for evaluating and awarding gamification badges.
 */

const BADGE_CRITERIA = {
  ORDERS: [
    { name: 'Bronze Beginner', threshold: 5, tier: 'Bronze' },
    { name: 'Silver Scaler', threshold: 15, tier: 'Silver' },
    { name: 'Gold Grafter', threshold: 50, tier: 'Gold' },
    { name: 'Platinum Pro', threshold: 100, tier: 'Platinum' },
    { name: 'Diamond Devotee', threshold: 250, tier: 'Diamond' },
    { name: 'Elite Eater', threshold: 500, tier: 'Elite' }
  ],
  LATE_NIGHT: [
    { name: 'Bronze Bat', threshold: 3, tier: 'Bronze' },
    { name: 'Silver Shadow', threshold: 10, tier: 'Silver' },
    { name: 'Gold Ghost', threshold: 25, tier: 'Gold' },
    { name: 'Platinum Phantom', threshold: 75, tier: 'Platinum' },
    { name: 'Diamond Drifter', threshold: 150, tier: 'Diamond' }
  ],
  STREAK: [
    { name: 'Bronze Believer', threshold: 3, tier: 'Bronze' },
    { name: 'Silver Streaker', threshold: 7, tier: 'Silver' },
    { name: 'Gold Guardian', threshold: 21, tier: 'Gold' },
    { name: 'Platinum Persistence', threshold: 50, tier: 'Platinum' },
    { name: 'Diamond Dynamo', threshold: 100, tier: 'Diamond' }
  ]
};

/**
 * Evaluates which new badges a user has earned.
 * @param {Object} user - The Sequelize user instance.
 * @returns {Array} - Array of new badge names unlocked.
 */
const evaluateBadges = (user) => {
  if (!user) return [];
  const currentBadges = Array.isArray(user.badges) ? user.badges : [];
  const newBadges = [];

  // 1. Order Count Badges
  BADGE_CRITERIA.ORDERS.forEach(b => {
    if (user.completedOrders >= b.threshold && !currentBadges.includes(b.name)) {
      newBadges.push(b.name);
    }
  });

  // 2. Late Night Badges
  BADGE_CRITERIA.LATE_NIGHT.forEach(b => {
    if (user.lateNightOrders >= b.threshold && !currentBadges.includes(b.name)) {
      newBadges.push(b.name);
    }
  });

  // 3. Streak Badges
  BADGE_CRITERIA.STREAK.forEach(b => {
    if (user.streakCount >= b.threshold && !currentBadges.includes(b.name)) {
      newBadges.push(b.name);
    }
  });

  return newBadges;
};

// IST hour (Render runs in UTC).
const istHour = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCHours();

/**
 * Credits the customer for a delivered order: ZenPoints (10 per ₹100), completedOrders (+1)
 * and late-night count, as atomic SQL increments so a concurrent spin / rating / redeem is
 * never overwritten by a stale read-modify-save. Then awards any newly unlocked badges.
 * Call only from the request that actually flipped the order to Delivered.
 * @returns {{ customer: object|null, newBadges: string[], points: number }}
 */
const creditCustomerForDelivery = async (User, order) => {
  const points = Math.max(0, Math.floor(Number(order.finalPrice || order.totalPrice || 0) / 100) * 10);
  const hour = istHour();
  const lateNight = hour >= 22 || hour < 4;
  // Daily streak is earned on delivery, not on placing the order: place-then-cancel orders used
  // to build streaks that unlock streak-gated Vault deals.
  try {
    await require('../middleware/rewardEngine').updateStreak(order.userId);
  } catch (streakErr) {
    console.warn('[STREAK_UPDATE_WARN]', streakErr.message);
  }
  const { literal } = require('sequelize');
  const bump = (col, by) => literal(`COALESCE("${col}", 0) + ${Number(by)}`);
  await User.update(
    {
      // An owner-only test order (utils/testView) is not counted for the public leaderboard (top students by orders).
      ...(order.isTestData ? {} : { completedOrders: bump('completedOrders', 1), lastCompletedRef: `order:${order.id}`, lastCompletedAt: new Date() }),
      ...(points > 0 ? { zenPoints: bump('zenPoints', points) } : {}),
      ...(lateNight ? { lateNightOrders: bump('lateNightOrders', 1) } : {})
    },
    { where: { id: order.userId } }
  );
  const customer = await User.findByPk(order.userId);
  if (!customer) return { customer: null, newBadges: [], points };
  const newBadges = evaluateBadges(customer);
  if (newBadges.length > 0) {
    customer.badges = [...(Array.isArray(customer.badges) ? customer.badges : []), ...newBadges];
    await customer.save({ fields: ['badges'] });
  }
  return { customer, newBadges, points };
};

/**
 * Counts a finished non-Order purchase towards Lucky Spins and order badges (owner, 25 Nov 2026: "5 orders should be
 * applicable for all kind of section orders"): Mega Basket delivered, In-Campus Booking collected, service booking
 * completed. completedOrders +1 as an atomic SQL increment, plus the last-finished reference for the app's pop-up.
 * No ZenPoints or streak here (those stay food / grocery order rewards). Call only from the request whose conditional
 * update actually moved the row to its final status, so a retry or double tap never counts twice. Never throws.
 * @param {'basket'|'campus'|'service'} kind
 * @returns {Promise<{ customer: object|null, newBadges: string[] }>}
 */
const creditCustomerForCompletion = async (kind, { id, userId }) => {
  try {
    if (!userId || !id) return { customer: null, newBadges: [] };
    const User = require('../models/User').getUserModel();
    const { literal } = require('sequelize');
    await User.update(
      { completedOrders: literal('COALESCE("completedOrders", 0) + 1'), lastCompletedRef: `${kind}:${id}`.slice(0, 80), lastCompletedAt: new Date() },
      { where: { id: userId } }
    );
    const customer = await User.findByPk(userId);
    if (!customer) return { customer: null, newBadges: [] };
    const newBadges = evaluateBadges(customer);
    if (newBadges.length > 0) {
      customer.badges = [...(Array.isArray(customer.badges) ? customer.badges : []), ...newBadges];
      await customer.save({ fields: ['badges'] });
    }
    return { customer, newBadges };
  } catch (err) {
    console.error('[COMPLETION_CREDIT_ERROR]', kind, id, err && err.message);
    return { customer: null, newBadges: [] };
  }
};

/**
 * "A Lucky Spin is waiting" push, only when this customer's latest finished order completed a group of
 * ORDERS_PER_SPIN (utils/spinRules). Never throws.
 */
const pushSpinEarnedIfDue = async (customer) => {
  try {
    if (!customer) return false;
    const { earnedSpinAt } = require('../utils/spinRules');
    if (!earnedSpinAt(customer.completedOrders)) return false;
    const { sendPushToTokens } = require('../utils/push');
    await sendPushToTokens(
      customer.fcmTokens,
      'You earned a free spin! 🎡',
      `That was your ${customer.completedOrders}th order. A Lucky Spin is waiting in Profile > Spin & deals.`,
      { type: 'SPIN_EARNED' },
      { recipients: [customer.id] }
    );
    return true;
  } catch (err) {
    console.warn('[SPIN_PUSH_WARN]', err && err.message);
    return false;
  }
};

module.exports = { evaluateBadges, creditCustomerForDelivery, creditCustomerForCompletion, pushSpinEarnedIfDue, BADGE_CRITERIA };
