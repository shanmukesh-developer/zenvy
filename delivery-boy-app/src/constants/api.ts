export const STORAGE_SERVER_KEY = '@zenvy_native_backend_url'; // legacy, no longer read (one backend only)
export const STORAGE_TOKEN_KEY = '@zenvy_native_rider_token';
export const STORAGE_PROFILE_KEY = '@zenvy_native_rider_profile';
export const STORAGE_ONLINE_KEY = '@zenvy_native_rider_online'; // legacy, duty state now comes from GET /delivery/profile

/** The one Zenvy backend (Render). */
export const DEFAULT_API_URL = 'https://hostelbites-backend-jwmt.onrender.com/api';

/** Sent with the push token so the server can tell app generations apart. */
export const APP_PUSH_VERSION = 'rider-2.0.0';

/** Foreground refresh cadence for pool + active orders. */
export const POLL_INTERVAL_MS = 15000;
export const STATS_POLL_INTERVAL_MS = 60000;

/** Strip trailing /api for Socket.io base URL */
export function socketBaseUrl(apiUrl: string): string {
  return apiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
}
