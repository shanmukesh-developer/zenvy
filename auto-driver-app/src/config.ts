// App-wide constants. ONE backend: /c/hostel-bite/backend on Render (driver routes /api/auto-ride/driver).
// For local testing set EXPO_PUBLIC_API_URL=http://<lan-ip>:5000 (never test writes on production).
// No React Native imports here: the API client is also run under Node by the verification script.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://hostelbites-backend-jwmt.onrender.com').replace(/\/+$/, '');

/** Driver API prefix (backend/modules/autoRide/routes.js driverRouter). */
export const DRIVER_API = '/api/auto-ride/driver';

/** Zenvy partner support. Digits only, with country code. */
export const SUPPORT_PHONE = '919391955674';
export const SUPPORT_PHONE_DISPLAY = '+91 93919 55674';
export const EMERGENCY_NUMBER = '112';

export const STORAGE = {
  token: '@zenvy_autodriver_token',
  driver: '@zenvy_autodriver_profile',
  savedPhone: '@zenvy_autodriver_saved_phone',
  queue: '@zenvy_autodriver_offline_queue_v1',
  pushRegistered: '@zenvy_autodriver_push_registered',
} as const;

/** Trip Detail: refetch this often (the socket nudges on top of it). */
export const TRIP_POLL_MS = 10000;
/** Home: refetch this often while open. */
export const HOME_POLL_MS = 30000;
/** Socket down this long = offline banner. */
export const OFFLINE_AFTER_MS = 15000;

/** Mirrors backend/modules/autoRide/enums.js LIMITS (the server checks again; these only guide the form). */
export const LIMITS = {
  MAX_FARE: 5000,
  MAX_FULL_FARE: 20000,
  /** Full-auto extra charges: at most this and never above the full-auto fare (server: enums.js MAX_EXTRA_CHARGES). */
  MAX_EXTRA_CHARGES: 2000,
  MAX_DELAY_MINUTES: 120,
  MIN_DELAY_MINUTES: 5,
  MIN_LEAD_MINUTES: 2,
  /** DEFAULT_SETTINGS.maxAdvanceDays (admin can change it; the server has the final word). */
  MAX_ADVANCE_DAYS: 7,
  MAX_VEHICLE_PHOTOS: 4,
  PIN_MAX_ATTEMPTS: 5,
  MAX_VEHICLES: 3,
  ABSOLUTE_MAX_CAPACITY: 12,
} as const;
