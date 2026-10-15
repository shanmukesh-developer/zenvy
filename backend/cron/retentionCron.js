// Data retention for campus chats and Friends > Pulse (owner policy, 2026-10-15):
//  • Chat messages (DMs, groups, task / Connect chats, After Dark, campus spot rooms) are permanently
//    deleted CHAT_RETENTION_DAYS (default 7) after they were sent. Conversations themselves stay.
//    Chat photos (CampusMedia purpose 'chat') go too once no message / group avatar points at them.
//  • Pulse threads (FriendsPost root + its replies, likes / reposts / bookmarks, poll + votes, hashtag
//    links, per-thread aliases) are deleted PULSE_RETENTION_DAYS (default 30) after the root was posted.
//    Post photos (purpose 'post') go only when nothing else still references them.
//  • Anything under an open moderation report or appeal is kept until that is resolved (evidence), and
//    the moderation / audit tables (FriendsReports, FriendsModActions, FriendsAppeals) are never touched.
//
// Both windows are admin GlobalConfig keys (whole days, minimum 1). Safe to run twice at once (every
// step is "delete what is still there") and batched (small id lists per statement) so Postgres never
// holds a long lock on the busy chat / feed tables.
const cron = require('node-cron');
const { Op } = require('sequelize');

const KEYS = { chat: 'CHAT_RETENTION_DAYS', pulse: 'PULSE_RETENTION_DAYS' };
const DEFAULT_DAYS = { chat: 7, pulse: 30 };
const MIN_DAYS = 1;
const MAX_DAYS = 3650;
const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH = 500;
const THREAD_BATCH = 100;
const MAX_BATCHES = 400; // per table per run; the next run continues
const OPEN_REPORT = ['open', 'in_review', 'escalated'];
const CACHE_MS = 60 * 1000;

const models = () => {
  try {
    // The app's connection; standalone harnesses only initialise the Friends module's one.
    const s = require('../config/db').getSequelize() || require('../modules/friends').getSequelize();
    return (s && s.models) || {};
  } catch {
    return {};
  }
};

/** Whole days between MIN_DAYS and MAX_DAYS, or null when the value is not a number. */
const normalizeDays = (raw) => {
  let v = raw;
  if (v && typeof v === 'object') v = v.days !== undefined ? v.days : v.value;
  if (typeof v === 'string') v = v.trim();
  if (v === '' || v === null || v === undefined || typeof v === 'boolean') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.floor(n)));
};

let cache = null; // { at, policy }
const clearRetentionCache = () => { cache = null; };

/** { chatDays, pulseDays } from GlobalConfig (defaults 7 / 30), cached for a minute. */
const getRetentionPolicy = async ({ fresh = false } = {}) => {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.policy;
  const policy = { chatDays: DEFAULT_DAYS.chat, pulseDays: DEFAULT_DAYS.pulse };
  try {
    const { GlobalConfig } = models();
    if (GlobalConfig) {
      const rows = await GlobalConfig.findAll({ where: { key: { [Op.in]: [KEYS.chat, KEYS.pulse] } } });
      for (const r of rows) {
        const d = normalizeDays(r.value);
        if (d === null) continue;
        if (r.key === KEYS.chat) policy.chatDays = d;
        if (r.key === KEYS.pulse) policy.pulseDays = d;
      }
    }
  } catch (err) {
    console.warn('[RETENTION] Could not read the retention settings, using defaults:', err.message);
  }
  cache = { at: Date.now(), policy };
  return policy;
};

const MEDIA_ID_RE = /\/api\/campus\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const mediaIdsIn = (value, out) => {
  if (value === null || value === undefined) return out;
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  for (const m of s.matchAll(MEDIA_ID_RE)) out.add(m[1].toLowerCase());
  return out;
};

const textColumns = (Model) => Object.entries(Model.rawAttributes)
  .filter(([, a]) => a.type && ['STRING', 'TEXT', 'JSON', 'JSONB'].includes(a.type.key))
  .map(([name, a]) => a.field || name);

/** Is `id` still mentioned by any text column of the given models? (Only the few candidate ids are checked.) */
const isReferenced = async (id, checks) => {
  for (const [Model, cols] of checks) {
    if (!Model || !cols.length) continue;
    const s = Model.sequelize;
    const or = cols.map((c) => s.where(s.cast(s.col(c), 'TEXT'), { [Op.like]: `%${id}%` }));
    const hit = await Model.findOne({ where: { [Op.or]: or }, attributes: [Model.primaryKeyAttribute] });
    if (hit) return true;
  }
  return false;
};

