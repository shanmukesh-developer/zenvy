// Small shared helpers for Rentals: errors, text cleaning, numbers, rate limits, audit.
const { FRIENDLY_SERVER_ERROR } = require('../../../utils/env');

class RentalsError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra || null;
  }
}
const fail = (status, code, message, extra) => new RentalsError(status, code, message, extra);

/** Known errors -> { code, message, ...extra }; anything else -> friendly 500 (details logged). */
const sendError = (res, err, tag = 'RENTALS') => {
  if (res.headersSent) return res;
  if (err instanceof RentalsError) {
    return res.status(err.status).json({ code: err.code, message: err.message, ...(err.extra || {}) });
  }
  console.error(`[${tag}_ERR]`, err && err.stack ? err.stack : err);
  return res.status(500).json({ code: 'SERVER_ERROR', message: FRIENDLY_SERVER_ERROR });
};

/** Wraps an async handler so thrown RentalsErrors become JSON replies. */
const handler = (fn, tag) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    sendError(res, err, tag);
  }
};

// Control characters (except newline / tab) and angle brackets are removed; whitespace collapsed.
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
  if (!Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) {
    throw fail(400, 'INVALID_INPUT', `${label || field} must be ${int ? 'a whole number' : 'a number'} between ${min} and ${max}.`, { field });
  }
  return int ? n : Math.round(n * 100) / 100;
};

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ── In-memory rate limits (per user, sliding window). Fine for one Render instance; resets on restart.
const buckets = new Map(); // key -> timestamps[]
setInterval(() => {
  const now = Date.now();
  for (const [k, list] of buckets) if (!list.length || now - list[list.length - 1] > 24 * 60 * 60 * 1000) buckets.delete(k);
}, 30 * 60 * 1000).unref?.();

const LIMITS = {
  listing_create: { max: Number(process.env.RENTALS_LISTINGS_PER_DAY) || 5, windowMs: 24 * 60 * 60 * 1000, message: 'You can add up to 5 vehicles a day. Please try again tomorrow.' },
  booking_request: { max: Number(process.env.RENTALS_REQUESTS_PER_HOUR) || 10, windowMs: 60 * 60 * 1000, message: 'Too many booking requests. Please wait a while and try again.' },
  report: { max: 10, windowMs: 24 * 60 * 60 * 1000, message: 'Too many reports today. Our team is already looking at the ones you sent.' },
  licence: { max: 6, windowMs: 24 * 60 * 60 * 1000, message: 'Too many licence uploads today. Please try again tomorrow.' },
  listing_write: { max: 60, windowMs: 60 * 60 * 1000, message: 'Too many changes. Please slow down and try again in a while.' },
};

/** Throws 429 when the user is over the limit, otherwise records the hit. */
const hit = (kind, userId) => {
  const cfg = LIMITS[kind];
  if (!cfg) return;
  const key = `${kind}:${userId}`;
  const now = Date.now();
  const list = (buckets.get(key) || []).filter((t) => now - t < cfg.windowMs);
  if (list.length >= cfg.max) {
    buckets.set(key, list);
    const retryAfter = Math.max(1, Math.ceil((cfg.windowMs - (now - list[0])) / 1000));
    throw fail(429, 'RATE_LIMITED', cfg.message, { retryAfter });
  }
  list.push(now);
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
      adminId: req.user && req.user.id ? String(req.user.id) : 'admin',
      targetId: targetId ? String(targetId) : 'global',
      action,
      details: JSON.stringify(details || {}).slice(0, 8000),
    });
  } catch (err) {
    console.warn('[RENTALS_AUDIT_WARN]', err.message);
  }
};

module.exports = { RentalsError, fail, sendError, handler, cleanText, isUuid, num, money, hit, resetLimits, audit, UUID_RE };
