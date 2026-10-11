// The ONE Zenvy backend (Render). For local testing of writes set EXPO_PUBLIC_API_URL=http://<lan-ip>:5000.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://hostelbites-backend-jwmt.onrender.com').replace(/\/+$/, '');

/** Zenvy partner-ops phone (also the backend PG_DESK_WHATSAPP default). Digits only, with country code. */
export const SUPPORT_PHONE = '919391955674';
export const SUPPORT_PHONE_DISPLAY = '+91 93919 55674';

export const STORAGE = {
  token: '@zenvy_restaurant_token',
  restaurant: '@zenvy_restaurant_profile',
  savedId: '@zenvy_restaurant_saved_id',
  soundOn: '@zenvy_restaurant_sound_on',
  // Keys written by the old KDS build; read once for migration, then removed.
  legacyToken: 'restaurant_token',
  legacyRestaurant: 'restaurant_data',
  legacySavedId: 'kds_saved_identifier',
} as const;

/** While the socket is down, refetch orders this often. */
export const FALLBACK_POLL_MS = 20000;
/** Repeat the new-order announcement this often while an order is unacknowledged. */
export const RING_REPEAT_MS = 10000;
/** Native speakOrder posts a notification each call, so throttle it in the background. */
export const NATIVE_RING_MIN_GAP_MS = 20000;

export const PREP_TIMES = [10, 15, 20, 30, 45] as const;

export const REJECT_REASONS = [
  'Item(s) out of stock',
  'Kitchen too busy',
  'Closing soon',
  "Can't make this customisation",
] as const;
