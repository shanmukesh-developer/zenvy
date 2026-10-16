// Wraps app.json.
//  - Firebase Android config (google-services.json): without it the app gets no FCM device token, so a
//    driver with the app closed never hears about a new booking / full-auto request. Dev builds still work
//    without the file (alerts then only arrive while the app is open; the app shows a banner saying so),
//    but a production build refuses to build without it: the EAS production profile fails here, and a
//    local `gradlew assembleRelease / bundleRelease` fails in Gradle (plugins/withReleaseSigning.js).
//    Set ALLOW_BUILD_WITHOUT_FCM=1 to override on purpose (both places).
//  - android.allowBackup=false: the session token must never be copied into Google / adb backups.
//  - Release signing: plugins/withReleaseSigning.js (Play upload key from android/keystore.properties,
//    never the debug keystore).
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const file = path.join(__dirname, 'google-services.json');
  const hasFirebase = fs.existsSync(file);
  const production = process.env.EAS_BUILD_PROFILE === 'production';
  if (!hasFirebase && production && process.env.ALLOW_BUILD_WITHOUT_FCM !== '1') {
    throw new Error(
      `[app.config] google-services.json is missing. Add the Android app "${config.android?.package}" ` +
      'to the Zenvy Firebase project and put its google-services.json next to app.json (see README), or ' +
      'booking / full-auto request pushes will never reach a closed app.',
    );
  }
  config.android = {
    ...(config.android || {}),
    allowBackup: false,
    ...(hasFirebase ? { googleServicesFile: './google-services.json' } : {}),
  };
  return config;
};
