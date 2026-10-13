/**
 * Per-user, per-action sliding-window rate limits. In-memory (Render free = one process).
 * The store is a tiny interface (take / reset) so a Redis-backed store can replace it when REDIS_URL
 * is set and the service is scaled out; nothing else needs to change.
 */
const { fail } = require('./http');

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Every Friends action that has a limit. Later phases add their own with define().
const LIMITS = {
  follow: { max: 30, windowMs: MIN },
  mute: { max: 60, windowMs: MIN },
  report: { max: 20, windowMs: HOUR },
  appeal: { max: 10, windowMs: DAY },
  settings: { max: 30, windowMs: MIN },
  guidelines: { max: 20, windowMs: HOUR },
  reveal_author: { max: 10, windowMs: DAY },
};

const memoryStore = () => {
  const hits = new Map(); // key -> number[] (ms, ascending)
  let ops = 0;
  const sweep = (now) => {
    for (const [k, list] of hits) {
      if (!list.length || now - list[list.length - 1] > DAY) hits.delete(k);
    }
  };
  return {
    take(key, max, windowMs, now = Date.now()) {
      const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
      if (list.length >= max) {
        hits.set(key, list);
        return { ok: false, retryAfterMs: Math.max(1000, windowMs - (now - list[0])) };
      }
      list.push(now);
      hits.set(key, list);
      if (++ops % 5000 === 0 || hits.size > 50000) sweep(now);
      return { ok: true, remaining: max - list.length };
    },
    reset(prefix) {
      if (!prefix) { hits.clear(); return; }
      for (const k of [...hits.keys()]) if (k.startsWith(prefix)) hits.delete(k);
    },
  };
};

let store = memoryStore();

const define = (action, max, windowMs) => { LIMITS[action] = { max, windowMs }; };

/** Takes one unit; returns { ok, retryAfterSec }. Unknown actions are not limited. */
const take = (userId, action) => {
  const rule = LIMITS[action];
  if (!rule) return { ok: true };
  const r = store.take(`${userId}:${action}`, rule.max, rule.windowMs);
  return r.ok ? { ok: true, remaining: r.remaining } : { ok: false, retryAfterSec: Math.ceil(r.retryAfterMs / 1000) };
};

/** Throws a 429 FriendsError when the user is over the limit for this action. */
const enforce = (userId, action) => {
  const r = take(userId, action);
  if (!r.ok) {
    throw fail(429, 'RATE_LIMITED', 'You are doing that too often. Please try again later.', { retryAfter: r.retryAfterSec, action });
  }
  return r;
};

/** Express middleware form keyed on req.user.id. */
const limit = (action) => (req, res, next) => {
  const r = take(req.user && req.user.id, action);
  if (r.ok) return next();
  res.set('Retry-After', String(r.retryAfterSec));
  return res.status(429).json({ message: 'You are doing that too often. Please try again later.', code: 'RATE_LIMITED', retryAfter: r.retryAfterSec, action });
};

const publicLimits = () => Object.fromEntries(Object.entries(LIMITS).map(([k, v]) => [k, { max: v.max, windowSec: Math.round(v.windowMs / 1000) }]));

const reset = (prefix) => store.reset(prefix);
const setStore = (s) => { store = s || memoryStore(); };

module.exports = { take, enforce, limit, define, reset, setStore, publicLimits, LIMITS };
