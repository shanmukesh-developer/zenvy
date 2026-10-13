// Client retry keys (Idempotency-Key header or a body field) for money / booking POSTs.
//
// Two layers, same as POST /api/orders:
//  1. In-process guard (this file): while the first request with a key is still running, a repeat
//     gets 409 `*_IN_PROGRESS` (the apps keep the key and retry). For a few minutes after it
//     succeeded, a repeat gets the first response again with `duplicate: true`.
//  2. Durable check in the route (a key column on the created row, or on the sender for gifts), so a
//     retry after a restart / redeploy still finds the first result.
// 409 is sent ONLY for "same key still being processed"; the apps rely on that.

const IN_FLIGHT_TTL_MS = 2 * 60 * 1000; // a stuck claim frees itself
const DONE_TTL_MS = 10 * 60 * 1000; // replay window for a finished request
const entries = new Map(); // `${scope}:${userId}:${key}` -> { at, done?: { status, body } }

const sweep = () => {
  const now = Date.now();
  for (const [k, v] of entries) {
    if (now - v.at > (v.done ? DONE_TTL_MS : IN_FLIGHT_TTL_MS)) entries.delete(k);
  }
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

/**
 * claim(scope, userId, key) →
 *   { state: 'new', finish(status, body), release() }   first request: run it, then finish or release
 *   { state: 'busy' }                                    same key still running → answer 409
 *   { state: 'done', status, body }                      finished recently → replay
 * Without a key every request is 'new' and finish/release are no-ops.
 */
const claim = (scope, userId, key) => {
  if (!key) return { state: 'new', finish() {}, release() {} };
  sweep();
  const id = `${scope}:${userId}:${key}`;
  const seen = entries.get(id);
  if (seen && seen.done) return { state: 'done', status: seen.done.status, body: seen.done.body };
  if (seen) return { state: 'busy' };
  const entry = { at: Date.now() };
  entries.set(id, entry);
  return {
    state: 'new',
    finish(status, body) {
      if (entries.get(id) === entry) entries.set(id, { at: Date.now(), done: { status, body } });
    },
    release() {
      if (entries.get(id) === entry) entries.delete(id);
    },
  };
};

module.exports = { readIdempotencyKey, claim, IN_FLIGHT_TTL_MS, DONE_TTL_MS };
