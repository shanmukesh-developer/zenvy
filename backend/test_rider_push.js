require('dotenv').config();
const { connectDB, getSequelize } = require('./config/db');
const { getDeliveryPartnerModel } = require('./models/DeliveryPartner');
const { sendPushToTokens } = require('./utils/push');

async function run() {
  try {
    await connectDB();
    const DeliveryPartner = getDeliveryPartnerModel();
    if (!DeliveryPartner) {
      console.error('DeliveryPartner model not loaded');
      process.exit(1);
    }

    const riders = await DeliveryPartner.findAll();
    let tokens = [];

    riders.forEach(rider => {
      let fcm = rider.fcmTokens;
      if (typeof fcm === 'string') {
        try { fcm = JSON.parse(fcm); } catch (e) { fcm = []; }
      }
      if (Array.isArray(fcm) && fcm.length > 0) {
        tokens = tokens.concat(fcm.map(t => typeof t === 'string' ? t : t.token));
      }
    });

    tokens = [...new Set(tokens)].filter(Boolean);
    console.log('Found rider tokens in local DB:', tokens);

    if (tokens.length > 0) {
      console.log('Sending test high-priority order notification to rider tokens...');
      await sendPushToTokens(
        tokens, 
        '🛵 New Order Ready! (Local Test)', 
        'Nexus Omni-Kitchen is ready for pickup. Closest to you!', 
        { orderId: 'test-1234', distance: '0.4', type: 'NEW_ORDER' }
      );
      console.log('Test notification sent successfully!');
    } else {
      console.log('No registered rider tokens found in the local DB. Please ensure you are logged in using the local host http://localhost:5005/api.');
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

run();
