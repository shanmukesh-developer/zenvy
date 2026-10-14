/**
 * Connect liveness provider boundary (friends_plan.md §7). One adapter per provider:
 *
 *   manual (default, free): the app shows a random gesture prompt, the user takes a selfie doing it
 *     (private CampusMedia purpose 'liveness_selfie'), an admin compares it with the person's Connect
 *     photos and passes or fails it. The selfie bytes are deleted as soon as the admin decides.
 *   aws / persona / ...: not implemented yet. Selecting one without an adapter means "not configured":
 *     Connect answers 503 LIVENESS_NOT_CONFIGURED (fail closed) until an adapter + keys are added here.
 *
 * Env:
 *   LIVENESS_PROVIDER         manual (default) | aws | persona | ...
 *   CONNECT_REQUIRE_LIVENESS  true (default). 'false' launches Connect on verified DOB + 18+ declaration
 *                             only; the launch report must say so.
 *
 * An adapter = {
 *   name, configured(): bool,
 *   start(profile) -> { mode:'manual', challenge, instructions[], expiresAt } | { mode:'provider', sessionUrl, expiresAt },
 *   verifyWebhook?(req) -> { userId, passed, note } | null   (provider mode only; signature checked)
 * }
 */
const manual = require('./manual');

const ADAPTERS = { manual };

const providerName = () => String(process.env.LIVENESS_PROVIDER || 'manual').trim().toLowerCase() || 'manual';

const required = () => String(process.env.CONNECT_REQUIRE_LIVENESS || 'true').trim().toLowerCase() !== 'false';

/** The active adapter, or null when the selected provider has no adapter / is missing keys. */
const adapter = () => {
  const a = ADAPTERS[providerName()];
  return a && a.configured() ? a : null;
};

const describe = () => {
  const a = adapter();
  return {
    required: required(),
    provider: providerName(),
    configured: !!a,
    mode: a ? (a.name === 'manual' ? 'manual' : 'provider') : null,
  };
};

module.exports = { adapter, describe, required, providerName, ADAPTERS };
