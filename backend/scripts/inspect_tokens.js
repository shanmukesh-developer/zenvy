const { connectDB, getSequelize } = require('../config/db');
const { getDeliveryPartnerModel } = require('../models/DeliveryPartner');

async function run() {
  try {
    await connectDB();
    const DeliveryPartner = getDeliveryPartnerModel();
    const riders = await DeliveryPartner.findAll();
    console.log(`Found ${riders.length} riders total:`);
    riders.forEach(r => {
      console.log(`Rider: ${r.name} (ID: ${r.id}), Online: ${r.isOnline}, Tokens:`, JSON.stringify(r.fcmTokens, null, 2));
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

run();
