// Small shared helpers for Campus Events: errors, text cleaning, numbers, codes, rate limits, audit.
// Same conventions as modules/autoRide/services/util.js.
const crypto = require('crypto');
const { FRIENDLY_SERVER_ERROR } = require('../../../utils/env');
const clock = require('./clock');

class CampusEventsError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra || null;
  }
}
const fail = (status, code, message, extra) => new CampusEventsError(status, code, message, extra);

const isUniqueError = (err) => !!err && (err.name === 'SequelizeUniqueConstraintError'
  || /UNIQUE constraint failed|duplicate key value/i.test(String((err && err.message) || (err && err.parent && err.parent.message) || '')));

/** Known errors -> { code, message, ...extra }; anything else -> friendly 500 (details logged). */
const sendError = (res, err, tag = 'CAMPUS_EVENTS') => {
  if (res.headersSent) return res;
  if (err instanceof CampusEventsError) {
    if (err.extra && err.extra.retryAfter) res.set('Retry-After', String(err.extra.retryAfter));
    return res.status(err.status).json({ code: err.code, message: err.message, ...(err.extra || {}) });
  }
  if (isUniqueError(err)) {
    return res.status(409).json({ code: 'CONFLICT', message: 'That changed just now. Please refresh and try again.' });
  }
  console.error(`[${tag}_ERR]`, err && err.stack ? err.stack : err);
  return res.status(500).json({ code: 'SERVER_ERROR', message: FRIENDLY_SERVER_ERROR });
};

const handler = (fn, tag) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    sendError(res, err, tag);
  }
};

// eslint-disable-next-line no-control-regex
const CTRL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;
const cleanText = (v, max, { multiline = false } = {}) => {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  let s = String(v).replace(CTRL_RE, '').replace(/[<>]/g, '');
  s = multiline ? s.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ');
  return s.trim().slice(0, max);
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
const assertUuid = (v, what = 'item') => {
  if (!isUuid(String(v || ''))) throw fail(404, 'NOT_FOUND', `This ${what} was not found.`);
  return String(v);
};

const num = (v, { min = 0, max = Number.MAX_SAFE_INTEGER, int = false, field = 'value', label, decimals = 2 } = {}) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (typeof v === 'boolean' || !Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) {
    throw fail(400, 'INVALID_INPUT', `${label || field} must be ${int ? 'a whole number' : 'a number'} between ${min} and ${max}.`, { field });
  }
  if (int) return n;
  const f = 10 ** Math.max(0, Math.min(10, Number(decimals) || 0));
  return Math.round(n * f) / f;
};
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
const toPaise = (rupees) => Math.round(money(rupees) * 100);

const parseTime = (v, field) => {
  const d = v instanceof Date ? v : new Date(String(v || ''));
  if (!v || Number.isNaN(d.getTime())) throw fail(400, 'INVALID_INPUT', `${field} must be a date and time.`, { field });
  return d;
};
const optTime = (v, field) => (v === undefined || v === null || v === '' ? null : parseTime(v, field));
const bool = (v) => v === true || v === 'true' || v === 1 || v === '1';
const iso = (d) => (d ? new Date(d).toISOString() : null);
const ms = (d) => (d ? new Date(d).getTime() : null);

// Unambiguous alphabets. Registration code EV-XXXXXX; ticket code 10-char Crockford base32.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const randomFrom = (alphabet, n) => {
  let s = '';
  for (let i = 0; i < n; i++) s += alphabet[crypto.randomInt(0, alphabet.length)];
  return s;
};
const newRegCode = () => `EV-${randomFrom(CODE_ALPHABET, 6)}`;
const newTicketCode = () => randomFrom(CROCKFORD, 10);
/** Typed ticket codes: upper case, Crockford look-alikes folded (O->0, I/L->1), separators dropped. */
const normalizeTicketCode = (v) => String(v || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').slice(0, 12);

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  if (x.length !== y.length || !x.length) return false;
  return crypto.timingSafeEqual(x, y);
};

