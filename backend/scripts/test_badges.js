/**
 * test_badges.js
 * Comprehensive verification script for the Multi-tier Badge System.
 */

const { Sequelize } = require('sequelize');
const path = require('path');
const { evaluateBadges } = require('../services/BadgeService');

async function verifyBadgeSystem() {
  const dbPath = path.join(__dirname, '..', 'local_dev.sqlite');
  console.log('--- STARTING BADGE SYSTEM VERIFICATION ---');
  console.log('Database Path:', dbPath);

  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false
  });

  try {
    const [users] = await sequelize.query("SELECT id, name, badges, completedOrders, lateNightOrders, streakCount FROM Users LIMIT 1");
    if (users.length === 0) {
      console.error('❌ Error: No users found to test with.');
      return;
    }

    const testUser = users[0];
    console.log(`Testing with User: ${testUser.name} (ID: ${testUser.id})`);

    // Reset user state for clean test
    await sequelize.query(`UPDATE Users SET badges = '[]', completedOrders = 9, lateNightOrders = 4, streakCount = 4 WHERE id = '${testUser.id}'`);

    const refreshUser = async () => {
        const [results] = await sequelize.query(`SELECT * FROM Users WHERE id = '${testUser.id}'`);
        return results[0];
    };

    let user = await refreshUser();
    user.badges = JSON.parse(user.badges || '[]');

    console.log('\n--- SCENARIO 1: SILVER TIER UPGRADE ---');
    console.log(`Current: Orders=${user.completedOrders}, LateNight=${user.lateNightOrders}, Streak=${user.streakCount}`);
    
    // Simulate one more order delivery
    user.completedOrders += 1;
    user.lateNightOrders += 1;
    user.streakCount += 1;

    const earned = evaluateBadges(user);
    console.log('Badges Earned:', earned);

    if (earned.includes('Silver Scaler') && earned.includes('Silver Shadow') && earned.includes('Silver Streaker')) {
      console.log('✅ PASS: All Silver badges earned correctly at threshold.');
    } else {
      console.error('❌ FAIL: Some Silver badges missing.');
    }

    // Update DB
    const newBadges = JSON.stringify([...user.badges, ...earned]);
    await sequelize.query(`UPDATE Users SET badges = '${newBadges}', completedOrders = ${user.completedOrders}, lateNightOrders = ${user.lateNightOrders}, streakCount = ${user.streakCount} WHERE id = '${testUser.id}'`);

    console.log('\n--- SCENARIO 2: GOLD TIER UPGRADE ---');
    user = await refreshUser();
    user.badges = JSON.parse(user.badges || '[]');
    user.completedOrders = 29;
    user.completedOrders += 1; // Hitting 30

    const goldEarned = evaluateBadges(user);
    console.log('Badges Earned at 30 orders:', goldEarned);

    if (goldEarned.includes('Gold Grafter')) {
      console.log('✅ PASS: Gold badge earned at 30 orders.');
    } else {
      console.error('❌ FAIL: Gold badge missing at threshold.');
    }

    console.log('\n--- SCENARIO 3: ANALYTICS AGGREGATION ---');
    const [stats] = await sequelize.query("SELECT id, name, badges FROM Users WHERE role = 'student'");
    const tiers = { Platinum: 0, Gold: 0, Silver: 0, None: 0 };
    
    stats.forEach(u => {
      const b = JSON.parse(u.badges || '[]');
      let userTier = 'None';
      if (b.some(name => name.includes('Platinum') || name.includes('Pro'))) userTier = 'Platinum';
      else if (b.some(name => name.includes('Gold') || name.includes('Grafter'))) userTier = 'Gold';
      else if (b.some(name => name.includes('Silver') || name.includes('Scaler'))) userTier = 'Silver';
      tiers[userTier]++;
    });

    console.log('Tier Distribution:', tiers);
    if (tiers.Gold > 0) {
      console.log('✅ PASS: Analytics successfully identified Gold tier user.');
    }

    console.log('\n--- VERIFICATION COMPLETE ---');

  } catch (error) {
    console.error('❌ Verification failed with error:', error);
  } finally {
    await sequelize.close();
  }
}

verifyBadgeSystem();
