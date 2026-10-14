// Phase 4 — Connect: idempotent, additive-only migrations. Called by friendsMigrations.js with
// (sequelize, helpers = { run, addCheck, addColumn, isPg, dialect, quoteList }) on every boot.
//  - mirrors every model index with CREATE [UNIQUE] INDEX IF NOT EXISTS (cm_pair_uq makes "one match per
//    pair" a database rule; cs_uq "one swipe per direction");
//  - Postgres CHECKs: statuses, swipe action, photo position 0..5, an ordered pair (low < high, so the
//    pair (a,b) and (b,a) can never both exist), no self swipe.
// Rollback: turn the connect flag off (API answers FEATURE_OFF); optionally drop ConnectMatches,
// ConnectSwipes, ConnectPhotos and ConnectProfiles after an export (and delete CampusMedia rows with
// purpose 'connect' / 'liveness_selfie'). Connect chats are Conversations with refType 'connect'.
// Nothing existing is altered.
const C = require('../models/connect/enums');

const INDEXES = [
  ['cp_user_uq', true, 'ConnectProfiles', '"userId"'],
  ['cp_discover', false, 'ConnectProfiles', '"campusId", "status", "lastActiveAt"'],
  ['cp_liveness', false, 'ConnectProfiles', '"livenessStatus", "livenessSubmittedAt"'],
  ['cph_uq', true, 'ConnectPhotos', '"userId", "position"'],
  ['cph_status', false, 'ConnectPhotos', '"status", "createdAt"'],
  ['cs_uq', true, 'ConnectSwipes', '"fromUserId", "toUserId"'],
  ['cs_to', false, 'ConnectSwipes', '"toUserId", "action"'],
  ['cm_pair_uq', true, 'ConnectMatches', '"userLowId", "userHighId"'],
  ['cm_low', false, 'ConnectMatches', '"userLowId", "status"'],
  ['cm_high', false, 'ConnectMatches', '"userHighId", "status"'],
  ['cm_ended', false, 'ConnectMatches', '"status", "endedAt"'],
];

module.exports = {
  INDEXES,
  async run(sequelize, h) {
    const { run, addCheck, quoteList } = h;
    for (const [name, unique, table, cols] of INDEXES) {
      await run(`idx ${name}`, `CREATE ${unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${name}" ON "${table}" (${cols});`);
    }
    await addCheck('ConnectProfiles', 'cp_status_chk', `"status" IN (${quoteList(C.PROFILE_STATUS)})`);
    await addCheck('ConnectProfiles', 'cp_mod_chk', `"modStatus" IN (${quoteList(C.MOD_STATUS)})`);
    await addCheck('ConnectProfiles', 'cp_liveness_chk', `"livenessStatus" IN (${quoteList(C.LIVENESS_STATUS)})`);
    await addCheck('ConnectPhotos', 'cph_status_chk', `"status" IN (${quoteList(C.PHOTO_STATUS)})`);
    await addCheck('ConnectPhotos', 'cph_position_chk', `"position" BETWEEN 0 AND ${C.PHOTOS_MAX - 1}`);
    await addCheck('ConnectSwipes', 'cs_action_chk', `"action" IN (${quoteList(C.SWIPE_ACTIONS)})`);
    await addCheck('ConnectSwipes', 'cs_not_self_chk', '"fromUserId" <> "toUserId"');
    await addCheck('ConnectMatches', 'cm_status_chk', `"status" IN (${quoteList(C.MATCH_STATUS)})`);
    await addCheck('ConnectMatches', 'cm_order_chk', '"userLowId" < "userHighId"');
  },
};
