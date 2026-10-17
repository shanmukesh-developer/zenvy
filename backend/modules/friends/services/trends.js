/**
 * Pulse hashtags and trends.
 *
 *  extractHashtags(text)   '#Fest2026 #fest2026 #x' -> ['fest2026'] (lower case, 2..40 chars, <= 10, letters /
 *                          digits / underscore, must contain a letter, so '#1' or a colour code is not a tag)
 *  syncHashtags(post)      makes FriendsPostHashtags match the post text (create / edit), race-safe
 *  getTrends(campusId)     top tags of the last 24 h on one campus, ranked by DISTINCT authors, so one
 *                          account spamming a tag counts once; authors with an active Friends / Pulse
 *                          sanction and posts that are not visible are left out; a tag needs at least
 *                          TREND_MIN_AUTHORS different people. Cached in memory for 60 s per campus.
 * Postgres is authoritative; counters are recounted from the link rows.
 */
const { Op } = require('sequelize');
const { getModel, getSequelize } = require('../index');
const { isUniqueError } = require('./http');
const P = require('../models/pulse/enums');

const WINDOW_MS = 24 * 60 * 60 * 1000;
const TTL_MS = 60 * 1000;
const TREND_MIN_AUTHORS = 2;
const TREND_LIMIT = 10;
const cache = new Map(); // campusId -> { at, items }

const TAG_RE = /(^|[^\p{L}\p{N}_&/])#([\p{L}\p{N}_]{2,40})(?![\p{L}\p{N}_])/gu;

/** Normalised, de-duplicated hashtags of a text (without '#'). */
const extractHashtags = (text) => {
  const out = [];
  const seen = new Set();
  const raw = String(text || '');
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(raw)) !== null) {
    const tag = m[2].normalize('NFKC').toLowerCase();
    if (!/\p{L}/u.test(tag) || seen.has(tag)) continue;
    if (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(tag) && /\d/.test(tag)) continue; // colour codes like #ff00aa
    seen.add(tag);
    out.push(tag);
    if (out.length >= P.MAX_HASHTAGS) break;
  }
  return out;
};

