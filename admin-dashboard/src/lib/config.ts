/**
 * Single source of truth for backend URLs used by the admin dashboard.
 *
 * Set NEXT_PUBLIC_API_URL (and optionally NEXT_PUBLIC_SOCKET_URL) at build time.
 * The default is the one production backend on Render, so a build without env
 * vars still talks to the right server. Do not hardcode backend URLs elsewhere.
 */
export const DEFAULT_API_URL = 'https://hostelbites-backend-jwmt.onrender.com';

const stripSlash = (url: string) => url.replace(/\/+$/, '');

export const API_URL: string = stripSlash(process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL);

export const SOCKET_URL: string = stripSlash(process.env.NEXT_PUBLIC_SOCKET_URL || API_URL);

/** Origin of the backend (scheme + host + port). The auth token is only ever sent here. */
export const API_ORIGIN: string = (() => {
  try {
    return new URL(API_URL).origin;
  } catch {
    return API_URL;
  }
})();
