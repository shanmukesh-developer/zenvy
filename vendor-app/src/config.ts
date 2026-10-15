// App-wide constants. ONE backend: /c/hostel-bite/backend on Render.
// For local testing of writes set EXPO_PUBLIC_API_URL=http://<lan-ip>:5000 (never test writes on production).
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://hostelbites-backend-jwmt.onrender.com').replace(/\/+$/, '');

/** Zenvy partner support. Digits only, with country code. */
export const SUPPORT_PHONE = '919391955674';
export const SUPPORT_PHONE_DISPLAY = '+91 93919 55674';

export const STORAGE = {
  token: '@zenvy_vendor_token',
  vendor: '@zenvy_vendor_profile',
  savedPhone: '@zenvy_vendor_saved_phone',
  voice: '@zenvy_vendor_voice_v1',
  /** Orders put off with "Later" (per shop, id → time). */
  silenced: '@zenvy_vendor_silenced',
  // voice.ts reads this once to migrate an old switch; the vendor app never had one.
  soundOnV1: '@zenvy_vendor_sound_on',
} as const;

/** While the socket is down, refetch orders this often. */
export const FALLBACK_POLL_MS = 20000;
/** Even with a healthy socket, refetch this often (catches anything a flaky network dropped). */
export const SAFETY_POLL_MS = 90000;
/** New-order ringing: repeat the announcement this often until accepted / rejected. */
export const RING_REPEAT_MS = 20000;
/** Socket down this long = "offline" (red banner + voice warning). */
export const OFFLINE_AFTER_MS = 15000;

/** Reject a NEW order (before accepting). */
export const REJECT_REASONS = [
  'Item finished',
  'Too busy right now',
  'Shop closing',
  "Can't deliver to this place",
] as const;

/** Cancel an order you already accepted. */
export const CANCEL_REASONS = [
  'Customer not answering',
  'Customer asked to cancel',
  "Couldn't find the address",
  'Item finished',
] as const;

/** New orders older than this turn amber / red (server auto-cancels at PENDING_ORDER_TIMEOUT_MINUTES, default 15). */
export const NEW_ORDER_WARN_MIN = 6;
export const NEW_ORDER_LATE_MIN = 10;