// ── In-memory rate limits (per account / key, sliding window). Resets on restart.
const buckets = new Map();
setInterval(() => {
  const t = Date.now();
  for (const [k, list] of buckets) if (!list.length || t - list[list.length - 1] > 24 * 60 * 60 * 1000) buckets.delete(k);
}, 30 * 60 * 1000).unref?.();

const RATE = {
  register: { max: Number(process.env.CAMPUS_EVENTS_REGISTER_PER_10MIN) || 30, windowMs: 10 * 60 * 1000, message: 'Too many registration attempts. Please wait a few minutes.' },
  invite: { max: 40, windowMs: 60 * 60 * 1000, message: 'Too many invitations. Please wait a while and try again.' },
  check_in: { max: Number(process.env.CAMPUS_EVENTS_CHECKIN_PER_MIN) || 120, windowMs: 60 * 1000, message: 'Too many scans in a minute. Please slow down.' },
  organizer_write: { max: 200, windowMs: 60 * 60 * 1000, message: 'Too many changes. Please slow down and try again in a while.' },
  apply: { max: 5, windowMs: 24 * 60 * 60 * 1000, message: 'Too many organizer applications today.' },
  join: { max: 30, windowMs: 10 * 60 * 1000, message: 'Too many join attempts. Please wait a few minutes.' },
};

/** Throws 429 when over the limit, otherwise records the hit. cfg overrides the named limit. */
const hit = (kind, id, cfg = RATE[kind]) => {
  if (!cfg) return;
  const key = `${kind}:${id}`;
  const t = Date.now();
  const list = (buckets.get(key) || []).filter((x) => t - x < cfg.windowMs);
  if (list.length >= cfg.max) {
    buckets.set(key, list);
    const retryAfter = Math.max(1, Math.ceil((cfg.windowMs - (t - list[0])) / 1000));
    throw fail(429, 'RATE_LIMITED', cfg.message, { retryAfter });
  }
  list.push(t);
  buckets.set(key, list);
};
const resetLimits = () => buckets.clear();

/** Admin audit mirror in VerificationLog (the admin panel's shared audit table). Never throws. */
const adminAudit = async (req, targetId, action, details) => {
  try {
    const { getVerificationLogModel } = require('../../../models/VerificationLog');
    const VerificationLog = getVerificationLogModel();
    if (!VerificationLog) return;
    await VerificationLog.create({
      adminId: req && req.user && req.user.id ? String(req.user.id) : 'admin',
      targetId: targetId ? String(targetId) : 'global',
      action,
      details: JSON.stringify(details || {}).slice(0, 8000),
      timestamp: clock.now(),
    });
  } catch (err) {
    console.warn('[CAMPUS_EVENTS_AUDIT_WARN]', err.message);
  }
};

const pageOpts = (query, dflt = 50, maxLimit = 200) => {
  const q = query || {};
  const limit = num(q.limit, { min: 1, max: maxLimit, int: true, field: 'limit' }) || dflt;
  const page = num(q.page, { min: 1, max: 100000, int: true, field: 'page' }) || 1;
  return { page, limit, offset: (page - 1) * limit, fetch: limit + 1 };
};
const paginate = (rows, p) => {
  const hasMore = rows.length > p.limit;
  return { rows: hasMore ? rows.slice(0, p.limit) : rows, pagination: { page: p.page, limit: p.limit, hasMore } };
};

const noStore = (req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); };

module.exports = {
  CampusEventsError, fail, sendError, handler, isUniqueError, cleanText, isUuid, assertUuid, num, money, toPaise, parseTime, optTime,
  bool, iso, ms, newRegCode, newTicketCode, normalizeTicketCode, sha256, safeEqual, hit, resetLimits, RATE, adminAudit, pageOpts,
  paginate, noStore, UUID_RE,
};
