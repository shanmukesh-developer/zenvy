// PROCESS_ROLE: what this Node process does.
//   all    (default) HTTP API + sockets + scheduled jobs: the single-process behaviour we always had.
//   web    HTTP API + sockets, NO scheduled jobs (run a 'worker' or an 'all' process next to it).
//   worker scheduled jobs only. Still connects to the database and still listens on PORT, but answers
//          only the health endpoints (/, /ping, /api/ping, /api/health) so Render health checks work.
//          It has NO socket.io server: socket emits from jobs are no-ops with a warning (once per
//          event name). Live socket updates from a separate worker need the Redis emitter (Phase 2);
//          until then run jobs in an 'all' process if clients must see job updates live.
// Unknown values fall back to 'all' (with a warning) so a typo never silently stops the jobs.
const ROLES = ['all', 'web', 'worker'];

let warnedBadRole = false;
const getProcessRole = () => {
  const raw = String(process.env.PROCESS_ROLE || '').trim().toLowerCase();
  if (!raw) return 'all';
  if (ROLES.includes(raw)) return raw;
  if (!warnedBadRole) {
    warnedBadRole = true;
    console.warn(`[PROCESS_ROLE] Unknown PROCESS_ROLE "${process.env.PROCESS_ROLE}": using "all" (valid: ${ROLES.join(', ')}).`);
  }
  return 'all';
};

const runsJobs = (role = getProcessRole()) => role === 'all' || role === 'worker';
const servesApi = (role = getProcessRole()) => role === 'all' || role === 'web';

// Socket.io stand-in for PROCESS_ROLE=worker. Every broadcast is dropped (warned once per event name),
// presence lookups see nobody, registration calls (use / on) are accepted and never fire.
const createNullIo = () => {
  const warned = new Set();
  const drop = (event) => {
    const key = String(event);
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(`[PROCESS_ROLE=worker] socket emit "${key}" dropped: this process has no socket server (needs the Redis emitter, Phase 2).`);
    }
    return false;
  };
  const makeNsp = (name) => {
    const nsp = {
      name,
      adapter: { rooms: new Map(), sids: new Map() },
      sockets: new Map(),
      use() { return nsp; },
      on() { return nsp; },
      once() { return nsp; },
      off() { return nsp; },
      removeAllListeners() { return nsp; },
      emit(event) { return drop(event); },
      serverSideEmit(event) { return drop(event); },
      to() { return nsp; },
      in() { return nsp; },
      except() { return nsp; },
      compress() { return nsp; },
      timeout() { return nsp; },
      socketsJoin() {},
      socketsLeave() {},
      disconnectSockets() {},
      fetchSockets: async () => [],
    };
    nsp.volatile = nsp;
    nsp.local = nsp;
    return nsp;
  };
  const root = makeNsp('/');
  const namespaces = new Map([['/', root]]);
  const io = Object.assign(Object.create(root), {
    isNullIo: true,
    sockets: root,
    engine: { clientsCount: 0, on() {} },
    of(name) {
      const key = typeof name === 'string' ? name : '/';
      if (!namespaces.has(key)) namespaces.set(key, makeNsp(key));
      return namespaces.get(key);
    },
    close(cb) { if (typeof cb === 'function') cb(); },
  });
  return io;
};

module.exports = { ROLES, getProcessRole, runsJobs, servesApi, createNullIo };
