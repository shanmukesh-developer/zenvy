// Serialisation for every capacity / roster / ticket changing write (same design as Auto-Ride locks.js):
//   withKeyLock(key, fn)   in-process FIFO queue per key (one Node process never runs two at once)
//   tx(fn)                 SQLite BEGIN IMMEDIATE (write lock up front, second waits on busy_timeout);
//                          Postgres: a transaction in which lockOpt() rows are SELECT ... FOR UPDATE.
//   withEventLock(id, fn)  = withKeyLock('ce_event:'+id) + tx + the event row FOR UPDATE on Postgres,
//                          fn(t, event). Everything that takes / frees a unit of an event (or of its slots,
//                          or a team place) runs inside it.
// The partial unique indexes in migrations.js are the last line of defence underneath.
const { Transaction } = require('sequelize');
const { getModel, getSequelize } = require('../index');
const { fail, isUniqueError } = require('./util');

const queues = new Map();
let inProcessQueue = true;
/** Tests only: turn the in-process queue off to prove the database guards hold on their own. */
const setInProcessQueue = (on) => { inProcessQueue = !!on; };

const withKeyLock = async (key, fn) => {
  if (!inProcessQueue) return fn();
  const k = String(key);
  const prev = queues.get(k) || Promise.resolve();
  let release;
  const mine = new Promise((r) => { release = r; });
  const chained = prev.then(() => mine);
  queues.set(k, chained);
  try {
    await prev;
    return await fn();
  } finally {
    release();
    if (queues.get(k) === chained) queues.delete(k);
  }
};

const isPg = () => getSequelize().getDialect() === 'postgres';
const tx = (fn) => getSequelize().transaction({ type: Transaction.TYPES.IMMEDIATE }, fn);
const lockOpt = (t) => (isPg() ? { transaction: t, lock: t.LOCK.UPDATE } : { transaction: t });

const withEventLock = (eventId, fn) => withKeyLock(`ce_event:${eventId}`, () => tx(async (t) => {
  const event = await getModel('CeEvent').findByPk(eventId, lockOpt(t));
  if (!event) throw fail(404, 'NOT_FOUND', 'This event was not found.');
  return fn(t, event);
}));

/** Retries fn on unique-index races (another process took the unit / code first). */
const retryOnConflict = async (fn, attempts = 3) => {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(i);
    } catch (err) {
      if (!isUniqueError(err) && !(err && err.code === 'CE_RETRY') && !/SQLITE_BUSY|database is locked/i.test(String(err && err.message))) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
};

module.exports = { withKeyLock, withEventLock, tx, lockOpt, isPg, retryOnConflict, setInProcessQueue };
