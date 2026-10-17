// B1: rate limits shared across instances when REDIS_URL is set; in-memory (today) otherwise.
//
// 1. expressStore(name) -> options to spread into express-rate-limit: `rateLimit({ ...opts, ...expressStore('auth') })`.
//    Without REDIS_URL it is {} (express-rate-limit keeps its own MemoryStore: unchanged behaviour).
//    With REDIS_URL: a FallbackStore. While Redis is ready, counts live in Redis (rate-limit-redis, keys
//    'zenvy:rl:<name>:<client key>', one per limiter); when Redis is down / slow (> REDIS_RL_TIMEOUT_MS,
//    default 250) the same request is counted in a local MemoryStore instead. Limits therefore fail OPEN
//    to per-instance memory limits and never block traffic because of Redis.
//
// 2. gate(ns, key, max, windowMs) -> null (allowed, hit recorded) | retryAfterSec (over the SHARED limit).
//    For the synchronous in-memory limiters (Friends limiter store, Auto-Ride / Campus Events / Rentals
//    hit()): they keep their exact local sliding window and additionally consult a Redis fixed-window
//    counter. The Redis count is read asynchronously (INCR after each allowed hit) and cached here, so the
//    check stays synchronous; the shared count lags by at most one request per instance. Without
//    REDIS_URL gate() always returns null and records nothing.
const redis = require('./redis');

const num = (v, def, min = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? n : def;
};
const rlTimeoutMs = () => num(process.env.REDIS_RL_TIMEOUT_MS, 250, 20);

const withTimeout = (p, ms) => {
  let t;
  return Promise.race([
    p,
    new Promise((_, reject) => { t = setTimeout(() => reject(new Error(`redis rate limit timed out after ${ms} ms`)), ms); if (t.unref) t.unref(); }),
  ]).finally(() => clearTimeout(t));
};

const stats = { redisHits: 0, memoryHits: 0, fallbacks: 0, gateDenied: 0, gateRecorded: 0 };

// ── 1. express-rate-limit store ───────────────────────────────────────────────────────────────────
class FallbackStore {
  constructor(name) {
    const { MemoryStore } = require('express-rate-limit');
    this.name = String(name);
    this.prefix = `rl:${this.name}:`;
    this.localKeys = false; // keys are shared (Redis) -> express-rate-limit tells limiters apart by prefix
    this.memory = new MemoryStore();
    this.redisStore = null;
    this.redisInit = null;
    this.options = null;
  }

  init(options) {
    this.options = options;
    this.memory.init(options);
  }

  // The rate-limit-redis store is created (and its Lua scripts loaded) on first use while Redis is ready.
  async redisReady() {
    if (!redis.isReady() || !this.options) return null;
    if (this.redisStore) return this.redisStore;
    if (!this.redisInit) {
      const { RedisStore } = require('rate-limit-redis');
      const store = new RedisStore({
        // ioredis adds the 'zenvy:' key prefix to the EVALSHA key.
        sendCommand: (...args) => redis.getClient().call(...args),
        prefix: this.prefix,
      });
      this.redisInit = withTimeout(store.init(this.options), Math.max(1000, rlTimeoutMs()))
        .then(() => { this.redisStore = store; return store; })
        .catch((err) => { this.redisInit = null; throw err; });
      this.redisInit.catch(() => {}); // awaited below; never an unhandled rejection
    }
    return this.redisInit;
  }

  async increment(key) {
    if (redis.isReady()) {
      try {
        const store = await this.redisReady();
        if (store) {
          const r = await withTimeout(store.increment(key), rlTimeoutMs());
          stats.redisHits++;
          return r;
        }
      } catch (err) {
        stats.fallbacks++;
        redis.noteError(err); // shows in redis.status(); this request is counted in memory instead
      }
    }
    stats.memoryHits++;
    return this.memory.increment(key);
  }

  async decrement(key) {
    if (this.redisStore && redis.isReady()) {
      try { await withTimeout(this.redisStore.decrement(key), rlTimeoutMs()); } catch { /* best effort */ }
    }
    return this.memory.decrement(key);
  }

  async resetKey(key) {
    if (this.redisStore && redis.isReady()) {
      try { await withTimeout(this.redisStore.resetKey(key), rlTimeoutMs()); } catch { /* best effort */ }
    }
    return this.memory.resetKey(key);
  }

  async get(key) {
    if (this.redisStore && redis.isReady()) {
      try { return await withTimeout(this.redisStore.get(key), rlTimeoutMs()); } catch { /* fall through */ }
    }
    return this.memory.get(key);
  }

