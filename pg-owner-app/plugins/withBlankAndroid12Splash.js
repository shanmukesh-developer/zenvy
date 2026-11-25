/**
 * Blank Android 12+ launch screen (owner, 25 Nov 2026: "while opening the app it shows the ZenWe logo first and then
 * the animation"). From Android 12 every app gets a system splash that shows the app icon unless the theme says
 * otherwise; app.json `splash` only covers older Android. This sets the launch theme's Android 12 splash to the
 * intro's own background colour with a transparent icon, so the app goes straight from that colour into the intro.
 *
 *   ["./plugins/withBlankAndroid12Splash", { "backgroundColor": "#FFFFFF" }]
 */
const { withAndroidStyles, AndroidConfig } = require('@expo/config-plugins');

const THEME = 'Theme.App.SplashScreen';

const setItem = (style, name, value) => {
  style.item = (style.item || []).filter((i) => i.$.name !== name);
  style.item.push({ $: { name }, _: value });
};

module.exports = function withBlankAndroid12Splash(config, { backgroundColor = '#FFFFFF' } = {}) {
  return withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults;
    const list = (styles.resources.style = styles.resources.style || []);
    let theme = list.find((s) => s.$ && s.$.name === THEME);
    if (!theme) {
      theme = { $: { name: THEME, parent: 'AppTheme' }, item: [] };
      list.push(theme);
    }
    // Android 12+ (ignored by older versions, which keep app.json's blank splash image).
    setItem(theme, 'android:windowSplashScreenBackground', backgroundColor);
    setItem(theme, 'android:windowSplashScreenAnimatedIcon', '@android:color/transparent');
    setItem(theme, 'android:windowSplashScreenIconBackgroundColor', backgroundColor);
    setItem(theme, 'android:windowSplashScreenAnimationDuration', '0');
    cfg.modResults = styles;
    return cfg;
  });
};
module.exports.THEME = THEME;
void AndroidConfig;
