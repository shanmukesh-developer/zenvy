// Expo config plugin: release signing for Zenvy Auto Driver, re-applied on every `expo prebuild`
// (android/ is generated and git-ignored, so signing can't live there). Same pattern as
// customer-mobile/android/app/build.gradle:
//  - the Play UPLOAD key is read from android/keystore.properties (git-ignored) or from
//    ~/.gradle/gradle.properties, keys ZENVY_UPLOAD_STORE_FILE / _STORE_PASSWORD / _KEY_ALIAS / _KEY_PASSWORD
//  - the release build type NEVER uses the debug keystore: with no upload key it is left unsigned
//  - a local assembleRelease / bundleRelease stops with a clear error when the upload key or
//    google-services.json is missing (override: ZENVY_ALLOW_UNSIGNED_RELEASE=1 / ALLOW_BUILD_WITHOUT_FCM=1).
//    EAS builds (EAS_BUILD=true) sign with EAS-managed credentials and skip the key check.
// If the generated build.gradle ever changes shape, prebuild fails here instead of silently shipping a
// debug-signed release.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = '// zenvy-release-signing';

const PROPS_BLOCK = `${MARK}: Play upload key from android/keystore.properties (git-ignored) or ~/.gradle/gradle.properties.
def zenvyKeystoreProps = new Properties()
def zenvyKeystoreFile = rootProject.file('keystore.properties')
if (zenvyKeystoreFile.exists()) {
    zenvyKeystoreFile.withInputStream { zenvyKeystoreProps.load(it) }
}
def zenvyStoreFile = zenvyKeystoreProps.getProperty('ZENVY_UPLOAD_STORE_FILE') ?: findProperty('ZENVY_UPLOAD_STORE_FILE')
def zenvyStorePassword = zenvyKeystoreProps.getProperty('ZENVY_UPLOAD_STORE_PASSWORD') ?: findProperty('ZENVY_UPLOAD_STORE_PASSWORD')
def zenvyKeyAlias = zenvyKeystoreProps.getProperty('ZENVY_UPLOAD_KEY_ALIAS') ?: findProperty('ZENVY_UPLOAD_KEY_ALIAS')
def zenvyKeyPassword = zenvyKeystoreProps.getProperty('ZENVY_UPLOAD_KEY_PASSWORD') ?: findProperty('ZENVY_UPLOAD_KEY_PASSWORD')
def zenvyHasUploadKey = zenvyStoreFile != null

gradle.taskGraph.whenReady { graph ->
    def releasing = graph.allTasks.any { t ->
        t.project == project && (t.name.startsWith('assemble') || t.name.startsWith('bundle')) && t.name.contains('Release')
    }
    if (!releasing) return
    def onEas = System.getenv('EAS_BUILD') == 'true'
    if (!onEas && !zenvyHasUploadKey && System.getenv('ZENVY_ALLOW_UNSIGNED_RELEASE') != '1') {
        throw new GradleException('Zenvy Auto Driver: no Play upload key. Create android/keystore.properties (see auto-driver-app/README.md). The release build is never signed with the debug key. Set ZENVY_ALLOW_UNSIGNED_RELEASE=1 for an unsigned test build.')
    }
    if (!file('google-services.json').exists() && System.getenv('ALLOW_BUILD_WITHOUT_FCM') != '1') {
        throw new GradleException('Zenvy Auto Driver: google-services.json is missing. Add com.srm.zenvyautodriver to the Zenvy Firebase project, put google-services.json next to app.json and run expo prebuild again (see README). Without it closed-app pushes never arrive. Set ALLOW_BUILD_WITHOUT_FCM=1 to override.')
    }
}

android {`;

const RELEASE_SIGNING = `
        if (zenvyHasUploadKey) {
            release {
                storeFile file(zenvyStoreFile)
                storePassword zenvyStorePassword
                keyAlias zenvyKeyAlias
                keyPassword zenvyKeyPassword
            }
        }
    }
    buildTypes {`;

function applySigning(src) {
  if (src.includes(MARK)) return src;
  let out = src;
  // 1. Properties + release guard before the android { } block.
  if (!/^android \{/m.test(out)) throw new Error('[withReleaseSigning] "android {" not found in app/build.gradle');
  out = out.replace(/^android \{/m, PROPS_BLOCK);
  // 2. A release signingConfig (only when the upload key exists), right after the debug one.
  const sc = /(signingConfigs \{\s*debug \{[\s\S]*?\}\s*)\}\s*buildTypes \{/;
  if (!sc.test(out)) throw new Error('[withReleaseSigning] signingConfigs { debug { } } block not found in app/build.gradle');
  out = out.replace(sc, (_m, debugBlock) => `${debugBlock.replace(/\s*$/, '')}${RELEASE_SIGNING}`);
  // 3. The release build type: upload key or unsigned, never signingConfigs.debug.
  const rel = /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!rel.test(out)) throw new Error('[withReleaseSigning] release { signingConfig signingConfigs.debug } not found in app/build.gradle');
  out = out.replace(rel, (_m, head) => `${head}// ${MARK.slice(3)}: Play upload key, or unsigned. Never the debug keystore.
            signingConfig zenvyHasUploadKey ? signingConfigs.release : null
            debuggable false`);
  if (/release \{[^}]*signingConfig signingConfigs\.debug/.test(out)) throw new Error('[withReleaseSigning] release still uses the debug keystore');
  return out;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') throw new Error('[withReleaseSigning] expected a Groovy app/build.gradle');
    cfg.modResults.contents = applySigning(cfg.modResults.contents);
    return cfg;
  });
};
module.exports.applySigning = applySigning;
