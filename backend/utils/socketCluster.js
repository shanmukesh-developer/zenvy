// B1: socket.io across instances.
//
// setup(io): when REDIS_URL is set, every namespace ('/', '/campus', and any created later) gets the
// @socket.io/redis-adapter, so io.to(room).emit(...), socketsJoin / socketsLeave / disconnectSockets and
// fetchSockets reach sockets connected to the OTHER instances too. Channels are 'zenvy:socket.io#…'.
// Without REDIS_URL nothing changes (in-memory adapter).
//
// While Redis is down the adapter still delivers to this instance's own sockets (it publishes and then
// broadcasts locally; publishing is dropped by utils/redis.adapterPubClient), and the helpers below fall
// back to local lookups, so a Redis outage degrades to single-instance behaviour.
//
// socketOptions(base): server options for multi-instance mode (REDIS_URL set or INSTANCE_MODE=multi).
// Render's load balancer has no sticky sessions, so a long-polling session whose requests land on two
// instances fails ("Session ID unknown"). Every Zenvy app asks for transports ['websocket', 'polling'] /
// ['websocket'] (websocket FIRST, one TCP connection = one instance), so they work. Polling stays
// allowed for old builds / proxies that block websockets (those may fail ~half the time across
// instances); SOCKET_TRANSPORTS=websocket makes the server websocket-only once no client needs polling.
// perMessageDeflate is switched off in multi mode (a zlib context per socket costs ~300 KB RAM and CPU);
// SOCKET_PER_MESSAGE_DEFLATE=off|on overrides it in either mode.
const redis = require('./redis');

const num = (v, def, min = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? n : def;
};
const fetchTimeoutMs = () => num(process.env.REDIS_ADAPTER_TIMEOUT_MS, 3000, 200);

let clustered = false;

const socketOptions = (base) => {
  const out = { ...base };
  const deflate = String(process.env.SOCKET_PER_MESSAGE_DEFLATE || '').trim().toLowerCase();
  if (deflate === 'off' || deflate === 'false' || deflate === '0') out.perMessageDeflate = false;
  else if (deflate === 'on' || deflate === 'true' || deflate === '1') out.perMessageDeflate = base.perMessageDeflate || { threshold: 1024 };
  else if (redis.isMultiInstance()) out.perMessageDeflate = false;
  const transports = String(process.env.SOCKET_TRANSPORTS || '').trim().toLowerCase();
  if (transports === 'websocket') { out.transports = ['websocket']; out.allowUpgrades = false; }
  return out;
};

/** Install the Redis adapter on every namespace (call right after `new Server`). Returns true when installed. */
const setup = (io) => {
  if (!io || io.isNullIo || typeof io.adapter !== 'function') return false;
  if (!redis.isConfigured()) return false;
  if (!redis.start()) return false;
  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    io.adapter(createAdapter(redis.adapterPubClient(), redis.getSubscriber(), {
      key: 'zenvy:socket.io',
      requestsTimeout: fetchTimeoutMs(),
    }));
    clustered = true;
    console.log(`🔗 [SOCKET] Redis adapter on (instance ${redis.INSTANCE_ID}): rooms and emits span every instance`);
    return true;
  } catch (err) {
    console.warn('⚠️ [SOCKET] Redis adapter not installed, sockets stay single-instance:', err.message);
    return false;
  }
};

const isClustered = () => clustered;
/** Clustered AND Redis currently reachable (cross-instance lookups possible). */
const isCrossInstance = () => clustered && redis.isReady();

const withTimeout = (p, ms) => {
  let t;
  return Promise.race([
    Promise.resolve(p),
    new Promise((_, reject) => { t = setTimeout(() => reject(new Error(`fetchSockets timed out after ${ms} ms`)), ms); if (t.unref) t.unref(); }),
  ]).finally(() => clearTimeout(t));
};

/**
 * fetchSockets() that never rejects because of Redis: cross-instance when possible, this instance's
 * sockets otherwise. `op` is a namespace or a BroadcastOperator (nsp.in(room)).
 * Remote sockets carry only id / rooms / data (socket.data), not socket.user.
 */
const fetchSocketsChecked = async (op) => {
  if (!op || typeof op.fetchSockets !== 'function') return { sockets: [], certain: true };
  if (!clustered) return { sockets: await op.fetchSockets(), certain: true };
  const local = async () => ({
    sockets: op.local && typeof op.local.fetchSockets === 'function' ? await op.local.fetchSockets() : [],
    certain: false, // other instances could not be asked
  });
  if (!redis.isReady()) return local();
  try {
    return { sockets: await withTimeout(op.fetchSockets(), fetchTimeoutMs() + 500), certain: true };
  } catch (err) {
    redis.noteError(err);
    return local();
  }
};
const fetchSockets = async (op) => (await fetchSocketsChecked(op)).sockets;

/**
 * Is anyone in `room` (any instance)? Resolves { present, certain }. A local member answers at once;
 * otherwise, when clustered, the other instances are asked. When they cannot be asked (Redis down /
 * timeout) the answer is { present: false, certain: false } and callers that would take something away
 * (e.g. mark a rider offline) should wait for a certain answer.
 */
const roomPresence = async (nsp, room) => {
  const live = nsp && nsp.adapter && nsp.adapter.rooms ? nsp.adapter.rooms.get(room) : null;
  if (live && live.size > 0) return { present: true, certain: true };
  if (!clustered) return { present: false, certain: true };
  if (!redis.isReady()) return { present: false, certain: false };
  try {
    const sockets = await withTimeout(nsp.in(room).fetchSockets(), fetchTimeoutMs() + 500);
    return { present: sockets.length > 0, certain: true };
  } catch (err) {
    redis.noteError(err);
    return { present: false, certain: false };
  }
};

/** Emit to this instance's sockets only (e.g. 'server:draining' during this instance's shutdown). */
const localEmit = (io, event, payload) => {
  if (!io) return;
  const target = io.local && typeof io.local.emit === 'function' ? io.local : io;
  target.emit(event, payload);
};

module.exports = { setup, socketOptions, isClustered, isCrossInstance, fetchSockets, fetchSocketsChecked, roomPresence, localEmit };
