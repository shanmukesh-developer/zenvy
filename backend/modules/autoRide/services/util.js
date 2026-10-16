// Small shared helpers for Auto-Ride: errors, text cleaning, numbers, rate limits, audit.
// Same conventions as modules/rentals/services/util.js.
const crypto = require('crypto');
const { FRIENDLY_SERVER_ERROR } = require('../../../utils/env');
const clock = require('./clock');

class AutoRideError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra || null;
  }
}
const fail = (status, code, message, extra) => new AutoRideError(status, code, message, extra);

const isUniqueError = (err) => !!err && (err.name === 'SequelizeUniqueConstraintError'
  || /UNIQUE constraint failed|duplicate key value/i.test(String((err && err.message) || (err && err.parent && err.parent.message) || '')));

/** Known errors -> { code, message, ...extra }; anything else -> friendly 500 (details logged). */
const sendError = (res, err, tag = 'AUTORIDE') => {
  if (res.headersSent) return res;
  if (err instanceof AutoRideError) {
    if (err.extra && err.extra.retryAfter) res.set('Retry-After', String(err.extra.retryAfter));
    return res.status(err.status).json({ code: err.code, message: err.message, ...(err.extra || {}) });
  }
  if (isUniqueError(err)) {
    return res.status(409).json({ code: 'CONFLICT', message: 'That changed just now. Please refresh and try again.' });
  }
  console.error(`[${tag}_ERR]`, err && err.stack ? err.stack : err);
  return res.status(500).json({ code: 'SERVER_ERROR', message: FRIENDLY_SERVER_ERROR });
};

/** Wraps an async handler so thrown AutoRideErrors become JSON replies. */
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

/** Number in [min, max] or null when absent; throws on a present-but-invalid value. */
const num = (v, { min = 0, max = Number.MAX_SAFE_INTEGER, int = false, field = 'value', label } = {}) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (typeof v === 'boolean' || !Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) {
    throw fail(400, 'INVALID_INPUT', `${label || field} must be ${int ? 'a whole number' : 'a number'} between ${min} and ${max}.`, { field });
  }
  return int ? n : Math.round(n * 100) / 100;
};
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const ymd = (v, field) => {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).slice(0, 10);
  if (!YMD_RE.test(s) || Number.isNaN(new Date(`${s}T00:00:00Z`).getTime())) throw fail(400, 'INVALID_INPUT', `${field} must be a date (YYYY-MM-DD).`, { field });
  return s;
};
const parseTime = (v, field) => {
  const d = v instanceof Date ? v : new Date(String(v || ''));
  if (!v || Number.isNaN(d.getTime())) throw fail(400, 'INVALID_INPUT', `${field} must be a date and time.`, { field });
  return d;
};
const bool = (v) => v === true || v === 'true' || v === 1 || v === '1';

const normalizeReg = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
const REG_RE = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/;

/** Short unambiguous booking code (no 0/O/1/I). Unique index auto_bookings_code backs it. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newBookingCode = () => {
  let s = 'ZA';
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  return s;
};
const newPin = () => String(crypto.randomInt(0, 10000)).padStart(4, '0');

// ── In-memory rate limits (per account, sliding window). One Render instance; resets on restart.
const buckets = new Map();
setInterval(() => {
  const t = Date.now();
  for (const [k, list] of buckets) if (!list.length || t - list[list.length - 1] > 24 * 60 * 60 * 1000) buckets.delete(k);
}, 30 * 60 * 1000).unref?.();

const LIMITS = {
  hold: { max: Number(process.env.AUTO_RIDE_HOLDS_PER_10MIN) || 20, windowMs: 10 * 60 * 1000, message: 'Too many seat holds. Please wait a few minutes and try again.' },
  confirm: { max: 30, windowMs: 10 * 60 * 1000, message: 'Too many attempts. Please wait a few minutes and try again.' },
  private_request: { max: Number(process.env.AUTO_RIDE_PRIVATE_PER_HOUR) || 6, windowMs: 60 * 60 * 1000, message: 'Too many full-auto requests. Please wait a while and try again.' },
  incident: { max: 10, windowMs: 24 * 60 * 60 * 1000, message: 'Too many reports today. Our team is already looking at the ones you sent.' },
  driver_write: { max: 120, windowMs: 60 * 60 * 1000, message: 'Too many changes. Please slow down and try again in a while.' },
  check_in: { max: 60, windowMs: 10 * 60 * 1000, message: 'Too many check-in attempts. Please wait a few minutes.' },
};

/** Throws 429 when the account is over the limit, otherwise records the hit. */
const hit = (kind, id) => {
  const cfg = LIMITS[kind];
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

/** Admin audit row (same table as the rest of the admin panel: VerificationLog). Never throws. */
const audit = async (req, targetId, action, details) => {
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
    console.warn('[AUTORIDE_AUDIT_WARN]', err.message);
  }
};

const noStore = (req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); };

module.exports = {
  AutoRideError, fail, sendError, handler, isUniqueError, cleanText, isUuid, num, money, ymd, parseTime, bool,
  normalizeReg, REG_RE, newBookingCode, newPin, hit, resetLimits, audit, noStore, UUID_RE,
};
