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

module.exports = { evaluateBadges, BADGE_CRITERIA };
