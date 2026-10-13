// PHASE STUB (Connect, Phase 4): only an active match may chat (no calls, decision D6); unmatch / block
// stops delivery even on an already-joined socket. Allows everything until then; the base rules in
// guards/index.js (membership, closedAt) still apply.
const connectGuard = async (_conversation, _userId, _action) => ({ ok: true });

module.exports = { connectGuard };
