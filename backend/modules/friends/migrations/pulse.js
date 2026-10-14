// Phase 2 — Pulse: idempotent, additive-only migrations. Called by friendsMigrations.js with
// (sequelize, helpers = { run, addCheck, addColumn, isPg, dialect, quoteList }) on every boot.
//  - mirrors every model index with CREATE [UNIQUE] INDEX IF NOT EXISTS;
//  - Postgres CHECK constraints for kinds / statuses / reply policy / poll option / counters;
//  - imports old Campus Whispers as anonymous Pulse posts (decision D3). The import is keyed by
//    (authorId, clientId = whisper id), so it never creates a post twice and never re-creates one the
//    author deleted. It runs in the background so it never delays startup; admins can re-run it with
//    POST /api/campus/pulse/admin/backfill-whispers.
// Rollback: turn the pulse flag off (API answers FEATURE_OFF); optionally drop FriendsPosts,
// FriendsPolls, FriendsPollVotes, FriendsHashtags and FriendsPostHashtags after an export.
// Nothing existing is altered; CampusWhispers rows are only read.
const P = require('../models/pulse/enums');

const INDEXES = [
  ['fpo_feed', false, 'FriendsPosts', '"campusId", "status", "createdAt", "id"'],
  ['fpo_root', false, 'FriendsPosts', '"rootId", "createdAt"'],
  ['fpo_parent', false, 'FriendsPosts', '"parentId", "createdAt"'],
  ['fpo_author', false, 'FriendsPosts', '"authorId", "createdAt"'],
  ['fpo_entity', false, 'FriendsPosts', '"entityId", "createdAt"'],
  ['fpo_space', false, 'FriendsPosts', '"spaceId"'],
  ['fpo_client_uq', true, 'FriendsPosts', '"authorId", "clientId"'],
  ['fpl_post_uq', true, 'FriendsPolls', '"postId"'],
  ['fpv_uq', true, 'FriendsPollVotes', '"pollId", "userId"'],
  ['fpv_poll', false, 'FriendsPollVotes', '"pollId", "optionIdx"'],
  ['fht_uq', true, 'FriendsHashtags', '"campusId", "tag"'],
  ['fht_recent', false, 'FriendsHashtags', '"campusId", "lastUsedAt"'],
  ['fph_uq', true, 'FriendsPostHashtags', '"postId", "hashtagId"'],
  ['fph_trend', false, 'FriendsPostHashtags', '"campusId", "createdAt"'],
  ['fph_tag', false, 'FriendsPostHashtags', '"hashtagId", "createdAt"'],
];

module.exports = {
  INDEXES,
  async run(sequelize, h) {
    const { run, addCheck, quoteList } = h;
    for (const [name, unique, table, cols] of INDEXES) {
      await run(`idx ${name}`, `CREATE ${unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${name}" ON "${table}" (${cols});`);
    }

    await addCheck('FriendsPosts', 'fpo_kind_chk', `"kind" IN (${quoteList(P.POST_KINDS)})`);
    await addCheck('FriendsPosts', 'fpo_status_chk', `"status" IN (${quoteList(P.POST_STATUS)})`);
    await addCheck('FriendsPosts', 'fpo_policy_chk', `"replyPolicy" IN (${quoteList(P.REPLY_POLICIES)})`);
    await addCheck('FriendsPosts', 'fpo_source_chk', `"source" IN (${quoteList(P.POST_SOURCES)})`);
    await addCheck('FriendsPosts', 'fpo_counts_chk', '"likeCount" >= 0 AND "replyCount" >= 0 AND "repostCount" >= 0');
    await addCheck('FriendsPosts', 'fpo_anon_chk', 'NOT ("isAnonymous" AND "entityId" IS NOT NULL)');
    await addCheck('FriendsPollVotes', 'fpv_option_chk', `"optionIdx" BETWEEN 0 AND ${P.POLL_MAX_OPTIONS - 1}`);
    await addCheck('FriendsHashtags', 'fht_count_chk', '"postCount" >= 0');

    // Old whispers -> anonymous Pulse posts, in the background (startup never waits for it).
    if (process.env.FRIENDS_SKIP_WHISPER_BACKFILL !== '1') {
      const { backfillWhispers } = require('../scripts/backfill_whispers');
      setTimeout(() => {
        backfillWhispers(sequelize).catch((err) => console.warn(`⚠️ [FRIENDS_MIGRATION_WARN] whisper backfill: ${err.message}`));
      }, 0);
    }
  },
};
