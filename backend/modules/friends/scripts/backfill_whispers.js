/**
 * Decision D3: old Campus Whispers become anonymous Pulse posts.
 *
 *  - One FriendsPost per whisper: source 'whisper', clientId = whisper id, authorId = whisper author,
 *    campusId = the author's campus, original createdAt kept, status 'visible'.
 *  - Idempotent: the unique index fpo_client_uq (authorId, clientId) means a whisper is imported at most
 *    once, and a post the author later deleted (status 'deleted', row kept) is never re-created.
 *  - The old alias is NOT carried over: it was sha256(userId) and the same everywhere, so it could link
 *    whispers together. Each imported post gets a fresh per-thread alias (FriendsAlias "pulse:<postId>").
 *  - Old hearts become likes (FriendsReactions 'like'), except the author's own automatic heart.
 *  - The whisper topic (other than 'General') becomes a hashtag link, so topic pages keep working.
 *  - Whispers whose author has no campus or no longer exists are skipped and counted.
 *  - Text is imported unchanged (old whispers allowed 400 characters).
 *
 * Runs in the background after the Friends migrations on every boot, from POST
 * /api/campus/pulse/admin/backfill-whispers, or by hand:  node modules/friends/scripts/backfill_whispers.js
 * (the CLI form connects with config/db.js, so only run it where DATABASE_URL points at the right DB).
 */
const { Op } = require('sequelize');

const BATCH = 200;
let inFlight = null;

const run = async (sequelize, { log = true } = {}) => {
  const models = sequelize.models;
  const Whisper = models.CampusWhisper;
  const { FriendsPost, CampusProfile, User, FriendsReaction } = models;
  const stats = { scanned: 0, imported: 0, existing: 0, skippedNoCampus: 0, skippedNoUser: 0, skippedEmpty: 0, likes: 0, failed: 0 };
  if (!Whisper || !FriendsPost || !CampusProfile || !User) return { ...stats, skipped: 'models not ready' };

  const alias = require('../services/alias');
  const trends = require('../services/trends');
  const campusOf = new Map();
  let lastCreatedAt = null;
  let lastId = null;

  for (;;) {
    const where = lastCreatedAt
      ? { [Op.or]: [{ createdAt: { [Op.gt]: lastCreatedAt } }, { createdAt: lastCreatedAt, id: { [Op.gt]: lastId } }] }
      : {};
    const batch = await Whisper.findAll({ where, order: [['createdAt', 'ASC'], ['id', 'ASC']], limit: BATCH });
    if (!batch.length) break;
    lastCreatedAt = batch[batch.length - 1].createdAt;
    lastId = batch[batch.length - 1].id;
    stats.scanned += batch.length;

    const done = await FriendsPost.findAll({
      where: { source: 'whisper', clientId: { [Op.in]: batch.map((w) => w.id) } },
      attributes: ['clientId'],
    });
    const imported = new Set(done.map((d) => String(d.clientId)));

    const authorIds = [...new Set(batch.map((w) => String(w.userId)).filter((u) => !campusOf.has(u)))];
    if (authorIds.length) {
      const [profiles, users] = await Promise.all([
        CampusProfile.findAll({ where: { userId: { [Op.in]: authorIds } }, attributes: ['userId', 'campusId'] }),
        User.findAll({ where: { id: { [Op.in]: authorIds } }, attributes: ['id'] }),
      ]);
      const exists = new Set(users.map((u) => String(u.id)));
      const pc = new Map(profiles.map((p) => [String(p.userId), p.campusId]));
      authorIds.forEach((u) => campusOf.set(u, exists.has(u) ? (pc.get(u) || null) : false));
    }

    for (const w of batch) {
      if (imported.has(String(w.id))) { stats.existing++; continue; }
      const campusId = campusOf.get(String(w.userId));
      if (campusId === false) { stats.skippedNoUser++; continue; }
      if (!campusId) { stats.skippedNoCampus++; continue; }
      const text = String(w.text || '').trim();
      if (!text) { stats.skippedEmpty++; continue; }
      try {
        const id = require('crypto').randomUUID();
        let post;
        try {
          post = await FriendsPost.create({
            id,
            campusId,
            authorId: w.userId,
            clientId: w.id,
            source: 'whisper',
            isAnonymous: true,
            aliasName: null,
            kind: 'post',
            text: text.slice(0, 400),
            replyPolicy: 'everyone',
            status: 'visible',
            createdAt: w.createdAt,
          });
        } catch (err) {
          if (/UNIQUE|duplicate key/i.test(String(err.message)) || err.name === 'SequelizeUniqueConstraintError') { stats.existing++; continue; }
          throw err;
        }
        post.aliasName = await alias.getAlias(`pulse:${post.id}`, w.userId);
        await post.save({ fields: ['aliasName'], silent: true });

        const hearts = (Array.isArray(w.hearts) ? w.hearts : []).map(String).filter((u) => u && u !== String(w.userId));
        if (hearts.length && FriendsReaction) {
          const live = await User.findAll({ where: { id: { [Op.in]: [...new Set(hearts)] } }, attributes: ['id'] });
          for (const u of live) {
            try {
              await FriendsReaction.create({ userId: u.id, targetType: 'post', targetId: post.id, kind: 'like' });
              stats.likes++;
            } catch { /* duplicate: fine */ }
          }
          await sequelize.query(
            'UPDATE "FriendsPosts" SET "likeCount" = (SELECT COUNT(*) FROM "FriendsReactions" WHERE "targetType" = \'post\' AND "targetId" = :id AND "kind" = \'like\') WHERE "id" = :id',
            { replacements: { id: post.id } },
          );
        }
        const topic = String(w.topic || '').trim();
        await trends.syncHashtags(post, { extraTags: topic && topic.toLowerCase() !== 'general' ? [topic.replace(/\s+/g, '_')] : [], at: w.createdAt });
        stats.imported++;
      } catch (err) {
        stats.failed++;
        console.warn('[PULSE_BACKFILL_WARN]', err.message);
      }
    }
    if (batch.length < BATCH) break;
  }
  if (log && (stats.imported || stats.failed)) {
    console.log(`✅ [PULSE_BACKFILL] whispers: ${stats.imported} imported, ${stats.existing} already there, ${stats.skippedNoCampus + stats.skippedNoUser} skipped, ${stats.failed} failed.`);
  }
  return stats;
};

/** Imports old whispers; concurrent calls in one process share the same run. */
const backfillWhispers = (sequelize, opts) => {
  if (inFlight) return inFlight;
  inFlight = run(sequelize, opts).finally(() => { inFlight = null; });
  return inFlight;
};

module.exports = { backfillWhispers };

if (require.main === module) {
  (async () => {
    const { connectDB, getSequelize } = require('../../../config/db');
    await connectDB(); // also runs the migrations, which start the same (shared) backfill run
    const s = getSequelize();
    if (!s) throw new Error('database is not initialised');
    console.log(await backfillWhispers(s));
    process.exit(0);
  })().catch((err) => { console.error(err.message); process.exit(1); });
}
