// Load-test rate-limit bypass.
//
// A request skips the RATE LIMITERS (and nothing else) only when it carries the header
// `X-Loadtest-Key` whose value equals env LOADTEST_KEY. With LOADTEST_KEY unset or empty there is
// no bypass at all. Authentication, authorization, account lockout and body validation are never
// touched by this helper: it is only ever used inside express-rate-limit `skip` options.
const crypto = require('crypto');
const { isProduction } = require('./env');

const HEADER = 'x-loadtest-key';

const configuredKey = () => {
  const k = process.env.LOADTEST_KEY;
  return typeof k === 'string' ? k.trim() : '';
};

// Constant-time comparison. Both sides are hashed to equal-length buffers first so
// timingSafeEqual never throws and the key length is not leaked.
const isLoadtestRequest = (req) => {
  const key = configuredKey();
  if (!key) return false;
  const raw = req && req.headers ? req.headers[HEADER] : undefined;
  const sent = Array.isArray(raw) ? raw[0] : raw;
  if (typeof sent !== 'string' || !sent) return false;
  const a = crypto.createHash('sha256').update(sent.trim()).digest();
  const b = crypto.createHash('sha256').update(key).digest();
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Rate limits are enforced in production. RATE_LIMIT_ENFORCE=1 turns them on in a local/dev run
// too (used to test the limiters and this bypass without a production environment).
const rateLimitsActive = () => isProduction() || process.env.RATE_LIMIT_ENFORCE === '1';

// For express-rate-limit `skip`: true = do not count / limit this request.
const skipRateLimit = (req) => !rateLimitsActive() || isLoadtestRequest(req);

let logged = false;
const logLoadtestStatus = () => {
  if (logged) return;
  logged = true;
  console.log(configuredKey()
    ? '[LOADTEST] LOADTEST_KEY is set: requests with a matching X-Loadtest-Key header skip rate limits (auth, lockout and validation still apply).'
    : '[LOADTEST] LOADTEST_KEY is not set: no rate-limit bypass.');
};

module.exports = { isLoadtestRequest, skipRateLimit, rateLimitsActive, logLoadtestStatus, HEADER };
