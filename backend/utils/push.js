const admin = require('../config/firebase');

const sendPushToTokens = async (tokens, title, body, data = {}) => {
  if (!admin.apps.length) return console.log('Firebase not initialized');
  if (!tokens || tokens.length === 0) return;

  const validTokens = tokens.map(t => t.token);

  const message = {
    notification: {
      title,
      body
    },
    data,
    tokens: validTokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`Successfully sent message:`, response);
    // You could also clean up old/invalid tokens here
  } catch (error) {
    console.error('Error sending message:', error);
  }
};

module.exports = { sendPushToTokens };
