// Zenvy After Dark opening hours (India Standard Time).
// Defaults: opens 22:00, closes 04:00. Override on Render with
// AFTER_DARK_START_HOUR / AFTER_DARK_END_HOUR (0-23), or set AFTER_DARK_ALWAYS_OPEN=true.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const readHour = (name, fallback) => {
  const n = parseInt(process.env[name], 10);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : fallback;
};

const getAfterDarkWindow = () => ({
  startHour: readHour('AFTER_DARK_START_HOUR', 22),
  endHour: readHour('AFTER_DARK_END_HOUR', 4),
});

const pad = (h) => `${String(h).padStart(2, '0')}:00`;

const isAfterDarkNow = (now = new Date()) => {
  if (process.env.AFTER_DARK_ALWAYS_OPEN === 'true') return true;
  const { startHour, endHour } = getAfterDarkWindow();
  const hour = new Date(now.getTime() + IST_OFFSET_MS).getUTCHours();
  if (startHour === endHour) return true; // 24h window
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour; // window crosses midnight
};

const afterDarkStatus = () => {
  const { startHour, endHour } = getAfterDarkWindow();
  return { open: isAfterDarkNow(), opensAt: pad(startHour), closesAt: pad(endHour), timezone: 'Asia/Kolkata' };
};

module.exports = { isAfterDarkNow, afterDarkStatus };
