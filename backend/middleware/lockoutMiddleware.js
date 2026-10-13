const failedLogins = new Map();

const LOCK_WINDOW_MS = 15 * 60 * 1000;

// Clean up expired locks AND stale partial counts every 15 minutes (the map must not grow forever).
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of failedLogins.entries()) {
    if ((record.lockTime && now > record.lockTime) || (!record.lockTime && now - (record.lastAt || 0) > LOCK_WINDOW_MS)) {
      failedLogins.delete(key);
    }
  }
}, LOCK_WINDOW_MS).unref?.();

// One key per account, however it is typed: '+91 98…', '098…' and '98…' are the same rider, and
// 'Pizza ', 'pizza' and 'PIZZA' the same store. Falls back to the IP only when no identifier is sent.
const lockoutKey = (req) => {
  const body = req.body || {};
  const raw = body.phone || body.email || body.id || body.name || body.identifier;
  const scope = req.baseUrl || '';
  if (!raw) return `${scope}|ip:${req.ip}`;
  const text = String(raw).trim().toLowerCase();
  const digits = text.replace(/\D/g, '');
  if (!text.includes('@') && digits.length >= 10 && /^[+\d\s()-]+$/.test(text)) {
    const { normalizePhone } = require('../utils/phoneUtils');
    return `${scope}|phone:${normalizePhone(text)}`;
  }
  return `${scope}|id:${text.replace(/\s+/g, ' ')}`;
};

// Account-level lock, keyed by the resolved account id (not by whatever body field the client
// used). Controllers that accept several identifier fields (store login: phone, partnerPhone,
// id, email, name, identifier) call these after resolving the account, so switching fields can
// never reset the count.
const MAX_FAILS = 5;
const isAccountLocked = (key) => {
  const record = failedLogins.get(key);
  if (!record || record.count < MAX_FAILS) return false;
  if (Date.now() < record.lockTime) return true;
  failedLogins.delete(key);
  return false;
};
const recordAccountFailure = (key) => {
  const current = failedLogins.get(key) || { count: 0, lockTime: 0 };
  current.count += 1;
  current.lastAt = Date.now();
  if (current.count >= MAX_FAILS) current.lockTime = Date.now() + LOCK_WINDOW_MS;
  failedLogins.set(key, current);
};
const clearAccountFailures = (key) => failedLogins.delete(key);

const accountLockout = (req, res, next) => {
  const key = lockoutKey(req);
  const record = failedLogins.get(key);

  if (record && record.count >= 5) {
    if (Date.now() < record.lockTime) {
      return res.status(429).json({
        message: 'Account locked due to too many failed login attempts. Try again in 15 minutes.'
      });
    } else {
      failedLogins.delete(key);
    }
  }

  // Intercept the response to track success/failure
  const originalSend = res.send;
  res.send = function (body) {
    const statusCode = res.statusCode;
    if (statusCode >= 200 && statusCode < 300) {
      failedLogins.delete(key);
    } else if (statusCode === 401 || statusCode === 400) {
      const current = failedLogins.get(key) || { count: 0, lockTime: 0 };
      current.count += 1;
      current.lastAt = Date.now();
      if (current.count >= 5) {
        current.lockTime = Date.now() + 15 * 60 * 1000; // 15 mins lock
      }
      failedLogins.set(key, current);
    }
    return originalSend.apply(this, arguments);
  };

  next();
};

module.exports = { accountLockout, isAccountLocked, recordAccountFailure, clearAccountFailures };
