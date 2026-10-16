// Cross-process mutual exclusion on Postgres: transaction-scoped advisory locks.
//
//   withAdvisoryXactLock(sequelize, key, fn, { transaction })
//
// Runs fn(t) while holding pg_advisory_xact_lock(<stable 64-bit key of `key`>). Every process
// (deploy overlap, 2+ instances) computes the same key, so two callers with the same key run one
// after the other; the lock is released when the transaction ends (commit / rollback), which also
// works behind PgBouncer in transaction mode.
//  - No opts.transaction: a transaction is opened, the lock taken, fn(t) runs (it must pass
//    { transaction: t } to its queries), then commit (rollback if fn throws; the error is rethrown).
//  - opts.transaction given: the lock is taken inside it (in a savepoint, so a failed lock statement
//    leaves the caller's transaction usable) and fn(transaction) runs; the caller ends the transaction.
//  - Not Postgres (SQLite: local dev / tests, one process): fn(opts.transaction || null) runs as is;
//    callers keep their in-process guard for that case.
//  - FAIL OPEN: if opening the transaction or the lock statement errors, a warning is logged and
//    fn runs without the lock (fn(null), or fn(opts.transaction)): exactly today's single-process
//    behaviour behind the caller's in-memory guard. A lock wait is bounded by the pool's
//    statement_timeout (30 s), after which it also fails open.
const crypto = require('crypto');

const LOCK_SQL = 'SELECT pg_advisory_xact_lock(CAST(:k AS bigint))';
const WARN_EVERY_MS = 60 * 1000;
let lastWarnAt = 0;

// Same signed 64-bit key in every process ('zenvy.lock:' namespace; jobs use 'zenvy.job:').
const lockKey = (key) => crypto.createHash('sha1').update(`zenvy.lock:${key}`).digest().readBigInt64BE(0).toString();

const isPostgres = (db) => !!db && typeof db.getDialect === 'function' && db.getDialect() === 'postgres';

const failOpen = (key, err) => {
  const now = Date.now();
  if (now - lastWarnAt < WARN_EVERY_MS) return;
  lastWarnAt = now;
  const label = String(key).split(':')[0] || 'lock';
  console.warn(`[PG_LOCK] ${label}: could not take the advisory lock (${err && err.message}); continuing without it (single-process guard only)`);
};

const withAdvisoryXactLock = async (sequelize, key, fn, opts = {}) => {
  const outer = opts.transaction || null;
  if (!isPostgres(sequelize)) return fn(outer);
  const k = lockKey(key);

  if (outer) {
    try {
      await sequelize.transaction({ transaction: outer }, async (sp) => {
        await sequelize.query(LOCK_SQL, { replacements: { k }, transaction: sp });
      });
    } catch (err) {
      failOpen(key, err);
    }
    return fn(outer);
  }

  let t = null;
  try {
    t = await sequelize.transaction();
    await sequelize.query(LOCK_SQL, { replacements: { k }, transaction: t });
  } catch (err) {
    if (t) await t.rollback().catch(() => {});
    failOpen(key, err);
    return fn(null);
  }
  let result;
  try {
    result = await fn(t);
  } catch (err) {
    await t.rollback().catch(() => {});
    throw err;
  }
  await t.commit();
  return result;
};

module.exports = { withAdvisoryXactLock, lockKey, isPostgres, LOCK_SQL };
