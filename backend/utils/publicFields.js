// Fields that public (unauthenticated) store / menu endpoints must never return.
// Admin endpoints (/api/admin/*) keep the full rows.
const STORE_SECRET_FIELDS = ['password', 'commissionRate', 'commissionType'];
const ITEM_SECRET_FIELDS = ['password', 'customCommission', 'ownerName', 'ownerPhone'];

const strip = (obj, fields) => {
  if (!obj || typeof obj !== 'object') return obj;
  for (const f of fields) delete obj[f];
  return obj;
};

// Both mutate and return the plain object they are given (call on toJSON() output, not model rows).
const stripStoreSecrets = (json) => strip(json, STORE_SECRET_FIELDS);
const stripItemSecrets = (json) => strip(json, ITEM_SECRET_FIELDS);

module.exports = { stripStoreSecrets, stripItemSecrets, STORE_SECRET_FIELDS, ITEM_SECRET_FIELDS };
