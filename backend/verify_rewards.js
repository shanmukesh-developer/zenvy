const { Sequelize } = require('sequelize');
const path = require('path');
const { initUserModel, getUserModel } = require('../backend/models/User');
const { initCouponModel, getCouponModel } = require('../backend/models/Coupon');

async function verify() {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../backend/local_dev.sqlite'),
    logging: false
  });

  initUserModel(sequelize);
  initCouponModel(sequelize);
  
  const User = getUserModel();
  const Coupon = getCouponModel();

  try {
    // 1. Find a test user (or create/identify one)
    const user = await User.findOne({ order: [['createdAt', 'DESC']] });
    if (!user) {
       console.log("No user found in DB. Run the app or seed data first.");
       return;
    }
    console.log(`Testing with User: ${user.name} (ID: ${user.id})`);

    // 2. Mock a "Free Delivery" win (Bias test)
    // We simulate what rewardController.js does
    const mockCode = `ZF-TEST-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const coupon = await Coupon.create({
      code: mockCode,
      type: 'FREEDEL',
      userId: user.id,
      isUsed: false,
      expiryDate: new Date(Date.now() + 1000 * 60 * 60)
    });
    console.log(`✅ Mock Coupon Created: ${coupon.code}`);

    // 3. Verify retrieval
    const activeCoupons = await Coupon.findAll({ where: { userId: user.id, isUsed: false } });
    console.log(`✅ Active Coupons in DB: ${activeCoupons.length}`);
    activeCoupons.forEach(c => console.log(`   - [${c.type}] ${c.code}`));

    // 4. (Cleanup option) - You can leave it for the user to try in checkout
    console.log("\nINSTRUCTIONS FOR MANUAL UI TEST:");
    console.log(`1. Login as ${user.name}`);
    console.log("2. Go to Checkout");
    console.log(`3. You should see coupon ${coupon.code} in the Rewards section.`);
    console.log("4. Selecting it should set Delivery Fee to FREE.");

  } catch (err) {
    console.error("Verification failed:", err);
  } finally {
    await sequelize.close();
  }
}

verify();