/** Deletes the given media ids that still have `purpose` and are no longer referenced. */
const deleteUnreferencedMedia = async (ids, purpose, checks) => {
  const { CampusMedia } = models();
  if (!CampusMedia || !ids.length) return 0;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH).filter((x) => UUID_RE.test(x));
    if (!chunk.length) continue;
    const rows = await CampusMedia.findAll({ where: { id: { [Op.in]: chunk }, purpose }, attributes: ['id'] });
    const gone = [];
    for (const r of rows) {
      if (!(await isReferenced(String(r.id), checks))) gone.push(r.id);
    }
    if (gone.length) deleted += await CampusMedia.destroy({ where: { id: { [Op.in]: gone }, purpose } });
  }
  return deleted;
};

// ── Chat ────────────────────────────────────────────────────────────────────────────────────────

const reportedIds = async (targetTypes) => {
  const { FriendsReport } = models();
  if (!FriendsReport) return [];
  const rows = await FriendsReport.findAll({
    where: { targetType: { [Op.in]: targetTypes }, status: { [Op.in]: OPEN_REPORT } },
    attributes: ['targetId'],
  });
  return [...new Set(rows.map((r) => String(r.targetId)))];
};

const runChatRetention = async ({ now = new Date() } = {}) => {
  const { Message, Conversation, ProximityMessage, CampusMedia } = models();
  const { chatDays } = await getRetentionPolicy({ fresh: true });
  const cutoff = new Date(now.getTime() - chatDays * DAY_MS);
  const stats = { days: chatDays, cutoff: cutoff.toISOString(), messages: 0, keptReported: 0, spotMessages: 0, media: 0 };
  const candidates = new Set();

  if (Message) {
    const keep = await reportedIds(['message']);
    stats.keptReported = keep.length
      ? await Message.count({ where: { id: { [Op.in]: keep }, createdAt: { [Op.lt]: cutoff } } })
      : 0;
    const where = { createdAt: { [Op.lt]: cutoff } };
    if (keep.length) where.id = { [Op.notIn]: keep };
    for (let b = 0; b < MAX_BATCHES; b++) {
      const rows = await Message.findAll({ where, attributes: ['id', 'mediaUrl', 'attachmentUrl'], order: [['createdAt', 'ASC']], limit: BATCH });
      if (!rows.length) break;
      for (const r of rows) { mediaIdsIn(r.mediaUrl, candidates); mediaIdsIn(r.attachmentUrl, candidates); }
      stats.messages += await Message.destroy({ where: { id: { [Op.in]: rows.map((r) => r.id) } } });
      if (rows.length < BATCH) break;
    }
  }

  // Campus spot rooms: same window (their own 24 h expiry also counts).
  if (ProximityMessage) {
    const where = { [Op.or]: [{ createdAt: { [Op.lt]: cutoff } }, { expiresAt: { [Op.lt]: now } }] };
    for (let b = 0; b < MAX_BATCHES; b++) {
      const rows = await ProximityMessage.findAll({ where, attributes: ['id'], order: [['createdAt', 'ASC']], limit: BATCH });
      if (!rows.length) break;
      stats.spotMessages += await ProximityMessage.destroy({ where: { id: { [Op.in]: rows.map((r) => r.id) } } });
      if (rows.length < BATCH) break;
    }
  }

  // Chat photos: the ones the deleted messages used, plus chat uploads older than the window that were
  // never sent (keyset scan by id so photos still in use are not re-read forever).
  if (CampusMedia) {
    let lastId = null;
    for (let b = 0; b < MAX_BATCHES; b++) {
      const where = { purpose: 'chat', createdAt: { [Op.lt]: cutoff } };
      if (lastId) where.id = { [Op.gt]: lastId };
      const rows = await CampusMedia.findAll({ where, attributes: ['id'], order: [['id', 'ASC']], limit: BATCH });
      if (!rows.length) break;
      for (const r of rows) candidates.add(String(r.id).toLowerCase());
      lastId = rows[rows.length - 1].id;
      if (rows.length < BATCH) break;
    }
    const checks = [
      [Message, Message ? ['mediaUrl', 'attachmentUrl'] : []],
      [Conversation, Conversation ? ['groupAvatar'] : []],
    ];
    stats.media = await deleteUnreferencedMedia([...candidates], 'chat', checks);
  }
  return stats;
};

// ── Pulse ───────────────────────────────────────────────────────────────────────────────────────

