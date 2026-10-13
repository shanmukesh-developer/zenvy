"use client";

import { useEffect } from 'react';
import { API_ORIGIN } from '@/lib/config';
import { clearSession, getAuthState, getToken, verifySession } from '@/lib/session';

// Responses from these paths are handled by the auth code itself.
const AUTH_PATHS = ['/api/users/login', '/api/users/logout', '/api/admin/me', '/api/users/profile'];

const resolveUrl = (resource: RequestInfo | URL): URL | null => {
  try {
    const raw =
      typeof resource === 'string' ? resource : resource instanceof URL ? resource.href : resource.url;
    return new URL(raw, window.location.href);
  } catch {
    return null;
  }
};

/** Older pages send "Bearer cookie-managed" / "Bearer " placeholders; treat those as no header. */
const isPlaceholder = (value: string | null) => {
  if (!value) return true;
  const v = value.replace(/^Bearer\s*/i, '').trim();
  return v === '' || v === 'cookie-managed' || v === 'null' || v === 'undefined';
};

/**
 * Attaches the admin Bearer token to requests for the backend origin only
 * (never to third-party URLs) and reacts to auth failures:
 * 401 -> session dropped; 403 -> session re-checked with the server.
 */
export default function FetchInterceptor() {
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = resolveUrl(input);
      const isBackend = !!url && url.origin === API_ORIGIN;

      if (isBackend) {
        const base = input instanceof Request ? input.headers : undefined;
        const headers = new Headers(init?.headers || base || {});
        const token = getToken();
        if (isPlaceholder(headers.get('Authorization'))) {
          if (token) headers.set('Authorization', `Bearer ${token}`);
          else headers.delete('Authorization');
        }
        init = { ...init, headers };
      }

      const response = await originalFetch(input, init);

      if (isBackend && url && !AUTH_PATHS.some((p) => url.pathname.startsWith(p))) {
        if (response.status === 401 && getToken()) {
          // SESSION_REVOKED: the password was changed (tokenVersion bumped), so every old login ends.
          const body = await response.clone().json().catch(() => null) as { code?: string } | null;
          clearSession(body?.code === 'SESSION_REVOKED'
            ? 'You were signed out because the account password changed. Please sign in again.'
            : 'Your session has expired. Please sign in again.');
        } else if (response.status === 403 && getAuthState().status === 'authed') {
          // Might be a per-action rule; only log out if the admin role itself is gone.
          verifySession();
        }
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
