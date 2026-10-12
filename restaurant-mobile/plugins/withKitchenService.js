// Expo config plugin: puts the native kitchen foreground service (screen-locked order alerts) back into
// android/ on every `expo prebuild` (and on EAS builds), so it does not live only on one machine.
//  - copies plugins/kitchen-service/*.kt into the app's Java package folder
//  - registers KitchenServicePackage in MainApplication.kt
//  - adds the <service> entry and the foreground-service / wakelock / notification permissions
// Edit the Kotlin in plugins/kitchen-service/, never in android/ (that folder is generated and git-ignored).
const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod, withMainApplication } = require('expo/config-plugins');

const SRC_DIR = path.join(__dirname, 'kitchen-service');
const KT_FILES = ['KitchenForegroundService.kt', 'KitchenServiceModule.kt', 'KitchenServicePackage.kt'];
const SOURCE_PACKAGE = 'com.anonymous.restaurantmobile';
const PERMISSIONS = [
  'android.permission.WAKE_LOCK',
  'android.permission.VIBRATE',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
];

function withKitchenSources(config) {
  return withDangerousMod(config, ['android', async (cfg) => {
    const pkg = cfg.android?.package || SOURCE_PACKAGE;
    const dest = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', ...pkg.split('.'));
    fs.mkdirSync(dest, { recursive: true });
    for (const file of KT_FILES) {
      let code = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
      if (pkg !== SOURCE_PACKAGE) code = code.replace(`package ${SOURCE_PACKAGE}`, `package ${pkg}`);
      fs.writeFileSync(path.join(dest, file), code);
    }
    return cfg;
  }]);
}

function withKitchenPackage(config) {
  return withMainApplication(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (src.includes('KitchenServicePackage()')) return cfg;
    const anchor = /PackageList\(this\)\.packages\.apply\s*\{/;
    if (!anchor.test(src)) {
      throw new Error('[withKitchenService] MainApplication.kt: could not find "PackageList(this).packages.apply {" to register KitchenServicePackage.');
    }
    cfg.modResults.contents = src.replace(anchor, (m) => `${m}\n          add(KitchenServicePackage())`);
    return cfg;
  });
}

function withKitchenManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    AndroidConfig.Permissions.ensurePermissions(manifest, PERMISSIONS);
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    app.service = (app.service || []).filter((s) => s?.$?.['android:name'] !== '.KitchenForegroundService');
    app.service.push({
      $: {
        'android:name': '.KitchenForegroundService',
        'android:enabled': 'true',
        'android:exported': 'false',
        'android:foregroundServiceType': 'dataSync|mediaPlayback',
      },
    });
    return cfg;
  });
}

module.exports = function withKitchenService(config) {
  return withKitchenManifest(withKitchenPackage(withKitchenSources(config)));
};
