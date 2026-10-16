// Client retry keys (Idempotency-Key header or a body field) for money / booking POSTs
// (gifts, service bookings, Mega Basket).
//
// Three layers:
//  1. In-process fast path (memory, as before): while the first request with a key is still running
//     in THIS process, a repeat gets 409 `*_IN_PROGRESS` (the apps keep the key and retry). For a few
//     minutes after it succeeded, a repeat gets the first response again with `duplicate: true`.
//  2. Shared claim (A2): the IdempotencyKeys table (models/IdempotencyKey.js), unique on
//     (scope, userId, key), so the same holds across processes (deploy overlap, 2+ instances).
//     The claim is one INSERT (Postgres: ON CONFLICT DO NOTHING; SQLite: insert, catch the unique
//     error). A conflicting row that is
//       in_progress and not expired          -> 'busy' (409)
//       done with a stored response          -> 'done' (that response, replayed by the route)
//       done but the response was too big    -> the request runs; the route's durable check answers
//       expired (stuck claim / old answer)   -> taken over with a conditional UPDATE
//     finish() stores status + body (capped at MAX_STORED_BODY_BYTES) for STORED_TTL_MS; release()
//     deletes the claim so a retry can run. The 'idempotency.cleanup' job deletes expired rows.
//     FAIL OPEN: any error of this layer (table missing, DB hiccup) is logged and the request goes
//     on with the in-process guard only, i.e. the single-process behaviour.
//  3. Durable check in the route (a key column on the created row, or on the sender for gifts), so a
//     retry still finds the first result whatever happened above.
// 409 is sent ONLY for "same key still being processed"; the apps rely on that.
const crypto = require('crypto');
const { Op } = require('sequelize');

const IN_FLIGHT_TTL_MS = 2 * 60 * 1000; // a stuck claim frees itself
const DONE_TTL_MS = 10 * 60 * 1000; // in-process replay window for a finished request
const STORED_TTL_MS = 24 * 60 * 60 * 1000; // shared replay window (IdempotencyKeys.expiresAt)
const MAX_STORED_BODY_BYTES = 64 * 1024; // larger responses are not stored (the route's durable check answers)
const WARN_EVERY_MS = 60 * 1000;

const entries = new Map(); // `${scope}:${userId}:${key}` -> { at, done?: { status, body } }

const sweep = () => {
  const now = Date.now();
  for (const [k, v] of entries) {
    if (now - v.at > (v.done ? DONE_TTL_MS : IN_FLIGHT_TTL_MS)) entries.delete(k);
  }
};

let lastWarnAt = 0;
const warn = (what, err) => {
  const now = Date.now();
  if (now - lastWarnAt < WARN_EVERY_MS) return;
  lastWarnAt = now;
  console.warn(`[IDEMPOTENCY] ${what} failed (${err && err.message}); using the in-process guard only`);
};

const defaultModel = () => {
  try { return require('../models/IdempotencyKey').getIdempotencyKeyModel() || null; } catch { return null; }
};

// The client's key: header first, then the given body values. '' when absent or unusable.
const KEY_RE = /^[A-Za-z0-9_.:-]{8,100}$/;
const readIdempotencyKey = (req, ...bodyValues) => {
  const candidates = [req.get ? req.get('Idempotency-Key') : undefined, ...bodyValues];
  for (const c of candidates) {
    if (c === undefined || c === null || c === '') continue;
    const k = String(c).trim();
    if (KEY_RE.test(k)) return k;
  }
  return '';
};

// JSON text of a response body, or null when it cannot be stored (too big / not serialisable).
const storableBody = (body) => {
  try {
    const s = JSON.stringify(body === undefined ? null : body);
    return typeof s === 'string' && Buffer.byteLength(s, 'utf8') <= MAX_STORED_BODY_BYTES ? s : null;
  } catch {
    return null;
  }
};
const parseBody = (s) => { try { return JSON.parse(s); } catch { return undefined; } };

const isUniqueError = (err) => !!err && (err.name === 'SequelizeUniqueConstraintError'
  || (err.parent && (err.parent.code === '23505' || /UNIQUE constraint failed/i.test(String(err.parent.message || '')))));

// One INSERT; true when this call created the row, false when (scope, userId, key) already exists.
const insertClaim = async (Model, row) => {
  const db = Model.sequelize;
  if (db && typeof db.getDialect === 'function' && db.getDialect() === 'postgres') {
    const rows = await db.query(
      'INSERT INTO "IdempotencyKeys" ("id", "scope", "userId", "key", "status", "token", "expiresAt", "createdAt", "updatedAt") '
      + "VALUES (:id, :scope, :userId, :key, 'in_progress', :token, :expiresAt, :now, :now) "
      + 'ON CONFLICT ("scope", "userId", "key") DO NOTHING RETURNING "id"',
      { replacements: row, type: db.QueryTypes.SELECT },
    );
    return Array.isArray(rows) && rows.length > 0;
  }
  try {
    await Model.create({
      id: row.id, scope: row.scope, userId: row.userId, key: row.key,
      status: 'in_progress', token: row.token, expiresAt: row.expiresAt,
    });
    return true;
  } catch (err) {
    if (isUniqueError(err)) return false;
    throw err;
  }
};

