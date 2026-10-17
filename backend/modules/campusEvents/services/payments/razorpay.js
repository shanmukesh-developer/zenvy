// Razorpay provider boundary (online payments for paid events). OFF until every one of
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET   (Render env, never in code)
//   CAMPUS_EVENTS_ONLINE_PAY_ENABLED                                 (env =1 or GlobalConfig row true)
// is set; until then every online-payment endpoint answers 503 PAYMENT_NOT_CONFIGURED.
// Rules: amounts are server-computed paise; the app's "payment success" screen is never proof: only a
// webhook with a valid X-Razorpay-Signature (HMAC-SHA256 of the RAW body, constant-time compare) marks a
// payment captured; webhook deliveries are de-duplicated by x-razorpay-event-id. No card data touches Zenvy.
// HTTP goes through axios (tests swap it with setHttp()).
const crypto = require('crypto');
const { fail, safeEqual } = require('../util');

const API = 'https://api.razorpay.com/v1';
let http = null;
const setHttp = (fn) => { http = fn; };
const client = () => http || require('axios');

const keys = () => ({
  keyId: String(process.env.RAZORPAY_KEY_ID || '').trim(),
  keySecret: String(process.env.RAZORPAY_KEY_SECRET || '').trim(),
  webhookSecret: String(process.env.RAZORPAY_WEBHOOK_SECRET || '').trim(),
});
const keysPresent = () => { const k = keys(); return !!(k.keyId && k.keySecret && k.webhookSecret); };

/** Online payments usable right now (keys + switch). */
const configured = async () => keysPresent() && (await require('../flag').readOnlineFlag());
const assertConfigured = async () => {
  if (!(await configured())) throw fail(503, 'PAYMENT_NOT_CONFIGURED', 'Online payment is not available yet. Choose pay at venue if the organizer offers it.');
};

const auth = () => { const k = keys(); return { username: k.keyId, password: k.keySecret }; };

/** Creates a Razorpay order. Returns { id, amount, currency }. */
const createOrder = async ({ amountPaise, receipt, notes }) => {
  const res = await client().post(`${API}/orders`, { amount: amountPaise, currency: 'INR', receipt: String(receipt).slice(0, 40), notes: notes || {} }, { auth: auth(), timeout: 10000 });
  const d = res && res.data;
  if (!d || !d.id) throw fail(502, 'PAYMENT_PROVIDER_ERROR', 'Could not start the payment. Please try again.');
  return { id: String(d.id), amount: Number(d.amount), currency: d.currency || 'INR' };
};

/** Refunds a captured payment. Returns { id }. */
const refund = async ({ paymentId, amountPaise }) => {
  const res = await client().post(`${API}/payments/${encodeURIComponent(paymentId)}/refund`, { amount: amountPaise, speed: 'normal' }, { auth: auth(), timeout: 10000 });
  const d = res && res.data;
  if (!d || !d.id) throw new Error('refund not accepted');
  return { id: String(d.id) };
};

/** Webhook signature: hex HMAC-SHA256 of the raw body with the webhook secret. */
const verifyWebhookSignature = (rawBody, signature) => {
  const k = keys();
  if (!k.webhookSecret || !signature || !Buffer.isBuffer(rawBody)) return false;
  const expected = crypto.createHmac('sha256', k.webhookSecret).update(rawBody).digest('hex');
  return safeEqual(expected, String(signature).trim());
};

module.exports = { configured, assertConfigured, keysPresent, keys, createOrder, refund, verifyWebhookSignature, setHttp };
