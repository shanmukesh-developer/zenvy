const User = require('../models/User');

// Middleware to update streak on every order
const updateStreak = async (userId) => {
  const user = await User.findById(userId);
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

module.exports = { updateStreak };