  async resetAll() {
    return this.memory.resetAll();
  }

  shutdown() {
    try { this.memory.shutdown(); } catch { /* ignore */ }
  }
}

const usedNames = new Set();
/** `{ store }` for express-rate-limit when REDIS_URL is set, `{}` otherwise. `name` must be unique per limiter. */
// Redis Cloud free allows ~100 ops/s: a limiter on EVERY request (the global API shield) would spend one
// op per request, so `hot` limiters stay per-instance in memory unless REDIS_SHARED_GLOBAL_LIMIT=1
// (worth it on a bigger Redis). REDIS_RATE_LIMITS=off keeps every express limiter in memory.
const expressStore = (name, { hot = false } = {}) => {
  if (!redis.isConfigured()) return {};
  if (String(process.env.REDIS_RATE_LIMITS || '').trim().toLowerCase() === 'off') return {};
  if (hot && String(process.env.REDIS_SHARED_GLOBAL_LIMIT || '').trim() !== '1') return {};
  redis.start();
  let n = String(name);
  // Two limiters must never share a prefix (they would count each other's hits).
  if (usedNames.has(n)) { let i = 2; while (usedNames.has(`${n}${i}`)) i++; n = `${n}${i}`; }
  usedNames.add(n);
  return { store: new FallbackStore(n) };
};

// ── 2. synchronous gate for the in-memory limiters ────────────────────────────────────────────────
const remote = new Map(); // `${ns}:${key}` -> { bucket, count }
const MAX_REMOTE = 50000;
let ops = 0;

const sweep = (now) => {
  for (const [k, r] of remote) if (r.expiresAt <= now) remote.delete(k);
};

/**
 * Shared-limit check for a synchronous limiter. Call AFTER the local check allowed the hit.
 * Returns null when allowed (the hit is recorded in Redis in the background) or the retry-after in
 * seconds when the shared (all instances) count for this window already reached `max`.
 */
const gate = (ns, key, max, windowMs, now = Date.now()) => {
  if (!redis.isConfigured() || !(windowMs > 0) || !(max > 0)) return null;
  redis.start();
  const id = `${ns}:${key}`;
  const bucket = Math.floor(now / windowMs);
  const seen = remote.get(id);
  if (redis.isReady() && seen && seen.bucket === bucket && seen.count >= max) {
    stats.gateDenied++;
    return Math.max(1, Math.ceil(((bucket + 1) * windowMs - now) / 1000));
  }
  if (!redis.isReady()) return null; // degraded: local limits only
  stats.gateRecorded++;
  const rkey = `rlg:${id}:${bucket}`;
  redis.tryCmd((c) => c.multi().incr(rkey).pexpire(rkey, windowMs + 1000).exec()).then((res) => {
    const count = res && res[0] && !res[0][0] ? Number(res[0][1]) : null;
    if (count === null) return;
    const cur = remote.get(id);
    if (!cur || cur.bucket < bucket || (cur.bucket === bucket && cur.count < count)) {
      remote.set(id, { bucket, count, expiresAt: (bucket + 1) * windowMs });
    }
  });
  if (++ops % 2000 === 0 || remote.size > MAX_REMOTE) sweep(now);
  return null;
};

/** Forget the cached shared counts (tests / limiter resets). Redis keys expire on their own. */
const resetGate = (prefix) => {
  if (!prefix) { remote.clear(); return; }
  for (const k of [...remote.keys()]) if (k.startsWith(prefix)) remote.delete(k);
};

/** A Friends-limiter store ({ take, reset }) = the in-memory store + the shared gate. */
const friendsStore = (memoryStore, ns = 'friends') => ({
  take(key, max, windowMs, now = Date.now()) {
    const r = memoryStore.take(key, max, windowMs, now);
    if (!r.ok) return r;
    const retryAfterSec = gate(ns, key, max, windowMs, now);
    if (retryAfterSec !== null) {
      memoryStore.untake && memoryStore.untake(key, now);
      return { ok: false, retryAfterMs: retryAfterSec * 1000 };
    }
    return r;
  },
  reset(prefix) {
    memoryStore.reset(prefix);
    resetGate(prefix ? `${ns}:${prefix}` : `${ns}:`);
  },
});

const status = () => ({ ...stats, gateKeysCached: remote.size, expressLimiters: usedNames.size });

module.exports = { expressStore, gate, resetGate, friendsStore, status, FallbackStore };
