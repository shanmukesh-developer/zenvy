const { isProduction, FRIENDLY_SERVER_ERROR } = require('../utils/env');

const errorHandler = (err, req, res, _next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  console.error('[UNHANDLED_ROUTE_ERROR]', req.method, req.originalUrl, err && err.stack ? err.stack : err);
  res.status(statusCode);
  const prod = isProduction();
  res.json({
    success: false,
    message: prod && statusCode >= 500 ? FRIENDLY_SERVER_ERROR : (err.message || FRIENDLY_SERVER_ERROR),
    code: err.code || 'INTERNAL_SERVER_ERROR',
    stack: prod ? null : err.stack,
  });
};

module.exports = { errorHandler };
