const { getUserModel } = require('../models/User');

// Middleware to update streak on every order
const updateStreak = async (userId) => {
  const User = getUserModel();
  const user = await User.findByPk(userId);
  if (!user) {
    console.warn('updateStreak: User not found for ID:', userId);
    return 0;
  }
  const now = new Date();
  const lastOrderDate = user.lastOrderDate ? new Date(user.lastOrderDate) : null;

  if (lastOrderDate) {
    const diffTime = Math.abs(now - lastOrderDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Ordered exactly the next day
      user.streakCount += 1;
    } else if (diffDays > 1) {
      // Streak broken
      user.streakCount = 1;
    }
  } else {
    // First order
    user.streakCount = 1;
  }

  user.lastOrderDate = now;
  await user.save();
  return user.streakCount;
};

// Calculate perks based on user badges
const calculateBadgePerks = (user) => {
  if (!user) return { deliveryDiscount: 0, orderDiscount: 0, status: 'Guest Citizen' };
  const badges = Array.isArray(user.badges) ? user.badges : JSON.parse(user.badges || '[]');
  let deliveryDiscount = 0;
  let orderDiscount = 0;
  let status = 'Standard Citizen';

  if (badges.some(b => b.includes('Elite'))) {
    deliveryDiscount = 1;
    orderDiscount = 100;
    status = 'Elite Sovereign';
  } else if (badges.some(b => b.includes('Diamond'))) {
    deliveryDiscount = 1;
    orderDiscount = 50;
    status = 'Diamond Dignitary';
  } else if (badges.some(b => b.includes('Platinum'))) {
    deliveryDiscount = 1; 
    orderDiscount = 25;
    status = 'Platinum Pro';
  } else if (badges.some(b => b.includes('Gold'))) {
    deliveryDiscount = 0.5;
    orderDiscount = 15;
    status = 'Gold Grafter';
  } else if (badges.some(b => b.includes('Silver'))) {
    deliveryDiscount = 0.2;
    orderDiscount = 10;
    status = 'Silver Scaler';
  } else if (badges.some(b => b.includes('Bronze'))) {
    orderDiscount = 5;
    status = 'Bronze Beginner';
  }

  // ── Zen Point Threshold (200 Points = Free Delivery) ──
  if (user.zenPoints >= 200 && deliveryDiscount < 1) {
    deliveryDiscount = 1;
    status = 'Zen Champion';
  }

  return { deliveryDiscount, orderDiscount, status };
};

module.exports = { updateStreak, calculateBadgePerks };
