// App-wide constants. ONE backend only (Render).

/** The one Zenvy backend. */
export const API_URL = 'https://hostelbites-backend-jwmt.onrender.com/api';

/** Strip trailing /api for the Socket.io base URL. */
export function socketBaseUrl(apiUrl: string): string {
  return apiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
}

/** Sent with the push token so the server can tell app generations apart. */
export const APP_PUSH_VERSION = 'rider-3.0.0';

/** Storage keys (token/profile keys kept from older builds so riders stay logged in after the update). */
export const KEYS = {
  token: '@zenvy_native_rider_token',
  profile: '@zenvy_native_rider_profile',
  voice: '@zenvy_rider_voice_v1',
  spoken: '@zenvy_rider_spoken_v1',
  dismissed: '@zenvy_rider_dismissed_orders',
  pushRegistered: '@zenvy_rider_push_registered',
  queue: '@zenvy_rider_offline_queue_v2',
  legacyQueue: '@zenvy_native_offline_queue',
  cachePrefix: '@zenvy_rider_cache:',
};

/** Foreground refresh cadence. Pool polling is the fallback for push / socket. */
export const POLL_ORDERS_MS = 12000;
export const POLL_STATS_MS = 60000;

/** Seconds a rider has to accept a new order before it is skipped (it stays in the pool for others). */
export const OFFER_SECONDS = 30;

/** Rejected / timed-out offers stay hidden this long. */
export const DISMISS_TTL_MS = 30 * 60 * 1000;

/** Zenvy support line (call / WhatsApp). */
export const SUPPORT_PHONE = '919391955674';
