// B1: cross-instance cache invalidation bus (Redis pub/sub, channel 'zenvy:bus:v1').
//
// Caches stay in each process (Redis Cloud free has ~30 MB: payloads are never stored there). When one
// instance clears a cache it publishes a tiny message { i: instanceId, n: name, a: args }; every OTHER
// instance applies the same clear locally (its own messages are ignored by instance id).
//
//   const clear = cacheBus.wrap('auth.user', (userId) => AUTH_CACHE.delete(userId), { resync: () => AUTH_CACHE.clear() });
//   clear(id)  -> clears here at once, then tells the other instances (no-op without Redis)
//
// resync: clears the WHOLE cache. Run on every instance when Redis comes back after an outage (the
// invalidations published meanwhile were lost), and when another instance announces it reconnected.
// Without REDIS_URL, wrap() returns a function that only runs the local clear: today's behaviour.
const redis = require('./redis');

const CHANNEL = 'zenvy:bus:v1';
const RESYNC = '__resync';
const MAX_ARGS_BYTES = 4096;

const handlers = new Map(); // name -> { apply(...args), resync() }
const stats = { published: 0, received: 0, applied: 0, ignoredOwn: 0, unknown: 0, errors: 0, resyncs: 0, dropped: 0 };
let subscribed = false;
// True while a message from another instance is being applied: clears it triggers (e.g. the restaurant
// list clear also invalidates a responseCache group) must not be re-broadcast (no ping-pong).
let applyingRemote = false;

const register = (name, apply, { resync } = {}) => {
  handlers.set(String(name), { apply, resync: typeof resync === 'function' ? resync : null });
};

const broadcast = (name, ...args) => {
  if (applyingRemote) return;
  if (!redis.isReady()) {
    if (redis.isConfigured()) stats.dropped++;
    return;
  }
  let msg;
  try {
    msg = JSON.stringify({ i: redis.INSTANCE_ID, n: String(name), a: args });
  } catch {
    msg = JSON.stringify({ i: redis.INSTANCE_ID, n: String(name), a: [] });
  }
  // A huge argument list is not worth shipping: the receivers clear everything for that name instead.
  if (msg.length > MAX_ARGS_BYTES) msg = JSON.stringify({ i: redis.INSTANCE_ID, n: String(name), a: [], all: true });
  stats.published++;
  redis.publish(CHANNEL, msg).catch(() => {});
};

/** Register a local clear and return a function that runs it here and broadcasts it to the other instances. */
const wrap = (name, apply, opts = {}) => {
  register(name, apply, opts);
  return (...args) => {
    const out = apply(...args);
    broadcast(name, ...args);
    return out;
  };
};

const resyncAll = (reason) => {
  stats.resyncs++;
  const prev = applyingRemote;
  applyingRemote = true;
  try {
    for (const [name, h] of handlers) {
      if (!h.resync) continue;
      try { h.resync(); } catch (err) { stats.errors++; console.warn(`[CACHE_BUS] resync ${name} failed:`, err.message); }
    }
  } finally { applyingRemote = prev; }
  if (reason) console.log(`[CACHE_BUS] local caches cleared (${reason})`);
};

const onMessage = (channel, raw) => {
  if (String(channel) !== CHANNEL) return;
  let msg;
  try { msg = JSON.parse(String(raw)); } catch { stats.errors++; return; }
  if (!msg || typeof msg !== 'object') return;
  stats.received++;
  if (msg.i === redis.INSTANCE_ID) { stats.ignoredOwn++; return; }
  if (msg.n === RESYNC) { resyncAll(`instance ${String(msg.i).slice(0, 64)} reconnected to Redis`); return; }
  const h = handlers.get(String(msg.n));
  if (!h) { stats.unknown++; return; }
  applyingRemote = true;
  try {
    if (msg.all && h.resync) h.resync();
    else h.apply(...(Array.isArray(msg.a) ? msg.a : []));
    stats.applied++;
  } catch (err) {
    stats.errors++;
    console.warn(`[CACHE_BUS] applying ${String(msg.n).slice(0, 60)} failed:`, err.message);
  } finally {
    applyingRemote = false;
  }
};

/** Subscribe (once) when Redis is configured. Safe to call more than once. */
const start = () => {
  if (subscribed || !redis.isConfigured()) return false;
  if (!redis.start()) return false;
  const sub = redis.getSubscriber();
  if (!sub) return false;
  subscribed = true;
  sub.on('message', onMessage);
  sub.subscribe(CHANNEL).catch(() => { /* autoResubscribe re-issues it after a reconnect */ });
  redis.onReady(({ recovered }) => {
    if (!recovered) return;
    // Invalidations sent while this instance was cut off are gone: clear here, and ask the others to
    // clear too (their invalidations from this instance were lost the same way).
    resyncAll('Redis reconnected');
    broadcast(RESYNC);
  });
  return true;
};

const status = () => ({ channel: CHANNEL, subscribed, handlers: handlers.size, ...stats });

module.exports = { register, broadcast, wrap, start, status, resyncAll, CHANNEL, _onMessage: onMessage };
