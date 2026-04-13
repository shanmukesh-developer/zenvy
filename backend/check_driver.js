/* eslint-disable */
const { connectDB, getSequelize } = require('./config/db');
const { getDeliveryPartnerModel } = require('./models/DeliveryPartner');

async function checkDriver() {
  await connectDB();
  const DeliveryPartner = getDeliveryPartnerModel();
  const driver = await DeliveryPartner.findOne({ where: { phone: 'driver1' } });
  if (driver) {
    console.log('✅ Driver1 found:', driver.name);
  } else {
    console.log('❌ Driver1 NOT found');
    // Create it for testing if missing
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('123456', 10);
    await DeliveryPartner.create({
      name: 'E2E Rider',
      phone: 'driver1',
      password: hashedPassword,
      vehicleType: 'Scooter',
      isOnline: false
    });
    console.log('✅ Driver1 created for E2E testing.');
  }
  process.exit(0);
}

checkDriver();
