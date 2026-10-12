// Fields that public (unauthenticated) store / menu endpoints must never return.
// Admin endpoints (/api/admin/*) keep the full rows.
// phone = the partner's private login phone (customers call the stall on whatsappNumber).
const STORE_SECRET_FIELDS = ['password', 'commissionRate', 'commissionType', 'phone', 'tokenVersion', 'fcmTokens'];
const ITEM_SECRET_FIELDS = ['password', 'customCommission', 'ownerName', 'ownerPhone'];

const strip = (obj, fields) => {
  if (!obj || typeof obj !== 'object') return obj;
  for (const f of fields) delete obj[f];
  return obj;
};

// Both mutate and return the plain object they are given (call on toJSON() output, not model rows).
const stripStoreSecrets = (json) => strip(json, STORE_SECRET_FIELDS);
const stripItemSecrets = (json) => strip(json, ITEM_SECRET_FIELDS);

// A promotion whose featuredUntil has passed is not featured any more (read-time check; the
// featured-expiry cron also clears the row). Mutates and returns the plain store object.
const applyFeaturedExpiry = (json, now = new Date()) => {
  if (json && json.isFeatured && json.featuredUntil && new Date(json.featuredUntil) < now) {
    json.isFeatured = false;
    json.featuredBadge = null;
  }
  return json;
};

module.exports = { stripStoreSecrets, stripItemSecrets, applyFeaturedExpiry, STORE_SECRET_FIELDS, ITEM_SECRET_FIELDS };
