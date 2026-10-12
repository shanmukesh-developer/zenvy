const { FRIENDLY_SERVER_ERROR } = require('./env');

// 500 reply for unexpected errors: the real error is logged here, the client gets a fixed friendly
// message (never Sequelize / SQL text, table or column names).
const sendServerError = (res, err, tag = '[SERVER_ERROR]') => {
  console.error(tag, err && err.stack ? err.stack : err);
  if (res.headersSent) return res;
  return res.status(500).json({ success: false, message: FRIENDLY_SERVER_ERROR });
};

module.exports = { sendServerError };
