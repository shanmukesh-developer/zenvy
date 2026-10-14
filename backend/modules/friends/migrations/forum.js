// Phase 1 — Forum: idempotent, additive-only migrations. Called by friendsMigrations.js with
// (sequelize, helpers = { run, addCheck, addColumn, isPg, dialect, quoteList }) on every boot.
//  - mirrors every model index with CREATE [UNIQUE] INDEX IF NOT EXISTS (tables created before an
//    index existed still get it);
//  - the partial unique frv_active_uq: one ACTIVE review per (target, reviewer), enforced by the DB;
//  - Postgres CHECK constraints for statuses / kinds / rating / vote value;
//  - seeds the eight default communities for every active campus (findOrCreate, idempotent).
// Rollback: turn the forum flag off (API answers FEATURE_OFF); optionally drop the FriendsCommunit*,
// FriendsForum*, FriendsVotes, FriendsReview* tables after an export. Nothing existing is altered.
const F = require('../models/forum/enums');

const INDEXES = [
  ['fcm_slug_uq', true, 'FriendsCommunities', '"campusId", "slug"'],
  ['fcm_campus', false, 'FriendsCommunities', '"campusId", "status", "sortOrder"'],
  ['fcr_uq', true, 'FriendsCommunityRoles', '"communityId", "userId"'],
  ['fcr_user', false, 'FriendsCommunityRoles', '"userId"'],
  ['ffp_new', false, 'FriendsForumPosts', '"communityId", "status", "createdAt", "id"'],
  ['ffp_hot', false, 'FriendsForumPosts', '"communityId", "status", "hotRank"'],
  ['ffp_top', false, 'FriendsForumPosts', '"communityId", "status", "score"'],
  ['ffp_author', false, 'FriendsForumPosts', '"authorId"'],
  ['ffp_campus', false, 'FriendsForumPosts', '"campusId", "status", "createdAt"'],
  ['ffp_client_uq', true, 'FriendsForumPosts', '"authorId", "clientId"'],
  ['ffc_post', false, 'FriendsForumComments', '"postId", "createdAt"'],
  ['ffc_parent', false, 'FriendsForumComments', '"parentId"'],
  ['ffc_author', false, 'FriendsForumComments', '"authorId"'],
  ['ffc_client_uq', true, 'FriendsForumComments', '"authorId", "clientId"'],
  ['fv_uq', true, 'FriendsVotes', '"userId", "targetType", "targetId"'],
  ['fv_target', false, 'FriendsVotes', '"targetType", "targetId", "value"'],
  ['fv_karma', false, 'FriendsVotes', '"userId", "targetAuthorId", "karmaAwarded", "updatedAt"'],
  ['frt_uq', true, 'FriendsReviewTargets', '"campusId", "kind", "nameKey"'],
  ['frt_list', false, 'FriendsReviewTargets', '"campusId", "status", "kind"'],
  ['frv_post_uq', true, 'FriendsReviews', '"forumPostId"'],
  ['frv_target', false, 'FriendsReviews', '"targetId", "status", "createdAt"'],
  ['frr_review_uq', true, 'FriendsReviewResponses', '"reviewId"'],
];

module.exports = {
  INDEXES,
  async run(sequelize, h) {
    const { run, addCheck, isPg, quoteList } = h;
    for (const [name, unique, table, cols] of INDEXES) {
      await run(`idx ${name}`, `CREATE ${unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${name}" ON "${table}" (${cols});`);
    }
    // One active review per reviewer per target (deleted / superseded reviews set active=false).
    await run('idx frv_active_uq', `CREATE UNIQUE INDEX IF NOT EXISTS "frv_active_uq" ON "FriendsReviews" ("targetId", "authorId") WHERE "active" = ${isPg ? 'true' : '1'};`);

    await addCheck('FriendsCommunities', 'fcm_kind_chk', `"kind" IN (${quoteList(F.COMMUNITY_KINDS)})`);
    await addCheck('FriendsCommunities', 'fcm_status_chk', `"status" IN (${quoteList(F.COMMUNITY_STATUS)})`);
    await addCheck('FriendsCommunities', 'fcm_counts_chk', '"memberCount" >= 0 AND "postCount" >= 0');
    await addCheck('FriendsCommunityRoles', 'fcr_role_chk', `"role" IN (${quoteList(F.COMMUNITY_ROLES)})`);
    await addCheck('FriendsForumPosts', 'ffp_type_chk', `"type" IN (${quoteList(F.POST_TYPES)})`);
    await addCheck('FriendsForumPosts', 'ffp_status_chk', `"status" IN (${quoteList(F.CONTENT_STATUS)})`);
    await addCheck('FriendsForumPosts', 'ffp_counts_chk', '"upCount" >= 0 AND "downCount" >= 0 AND "commentCount" >= 0');
    await addCheck('FriendsForumComments', 'ffc_status_chk', `"status" IN (${quoteList(F.CONTENT_STATUS)})`);
    await addCheck('FriendsForumComments', 'ffc_depth_chk', `"depth" BETWEEN 0 AND ${F.MAX_DEPTH}`);
    await addCheck('FriendsVotes', 'fv_value_chk', '"value" IN (-1, 1)');
    await addCheck('FriendsVotes', 'fv_target_chk', `"targetType" IN (${quoteList(F.VOTE_TARGETS)})`);
    await addCheck('FriendsReviewTargets', 'frt_kind_chk', `"kind" IN (${quoteList(F.REVIEW_KINDS)})`);
    await addCheck('FriendsReviewTargets', 'frt_status_chk', `"status" IN (${quoteList(F.REVIEW_TARGET_STATUS)})`);
    await addCheck('FriendsReviews', 'frv_rating_chk', '"rating" BETWEEN 1 AND 5');
    await addCheck('FriendsReviews', 'frv_status_chk', `"status" IN (${quoteList(F.REVIEW_STATUS)})`);
    await addCheck('FriendsReviewResponses', 'frr_role_chk', `"responderRole" IN (${quoteList(F.RESPONDER_ROLES)})`);
    await addCheck('FriendsReviewResponses', 'frr_status_chk', `"status" IN (${quoteList(F.RESPONSE_STATUS)})`);

    // Default communities for every active campus (idempotent). Failures only warn.
    try {
      const { seedAllCampuses } = require('../seed/communities');
      await seedAllCampuses(sequelize);
    } catch (err) {
      console.warn(`⚠️ [FRIENDS_MIGRATION_WARN] forum seed: ${err.message}`);
    }
  },
};
