// PHASE STUB (Tasks, Phase 3): decides who may join / send / call in a task conversation
// (only the poster and the accepted helper, while the task allows it). Allows everything until then;
// the base rules in guards/index.js (membership, closedAt) still apply.
const taskGuard = async (_conversation, _userId, _action) => ({ ok: true });

module.exports = { taskGuard };