/**
 * Shared (database) claim. Resolves to
 *   { state: 'own', token }            this request owns the row: run it
 *   { state: 'busy' }                  another request with this key is running
 *   { state: 'done', status, body }    it finished: replay the stored response
 *   { state: 'pass' }                  it finished but its response was not stored: run it (the
 *                                      route's durable check answers) without touching the row
 */
const claimShared = async (Model, scope, userId, key) => {
  const token = crypto.randomUUID();
  for (let attempt = 0; attempt < 2; attempt++) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + IN_FLIGHT_TTL_MS);
    if (await insertClaim(Model, { id: crypto.randomUUID(), scope, userId, key, token, expiresAt, now })) {
      return { state: 'own', token };
    }
    const row = await Model.findOne({ where: { scope, userId, key } });
    if (!row) continue; // released / cleaned up in between: try the insert once more
    if (new Date(row.expiresAt).getTime() > Date.now()) {
      if (row.status !== 'done') return { state: 'busy' };
      if (row.responseBody === null || row.responseBody === undefined) return { state: 'pass' };
      const body = parseBody(row.responseBody);
      if (body === undefined) return { state: 'pass' };
      return { state: 'done', status: Number(row.responseStatus) || 200, body };
    }
    // Expired (a stuck claim, or an old answer the cleanup job has not deleted yet): take it over,
    // conditionally, so of two racing takeovers only one wins.
    const [n] = await Model.update(
      { status: 'in_progress', token, responseStatus: null, responseBody: null, expiresAt: new Date(Date.now() + IN_FLIGHT_TTL_MS) },
      { where: { id: row.id, token: row.token, expiresAt: { [Op.lte]: new Date() } } },
    );
    return n === 1 ? { state: 'own', token } : { state: 'busy' };
  }
  return { state: 'busy' };
};

/**
 * claim(scope, userId, key) → Promise of
 *   { state: 'new', finish(status, body), release() }   first request: run it, then finish or release
 *   { state: 'busy' }                                    same key still running → answer 409
 *   { state: 'done', status, body }                      finished → replay
 * Without a key every request is 'new' and finish/release are no-ops. finish / release return
 * promises that never reject (callers may await them; the in-process part is applied at once).
 * opts.model overrides the IdempotencyKey model (tests; null = in-process only).
 */
const claim = async (scope, userId, key, opts = {}) => {
  if (!key) return { state: 'new', async finish() {}, async release() {} };
  sweep();
  const uid = String(userId);
  const id = `${scope}:${uid}:${key}`;
  const seen = entries.get(id);
  if (seen && seen.done) return { state: 'done', status: seen.done.status, body: seen.done.body };
  if (seen) return { state: 'busy' };
  const entry = { at: Date.now() };
  entries.set(id, entry); // before any await: a same-process repeat is 'busy' at once
  const dropMemory = () => { if (entries.get(id) === entry) entries.delete(id); };

  const Model = opts.model !== undefined ? opts.model : defaultModel();
  let owned = null; // token of the shared row this request owns
  if (Model) {
    try {
      const shared = await claimShared(Model, scope, uid, key);
      if (shared.state === 'busy' || shared.state === 'done') {
        dropMemory();
        return shared.state === 'busy' ? { state: 'busy' } : { state: 'done', status: shared.status, body: shared.body };
      }
      if (shared.state === 'own') owned = shared.token;
    } catch (err) {
      warn('claim', err);
    }
  }

  let settled = false;
  const where = () => ({ scope, userId: uid, key, token: owned });
  return {
    state: 'new',
    async finish(status, body) {
      if (settled) return;
      settled = true;
      if (entries.get(id) === entry) entries.set(id, { at: Date.now(), done: { status, body } });
      if (!owned) return;
      try {
        await Model.update(
          { status: 'done', responseStatus: status, responseBody: storableBody(body), expiresAt: new Date(Date.now() + STORED_TTL_MS) },
          { where: where() },
        );
      } catch (err) {
        warn('finish', err);
      }
    },
    async release() {
      if (settled) return;
      settled = true;
      dropMemory();
      if (!owned) return;
      try {
        await Model.destroy({ where: { ...where(), status: 'in_progress' } });
      } catch (err) {
        warn('release', err);
      }
    },
  };
};

/** Deletes expired claims / stored answers. Job 'idempotency.cleanup' (jobs/index.js). */
const cleanupExpired = async (opts = {}) => {
  const Model = opts.model !== undefined ? opts.model : defaultModel();
  if (!Model) return { deleted: 0 };
  const deleted = await Model.destroy({ where: { expiresAt: { [Op.lt]: new Date() } } });
  return { deleted: Number(deleted) || 0 };
};

module.exports = {
  readIdempotencyKey, claim, cleanupExpired, storableBody,
  IN_FLIGHT_TTL_MS, DONE_TTL_MS, STORED_TTL_MS, MAX_STORED_BODY_BYTES,
};
