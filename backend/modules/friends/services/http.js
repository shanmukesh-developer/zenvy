// Error shape and handler wrapper for every Friends route: errors are { message, code, ...extra }.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SERVER_ERROR = 'Something went wrong. Please try again.';

class FriendsError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const fail = (status, code, message, extra) => new FriendsError(status, code, message, extra);

const sendError = (res, err, tag = 'FRIENDS') => {
  if (err instanceof FriendsError) {
    return res.status(err.status).json({ message: err.message, code: err.code, ...err.extra });
  }
  if (err && (err.name === 'SequelizeValidationError')) {
    return res.status(400).json({ message: 'Some details are not valid.', code: 'INVALID_INPUT' });
  }
  // Never log request content (anonymous ids, private text); the message is enough.
  console.error(`[${tag}_ERR]`, err && err.message ? err.message : err);
  return res.status(500).json({ message: SERVER_ERROR, code: 'SERVER_ERROR' });
};

/** Wraps an async handler: thrown FriendsErrors become their JSON response, anything else a 500. */
const wrap = (fn, tag) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    if (!res.headersSent) sendError(res, err, tag);
  }
};

const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
const requireUuid = (v, label = 'id') => {
  if (!isUuid(v)) throw fail(400, 'INVALID_ID', `That ${label} is not valid.`);
  return v;
};

const isUniqueError = (err) => !!err && (err.name === 'SequelizeUniqueConstraintError'
  || /UNIQUE constraint failed|duplicate key value/i.test(String(err.message || '')));

/** Short optional text: trimmed, '' -> null, longer than max -> 400. */
const optText = (value, max, field) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw fail(400, 'INVALID_INPUT', `${field} must be text.`, { field });
  const v = value.trim();
  if (!v) return null;
  if (v.length > max) throw fail(400, 'TOO_LONG', `${field} can be at most ${max} characters.`, { field, max });
  return v;
};

module.exports = { FriendsError, fail, sendError, wrap, isUuid, requireUuid, isUniqueError, optText, UUID_RE, SERVER_ERROR };
