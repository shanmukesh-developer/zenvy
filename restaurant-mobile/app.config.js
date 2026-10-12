// Wraps app.json. Adds the Firebase Android config only when google-services.json is present, so the
// app still builds before the owner registers this package in Firebase (push token = FCM token).
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const file = path.join(__dirname, 'google-services.json');
  if (fs.existsSync(file)) {
    config.android = { ...(config.android || {}), googleServicesFile: './google-services.json' };
  }
  return config;
};
