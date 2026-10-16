// Sequelize pool + Postgres per-connection timeouts, read from the environment (A4).
//
//   DB_POOL_MAX              max connections per process          default 20   (same as before; lower after the load test)
//   DB_POOL_MIN              warm connections kept open            default 0    (was 3)
//   DB_POOL_ACQUIRE_MS       wait for a free connection, then fail default 10000 (was 60000)
//   DB_POOL_IDLE_MS          close a connection idle this long     default 30000 (unchanged)
//   DB_POOL_EVICT_MS         idle sweep interval                   default 10000 (unchanged)
//   DB_STATEMENT_TIMEOUT_MS  Postgres statement_timeout per conn   default 30000 (same as before); 0 = off
//
// statement_timeout and idle_in_transaction_session_timeout (fixed 30 s: utils/jobs.js relies on it and
// raises it for its lock transaction with SET LOCAL) are passed as node-postgres connection options,
// i.e. sent in the connection's startup packet: no session-level SET is ever issued, so nothing can leak
// to other clients behind a transaction-mode pooler (PgBouncer / Supavisor port 6543). This is the same
// mechanism the backend has always used (dialectOptions.statement_timeout = 30000), only the value moves.
// Work that legitimately runs longer raises the limit for itself only: SET LOCAL inside its own
// transaction (withStatementTimeout below), or its own connection (scripts/ensure_indexes.js).
const DEFAULTS = Object.freeze({
  poolMax: 20,
  poolMin: 0,
  acquireMs: 10000,
  idleMs: 30000,
  evictMs: 10000,
  statementTimeoutMs: 30000,
  idleInTransactionMs: 30000,
});

// Non-negative integer from env, else the default (garbage / negative values never break the pool).
const intEnv = (env, key, def, { min = 0 } = {}) => {
  const raw = env[key];
  if (raw === undefined || raw === null || String(raw).trim() === '') return def;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < min) return def;
  return Math.floor(n);
};

const getPoolConfig = (env = process.env) => {
  const max = intEnv(env, 'DB_POOL_MAX', DEFAULTS.poolMax, { min: 1 });
  const min = Math.min(intEnv(env, 'DB_POOL_MIN', DEFAULTS.poolMin), max);
  return {
    max,
    min,
    acquire: intEnv(env, 'DB_POOL_ACQUIRE_MS', DEFAULTS.acquireMs, { min: 1 }),
    idle: intEnv(env, 'DB_POOL_IDLE_MS', DEFAULTS.idleMs, { min: 1 }),
    evict: intEnv(env, 'DB_POOL_EVICT_MS', DEFAULTS.evictMs, { min: 1 }),
  };
};

/** Statement timeout in ms (0 = off). */
const getStatementTimeoutMs = (env = process.env) => intEnv(env, 'DB_STATEMENT_TIMEOUT_MS', DEFAULTS.statementTimeoutMs);

/** Postgres timeout connection options for Sequelize dialectOptions (merged with ssl by the caller). */
const getPgTimeoutOptions = (env = process.env) => {
  const opts = { idle_in_transaction_session_timeout: DEFAULTS.idleInTransactionMs };
  const st = getStatementTimeoutMs(env);
  if (st > 0) opts.statement_timeout = st; // 0 = not sent at all: the server / role default applies
  return opts;
};

/**
 * Run fn(t) inside a transaction whose statement_timeout is raised (or lowered) to ms for that
 * transaction only (SET LOCAL: transaction scoped, safe behind transaction-mode poolers). On any other
 * dialect fn(null) runs as is. Rethrows fn's error after rolling back.
 */
const withStatementTimeout = async (sequelize, ms, fn) => {
  if (!sequelize || typeof sequelize.getDialect !== 'function' || sequelize.getDialect() !== 'postgres') return fn(null);
  const value = Math.max(0, Math.floor(Number(ms) || 0));
  return sequelize.transaction(async (t) => {
    await sequelize.query(`SET LOCAL statement_timeout = ${value}`, { transaction: t });
    return fn(t);
  });
};

/** One line for the boot log (no secrets). */
const describe = (env = process.env) => {
  const p = getPoolConfig(env);
  const st = getStatementTimeoutMs(env);
  return `pool max=${p.max} min=${p.min} acquire=${p.acquire}ms idle=${p.idle}ms evict=${p.evict}ms; statement_timeout=${st > 0 ? `${st}ms` : 'off'}; idle_in_transaction_session_timeout=${DEFAULTS.idleInTransactionMs}ms`;
};

module.exports = { DEFAULTS, intEnv, getPoolConfig, getStatementTimeoutMs, getPgTimeoutOptions, withStatementTimeout, describe };
