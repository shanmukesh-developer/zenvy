// App-wide constants. ONE backend: /c/hostel-bite/backend on Render.
// For local testing of writes set EXPO_PUBLIC_API_URL=http://<lan-ip>:5000 (never test writes on production).
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://hostelbites-backend-jwmt.onrender.com').replace(/\/+$/, '');

/** Zenvy partner support. Digits only, with country code. */
export const SUPPORT_PHONE = '919391955674';
export const SUPPORT_PHONE_DISPLAY = '+91 93919 55674';

export const STORAGE = {
  token: '@zenvy_restaurant_token',
  restaurant: '@zenvy_restaurant_profile',
  savedId: '@zenvy_restaurant_saved_id',
  voice: '@zenvy_restaurant_voice_v2',
  /** Orders put off with "Later" (per store, id → time). */
  silenced: '@zenvy_restaurant_silenced',
  // Older builds: read once for migration, then removed.
  soundOnV1: '@zenvy_restaurant_sound_on',
  legacyToken: 'restaurant_token',
  legacyRestaurant: 'restaurant_data',
  legacySavedId: 'kds_saved_identifier',
} as const;

/** While the socket is down, refetch orders this often. */
export const FALLBACK_POLL_MS = 20000;
/** Even with a healthy socket, refetch this often (catches anything a flaky network dropped). */
export const SAFETY_POLL_MS = 90000;
/** Soundbox ringing: repeat the new-order announcement this often until accepted / rejected. */
export const RING_REPEAT_MS = 20000;
/** Socket down this long = "offline" (red banner + voice warning). */
export const OFFLINE_AFTER_MS = 15000;

/** Prep-time chips (minutes). */
export const PREP_TIMES = [10, 15, 20, 30] as const;

export const REJECT_REASONS = [
  'Items out of stock',
  'Kitchen too busy',
  'Closing soon',
  "Can't make this customisation",
] as const;

/** New orders older than this turn amber / red (server auto-cancels at PENDING_ORDER_TIMEOUT_MINUTES, default 15). */
export const NEW_ORDER_WARN_MIN = 8;
export const NEW_ORDER_LATE_MIN = 12;
