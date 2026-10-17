// CeAuditLog: edits, approvals, cancellations, refunds, overrides, roster changes, payment marks.
// Admin actions are mirrored into VerificationLog (util.adminAudit) like the rest of the admin panel.
// write(t?) joins the caller's transaction when given (the audit row commits or rolls back with the change).
const { getModel } = require('../index');
const clock = require('./clock');

const roleOf = (req, fallback) => {
  if (!req || !req.user) return fallback || 'system';
  return String(req.user.role || '').toLowerCase() === 'admin' ? 'admin' : (fallback || 'user');
};

const write = async ({ eventId = null, teamId = null, registrationId = null, actorUserId = null, actorRole = 'system', action, details = {} }, t) => {
  try {
    await getModel('CeAuditLog').create({
      eventId, teamId, registrationId, actorUserId, actorRole, action, details: details || {}, at: clock.now(),
    }, t ? { transaction: t } : {});
  } catch (err) {
    if (t) throw err; // inside a transaction the change must not commit without its audit row
    console.warn('[CAMPUS_EVENTS_AUDIT_WARN]', err.message);
  }
};

/** From a request: actor = req.user. */
const fromReq = (req, entry, t, fallbackRole) => write({ ...entry, actorUserId: req && req.user ? req.user.id : null, actorRole: roleOf(req, fallbackRole) }, t);

module.exports = { write, fromReq, roleOf };
