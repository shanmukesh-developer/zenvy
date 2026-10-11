// Single source of truth for "are we running in production?".
// Render sets RENDER=true; NODE_ENV=production is honoured everywhere else.
const isProduction = () => process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

// Friendly text shown to customers instead of raw database / stack messages.
const FRIENDLY_SERVER_ERROR = 'Something went wrong on our side. Please try again in a moment.';

// Fields that must never reach a client in production (raw errors, stacks, SQL details).
const LEAKY_FIELDS = ['error', 'stack', 'details', 'err', 'sql', 'original', 'parent'];

/**
 * Express middleware: in production, strips raw error details from every JSON
 * response and replaces the message of 500 responses with a friendly one.
 * Admin callers keep the raw message (the dashboard uses it for diagnostics), but
 * never the stack. Bodies that already carry a stable `code` keep their message
 * (those messages are written for users).
 */
const sanitizeErrorResponses = (req, res, next) => {
  if (!isProduction()) return next();
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    try {
      if (res.statusCode >= 400 && body && typeof body === 'object' && !Array.isArray(body)) {
        const clean = { ...body };
        const isAdmin = !!(req.user && String(req.user.role || '').toLowerCase() === 'admin');
        delete clean.stack;
        if (!isAdmin) {
          for (const f of LEAKY_FIELDS) delete clean[f];
          if (res.statusCode === 500 && !(typeof body.code === 'string' && body.code !== 'INTERNAL_SERVER_ERROR')) {
            clean.message = FRIENDLY_SERVER_ERROR;
          }
          if (!clean.message) {
            clean.message = res.statusCode >= 500 ? FRIENDLY_SERVER_ERROR : "We couldn't complete that request.";
          }
        }
        return originalJson(clean);
      }
    } catch { /* never break a response because of sanitising */ }
    return originalJson(body);
  };
  next();
};

module.exports = { isProduction, sanitizeErrorResponses, FRIENDLY_SERVER_ERROR };