/** Post ids (of `ids`) that an open report or an open appeal still points at. */
const protectedPostIds = async (ids) => {
  const { FriendsReport, FriendsAppeal, FriendsModAction } = models();
  const out = new Set();
  if (!ids.length) return out;
  if (FriendsReport) {
    const rows = await FriendsReport.findAll({
      where: { targetType: { [Op.in]: ['post', 'reply'] }, targetId: { [Op.in]: ids }, status: { [Op.in]: OPEN_REPORT } },
      attributes: ['targetId'],
    });
    rows.forEach((r) => out.add(String(r.targetId)));
  }
  if (FriendsAppeal && FriendsModAction) {
    const actions = await FriendsModAction.findAll({ where: { targetId: { [Op.in]: ids } }, attributes: ['id', 'targetId'] });
    if (actions.length) {
      const open = await FriendsAppeal.findAll({
        where: { actionId: { [Op.in]: actions.map((a) => a.id) }, status: 'open' },
        attributes: ['actionId'],
      });
      const openIds = new Set(open.map((a) => String(a.actionId)));
      actions.forEach((a) => { if (openIds.has(String(a.id))) out.add(String(a.targetId)); });
    }
  }
  return out;
};

const runPulseRetention = async ({ now = new Date() } = {}) => {
  const M = models();
  const { FriendsPost } = M;
  const { pulseDays } = await getRetentionPolicy({ fresh: true });
  const cutoff = new Date(now.getTime() - pulseDays * DAY_MS);
  const stats = { days: pulseDays, cutoff: cutoff.toISOString(), threads: 0, posts: 0, reactions: 0, polls: 0, pollVotes: 0, hashtagLinks: 0, keptThreads: 0, media: 0 };
  if (!FriendsPost) return stats;
  const s = FriendsPost.sequelize;
  const mediaCandidates = new Set();

  let lastId = null;
  for (let b = 0; b < MAX_BATCHES; b++) {
    const where = { rootId: null, createdAt: { [Op.lt]: cutoff } };
    if (lastId) where.id = { [Op.gt]: lastId };
    const roots = await FriendsPost.findAll({ where, attributes: ['id'], order: [['id', 'ASC']], limit: THREAD_BATCH });
    if (!roots.length) break;
    lastId = roots[roots.length - 1].id;
    const rootIds = roots.map((r) => String(r.id));

    const thread = await FriendsPost.findAll({
      where: { [Op.or]: [{ id: { [Op.in]: rootIds } }, { rootId: { [Op.in]: rootIds } }] },
      attributes: ['id', 'rootId', 'media', 'pollId'],
    });
    const rootOf = (p) => String(p.rootId || p.id);
    const prot = await protectedPostIds(thread.map((p) => String(p.id)));
    const keptRoots = new Set(thread.filter((p) => prot.has(String(p.id))).map(rootOf));
    stats.keptThreads += keptRoots.size;
    const doomed = thread.filter((p) => !keptRoots.has(rootOf(p)));
    if (doomed.length) {
      const ids = doomed.map((p) => String(p.id));
      for (const p of doomed) {
        for (const m of (Array.isArray(p.media) ? p.media : [])) {
          if (m && typeof m.mediaId === 'string') mediaCandidates.add(m.mediaId.toLowerCase());
          else mediaIdsIn(m, mediaCandidates);
        }
      }
      if (M.FriendsReaction) {
        stats.reactions += await M.FriendsReaction.destroy({ where: { targetType: 'post', targetId: { [Op.in]: ids } } });
      }
      if (M.FriendsPoll) {
        const polls = await M.FriendsPoll.findAll({ where: { postId: { [Op.in]: ids } }, attributes: ['id'] });
        const pollIds = polls.map((p) => p.id);
        if (pollIds.length) {
          if (M.FriendsPollVote) stats.pollVotes += await M.FriendsPollVote.destroy({ where: { pollId: { [Op.in]: pollIds } } });
          stats.polls += await M.FriendsPoll.destroy({ where: { id: { [Op.in]: pollIds } } });
        }
      }
      if (M.FriendsPostHashtag) {
        const links = await M.FriendsPostHashtag.findAll({ where: { postId: { [Op.in]: ids } }, attributes: ['id', 'hashtagId'] });
        if (links.length) {
          const per = new Map();
          links.forEach((l) => per.set(String(l.hashtagId), [...(per.get(String(l.hashtagId)) || []), l.id]));
          for (const [hid, linkIds] of per) {
            // Decrement by what THIS run deleted, so a concurrent run never double-counts.
            const n = await M.FriendsPostHashtag.destroy({ where: { id: { [Op.in]: linkIds } } });
            stats.hashtagLinks += n;
            if (n && M.FriendsHashtag) {
              await M.FriendsHashtag.update(
                { postCount: s.literal(`CASE WHEN "postCount" > ${Number(n)} THEN "postCount" - ${Number(n)} ELSE 0 END`) },
                { where: { id: hid } }
              ).catch(() => {});
            }
          }
        }
      }
      if (M.FriendsAlias) {
        const keys = [...new Set(doomed.map((p) => `pulse:${rootOf(p)}`))];
        await M.FriendsAlias.destroy({ where: { threadKey: { [Op.in]: keys } } });
      }
      // Replies first, then the roots (no FK between posts, but keeps a half-done batch consistent).
      const replyIds = doomed.filter((p) => p.rootId).map((p) => p.id);
      const rootDoomed = doomed.filter((p) => !p.rootId).map((p) => p.id);
      if (replyIds.length) stats.posts += await FriendsPost.destroy({ where: { id: { [Op.in]: replyIds } } });
      if (rootDoomed.length) {
        const gone = await FriendsPost.destroy({ where: { id: { [Op.in]: rootDoomed } } });
        stats.posts += gone;
        stats.threads += gone;
      }
    }
    if (roots.length < THREAD_BATCH) break;
  }

  // Post photos are shared with other boards (Community feed, birthdays, the Wall): delete one only
  // when no remaining row anywhere mentions it.
  const checkModels = ['FriendsPost', 'CommunityPost', 'BirthdayCelebration', 'BirthdayWish', 'WallSubmission', 'WallEvent', 'FriendsEntity', 'FriendsSpace']
    .map((n) => M[n]).filter(Boolean).map((Model) => [Model, textColumns(Model)]);
  stats.media = await deleteUnreferencedMedia([...mediaCandidates], 'post', checkModels);
  return stats;
};

