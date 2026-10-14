"use client";

import { useEffect } from 'react';
import { API_ORIGIN } from '@/lib/config';
import { clearSession, getAuthState, getToken, verifySession } from '@/lib/session';
import { cachedGet, invalidateRequestCache, isCacheablePath } from '@/lib/requestCache';

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

const abortError = () => new DOMException('The operation was aborted.', 'AbortError');

/** Resolves/rejects with `p`, or rejects as soon as the caller's own signal aborts. */
const withCallerSignal = <T,>(p: Promise<T>, signal?: AbortSignal | null): Promise<T> => {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
};

/**
 * Attaches the admin Bearer token to requests for the backend origin only
 * (never to third-party URLs) and reacts to auth failures:
 * 401 -> session dropped; 403 -> session re-checked with the server.
 *
 * Backend GETs also go through the read cache (lib/requestCache: in-flight dedupe + a few seconds of
 * fresh cache); any other method invalidates that cache. `cache: 'reload'` skips the fresh cache.
 */
export default function FetchInterceptor() {
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = resolveUrl(input);
      const isBackend = !!url && url.origin === API_ORIGIN;
      /** Authorization header this request actually carried (backend requests only). */
      let sentAuth: string | null = null;

      if (isBackend) {
        const base = input instanceof Request ? input.headers : undefined;
        const headers = new Headers(init?.headers || base || {});
        const token = getToken();
        if (isPlaceholder(headers.get('Authorization'))) {
          if (token) headers.set('Authorization', `Bearer ${token}`);
          else headers.delete('Authorization');
        }
        sentAuth = headers.get('Authorization');
        init = { ...init, headers };
      }

      const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      let response: Response;
      if (isBackend && url && method === 'GET' && !(input instanceof Request) && isCacheablePath(url.pathname)) {
        // Shared request: the caller's AbortSignal must not cancel it for the other callers.
        const shared: RequestInit = { ...init, signal: undefined };
        response = await withCallerSignal(
          cachedGet(url, getToken(), () => originalFetch(input, shared), init?.cache === 'reload'),
          init?.signal,
        );
      } else {
        if (isBackend && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') invalidateRequestCache();
        response = await originalFetch(input, init);
        // Invalidate again once the write has landed (reads issued meanwhile may predate it).
        if (isBackend && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') invalidateRequestCache();
      }

      if (isBackend && url && !AUTH_PATHS.some((p) => url.pathname.startsWith(p))) {
        const current = getToken();
        // Only a 401 for the current token ends the session: a slow request sent with an older token
        // (or none) must not sign out an admin who has signed in again since.
        if (response.status === 401 && current && sentAuth === `Bearer ${current}`) {
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
