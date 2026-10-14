// Phase 3 — Tasks: idempotent, additive-only migrations. Called by friendsMigrations.js with
// (sequelize, helpers = { run, addCheck, addColumn, isPg, dialect, quoteList }) on every boot.
//  - mirrors every model index with CREATE [UNIQUE] INDEX IF NOT EXISTS;
//  - the partial unique fta_one_active: at most ONE selected/accepted application per task, enforced
//    by the database (SQLite and Postgres both support partial indexes);
//  - Postgres CHECK constraints: statuses, category, fulfillment, reward 0..50000, rating 1..5,
//    non-negative counters, "an assigned / running / finished task has a helper", "the helper is not
//    the poster", "a reviewer does not review themself".
// Rollback: turn the tasks flag off (API answers FEATURE_OFF); optionally drop FriendsTaskReviews,
// FriendsTaskApplications and FriendsTasks after an export. Task conversations are ordinary
// Conversations rows (refType 'task') and stay readable. Nothing existing is altered.
const T = require('../models/tasks/enums');

const INDEXES = [
  ['ft_board', false, 'FriendsTasks', '"campusId", "status", "modStatus", "createdAt"'],
  ['ft_deadline', false, 'FriendsTasks', '"status", "deadlineAt"'],
  ['ft_submitted', false, 'FriendsTasks', '"status", "submittedAt"'],
  ['ft_poster', false, 'FriendsTasks', '"posterId", "createdAt"'],
  ['ft_helper', false, 'FriendsTasks', '"helperId", "createdAt"'],
  ['ft_client_uq', true, 'FriendsTasks', '"posterId", "clientId"'],
  ['fta_uq', true, 'FriendsTaskApplications', '"taskId", "applicantId"'],
  ['fta_task', false, 'FriendsTaskApplications', '"taskId", "status", "createdAt"'],
  ['fta_applicant', false, 'FriendsTaskApplications', '"applicantId", "createdAt"'],
  ['ftr_uq', true, 'FriendsTaskReviews', '"taskId", "reviewerId"'],
  ['ftr_reviewee', false, 'FriendsTaskReviews', '"revieweeId", "createdAt"'],
];

module.exports = {
  INDEXES,
  async run(sequelize, h) {
    const { run, addCheck, quoteList } = h;
    for (const [name, unique, table, cols] of INDEXES) {
      await run(`idx ${name}`, `CREATE ${unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${name}" ON "${table}" (${cols});`);
    }
    // One helper per task: the select / accept transitions rely on this as the last line of defence.
    await run('idx fta_one_active', `CREATE UNIQUE INDEX IF NOT EXISTS "fta_one_active" ON "FriendsTaskApplications" ("taskId") WHERE "status" IN (${quoteList(T.ONE_HELPER_STATUS)});`);

    await addCheck('FriendsTasks', 'ft_status_chk', `"status" IN (${quoteList(T.TASK_STATUS)})`);
    await addCheck('FriendsTasks', 'ft_mod_chk', `"modStatus" IN (${quoteList(T.MOD_STATUS)})`);
    await addCheck('FriendsTasks', 'ft_category_chk', `"category" IN (${quoteList(T.CATEGORIES)})`);
    await addCheck('FriendsTasks', 'ft_fulfillment_chk', `"fulfillment" IN (${quoteList(T.FULFILLMENT)})`);
    await addCheck('FriendsTasks', 'ft_reward_chk', `"rewardInr" BETWEEN ${T.REWARD_MIN} AND ${T.REWARD_MAX}`);
    await addCheck('FriendsTasks', 'ft_counts_chk', '"applicationCount" >= 0 AND "submissionRejections" >= 0');
    await addCheck('FriendsTasks', 'ft_helper_chk', `"status" NOT IN ('assigned', 'in_progress', 'submitted', 'completed', 'disputed') OR "helperId" IS NOT NULL`);
    await addCheck('FriendsTasks', 'ft_not_self_chk', '"helperId" IS NULL OR "helperId" <> "posterId"');
    await addCheck('FriendsTaskApplications', 'fta_status_chk', `"status" IN (${quoteList(T.APPLICATION_STATUS)})`);
    await addCheck('FriendsTaskReviews', 'ftr_rating_chk', '"rating" BETWEEN 1 AND 5');
    await addCheck('FriendsTaskReviews', 'ftr_role_chk', `"revieweeRole" IN ('poster', 'helper')`);
    await addCheck('FriendsTaskReviews', 'ftr_self_chk', '"reviewerId" <> "revieweeId"');
  },
};