// ── Scheduling ──────────────────────────────────────────────────────────────────────────────────

let running = false;
const runRetention = async (opts = {}) => {
  if (running) return { skipped: 'already running' };
  running = true;
  const out = {};
  try {
    try {
      out.chat = await runChatRetention(opts);
      const c = out.chat;
      console.log(`[RETENTION] chat (${c.days}d): ${c.messages} messages, ${c.spotMessages} spot messages, ${c.media} photos deleted; ${c.keptReported} kept under open reports.`);
    } catch (err) {
      console.error('[RETENTION] chat cleanup failed:', err.message);
      out.chatError = err.message;
    }
    try {
      out.pulse = await runPulseRetention(opts);
      const p = out.pulse;
      console.log(`[RETENTION] pulse (${p.days}d): ${p.threads} threads / ${p.posts} posts, ${p.reactions} reactions, ${p.polls} polls, ${p.pollVotes} votes, ${p.media} photos deleted; ${p.keptThreads} threads kept under open reports/appeals.`);
    } catch (err) {
      console.error('[RETENTION] pulse cleanup failed:', err.message);
      out.pulseError = err.message;
    }
    try {
      // Wall / birthday / community photos nothing points at any more (B19).
      out.media = await require('../utils/mediaCleanup').sweepUnreferencedMedia(opts);
      if (out.media.deleted) console.log(`[RETENTION] unreferenced photos: ${out.media.deleted} deleted (${out.media.checked} checked).`);
    } catch (err) {
      console.error('[RETENTION] photo sweep failed:', err.message);
      out.mediaError = err.message;
    }
  } finally {
    running = false;
  }
  return out;
};

let scheduled = false;
const initRetentionCron = () => {
  if (scheduled) return;
  scheduled = true;
  // Hourly at :23 (off the top of the hour, away from the other hourly jobs), plus once shortly after boot.
  cron.schedule('23 * * * *', () => { runRetention().catch(() => {}); });
  const t = setTimeout(() => { runRetention().catch(() => {}); }, 3 * 60 * 1000);
  if (t.unref) t.unref();
  console.log('[CRON] Chat / Pulse retention job initialized (runs hourly).');
};

module.exports = {
  KEYS,
  DEFAULT_DAYS,
  MIN_DAYS,
  MAX_DAYS,
  normalizeDays,
  getRetentionPolicy,
  clearRetentionCache,
  runChatRetention,
  runPulseRetention,
  runRetention,
  initRetentionCron,
};
