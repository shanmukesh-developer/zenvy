// Real open/closed state for a store, from the vendor's own switches and operating hours (IST).

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const toMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return (h * 60 + min) % (24 * 60);
};

const formatTime = (hhmm) => {
  const mins = toMinutes(hhmm);
  if (mins === null) return hhmm;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

const istMinutesNow = (now = new Date()) => {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
};

const readHours = (restaurant) => {
  let hours = restaurant && (typeof restaurant.get === 'function' ? restaurant.get('operatingHours') : restaurant.operatingHours);
  if (typeof hours === 'string') {
    try { hours = JSON.parse(hours); } catch { hours = null; }
  }
  return hours && typeof hours === 'object' ? hours : null;
};

// → { isOpen, reason?, opensAt?, closesAt?, message? }
const getStoreOpenState = (restaurant, now = new Date()) => {
  if (!restaurant) return { isOpen: false, reason: 'not_found', message: 'This store is no longer on Zenvy.' };
  const name = restaurant.name || 'This store';
  if (restaurant.isActive === false) {
    return { isOpen: false, reason: 'inactive', message: `${name} is not taking orders right now.` };
  }
  const hours = readHours(restaurant);
  const start = hours ? toMinutes(hours.start) : null;
  const end = hours ? toMinutes(hours.end) : null;
  if (restaurant.isOpenNow === false) {
    return {
      isOpen: false,
      reason: 'closed_by_store',
      ...(hours && hours.start ? { opensAt: hours.start } : {}),
      message: `${name} is closed right now. Please check back a little later.`
    };
  }
  if (start === null || end === null || start === end) return { isOpen: true }; // no hours / open 24h

  const nowMin = istMinutesNow(now);
  const open = start < end ? (nowMin >= start && nowMin < end) : (nowMin >= start || nowMin < end); // overnight
  if (open) return { isOpen: true, closesAt: hours.end };
  return {
    isOpen: false,
    reason: 'outside_hours',
    opensAt: hours.start,
    message: `${name} is closed right now — it opens at ${formatTime(hours.start)}.`
  };
};

// Campus-wide ordering window (production only): no orders 9 PM – 6 AM IST.
const NIGHT_START_HOUR = 21;
const NIGHT_END_HOUR = 6;
const getCampusServiceability = (now = new Date()) => {
  const isProduction = require('./env').isProduction();
  const hour = Math.floor(istMinutesNow(now) / 60);
  const closed = isProduction && (hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR);
  if (!closed) return { open: true };
  return {
    open: false,
    reopensAt: `${String(NIGHT_END_HOUR).padStart(2, '0')}:00`,
    message: 'Campus ordering is closed for the night 🌙 We will be back at 6 AM.'
  };
};

module.exports = { getStoreOpenState, getCampusServiceability, formatTime };