/** A tag from a URL path segment, or null when it is not a valid tag. */
const normaliseTag = (raw) => {
  const t = String(raw || '').replace(/^#/, '').normalize('NFKC').toLowerCase();
  if (!/^[\p{L}\p{N}_]{2,40}$/u.test(t) || !/\p{L}/u.test(t)) return null;
  return t;
};

const findOrCreateTag = async (campusId, tag) => {
  const FriendsHashtag = getModel('FriendsHashtag');
  const found = await FriendsHashtag.findOne({ where: { campusId, tag } });
  if (found) return found;
  try {
    return await FriendsHashtag.create({ campusId, tag, lastUsedAt: new Date() });
  } catch (err) {
    if (!isUniqueError(err)) throw err;
    return FriendsHashtag.findOne({ where: { campusId, tag } });
  }
};

/** Recounts postCount (visible posts only) for the given hashtag ids. */
const recountHashtags = async (hashtagIds) => {
  const ids = [...new Set((hashtagIds || []).filter(Boolean).map(String))];
  for (const id of ids) {
    await getSequelize().query(
      `UPDATE "FriendsHashtags" SET "postCount" = (
         SELECT COUNT(*) FROM "FriendsPostHashtags" ph JOIN "FriendsPosts" p ON p."id" = ph."postId"
         WHERE ph."hashtagId" = :id AND p."status" = 'visible') WHERE "id" = :id`,
      { replacements: { id } },
    );
  }
};

/**
 * Makes the post's hashtag links match `tags` (default: parsed from post.text). Returns the tag list.
 * extraTags lets the whisper import attach the old whisper topic.
 */
const syncHashtags = async (post, { extraTags = [], at } = {}) => {
  const FriendsPostHashtag = getModel('FriendsPostHashtag');
  const FriendsHashtag = getModel('FriendsHashtag');
  const wanted = [...new Set([...extractHashtags(post.text), ...extraTags.map(normaliseTag).filter(Boolean)])].slice(0, P.MAX_HASHTAGS);
  const existing = await FriendsPostHashtag.findAll({ where: { postId: post.id }, attributes: ['id', 'hashtagId'] });
  const tagRows = existing.length
    ? await FriendsHashtag.findAll({ where: { id: { [Op.in]: existing.map((e) => e.hashtagId) } }, attributes: ['id', 'tag'] })
    : [];
  const tagOf = new Map(tagRows.map((t) => [String(t.id), t.tag]));
  const have = new Map(existing.map((e) => [tagOf.get(String(e.hashtagId)), e]));
  const touched = [];

  for (const [tag, link] of have) {
    if (!wanted.includes(tag)) {
      await FriendsPostHashtag.destroy({ where: { id: link.id } });
      touched.push(link.hashtagId);
    }
  }
  for (const tag of wanted) {
    if (have.has(tag)) continue;
    const h = await findOrCreateTag(post.campusId, tag);
    try {
      await FriendsPostHashtag.create({
        postId: post.id,
        hashtagId: h.id,
        campusId: post.campusId,
        authorId: post.authorId,
        ...(at ? { createdAt: at } : {}),
      });
    } catch (err) {
      if (!isUniqueError(err)) throw err;
    }
    const usedAt = at || new Date();
    await FriendsHashtag.update({ lastUsedAt: usedAt }, {
      where: { id: h.id, [Op.or]: [{ lastUsedAt: null }, { lastUsedAt: { [Op.lt]: usedAt } }] },
    });
    touched.push(h.id);
  }
  // Keep counters right even when only the post status changed.
  await recountHashtags([...touched, ...existing.map((e) => e.hashtagId)]);
  return wanted;
};

/** Hashtag ids linked to these posts (for recounts after a status change). */
const hashtagIdsOf = async (postIds) => {
  const ids = (postIds || []).filter(Boolean);
  if (!ids.length) return [];
  const rows = await getModel('FriendsPostHashtag').findAll({ where: { postId: { [Op.in]: ids } }, attributes: ['hashtagId'] });
  return rows.map((r) => r.hashtagId);
};

const computeTrends = async (campusId) => {
  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_MS);
  const rows = await getSequelize().query(
    `SELECT h."id" AS "id", h."tag" AS "tag",
            COUNT(DISTINCT ph."authorId") AS "authors", COUNT(*) AS "posts", MAX(ph."createdAt") AS "lastAt"
       FROM "FriendsPostHashtags" ph
       JOIN "FriendsHashtags" h ON h."id" = ph."hashtagId"
       JOIN "FriendsPosts" p ON p."id" = ph."postId"
      WHERE ph."campusId" = :campusId
        AND ph."createdAt" >= :since
        AND p."status" = 'visible'
        AND ph."authorId" NOT IN (
          SELECT s."userId" FROM "FriendsSanctions" s
           WHERE s."liftedAt" IS NULL AND s."scope" IN ('friends', 'pulse')
             AND (s."until" IS NULL OR s."until" > :now))
      GROUP BY h."id", h."tag"
     HAVING COUNT(DISTINCT ph."authorId") >= :minAuthors
      ORDER BY COUNT(DISTINCT ph."authorId") DESC, COUNT(*) DESC, MAX(ph."createdAt") DESC
      LIMIT :limit`,
    { replacements: { campusId, since, now, minAuthors: TREND_MIN_AUTHORS, limit: TREND_LIMIT }, type: getSequelize().QueryTypes.SELECT },
  );
  return rows.map((r, i) => ({
    rank: i + 1,
    hashtagId: r.id,
    tag: r.tag,
    people: Number(r.authors) || 0,
    posts: Number(r.posts) || 0,
  }));
};

/** Trends for one campus (cached 60 s). Never throws: on error returns []. */
const getTrends = async (campusId, { fresh = false } = {}) => {
  if (!campusId) return [];
  const key = String(campusId);
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.items;
  try {
    const items = await computeTrends(key);
    if (cache.size > 2000) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), items });
    return items;
  } catch (err) {
    console.warn('[PULSE_TRENDS_WARN]', err.message);
    return hit ? hit.items : [];
  }
};

// B1: with REDIS_URL set the same entry is dropped on every instance (utils/cacheBus; a remote null = all).
const clearTrendsLocal = (campusId) => {
  if (campusId === undefined) cache.clear();
  else cache.delete(String(campusId));
};
const trendsBus = require('../../../utils/cacheBus');
trendsBus.register('friends.trends', (campusId) => clearTrendsLocal(campusId === null ? undefined : campusId), { resync: () => cache.clear() });
const clearTrends = (...args) => {
  clearTrendsLocal(...args);
  trendsBus.broadcast('friends.trends', ...args);
};

module.exports = {
  extractHashtags,
  normaliseTag,
  syncHashtags,
  recountHashtags,
  hashtagIdsOf,
  getTrends,
  clearTrends,
  TREND_MIN_AUTHORS,
  WINDOW_MS,
};
