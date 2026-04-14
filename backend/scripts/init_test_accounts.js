require('dotenv').config();
const { connectDB, getSequelize } = require('../config/db');

async function run() {
  await connectDB();
  const sequelize = getSequelize();
  
  // Models are initialized into sequelize.models by connectDB -> initializeAllModels
  const User = sequelize.models.User;
  const DeliveryPartner = sequelize.models.DeliveryPartner;

  if (!User || !DeliveryPartner) {
    console.error('❌ Error: Models failed to initialize.');
    process.exit(1);
  }

  const [user, createdUser] = await User.findOrCreate({
    where: { phone: '1234567890' },
    defaults: {
      name: 'E2E Tester',
      password: 'testpassword',
      hostelBlock: 'X',
      roomNumber: '101'
    }
  });
  console.log(`✅ User ${createdUser ? 'created' : 'already exists'}: ${user.name}`);

  const [partner, createdPartner] = await DeliveryPartner.findOrCreate({
    where: { phone: '1234567890' },
    defaults: {
      name: 'E2E Rider',
      password: 'testpassword',
      isApproved: true
    }
  });
  console.log(`✅ Rider ${createdPartner ? 'created' : 'already exists'}: ${partner.name}`);

  process.exit(0);
}

run().catch(err => {
  console.error('❌ Init failed:', err.message);
  process.exit(1);
});
