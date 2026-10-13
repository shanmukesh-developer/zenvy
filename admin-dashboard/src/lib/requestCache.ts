"use client";
/**
 * Read cache for backend GETs, applied in FetchInterceptor (so `adminRequest`, `api.get` and the
 * pages that still call `fetch()` directly all share it).
 *
 *  - In-flight dedupe: identical GETs issued while one is still running share a single network call
 *    (e.g. the dashboard and the SOS modal both paging /api/admin/riders on open).
 *  - Short fresh cache (FRESH_MS): a repeat GET of the same URL within a few seconds is answered
 *    from memory (tab switches, remounts, two widgets reading /api/admin/health, etc.).
 *  - `peekCachedJson(path)` gives a page the last good body (up to STALE_MS old) so it can paint
 *    immediately on navigation while its normal fetch revalidates (stale-while-revalidate).
 *
 * Invalidation: any non-GET to the backend marks everything stale (so the read after a save goes to
 * the network), every realtime socket event does the same, and signing in/out drops everything. Entries are
 * also keyed by the bearer token, so nothing can be served across logins. Memory only: nothing is
 * written to sessionStorage/localStorage.
 */

const FRESH_MS = 8000;
const STALE_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 120;
/** Bodies bigger than this are not kept (they are still deduped while in flight). */
const MAX_BODY_CHARS = 1_500_000;

/** Paths whose responses must never be cached (auth/session, health checks, uploads). */
const NEVER_CACHE = [
  '/api/users/login',
  '/api/users/logout',
  '/api/users/profile',
  '/api/admin/me',
  '/api/health',
  '/api/upload',
];

interface Snapshot {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: string;
}

interface Entry {
  at: number;
  snap: Snapshot;
  /** false once invalidated: no longer served as fresh, still usable by peekCachedJson. */
  valid: boolean;
}

const cache = new Map<string, Entry>();
const inflight = new Map<string, { gen: number; promise: Promise<Snapshot> }>();
/** Bumped on every invalidation; reads started before it are neither joined nor served as fresh. */
let generation = 0;
/** Generation of the last full clear (sign in/out): reads started before it are never stored. */
let clearGen = 0;

const toResponse = (s: Snapshot) => new Response(s.status === 204 || s.status === 304 ? null : s.body, {
  status: s.status,
  statusText: s.statusText,
  headers: s.headers,
});

const snapshot = async (res: Response): Promise<Snapshot> => ({
  status: res.status,
  statusText: res.statusText,
  headers: Array.from(res.headers.entries()),
  body: await res.text(),
});

/**
 * Marks every cached read as out of date (writes, realtime events). The next GET goes to the
 * network; the old bodies stay available to peekCachedJson for a stale first paint only.
 */
export function invalidateRequestCache() {
  generation++;
  cache.forEach(e => { e.valid = false; });
  // In-flight reads are left to finish (their callers still need an answer) but are not stored as fresh.
}

/** Drops everything (sign in / sign out), so no data outlives the session that loaded it. */
export function clearRequestCache() {
  generation++;
  clearGen = generation;
  cache.clear();
  inflight.clear();
}

export function isCacheablePath(pathname: string) {
  return !NEVER_CACHE.some(p => pathname.startsWith(p));
}

const keyFor = (url: URL, token: string | null) => `${token ? token.slice(-16) : 'anon'} ${url.pathname}${url.search}`;

let tokenForPeek: () => string | null = () => null;
export function setPeekTokenSource(fn: () => string | null) { tokenForPeek = fn; }

/**
 * Runs a backend GET through the dedupe + fresh cache. `network` performs the real request.
 * `bypass` skips the fresh cache (still deduped), used for `cache: 'reload'` requests.
 */
export async function cachedGet(url: URL, token: string | null, network: () => Promise<Response>, bypass = false): Promise<Response> {
  const key = keyFor(url, token);
  if (!bypass) {
    const hit = cache.get(key);
    if (hit && hit.valid && Date.now() - hit.at < FRESH_MS) return toResponse(hit.snap);
  }
  const running = inflight.get(key);
  // A read that started before the last write/live event may carry old data: do not join it.
  let pending = running && running.gen === generation ? running.promise : undefined;
  if (!pending) {
    const startedGen = generation;
    const promise: Promise<Snapshot> = network()
      .then(snapshot)
      .then(snap => {
        const current = cache.get(key);
        const outdated = startedGen !== generation;
        if (
          startedGen >= clearGen &&
          snap.status >= 200 && snap.status < 300 && snap.body.length <= MAX_BODY_CHARS &&
          !(outdated && current?.valid) // never replace a newer fresh body with an older one
        ) {
          cache.delete(key);
          // Started before an invalidation: keep it for stale paints, but never serve it as fresh.
          cache.set(key, { at: Date.now(), snap, valid: !outdated });
          if (cache.size > MAX_ENTRIES) {
            const oldest = cache.keys().next().value;
            if (oldest !== undefined) cache.delete(oldest);
          }
        }
        return snap;
      })
      .finally(() => { if (inflight.get(key)?.promise === promise) inflight.delete(key); });
    inflight.set(key, { gen: startedGen, promise });
    pending = promise;
  }
  return toResponse(await pending);
}

/**
 * Last good JSON body for a backend path (e.g. '/api/admin/stats'), if one was fetched in this tab
 * within `maxAgeMs`. Only for painting a first frame; always revalidate with a normal fetch.
 * Invalidated entries are still returned (that is the point of a stale first paint).
 */
export function peekCachedJson<T = unknown>(path: string, apiUrl: string, maxAgeMs = STALE_MS): T | null {
  try {
    const url = new URL(`${apiUrl}${path}`);
    const hit = cache.get(keyFor(url, tokenForPeek()));
    if (!hit || Date.now() - hit.at > maxAgeMs) return null;
    return JSON.parse(hit.snap.body) as T;
  } catch {
    return null;
  }
}
