// Serialisation helpers for every seat / queue changing write.
//   withKeyLock(key, fn)  in-process FIFO queue per key (one Node process never runs two at once)
//   tx(fn)                write transaction: SQLite BEGIN IMMEDIATE (takes the write lock up front, so
//                         two transactions can never interleave; busy_timeout makes the second wait);
//                         Postgres: a normal transaction in which lockOpt() rows are SELECT ... FOR UPDATE.
//   withTripLock(id, fn)  = withKeyLock('trip:'+id) + tx + the trip row locked FOR UPDATE on Postgres
//                         (so a second process / instance waits on the row lock), fn(t, trip).
// The partial unique indexes in migrations.js are the last line of defence underneath all of this.
const { Transaction } = require('sequelize');
const { getModel, getSequelize } = require('../index');
const { fail } = require('./util');

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

const withTripLock = (tripId, fn) => withKeyLock(`trip:${tripId}`, () => tx(async (t) => {
  const trip = await getModel('AutoTrip').findByPk(tripId, lockOpt(t));
  if (!trip) throw fail(404, 'NOT_FOUND', 'This auto trip was not found.');
  return fn(t, trip);
}));

/** Retries fn on unique-index races (another process won a queue number / counter row). */
const retryOnConflict = async (fn, attempts = 3) => {
  const { isUniqueError } = require('./util');
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(i);
    } catch (err) {
      if (!isUniqueError(err) && !(err && err.code === 'QUEUE_RETRY')) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
};

module.exports = { withKeyLock, withTripLock, tx, lockOpt, isPg, retryOnConflict, setInProcessQueue };
