require('dotenv').config();
const { connectDB } = require('./config/db');
const { sendPushToTokens } = require('./utils/push');

async function run() {
  try {
    await connectDB();
    const token = 'c6-qQzaiQYmXEmywrrENm3:APA91bGorR3gGuJ8xMXsT8PE7lU8YttYWaTIvYzFcTqDMlT5CBw3vH_Af_N8zExRBsuoiwPJ8tGXh-3n47FaYKzS7bi4_bLT3grQeepE9GlYtTjd2qrfbqM';
    console.log('Sending direct push notification to Android device token:', token);
    
    await sendPushToTokens(
      [token], 
      '🛵 Test Order Assigned! (Android App)', 
      'A new order is available at Nexus Omni-Kitchen. Open your app now!', 
      { orderId: 'test-direct-999', type: 'NEW_ORDER' }
    );
    console.log('FCM call completed!');
  } catch (err) {
    console.error('Error sending push:', err);
  } finally {
    process.exit(0);
  }
}

run();
