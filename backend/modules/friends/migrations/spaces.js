// Phase 5 — Spaces: idempotent, additive-only migrations. Called by friendsMigrations.js with
// (sequelize, helpers = { run, addCheck, addColumn, isPg, dialect, quoteList }) on every boot.
//  - mirrors every model index with CREATE [UNIQUE] INDEX IF NOT EXISTS;
//  - the partial unique fsp_one_live: a host has at most ONE live Space (SQLite and Postgres both
//    support partial indexes), so parallel "start now" requests can never create two;
//  - Postgres CHECK constraints: statuses, roles, participation, caps, non-negative counters,
//    "a live Space has started", "a finished Space has an end time".
// Rollback: turn the spaces flag off (the API answers FEATURE_OFF and space:* socket events ack
// FEATURE_OFF); optionally drop FriendsSpaceReminders, FriendsSpaceMembers and FriendsSpaces after an
// export. Space cards in FriendsPosts (kind 'space_card') stay hidden while the flag is off. Nothing
// existing is altered.
const S = require('../models/spaces/enums');

const INDEXES = [
  ['fsp_list', false, 'FriendsSpaces', '"campusId", "status", "scheduledFor"'],
  ['fsp_host', false, 'FriendsSpaces', '"hostId", "status"'],
  ['fsp_due', false, 'FriendsSpaces', '"status", "scheduledFor"'],
  ['fsp_client_uq', true, 'FriendsSpaces', '"hostId", "clientId"'],
  ['fsm_uq', true, 'FriendsSpaceMembers', '"spaceId", "userId"'],
  ['fsm_live', false, 'FriendsSpaceMembers', '"spaceId", "leftAt"'],
  ['fsm_user', false, 'FriendsSpaceMembers', '"userId", "createdAt"'],
  ['fsr_uq', true, 'FriendsSpaceReminders', '"spaceId", "userId"'],
  ['fsr_due', false, 'FriendsSpaceReminders', '"sentAt", "spaceId"'],
];

module.exports = {
  INDEXES,
  async run(sequelize, h) {
    const { run, addCheck, quoteList } = h;
    for (const [name, unique, table, cols] of INDEXES) {
      await run(`idx ${name}`, `CREATE ${unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${name}" ON "${table}" (${cols});`);
    }
    // One live Space per host: create / start rely on this as the last line of defence.
    await run('idx fsp_one_live', 'CREATE UNIQUE INDEX IF NOT EXISTS "fsp_one_live" ON "FriendsSpaces" ("hostId") WHERE "status" = \'live\';');

    await addCheck('FriendsSpaces', 'fsp_status_chk', `"status" IN (${quoteList(S.SPACE_STATUS)})`);
    await addCheck('FriendsSpaces', 'fsp_mod_chk', `"modStatus" IN (${quoteList(S.MOD_STATUS)})`);
    await addCheck('FriendsSpaces', 'fsp_participation_chk', `"participation" IN (${quoteList(S.PARTICIPATION)})`);
    await addCheck('FriendsSpaces', 'fsp_visibility_chk', `"visibility" IN (${quoteList(S.VISIBILITY)})`);
    await addCheck('FriendsSpaces', 'fsp_end_reason_chk', `"endReason" IS NULL OR "endReason" IN (${quoteList(S.END_REASONS)})`);
    await addCheck('FriendsSpaces', 'fsp_caps_chk', '"maxSpeakers" BETWEEN 2 AND 12 AND "maxListeners" BETWEEN 1 AND 200 AND "peakListeners" >= 0');
    await addCheck('FriendsSpaces', 'fsp_live_chk', '"status" <> \'live\' OR "startedAt" IS NOT NULL');
    await addCheck('FriendsSpaces', 'fsp_ended_chk', '"status" NOT IN (\'ended\', \'cancelled\', \'expired\') OR "endedAt" IS NOT NULL');
    await addCheck('FriendsSpaceMembers', 'fsm_role_chk', `"role" IN (${quoteList(S.ROLES)})`);
    await addCheck('FriendsSpaceReminders', 'fsr_skip_chk', `"skippedReason" IS NULL OR "skippedReason" IN (${quoteList(S.REMINDER_SKIP)})`);
  },
};
