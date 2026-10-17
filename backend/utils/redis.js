// B1: optional Redis layer for running the API as 2+ instances behind Render's load balancer.
//
// OFF unless REDIS_URL is set (redis:// or rediss://) and, in production, REDIS_ENABLED=true. With it unset nothing here connects, every
// helper answers "not ready" and the callers keep today's single-instance, in-memory behaviour.
//
// Connections per process (Redis Cloud free allows ~30): at most TWO
//   • cmd  - commands (rate limits, presence keys, ...) AND publishing (socket.io adapter + cache bus)
//   • sub  - subscriber (socket.io adapter channels + the cache-invalidation bus)
// Both connect lazily on start(), use short timeouts (REDIS_CONNECT_TIMEOUT_MS 3000, REDIS_COMMAND_TIMEOUT_MS
// 500) and reconnect forever with exponential backoff (200 ms .. 10 s, jittered). Keys are prefixed 'zenvy:'.
//
// Redis configured but DOWN: logged once per outage (never the URL / password), isReady() is false and
// every caller falls back to local behaviour (local socket emits, local cache clears, in-memory rate
// limits). Commands never queue while disconnected (enableOfflineQueue false on cmd), so a request
// never waits on Redis for more than the command timeout. When it comes back, onReady listeners run with
// { recovered: true } (the cache bus then clears local caches: invalidations sent meanwhile were lost).
//
// Instance identity: INSTANCE_ID env, else Render's RENDER_INSTANCE_ID, else host-pid-random.
const os = require('os');
const crypto = require('crypto');

const KEY_PREFIX = 'zenvy:';

const num = (v, def, min = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? n : def;
};

