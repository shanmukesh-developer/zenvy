const cron = require('node-cron');
const { Op } = require('sequelize');
const { getUserModel } = require('../models/User');
const { sendPushToTokens } = require('../utils/push');

const initStreakNudge = () => {
  // Daily at 18:00 IST (Render runs in UTC), while campus ordering is still open (closes 21:00 IST),
  // so the student can still act on it before the streak resets at midnight.
  cron.schedule('0 18 * * *', async () => {
    console.log('[STREAK CRON] Running daily fire streak expiry checks...');
    try {
      await runStreakNudgeLogic();
    } catch (error) {
      console.error('[STREAK CRON] Error during streak nudge cycle:', error);
    }
  }, { timezone: 'Asia/Kolkata' });
  console.log('⏰ [CRON] Daily streak nudge job scheduled at 6:00 PM IST');
};

const runStreakNudgeLogic = async () => {
  const User = getUserModel();
  if (!User) return;

  const now = new Date();
  
  // Helper to get local date string (YYYY-MM-DD) in IST
  const getLocalDateString = (date) => {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
  };

  const todayStr = getLocalDateString(now);
  
  // Calculate yesterday's date string in IST
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalDateString(yesterday);

  console.log(`[STREAK CHECK] Checking streak status. Today IST: ${todayStr}, Yesterday IST: ${yesterdayStr}`);

  // Fetch all active students with a streak count
  const users = await User.findAll({
    where: {
      role: 'student',
      isActive: true,
      streakCount: {
        [Op.gt]: 0
      },
      lastOrderDate: {
        [Op.ne]: null
      }
    },
    attributes: ['id', 'streakCount', 'lastOrderDate', 'fcmTokens']
  });

  console.log(`[STREAK CHECK] Scanning ${users.length} users with active streaks...`);

  let nudgedCount = 0;
  for (const user of users) {
    const userLastOrderStr = getLocalDateString(new Date(user.lastOrderDate));
    
    // If their last order was yesterday, and they have not placed an order today yet,
    // their streak is expiring at midnight today (in a few hours)!
    if (userLastOrderStr === yesterdayStr) {
      // The User model getter already returns an array (JSON.parse here threw and aborted the loop).
      const tokens = Array.isArray(user.fcmTokens) ? user.fcmTokens : [];
      if (tokens.length > 0) {
        try {
          await sendPushToTokens(
            tokens,
            'Maintain your streak! 🔥',
            `Your daily fire streak of ${user.streakCount} days is expiring in a few hours. Place an order now to keep it alive!`,
            {
              type: 'streak_nudge',
              streakCount: String(user.streakCount)
            },
            { recipients: [user.id] }
          );
          nudgedCount++;
        } catch (pushErr) {
          console.warn(`[STREAK NUDGE] Push failed for user ${user.id}:`, pushErr.message);
        }
      }
    }
  }
  
  console.log(`[STREAK CHECK] Finished. Nudged ${nudgedCount} users.`);
};

module.exports = { initStreakNudge, runStreakNudgeLogic };