const INSTANCE_ID = (() => {
  const fromEnv = String(process.env.INSTANCE_ID || process.env.RENDER_INSTANCE_ID || '').trim();
  if (fromEnv) return fromEnv.slice(0, 64);
  const host = String(os.hostname() || 'host').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 24) || 'host';
  return `${host}-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
})();

const rawUrl = () => String(process.env.REDIS_URL || '').trim();
/** True when REDIS_URL is set to a redis:// or rediss:// URL (the value itself is never logged). */
// In production the layer also needs REDIS_ENABLED=true, so a REDIS_URL saved on Render ahead of time
// stays dormant until the owner deliberately switches it on (free Redis plans have small op/traffic caps).
const isProductionHost = () => String(process.env.NODE_ENV || '').toLowerCase() === 'production'
  || /^(1|true)$/i.test(String(process.env.RENDER || ''));
const isEnabled = () => !isProductionHost() || /^(1|true|yes|on)$/i.test(String(process.env.REDIS_ENABLED || '').trim());
const isConfigured = () => /^rediss?:\/\//i.test(rawUrl()) && isEnabled();

// Multi-instance mode: REDIS_URL set, or INSTANCE_MODE=multi (forces the socket settings even without Redis).
const isMultiInstance = () => isConfigured() || String(process.env.INSTANCE_MODE || '').trim().toLowerCase() === 'multi';

// ── State ─────────────────────────────────────────────────────────────────────────────────────────
let IORedis = null;
let cmd = null;
let sub = null;
let started = false;
let closing = false;
let wasReady = false;      // isReady() at the last transition check
let everReady = false;
let downLogged = false;
let pingTimer = null;
const readyListeners = new Set();
const stats = {
  readyAt: 0,
  downSince: 0,
  outages: 0,
  recoveries: 0,
  lastError: null,
  lastErrorAt: 0,
  latencyMs: null,
  lastPingAt: 0,
  commandErrors: 0,
};

// Error text without anything from the URL (host / user / password) in it.
const redact = (msg) => {
  let s = String(msg || '').slice(0, 300);
  try {
    const u = new URL(rawUrl());
    for (const part of [u.password, u.username, u.host, u.hostname, rawUrl()]) {
      if (part && part.length >= 3) s = s.split(part).join('<redacted>');
    }
  } catch { /* not a parseable URL */ }
  return s.replace(/rediss?:\/\/\S+/gi, 'redis://<redacted>');
};

const noteError = (err) => {
  stats.commandErrors++;
  stats.lastError = redact(err && (err.code || err.message) ? `${err.code ? `${err.code}: ` : ''}${err.message || ''}` : err);
  stats.lastErrorAt = Date.now();
};

const isReady = () => !!(cmd && sub && cmd.status === 'ready' && sub.status === 'ready' && !closing);

const checkTransition = () => {
  const now = isReady();
  if (now === wasReady) return;
  wasReady = now;
  if (now) {
    const recovered = everReady;
    everReady = true;
    stats.readyAt = Date.now();
    if (recovered) {
      stats.recoveries++;
      console.log(`✅ [REDIS] reconnected after ${Math.round((Date.now() - stats.downSince) / 1000)} s: multi-instance features back on (instance ${INSTANCE_ID})`);
    } else {
      console.log(`✅ [REDIS] connected: socket adapter, cache bus and shared rate limits on (instance ${INSTANCE_ID})`);
    }
    stats.downSince = 0;
    downLogged = false;
    for (const fn of Array.from(readyListeners)) {
      try { fn({ recovered }); } catch (err) { console.warn('[REDIS] ready listener failed:', err.message); }
    }
  } else if (!closing) {
    stats.downSince = Date.now();
    if (everReady) stats.outages++;
    if (!downLogged) {
      downLogged = true;
      console.warn(`⚠️ [REDIS] unavailable${stats.lastError ? ` (${stats.lastError})` : ''}: running single-instance (local emits, local caches, in-memory rate limits) until it is back`);
    }
  }
};

const retryStrategy = (times) => Math.min(10000, 200 * 2 ** Math.min(Math.max(0, times - 1), 6)) + Math.floor(Math.random() * 250);

const baseOptions = (role) => ({
  lazyConnect: true,
  connectTimeout: num(process.env.REDIS_CONNECT_TIMEOUT_MS, 3000, 100),
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
  autoResubscribe: true,
  retryStrategy,
  connectionName: `zenvy-${role}-${INSTANCE_ID}`.slice(0, 60).replace(/\s/g, ''),
  // A failover replica answers READONLY: reconnect (to the new primary) and resend.
  reconnectOnError: (err) => (/READONLY/.test(String(err && err.message)) ? 2 : false),
});

const attach = (client, role) => {
  client.on('error', (err) => {
    noteError(err);
    if (!downLogged && !closing && !wasReady && !everReady) {
      // First connect failing: say so once (the transition log covers later outages).
      downLogged = true;
      console.warn(`⚠️ [REDIS] ${role} connection failed (${stats.lastError}): running single-instance until it connects`);
    }
  });
  for (const ev of ['ready', 'close', 'end', 'reconnecting']) client.on(ev, checkTransition);
};

const ping = async () => {
  if (!isReady()) return null;
  const t0 = process.hrtime.bigint();
  try {
    await cmd.ping();
    stats.latencyMs = Math.round(Number(process.hrtime.bigint() - t0) / 1e4) / 100;
    stats.lastPingAt = Date.now();
    return stats.latencyMs;
  } catch (err) {
    noteError(err);
    return null;
  }
};

/** Connect (lazily, once). Returns false when REDIS_URL is not set. Never throws, never blocks. */
const start = () => {
  if (started) return !!cmd;
  started = true;
  if (!isConfigured()) {
    if (String(process.env.REDIS_URL || '').trim() && !isEnabled()) console.log('[REDIS] REDIS_URL is set but REDIS_ENABLED is not true: Redis layer stays off (single-instance mode)');
    else if (String(process.env.REDIS_URL || '').trim()) console.warn('⚠️ [REDIS] REDIS_URL is set but is not a redis:// or rediss:// URL: Redis layer stays off');
    return false;
  }
  try {
    IORedis = require('ioredis');
  } catch (err) {
    console.warn('⚠️ [REDIS] ioredis is not installed: Redis layer stays off', err.message);
    return false;
  }
  const url = rawUrl();
  cmd = new IORedis(url, {
    ...baseOptions('cmd'),
    keyPrefix: KEY_PREFIX,
    commandTimeout: num(process.env.REDIS_COMMAND_TIMEOUT_MS, 500, 50),
    enableOfflineQueue: false, // never park a request behind a dead connection
  });
  sub = new IORedis(url, {
    ...baseOptions('sub'),
    // Subscriptions issued before the first connect are queued (a handful of SUBSCRIBE commands).
    enableOfflineQueue: true,
  });
  attach(cmd, 'command');
  attach(sub, 'subscriber');
  cmd.connect().catch(() => { /* retried by retryStrategy; logged by the error handler */ });
  sub.connect().catch(() => { /* same */ });
  pingTimer = setInterval(() => { ping().catch(() => {}); }, num(process.env.REDIS_PING_INTERVAL_MS, 15000, 1000));
  if (pingTimer.unref) pingTimer.unref();
  return true;
};

/** Run fn({ recovered }) every time Redis becomes ready (also now, if it already is). Returns an unsubscribe. */
const onReady = (fn) => {
  readyListeners.add(fn);
  if (isReady()) { try { fn({ recovered: false }); } catch (err) { console.warn('[REDIS] ready listener failed:', err.message); } }
  return () => readyListeners.delete(fn);
};

const getClient = () => cmd;
const getSubscriber = () => sub;

/**
 * Run a command only when Redis is ready; resolves `fallback` (default null) when it is not or the
 * command fails / times out. Never throws. fn receives the command client.
 */
const tryCmd = async (fn, fallback = null) => {
  if (!isReady()) return fallback;
  try {
    return await fn(cmd);
  } catch (err) {
    noteError(err);
    return fallback;
  }
};

/** Publish on a raw channel (channels are NOT key-prefixed). False when not ready / failed. */
const publish = (channel, message) => {
  if (!isReady()) return Promise.resolve(false);
  return cmd.publish(channel, message).then(() => true, (err) => { noteError(err); return false; });
};

// What @socket.io/redis-adapter calls on its "pub" client. Publishing goes through the shared command
// client; while Redis is not ready a publish is dropped (the adapter has already delivered the packet to
// this instance's own sockets) instead of queueing or rejecting unhandled.
const adapterPubClient = () => ({
  publish: (channel, message) => publish(channel, message).then((ok) => (ok ? 1 : 0)),
  // ioredis-style send_command, used for PUBSUB NUMSUB (how many instances to wait for in fetchSockets).
  send_command: (name, args, cb) => {
    if (!isReady()) { cb(new Error('Redis not ready')); return; }
    cmd.call(name, ...(args || [])).then((r) => cb(null, r), (err) => { noteError(err); cb(err); });
  },
  on() { return this; },
  off() { return this; },
  listenerCount() { return 2; },
});

/** Close both connections (graceful shutdown). Bounded, never throws. */
const close = async (timeoutMs = 1500) => {
  if (!cmd && !sub) return;
  closing = true;
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = null;
  const quit = (c) => (c ? Promise.race([
    c.quit().catch(() => { try { c.disconnect(); } catch { /* ignore */ } }),
    new Promise((r) => setTimeout(r, timeoutMs).unref?.()),
  ]).then(() => { try { c.disconnect(); } catch { /* ignore */ } }) : Promise.resolve());
  await Promise.all([quit(cmd), quit(sub)]);
};

/** Status for /api/admin/metrics/perf and health (no URL, host or password). */
const status = () => ({
  configured: isConfigured(),
  ready: isReady(),
  instanceId: INSTANCE_ID,
  multiInstance: isMultiInstance(),
  latencyMs: stats.latencyMs,
  connections: (cmd ? 1 : 0) + (sub ? 1 : 0),
  connectionStates: cmd || sub ? { cmd: cmd ? cmd.status : null, sub: sub ? sub.status : null } : null,
  downSince: stats.downSince ? new Date(stats.downSince).toISOString() : null,
  outages: stats.outages,
  recoveries: stats.recoveries,
  commandErrors: stats.commandErrors,
  lastError: stats.lastError,
  lastErrorAt: stats.lastErrorAt ? new Date(stats.lastErrorAt).toISOString() : null,
});

module.exports = {
  KEY_PREFIX,
  INSTANCE_ID,
  isConfigured,
  isMultiInstance,
  isReady,
  start,
  onReady,
  getClient,
  getSubscriber,
  tryCmd,
  publish,
  ping,
  adapterPubClient,
  close,
  status,
  redact,
  noteError,
};
