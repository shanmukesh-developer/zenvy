/**
 * Friends > Pulse (Phase 2): /api/campus/pulse. Contract: backend_contract.md "Friends (pulse)".
 *
 * The campus feed: 280-character posts with up to 4 images, one link and an optional poll, threaded
 * replies with a reply policy, hashtags + trends, likes / reposts / bookmarks, follows (Following
 * tab), verified entities (clubs, departments, official accounts), anonymous posting with a per-thread
 * alias, edit / delete with audit, and Space cards (written by the Spaces phase, shown only while the
 * spaces flag is on). Reports / appeals / reveal-author reuse the Phase 0 services through the 'post'
 * and 'reply' resolvers registered at the bottom. Coexists with the older campus routes
 * /pulse/today, /pulse/question, /pulse/whispers and /pulse/branch-wars (mounted first in campusRoutes).
 *
 * Privacy rules enforced here:
 *  - authorId never leaves the server (identity.authorOf + scrub). Anonymous authors are
 *    { anonymous, alias, isMine? } and the alias is per thread ("pulse:<rootId>").
 *  - Anonymous posts never appear in Following, cannot be reposted, cannot use the 'following' reply
 *    policy (it would reveal whom the author follows) and their audit rows carry no actor id.
 *  - Blocks and mutes filter NAMED content only. Filtering anonymous posts by their real author would
 *    let anyone de-anonymise a post by blocking candidates and watching it disappear.
 */
const crypto = require('crypto');
const { Op } = require('sequelize');
const { getModel, getSequelize } = require('../index');
const flags = require('../services/featureFlags');
const limiter = require('../services/limiter');
const identity = require('../services/identity');
const cursor = require('../services/cursor');
const blocks = require('../services/blocks');
const reportsSvc = require('../services/reports');
const targets = require('../services/targets');
const audit = require('../services/audit');
const alias = require('../services/alias');
const contentPolicy = require('../services/contentPolicy');
const trends = require('../services/trends');
const { notify } = require('../services/notify');
const { fail, requireUuid, isUuid, isUniqueError, optText } = require('../services/http');
const P = require('../models/pulse/enums');

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

limiter.define('pulse_post', 10, HOUR);
limiter.define('pulse_reply', 60, HOUR);
limiter.define('pulse_like', 300, HOUR);
limiter.define('pulse_repost', 60, HOUR);
limiter.define('pulse_bookmark', 120, HOUR);
limiter.define('pulse_poll_vote', 120, HOUR);
limiter.define('pulse_edit', 30, HOUR);

const MEDIA_PURPOSES = ['post', 'other', 'chat', 'forum'];
const MENTION_RE = /(^|[^A-Za-z0-9_-])@(ZNV-[A-Z0-9]{5})(?![A-Za-z0-9])/gi;
const MAX_MENTION_NOTIFY = 5;
const CLOSED_STATES = ['removed', 'hidden', 'deleted'];

const M = (name) => getModel(name);
const send = (res, status, payload) => res.status(status).json(identity.scrub(payload));
const esc = (v) => getSequelize().escape(String(v));
const likeOp = () => (getSequelize().getDialect() === 'postgres' ? Op.iLike : Op.like);

const notifyAdmin = (type, action, id, extra) => {
  try { require('../../../utils/realtime').notifyAdmin(type, action, id, extra); } catch { /* optional */ }
};

const ctxOf = (req) => (req.friends && req.friends.ctx) || null;
const campusOf = (req) => {
  const ctx = ctxOf(req);
  return ctx && ctx.profile ? ctx.profile.campusId : null;
};
const charLen = (s) => Array.from(String(s || '')).length;

// ═════════════════════════════════════════════════════════════════════════════
// Viewer filters (blocks, mutes, follows)
// ═════════════════════════════════════════════════════════════════════════════

const viewerState = async (me) => {
  const [blocked, edges] = await Promise.all([
    blocks.blockedIds(me),
    M('FriendsEdge').findAll({ where: { userId: me, kind: { [Op.in]: ['mute', 'follow'] } }, attributes: ['kind', 'targetType', 'targetId'] }),
  ]);
  const set = (kind, type) => new Set(edges.filter((e) => e.kind === kind && e.targetType === type).map((e) => String(e.targetId)));
  const mutedUsers = set('mute', 'user');
  const hiddenAuthors = new Set([...blocked, ...mutedUsers].map(String));
  hiddenAuthors.delete(String(me));
  return {
    me: String(me),
    blocked,
    hiddenAuthors, // named authors I must not see (blocked either way, or muted)
    mutedEntities: set('mute', 'entity'),
    mutedTags: set('mute', 'hashtag'),
    followUsers: set('follow', 'user'),
    followEntities: set('follow', 'entity'),
  };
};

/** Conditions that drop named content from hidden authors / muted entities / muted hashtags. */
const exclusions = (vs, { skipTags = false } = {}) => {
  const and = [];
  if (vs.hiddenAuthors.size) and.push({ [Op.or]: [{ isAnonymous: true }, { authorId: { [Op.notIn]: [...vs.hiddenAuthors] } }] });
  if (vs.mutedEntities.size) and.push({ [Op.or]: [{ entityId: null }, { entityId: { [Op.notIn]: [...vs.mutedEntities] } }] });
  if (!skipTags && vs.mutedTags.size) {
    and.push(getSequelize().literal(`"FriendsPost"."id" NOT IN (SELECT "postId" FROM "FriendsPostHashtags" WHERE "hashtagId" IN (${[...vs.mutedTags].map(esc).join(', ')}))`));
  }
  return and;
};

/** Ascending keyset condition (thread replies are read oldest first). */
const afterAsc = (raw) => {
  const c = cursor.decode(raw);
  if (!c) return null;
  return { [Op.or]: [{ createdAt: { [Op.gt]: c.value } }, { createdAt: c.value, id: { [Op.gt]: c.id } }] };
};

// ═════════════════════════════════════════════════════════════════════════════
// Counters (always recounted from the source rows: exact under concurrency)
// ═════════════════════════════════════════════════════════════════════════════

const recountReaction = async (postId, kind) => {
  const col = kind === 'like' ? 'likeCount' : 'repostCount';
  await getSequelize().query(
    `UPDATE "FriendsPosts" SET "${col}" = (SELECT COUNT(*) FROM "FriendsReactions" WHERE "targetType" = 'post' AND "targetId" = :id AND "kind" = :kind) WHERE "id" = :id`,
    { replacements: { id: postId, kind } },
  );
};

const recountReplies = async (postId) => {
  if (!postId) return;
  await getSequelize().query(
    'UPDATE "FriendsPosts" SET "replyCount" = (SELECT COUNT(*) FROM "FriendsPosts" c WHERE c."parentId" = :id AND c."status" = \'visible\') WHERE "id" = :id',
    { replacements: { id: postId } },
  );
};

const counts = async (postId) => {
  const p = await M('FriendsPost').findByPk(postId, { attributes: ['likeCount', 'replyCount', 'repostCount'] });
  return p ? { likeCount: p.likeCount, replyCount: p.replyCount, repostCount: p.repostCount } : {};
};

/** Status change from moderation / self-delete, keeping reply + hashtag counters right. */
const setPostStatus = async (post, status, reason) => {
  post.status = status;
  if (status === 'visible') post.removedReason = null;
  else if (reason) post.removedReason = String(reason).slice(0, 300);
  await post.save({ fields: ['status', 'removedReason'] });
  if (post.parentId) await recountReplies(post.parentId);
  await trends.recountHashtags(await trends.hashtagIdsOf([post.id]));
};

// ═════════════════════════════════════════════════════════════════════════════
// Input parsing
// ═════════════════════════════════════════════════════════════════════════════

const resolveMedia = async (mediaIds, ownerId) => {
  if (mediaIds === undefined || mediaIds === null) return [];
  if (!Array.isArray(mediaIds)) throw fail(400, 'INVALID_MEDIA', 'mediaIds must be a list.');
  const ids = [...new Set(mediaIds.map(String))];
  if (ids.length > P.MAX_MEDIA) throw fail(400, 'TOO_MANY_MEDIA', `You can attach at most ${P.MAX_MEDIA} images.`, { max: P.MAX_MEDIA });
  if (!ids.length) return [];
  if (!ids.every(isUuid)) throw fail(400, 'INVALID_MEDIA', 'One of the images is not valid.');
  const rows = await M('CampusMedia').findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'ownerId', 'isPrivate', 'purpose', 'mime'] });
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  for (const id of ids) {
    const r = byId.get(id);
    if (!r || String(r.ownerId) !== String(ownerId) || r.isPrivate || !MEDIA_PURPOSES.includes(r.purpose)
      || (r.mime && !/^image\/(jpeg|png|webp|gif)$/i.test(r.mime))) {
      throw fail(400, 'INVALID_MEDIA', 'Upload the image again and attach it from this device.');
    }
  }
  return ids.map((id) => ({ mediaId: id }));
};

/** One structured link: http(s), not denylisted. Returns { link, flagged }. */
const parseLink = (raw, cfg) => {
  if (raw === undefined || raw === null || raw === '') return { link: null, flagged: false };
  if (Array.isArray(raw)) {
    if (raw.length > 1) throw fail(400, 'TOO_MANY_LINKS', 'You can add one link to a post.', { max: 1 });
    return parseLink(raw[0], cfg);
  }
  const url = typeof raw === 'string' ? raw : raw && raw.url;
  const r = contentPolicy.checkLink(typeof url === 'string' ? url.trim() : url, cfg);
  if (!r.ok) throw fail(422, 'CONTENT_BLOCKED', contentPolicy.REASON_TEXT[r.reason] || 'That link is not allowed.', { reasons: [r.reason] });
  return { link: { url: String(url).trim(), host: r.host }, flagged: !!r.flag };
};

const parsePoll = (raw) => {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw fail(400, 'INVALID_POLL', 'Poll must have options and a duration.');
  const options = Array.isArray(raw.options) ? raw.options : null;
  if (!options || options.length < P.POLL_MIN_OPTIONS || options.length > P.POLL_MAX_OPTIONS) {
    throw fail(400, 'INVALID_POLL', `A poll needs ${P.POLL_MIN_OPTIONS} to ${P.POLL_MAX_OPTIONS} options.`, { min: P.POLL_MIN_OPTIONS, max: P.POLL_MAX_OPTIONS });
  }
  const labels = options.map((o) => (typeof o === 'string' ? o.trim() : ''));
  if (labels.some((l) => !l || charLen(l) > P.POLL_OPTION_MAX)) {
    throw fail(400, 'INVALID_POLL', `Each option must be 1-${P.POLL_OPTION_MAX} characters.`, { max: P.POLL_OPTION_MAX });
  }
  if (new Set(labels.map((l) => l.toLowerCase())).size !== labels.length) throw fail(400, 'INVALID_POLL', 'Poll options must be different.');
  const hours = raw.durationHours === undefined ? 24 : Number(raw.durationHours);
  if (!Number.isInteger(hours) || hours < P.POLL_MIN_HOURS || hours > P.POLL_MAX_HOURS) {
    throw fail(400, 'INVALID_POLL', `A poll can run from ${P.POLL_MIN_HOURS} hour to ${P.POLL_MAX_HOURS / 24} days.`, { minHours: P.POLL_MIN_HOURS, maxHours: P.POLL_MAX_HOURS });
  }
  return { labels, hours };
};

const parseText = (raw, { required }) => {
  if (raw === undefined || raw === null) {
    if (required) throw fail(400, 'EMPTY_POST', 'Write something first.');
    return null;
  }
  if (typeof raw !== 'string') throw fail(400, 'INVALID_INPUT', 'Text must be text.', { field: 'text' });
  const t = raw.replace(/\r\n/g, '\n').trim();
  if (!t) {
    if (required) throw fail(400, 'EMPTY_POST', 'Write something first.');
    return null;
  }
  if (charLen(t) > P.MAX_TEXT) throw fail(400, 'TOO_LONG', `Posts can be at most ${P.MAX_TEXT} characters.`, { field: 'text', max: P.MAX_TEXT });
  return t;
};

const flagCategory = (reasons) => {
  if (reasons.includes('SELF_HARM')) return 'self_harm';
  if (reasons.some((r) => /SPAM|LINK/.test(r))) return 'spam';
  return 'other';
};

/** Active, verified entity of my campus that I manage (403 otherwise). */
const managedEntity = async (entityId, me, campusId) => {
  requireUuid(entityId, 'entity');
  const e = await M('FriendsEntity').findByPk(entityId);
  if (!e || e.status !== 'active' || !e.verified || String(e.campusId) !== String(campusId)
    || !(e.managerIds || []).map(String).includes(String(me))) {
    throw fail(403, 'NOT_ENTITY_MANAGER', 'You can only post as a verified club or account you manage.');
  }
  return e;
};

// ═════════════════════════════════════════════════════════════════════════════
// Serialization
// ═════════════════════════════════════════════════════════════════════════════

const mediaOut = (req, media) => (media || []).map((m) => ({
  mediaId: m.mediaId,
  url: require('../../campus/campusHelpers').absolutize(req, `/api/campus/media/${m.mediaId}`),
}));

const pollTallies = async (pollIds) => {
  if (!pollIds.length) return new Map();
  const rows = await M('FriendsPollVote').findAll({
    where: { pollId: { [Op.in]: pollIds } },
    attributes: ['pollId', 'optionIdx', [getSequelize().fn('COUNT', getSequelize().col('id')), 'n']],
    group: ['pollId', 'optionIdx'],
    raw: true,
  });
  const out = new Map();
  rows.forEach((r) => {
    const k = String(r.pollId);
    if (!out.has(k)) out.set(k, new Map());
    out.get(k).set(Number(r.optionIdx), Number(r.n) || 0);
  });
  return out;
};

const pollOut = (poll, tally, myVote, isMine) => {
  const closed = new Date(poll.closesAt).getTime() <= Date.now();
  const showResults = closed || myVote !== null || isMine;
  const total = [...(tally || new Map()).values()].reduce((a, b) => a + b, 0);
  return {
    id: poll.id,
    options: (poll.options || []).map((label, idx) => (showResults
      ? { idx, label, votes: (tally && tally.get(idx)) || 0 }
      : { idx, label })),
    totalVotes: showResults ? total : undefined,
    myVote,
    closesAt: poll.closesAt,
    closed,
    showResults,
  };
};

const reactionsOf = async (me, ids) => {
  if (!me || !ids.length) return { like: new Set(), repost: new Set(), bookmark: new Set() };
  const rows = await M('FriendsReaction').findAll({ where: { userId: me, targetType: 'post', targetId: { [Op.in]: ids } }, attributes: ['targetId', 'kind'] });
  const out = { like: new Set(), repost: new Set(), bookmark: new Set() };
  rows.forEach((r) => { if (out[r.kind]) out[r.kind].add(String(r.targetId)); });
  return out;
};

const replyAllowed = (root, me, authorFollowsMe) => {
  if (!root || root.status !== 'visible' || root.kind === 'space_card') return false;
  if (String(root.authorId) === String(me)) return true;
  if (root.replyPolicy === 'none') return false;
  if (root.replyPolicy === 'following') return !!authorFollowsMe;
  return true;
};

const spaceCards = async (req, cards, me, spacesOn) => {
  const out = new Map();
  const FriendsSpace = M('FriendsSpace');
  if (!cards.length || !spacesOn || !FriendsSpace) return out;
  const spaceIds = cards.map((c) => c.spaceId).filter(Boolean);
  const spaces = await FriendsSpace.findAll({ where: { id: { [Op.in]: spaceIds } } });
  const byId = new Map(spaces.map((s) => [String(s.id), s]));
  const Member = M('FriendsSpaceMember');
  const Reminder = M('FriendsSpaceReminder');
  const [members, reminders] = await Promise.all([
    Member ? Member.findAll({ where: { spaceId: { [Op.in]: spaceIds }, leftAt: null, removedAt: null }, attributes: ['spaceId'] }) : [],
    Reminder ? Reminder.findAll({ where: { spaceId: { [Op.in]: spaceIds } }, attributes: ['spaceId', 'userId'] }) : [],
  ]);
  const tally = (rows) => rows.reduce((m, r) => m.set(String(r.spaceId), (m.get(String(r.spaceId)) || 0) + 1), new Map());
  const live = tally(members);
  const interested = tally(reminders);
  const reminded = new Set(reminders.filter((r) => String(r.userId) === String(me)).map((r) => String(r.spaceId)));
  const hostIds = spaces.map((s) => s.hostId).filter(Boolean);
  const ids = await identity.loadIdentities(req, hostIds, { viewerId: me });
  const entityIds = spaces.map((s) => s.entityId).filter(Boolean);
  const ents = entityIds.length ? await M('FriendsEntity').findAll({ where: { id: { [Op.in]: entityIds } } }) : [];
  const entOf = new Map(ents.map((e) => [String(e.id), identity.entityIdentity(req, e)]));
  for (const c of cards) {
    const s = byId.get(String(c.spaceId));
    if (!s || !['scheduled', 'live'].includes(s.status)) continue;
    const host = ids.get(String(s.hostId)) || { userId: null, name: 'Former student', avatarUrl: null, verified: false, badges: [] };
    out.set(String(c.id), {
      kind: 'space_card',
      id: c.id,
      spaceId: s.id,
      title: s.title,
      topic: s.topic || null,
      host: s.entityId && entOf.get(String(s.entityId)) ? { ...host, entity: entOf.get(String(s.entityId)) } : host,
      status: s.status,
      scheduledFor: s.scheduledFor || null,
      startedAt: s.startedAt || null,
      participantCount: live.get(String(s.id)) || 0,
      interestedCount: interested.get(String(s.id)) || 0,
      reminded: reminded.has(String(s.id)),
      createdAt: c.createdAt,
    });
  }
  return out;
};

/**
 * Post DTOs for a viewer, in the order of `rows`. Space cards are rendered only when the spaces
 * flag is on and their Space is scheduled or live (otherwise they are dropped).
 */
const serializePosts = async (req, rows, me, { spacesOn = false, admin = false } = {}) => {
  if (!rows.length) return [];
  const posts = rows.filter((p) => p.kind !== 'space_card');
  const cards = rows.filter((p) => p.kind === 'space_card');
  const ids = posts.map((p) => String(p.id));

  const parentIds = [...new Set(posts.map((p) => p.parentId).filter(Boolean).map(String))];
  const rootIds = [...new Set(posts.map((p) => p.rootId).filter(Boolean).map(String))];
  const relatedIds = [...new Set([...parentIds, ...rootIds])].filter((id) => !ids.includes(id));
  const related = relatedIds.length ? await M('FriendsPost').findAll({ where: { id: { [Op.in]: relatedIds } } }) : [];
  const byId = new Map([...posts, ...related].map((p) => [String(p.id), p]));

  const named = [...posts, ...related].filter((p) => !p.isAnonymous).map((p) => p.authorId);
  const entityIds = [...new Set(posts.map((p) => p.entityId).filter(Boolean).map(String))];
  const pollIds = posts.map((p) => p.pollId).filter(Boolean);
  const followPolicyAuthors = [...new Set([...posts, ...related]
    .filter((p) => !p.rootId && p.replyPolicy === 'following' && String(p.authorId) !== String(me))
    .map((p) => String(p.authorId)))];

  const [idents, ents, polls, tallies, myPollVotes, mine, linkRows, followsMe, cardOut] = await Promise.all([
    identity.loadIdentities(req, named, { viewerId: me }),
    entityIds.length ? M('FriendsEntity').findAll({ where: { id: { [Op.in]: entityIds } } }) : [],
    pollIds.length ? M('FriendsPoll').findAll({ where: { id: { [Op.in]: pollIds } } }) : [],
    pollTallies(pollIds),
    me && pollIds.length ? M('FriendsPollVote').findAll({ where: { userId: me, pollId: { [Op.in]: pollIds } }, attributes: ['pollId', 'optionIdx'] }) : [],
    reactionsOf(me, ids),
    ids.length ? M('FriendsPostHashtag').findAll({ where: { postId: { [Op.in]: ids } }, attributes: ['postId', 'hashtagId'] }) : [],
    me && followPolicyAuthors.length ? M('FriendsEdge').findAll({ where: { userId: { [Op.in]: followPolicyAuthors }, kind: 'follow', targetType: 'user', targetId: me }, attributes: ['userId'] }) : [],
    spaceCards(req, cards, me, spacesOn),
  ]);
  const entOf = new Map(ents.map((e) => [String(e.id), identity.entityIdentity(req, e)]));
  const pollOf = new Map(polls.map((p) => [String(p.id), p]));
  const myVoteOf = new Map(myPollVotes.map((v) => [String(v.pollId), Number(v.optionIdx)]));
  const tagIds = [...new Set(linkRows.map((l) => String(l.hashtagId)))];
  const tags = tagIds.length ? await M('FriendsHashtag').findAll({ where: { id: { [Op.in]: tagIds } }, attributes: ['id', 'tag'] }) : [];
  const tagOf = new Map(tags.map((t) => [String(t.id), t.tag]));
  const tagsOfPost = new Map();
  linkRows.forEach((l) => {
    const k = String(l.postId);
    if (!tagsOfPost.has(k)) tagsOfPost.set(k, []);
    const t = tagOf.get(String(l.hashtagId));
    if (t) tagsOfPost.get(k).push(t);
  });
  const authorsFollowingMe = new Set(followsMe.map((f) => String(f.userId)));

  const authorShape = (p) => identity.authorOf(p, idents, me, entOf);

  return rows.map((p) => {
    if (p.kind === 'space_card') return cardOut.get(String(p.id)) || null;
    const isMine = !!me && String(p.authorId) === String(me);
    const root = p.rootId ? byId.get(String(p.rootId)) : p;
    const parent = p.parentId ? byId.get(String(p.parentId)) : null;
    const poll = p.pollId ? pollOf.get(String(p.pollId)) : null;
    const myVote = poll && myVoteOf.has(String(poll.id)) ? myVoteOf.get(String(poll.id)) : null;
    const textTags = trends.extractHashtags(p.text);
    const linked = tagsOfPost.get(String(p.id)) || [];
    const hashtags = [...new Set([...textTags, ...linked])];
    const visible = p.status === 'visible';
    return {
      kind: p.kind,
      id: p.id,
      rootId: p.rootId || null,
      parentId: p.parentId || null,
      replyTo: parent ? (parent.status === 'visible' || (me && String(parent.authorId) === String(me))
        ? { id: parent.id, author: authorShape(parent) }
        : { id: parent.id, unavailable: true }) : null,
      text: p.text || '',
      hashtags,
      media: mediaOut(req, p.media),
      link: p.link || null,
      poll: poll ? pollOut(poll, tallies.get(String(poll.id)), myVote, isMine) : null,
      author: authorShape(p),
      replyPolicy: root ? root.replyPolicy : p.replyPolicy,
      canReply: visible && replyAllowed(root, me, root && authorsFollowingMe.has(String(root.authorId))),
      status: p.status,
      underReview: p.status === 'pending_review',
      removedReason: (isMine || admin) && ['removed', 'hidden'].includes(p.status) ? (p.removedReason || null) : undefined,
      likeCount: p.likeCount,
      replyCount: p.replyCount,
      repostCount: p.repostCount,
      liked: mine.like.has(String(p.id)),
      reposted: mine.repost.has(String(p.id)),
      bookmarked: mine.bookmark.has(String(p.id)),
      canEdit: isMine && !CLOSED_STATES.includes(p.status),
      canDelete: isMine && p.status !== 'deleted',
      canRepost: visible && !p.isAnonymous,
      mine: isMine ? true : undefined,
      imported: p.source === 'whisper' ? true : undefined,
      createdAt: p.createdAt,
      editedAt: p.editedAt || null,
    };
  }).filter(Boolean);
};

const serializeOne = async (req, post, me, opts) => (await serializePosts(req, [post], me, opts))[0] || null;

const spacesOn = (req) => flags.isEnabled(req.friends.cfg, 'spaces');

// ═════════════════════════════════════════════════════════════════════════════
// Loading a post a viewer may act on
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 404 when: another campus, deleted, not visible (unless it is my own and allowOwn), a named post of
 * someone I blocked / who blocked me, or a Space card while Spaces is off.
 */
const loadPostFor = async (req, id, { allowOwn = false, interactive = false } = {}) => {
  requireUuid(id, 'post');
  const me = req.user.id;
  const post = await M('FriendsPost').findByPk(id);
  const notFound = () => fail(404, 'POST_NOT_FOUND', 'Post not found.');
  if (!post || String(post.campusId) !== String(campusOf(req)) || post.status === 'deleted') throw notFound();
  const isMine = String(post.authorId) === String(me);
  if (post.status !== 'visible' && !(allowOwn && isMine)) throw notFound();
  if (!post.isAnonymous && !isMine && (await blocks.blockedIds(me)).has(String(post.authorId))) throw notFound();
  if (post.kind === 'space_card') {
    if (!spacesOn(req)) throw notFound();
    if (interactive) throw fail(409, 'NOT_INTERACTIVE', 'Open the Space to join in.');
  }
  return post;
};

// ═════════════════════════════════════════════════════════════════════════════
// Feeds
// ═════════════════════════════════════════════════════════════════════════════

// GET /feed?tab=campus|following&cursor=&limit=
const feed = async (req, res) => {
  const me = req.user.id;
  const tab = String(req.query.tab || 'campus');
  if (!['campus', 'following'].includes(tab)) throw fail(400, 'INVALID_TAB', 'tab must be campus or following.');
  const limit = cursor.pageSize(req.query.limit, 20);
  const campusId = campusOf(req);
  const vs = await viewerState(me);
  const after = cursor.after(req.query.cursor);
  const showSpaces = spacesOn(req);

  if (tab === 'campus') {
    const and = [
      { campusId, status: 'visible', kind: { [Op.in]: showSpaces ? ['post', 'space_card'] : ['post'] } },
      ...exclusions(vs),
    ];
    if (after) and.push(after);
    const rows = await M('FriendsPost').findAll({ where: { [Op.and]: and }, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: limit + 1 });
    const { items, nextCursor } = cursor.page(rows, limit);
    const out = await serializePosts(req, items, me, { spacesOn: showSpaces });
    const payload = { tab, items: out, nextCursor };
    if (!req.query.cursor) {
      const t = await trends.getTrends(campusId);
      payload.trends = t.filter((x) => !vs.mutedTags.has(String(x.hashtagId))).slice(0, 5);
    }
    return send(res, 200, payload);
  }

  // Following: named root posts by people / entities I follow (and my own), plus their reposts.
  const people = [...new Set([...vs.followUsers, vs.me])].filter((u) => !vs.hiddenAuthors.has(u));
  const ents = [...vs.followEntities].filter((e) => !vs.mutedEntities.has(e));
  const who = [{ authorId: { [Op.in]: people } }];
  if (ents.length) who.push({ entityId: { [Op.in]: ents } });
  const postAnd = [{ campusId, status: 'visible', kind: 'post', isAnonymous: false }, { [Op.or]: who }, ...exclusions(vs)];
  if (after) postAnd.push(after);
  const reposters = people;
  const inList = reposters.map(esc).join(', ');
  const repostAnd = [
    { targetType: 'post', kind: 'repost', userId: { [Op.in]: reposters } },
    // Only the newest repost of a post by anyone I follow, so one post is shown once.
    getSequelize().literal(`NOT EXISTS (SELECT 1 FROM "FriendsReactions" r2 WHERE r2."kind" = 'repost' AND r2."targetType" = 'post'
      AND r2."targetId" = "FriendsReaction"."targetId" AND r2."userId" IN (${inList})
      AND (r2."createdAt" > "FriendsReaction"."createdAt" OR (r2."createdAt" = "FriendsReaction"."createdAt" AND r2."id" > "FriendsReaction"."id")))`),
  ];
  if (after) repostAnd.push(after);
  const [postRows, repostRows] = await Promise.all([
    M('FriendsPost').findAll({ where: { [Op.and]: postAnd }, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: limit + 1 }),
    M('FriendsReaction').findAll({ where: { [Op.and]: repostAnd }, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: limit + 1 }),
  ]);
  const merged = [
    ...postRows.map((r) => ({ type: 'post', createdAt: r.createdAt, id: String(r.id), row: r })),
    ...repostRows.map((r) => ({ type: 'repost', createdAt: r.createdAt, id: String(r.id), row: r })),
  ].sort((a, b) => {
    const d = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (d) return d;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
  const pageItems = merged.slice(0, limit);
  const nextCursor = merged.length > limit && pageItems.length ? cursor.encode(pageItems[pageItems.length - 1]) : null;

  // Load the reposted posts and drop the ones I cannot see or that already show as originals.
  const repostTargets = pageItems.filter((i) => i.type === 'repost').map((i) => i.row.targetId);
  const targetsRows = repostTargets.length ? await M('FriendsPost').findAll({ where: { id: { [Op.in]: repostTargets } } }) : [];
  const targetOf = new Map(targetsRows.map((p) => [String(p.id), p]));
  const originals = new Set(pageItems.filter((i) => i.type === 'post').map((i) => i.id));
  const followedAuthors = new Set(people);
  const mutedTagPosts = new Set();
  if (vs.mutedTags.size && targetsRows.length) {
    const links = await M('FriendsPostHashtag').findAll({ where: { postId: { [Op.in]: targetsRows.map((p) => p.id) }, hashtagId: { [Op.in]: [...vs.mutedTags] } }, attributes: ['postId'] });
    links.forEach((l) => mutedTagPosts.add(String(l.postId)));
  }
  const keep = pageItems.filter((i) => {
    if (i.type === 'post') return true;
    const p = targetOf.get(String(i.row.targetId));
    if (!p || p.status !== 'visible' || p.isAnonymous || String(p.campusId) !== String(campusId) || p.kind === 'space_card') return false;
    if (vs.hiddenAuthors.has(String(p.authorId)) || (p.entityId && vs.mutedEntities.has(String(p.entityId)))) return false;
    if (mutedTagPosts.has(String(p.id))) return false;
    if (originals.has(String(p.id))) return false;
    // The original already appears in Following on its own.
    if (p.kind === 'post' && (followedAuthors.has(String(p.authorId)) || (p.entityId && ents.includes(String(p.entityId))))) return false;
    return true;
  });
  const postsToSerialize = keep.map((i) => (i.type === 'post' ? i.row : targetOf.get(String(i.row.targetId))));
  const dtos = await serializePosts(req, postsToSerialize, me);
  const dtoOf = new Map(dtos.map((d) => [String(d.id), d]));
  const reposterIds = keep.filter((i) => i.type === 'repost').map((i) => i.row.userId);
  const reposterIdent = await identity.loadIdentities(req, reposterIds, { viewerId: me });
  const items = keep.map((i) => {
    if (i.type === 'post') return dtoOf.get(i.id) || null;
    const dto = dtoOf.get(String(i.row.targetId));
    if (!dto) return null;
    return {
      kind: 'repost',
      id: i.row.id,
      repostedBy: reposterIdent.get(String(i.row.userId)) || null,
      repostedAt: i.row.createdAt,
      post: dto,
    };
  }).filter(Boolean);
  return send(res, 200, { tab, items, nextCursor });
};

// GET /trends
const getTrendsRoute = async (req, res) => {
  const vs = await viewerState(req.user.id);
  const items = (await trends.getTrends(campusOf(req))).filter((x) => !vs.mutedTags.has(String(x.hashtagId)));
  send(res, 200, { items, windowHours: trends.WINDOW_MS / 3600000, minPeople: trends.TREND_MIN_AUTHORS });
};

// GET /hashtags/:tag?cursor=
const hashtagFeed = async (req, res) => {
  const me = req.user.id;
  const tag = trends.normaliseTag(req.params.tag);
  if (!tag) throw fail(400, 'INVALID_TAG', 'That hashtag is not valid.');
  const campusId = campusOf(req);
  const limit = cursor.pageSize(req.query.limit, 20);
  const h = await M('FriendsHashtag').findOne({ where: { campusId, tag } });
  const vs = await viewerState(me);
  if (!h) return send(res, 200, { hashtag: { id: null, tag, postCount: 0, muted: false }, items: [], nextCursor: null });
  const and = [
    { campusId, status: 'visible', kind: { [Op.in]: ['post', 'reply'] } },
    getSequelize().literal(`"FriendsPost"."id" IN (SELECT "postId" FROM "FriendsPostHashtags" WHERE "hashtagId" = ${esc(h.id)})`),
    ...exclusions(vs, { skipTags: true }),
  ];
  const after = cursor.after(req.query.cursor);
  if (after) and.push(after);
  const rows = await M('FriendsPost').findAll({ where: { [Op.and]: and }, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: limit + 1 });
  const { items, nextCursor } = cursor.page(rows, limit);
  send(res, 200, {
    hashtag: { id: h.id, tag: h.tag, postCount: h.postCount, lastUsedAt: h.lastUsedAt, muted: vs.mutedTags.has(String(h.id)) },
    items: await serializePosts(req, items, me),
    nextCursor,
  });
};

// GET /users/:id/posts?cursor= — named posts and replies of one student (never their anonymous ones).
const userPosts = async (req, res) => {
  const me = req.user.id;
  const userId = requireUuid(req.params.id, 'user');
  const campusId = campusOf(req);
  if (userId !== me && (await blocks.blockedIds(me)).has(userId)) throw fail(404, 'USER_NOT_FOUND', 'This student is not available.');
  const prof = await M('CampusProfile').findOne({ where: { userId }, attributes: ['campusId'] });
  if (!prof || String(prof.campusId) !== String(campusId)) throw fail(404, 'USER_NOT_FOUND', 'This student is not available.');
  const limit = cursor.pageSize(req.query.limit, 20);
  const and = [{ campusId, authorId: userId, isAnonymous: false, status: 'visible', kind: { [Op.in]: ['post', 'reply'] } }];
  const after = cursor.after(req.query.cursor);
  if (after) and.push(after);
  const rows = await M('FriendsPost').findAll({ where: { [Op.and]: and }, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: limit + 1 });
  const { items, nextCursor } = cursor.page(rows, limit);
  send(res, 200, { items: await serializePosts(req, items, me), nextCursor });
};

// GET /mine?cursor= — my posts and replies in every state except deleted (anonymous ones included).
const myPosts = async (req, res) => {
  const me = req.user.id;
  const limit = cursor.pageSize(req.query.limit, 20);
  const and = [{ authorId: me, campusId: campusOf(req), kind: { [Op.in]: ['post', 'reply'] }, status: { [Op.ne]: 'deleted' } }];
  const after = cursor.after(req.query.cursor);
  if (after) and.push(after);
  const rows = await M('FriendsPost').findAll({ where: { [Op.and]: and }, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: limit + 1 });
  const { items, nextCursor } = cursor.page(rows, limit);
  send(res, 200, { items: await serializePosts(req, items, me), nextCursor });
};

// ═════════════════════════════════════════════════════════════════════════════
// Posts and replies
// ═════════════════════════════════════════════════════════════════════════════

// GET /posts/:id — { post, parent, root } (parent / root only for replies, when I can see them)
const getPost = async (req, res) => {
  const me = req.user.id;
  const post = await loadPostFor(req, req.params.id, { allowOwn: true });
  const extra = [];
  if (post.parentId) extra.push(post.parentId);
  if (post.rootId && post.rootId !== post.parentId) extra.push(post.rootId);
  let related = [];
  if (extra.length) {
    const blocked = await blocks.blockedIds(me);
    related = (await M('FriendsPost').findAll({ where: { id: { [Op.in]: extra } } }))
      .filter((p) => p.status === 'visible' && String(p.campusId) === String(post.campusId)
        && (p.isAnonymous || String(p.authorId) === String(me) || !blocked.has(String(p.authorId))));
  }
  const dtos = await serializePosts(req, [post, ...related], me, { spacesOn: spacesOn(req) });
  const of = new Map(dtos.map((d) => [String(d.id), d]));
  send(res, 200, {
    post: of.get(String(post.id)) || null,
    parent: post.parentId ? of.get(String(post.parentId)) || null : null,
    root: post.rootId && post.rootId !== post.parentId ? of.get(String(post.rootId)) || null : null,
  });
};

// GET /posts/:id/replies?cursor= — direct replies, oldest first. Named replies of hidden authors are
// left out; my own replies show in every state but 'deleted'.
const listReplies = async (req, res) => {
  const me = req.user.id;
  const parent = await loadPostFor(req, req.params.id, { allowOwn: true });
  if (parent.kind === 'space_card') return send(res, 200, { items: [], nextCursor: null });
  const limit = cursor.pageSize(req.query.limit, 20);
  const vs = await viewerState(me);
  const and = [
    { parentId: parent.id, kind: 'reply' },
    { [Op.or]: [{ status: 'visible' }, { authorId: me, status: { [Op.in]: ['pending_review', 'hidden', 'removed'] } }] },
    ...exclusions(vs, { skipTags: true }),
  ];
  const after = afterAsc(req.query.cursor);
  if (after) and.push(after);
  const rows = await M('FriendsPost').findAll({ where: { [Op.and]: and }, order: [['createdAt', 'ASC'], ['id', 'ASC']], limit: limit + 1 });
  const { items, nextCursor } = cursor.page(rows, limit);
  send(res, 200, { items: await serializePosts(req, [...items], me), nextCursor });
};

const mentionedUsers = async (text, me, campusId) => {
  const codes = new Set();
  let m;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(String(text || ''))) !== null) {
    codes.add(m[2].toUpperCase());
    if (codes.size >= MAX_MENTION_NOTIFY) break;
  }
  if (!codes.size) return [];
  const users = await M('User').findAll({ where: { friendCode: { [Op.in]: [...codes] }, isActive: true }, attributes: ['id'] });
  const ids = users.map((u) => String(u.id)).filter((u) => u !== String(me));
  if (!ids.length) return [];
  const profiles = await M('CampusProfile').findAll({ where: { userId: { [Op.in]: ids }, campusId, verificationStatus: 'verified' }, attributes: ['userId'] });
  const blocked = await blocks.blockedIds(me);
  return profiles.map((p) => String(p.userId)).filter((u) => !blocked.has(u));
};

// POST /posts { text, mediaIds, link, poll{options, durationHours}, replyPolicy, anonymous, parentId, entityId, clientId }
const createPost = async (req, res) => {
  const me = req.user.id;
  const { ctx, cfg } = req.friends;
  const b = req.body || {};
  const campusId = campusOf(req);
  const FriendsPost = M('FriendsPost');

  const clientId = b.clientId === undefined || b.clientId === null || b.clientId === '' ? null : requireUuid(String(b.clientId), 'clientId');
  if (clientId) {
    const existing = await FriendsPost.findOne({ where: { authorId: me, clientId } });
    if (existing) return send(res, 200, { post: await serializeOne(req, existing, me), duplicate: true });
  }

  // Reply or root post.
  let parent = null;
  let root = null;
  if (b.parentId !== undefined && b.parentId !== null && b.parentId !== '') {
    parent = await loadPostFor(req, String(b.parentId), { interactive: true });
    root = parent.rootId ? await FriendsPost.findByPk(parent.rootId) : parent;
    if (!root || root.status !== 'visible' || String(root.campusId) !== String(campusId)) throw fail(409, 'POST_NOT_OPEN', 'This conversation is closed.');
    if (!root.isAnonymous && String(root.authorId) !== me && (await blocks.blockedIds(me)).has(String(root.authorId))) {
      throw fail(404, 'POST_NOT_FOUND', 'Post not found.');
    }
    let followsMe = false;
    if (root.replyPolicy === 'following' && String(root.authorId) !== me) {
      followsMe = !!(await M('FriendsEdge').findOne({ where: { userId: root.authorId, kind: 'follow', targetType: 'user', targetId: me }, attributes: ['id'] }));
    }
    if (!replyAllowed(root, me, followsMe)) {
      throw fail(403, 'REPLIES_RESTRICTED', root.replyPolicy === 'none' ? 'Replies are turned off for this post.' : 'Only people the author follows can reply.', { replyPolicy: root.replyPolicy });
    }
  }
  const isReply = !!parent;

  const media = await resolveMedia(b.mediaIds, me);
  const text = parseText(b.text, { required: !media.length });
  const poll = parsePoll(b.poll);
  if (poll && isReply) throw fail(400, 'POLL_NOT_ALLOWED', 'Replies cannot have polls.');
  if (poll && !text) throw fail(400, 'EMPTY_POST', 'Ask your poll question in the text.');
  const { link, flagged: linkFlag } = parseLink(b.link, cfg);

  let entity = null;
  if (b.entityId !== undefined && b.entityId !== null && b.entityId !== '') entity = await managedEntity(String(b.entityId), me, campusId);
  const anonymous = b.anonymous === undefined
    ? !entity && !!(ctx.settings && ctx.settings.defaultAnonymous)
    : b.anonymous === true;
  if (anonymous && entity) throw fail(400, 'ENTITY_NOT_ANONYMOUS', 'Posts from a club or official account cannot be anonymous.');

  let replyPolicy = 'everyone';
  if (!isReply && b.replyPolicy !== undefined && b.replyPolicy !== null) {
    replyPolicy = String(b.replyPolicy);
    if (!P.REPLY_POLICIES.includes(replyPolicy)) throw fail(400, 'INVALID_REPLY_POLICY', `replyPolicy must be one of ${P.REPLY_POLICIES.join(', ')}.`);
    if (anonymous && replyPolicy === 'following') throw fail(400, 'ANON_POLICY', 'Anonymous posts can allow replies from everyone or no one.');
  }
  if (isReply) replyPolicy = root.replyPolicy;

  const decision = contentPolicy.enforce([text, ...(poll ? poll.labels : [])].filter(Boolean).join('\n'), { kind: isReply ? 'reply' : 'post', cfg });
  limiter.enforce(me, isReply ? 'pulse_reply' : 'pulse_post');

  const reasons = [...(decision.decision === 'flag' ? decision.reasons : []), ...(linkFlag ? ['LINK_SHORTENER'] : [])];
  const status = reasons.length ? 'pending_review' : 'visible';
  const id = crypto.randomUUID();
  const rootId = isReply ? root.id : null;
  const aliasName = anonymous ? await alias.getAlias(`pulse:${rootId || id}`, me) : null;

  // The poll row is written first so the post is never visible without it.
  let pollRow = null;
  if (poll) {
    pollRow = await M('FriendsPoll').create({ postId: id, options: poll.labels, closesAt: new Date(Date.now() + poll.hours * HOUR) });
  }
  let post;
  try {
    post = await FriendsPost.create({
      id,
      campusId,
      authorId: me,
      entityId: entity ? entity.id : null,
      clientId,
      source: 'app',
      isAnonymous: anonymous,
      aliasName,
      kind: isReply ? 'reply' : 'post',
      rootId,
      parentId: isReply ? parent.id : null,
      text,
      media,
      link,
      pollId: pollRow ? pollRow.id : null,
      replyPolicy,
      status,
    });
  } catch (err) {
    if (pollRow) await M('FriendsPoll').destroy({ where: { id: pollRow.id } }).catch(() => {});
    if (!isUniqueError(err) || !clientId) throw err;
    const existing = await FriendsPost.findOne({ where: { authorId: me, clientId } });
    return send(res, 200, { post: await serializeOne(req, existing, me), duplicate: true });
  }

  await trends.syncHashtags(post);
  if (isReply) await recountReplies(parent.id);

  if (reasons.length) {
    await reportsSvc.fileSystemReport({ targetType: isReply ? 'reply' : 'post', targetId: post.id, category: flagCategory(reasons), note: `Automatic check: ${reasons.join(', ')}` });
  } else {
    const who = anonymous ? aliasName : (entity ? entity.name : (ctx.user.name || 'A student'));
    const preview = text ? (text.length > 100 ? `${text.slice(0, 100)}...` : text) : 'sent a photo';
    if (isReply) {
      const recipients = [parent.authorId, root.authorId].map(String).filter((u) => u !== String(me));
      await notify('FRIENDS_REPLY', recipients, { id: post.id, dedupeKey: `reply:${post.id}`, body: `${who} replied: ${preview}`, data: { postId: post.id, rootId } });
    }
    const mentioned = (await mentionedUsers(text, me, campusId)).filter((u) => !isReply || (u !== String(parent.authorId) && u !== String(root.authorId)));
    if (mentioned.length) {
      await notify('FRIENDS_MENTION', mentioned, { id: post.id, dedupeKey: `mention:${post.id}`, body: `${who} mentioned you: ${preview}`, data: { postId: post.id, rootId: rootId || post.id } });
    }
  }
  send(res, 201, { post: await serializeOne(req, post, me), duplicate: false, underReview: status === 'pending_review' });
};

const auditSelf = (row, action, meta) => audit.recordSafe({
  // Anonymous content: no actor / subject id, so the audit list cannot de-anonymise it.
  actorId: row.isAnonymous ? null : row.authorId,
  actorRole: 'self',
  action,
  targetType: row.kind === 'reply' ? 'reply' : 'post',
  targetId: row.id,
  subjectUserId: row.isAnonymous ? null : row.authorId,
  meta: { ...meta, anonymous: !!row.isAnonymous },
});

// PATCH /posts/:id { text } — author only; the previous text goes to the audit trail.
const updatePost = async (req, res) => {
  const me = req.user.id;
  const { cfg } = req.friends;
  const post = await loadPostFor(req, req.params.id, { allowOwn: true });
  if (String(post.authorId) !== String(me) || post.kind === 'space_card') throw fail(403, 'NOT_AUTHOR', 'You can only edit your own posts.');
  if (['removed', 'hidden'].includes(post.status)) throw fail(409, 'REMOVED', 'This post was removed by a moderator. You can appeal the decision.');
  const b = req.body || {};
  if (b.text === undefined) throw fail(400, 'NOTHING_TO_UPDATE', 'Nothing to update.');
  const text = parseText(b.text, { required: !(post.media || []).length });
  const decision = contentPolicy.enforce(text || '', { kind: post.kind === 'reply' ? 'reply' : 'post', cfg });
  limiter.enforce(me, 'pulse_edit');
  const previous = post.text;
  post.text = text;
  post.editedAt = new Date();
  const flagged = decision.decision === 'flag';
  if (flagged && post.status === 'visible') post.status = 'pending_review';
  await post.save({ fields: ['text', 'editedAt', 'status'] });
  await trends.syncHashtags(post);
  if (post.parentId) await recountReplies(post.parentId);
  await auditSelf(post, 'edit_self', { previous });
  if (flagged) {
    await reportsSvc.fileSystemReport({ targetType: post.kind === 'reply' ? 'reply' : 'post', targetId: post.id, category: flagCategory(decision.reasons), note: `Automatic check after edit: ${decision.reasons.join(', ')}` });
  }
  send(res, 200, { post: await serializeOne(req, post, me), underReview: post.status === 'pending_review' });
};

// DELETE /posts/:id — author only (status 'deleted', the row is kept as evidence).
const deletePost = async (req, res) => {
  const me = req.user.id;
  const post = await loadPostFor(req, req.params.id, { allowOwn: true });
  if (String(post.authorId) !== String(me) || post.kind === 'space_card') throw fail(403, 'NOT_AUTHOR', 'You can only delete your own posts.');
  await setPostStatus(post, 'deleted');
  await auditSelf(post, 'delete_self', { text: post.text });
  send(res, 200, { deleted: true });
};

// ═════════════════════════════════════════════════════════════════════════════
// Likes, reposts, bookmarks (FriendsReactions, idempotent)
// ═════════════════════════════════════════════════════════════════════════════

const react = (kind, action) => async (req, res) => {
  const me = req.user.id;
  const FriendsReaction = M('FriendsReaction');
  if (action === 'remove') {
    const id = requireUuid(req.params.id, 'post');
    const removed = await FriendsReaction.destroy({ where: { userId: me, targetType: 'post', targetId: id, kind } });
    if (kind !== 'bookmark') await recountReaction(id, kind);
    const c = kind === 'bookmark' ? {} : await counts(id);
    return send(res, 200, { [kind === 'like' ? 'liked' : kind === 'repost' ? 'reposted' : 'bookmarked']: false, removed: removed > 0, ...c });
  }
  const post = await loadPostFor(req, req.params.id, { interactive: kind !== 'bookmark' });
  if (kind === 'repost' && post.isAnonymous) throw fail(409, 'ANONYMOUS_NO_REPOST', 'Anonymous posts cannot be reposted.');
  if (kind === 'bookmark' && post.kind === 'space_card') throw fail(409, 'NOT_INTERACTIVE', 'Open the Space to join in.');
  limiter.enforce(me, `pulse_${kind}`);
  let duplicate = false;
  try {
    await FriendsReaction.create({ userId: me, targetType: 'post', targetId: post.id, kind });
  } catch (err) {
    if (!isUniqueError(err)) throw err;
    duplicate = true;
  }
  if (kind !== 'bookmark') await recountReaction(post.id, kind);
  const c = kind === 'bookmark' ? {} : await counts(post.id);
  send(res, duplicate ? 200 : 201, { [kind === 'like' ? 'liked' : kind === 'repost' ? 'reposted' : 'bookmarked']: true, duplicate, ...c });
};

// GET /bookmarks?cursor=
const listBookmarks = async (req, res) => {
  const me = req.user.id;
  const limit = cursor.pageSize(req.query.limit, 20);
  const and = [{ userId: me, targetType: 'post', kind: 'bookmark' }];
  const after = cursor.after(req.query.cursor);
  if (after) and.push(after);
  const marks = await M('FriendsReaction').findAll({ where: { [Op.and]: and }, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: limit + 1 });
  const { items, nextCursor } = cursor.page(marks, limit);
  const blocked = await blocks.blockedIds(me);
  const posts = await M('FriendsPost').findAll({ where: { id: { [Op.in]: items.map((m) => m.targetId) }, campusId: campusOf(req), status: 'visible', kind: { [Op.in]: ['post', 'reply'] } } });
  const byId = new Map(posts.filter((p) => p.isAnonymous || String(p.authorId) === me || !blocked.has(String(p.authorId))).map((p) => [String(p.id), p]));
  const ordered = items.map((m) => byId.get(String(m.targetId))).filter(Boolean);
  send(res, 200, { items: await serializePosts(req, ordered, me), nextCursor });
};

// ═════════════════════════════════════════════════════════════════════════════
// Polls
// ═════════════════════════════════════════════════════════════════════════════

// POST /polls/:id/vote { optionIdx } — one vote per person; results after voting or once closed.
const votePoll = async (req, res) => {
  const me = req.user.id;
  const pollId = requireUuid(req.params.id, 'poll');
  const poll = await M('FriendsPoll').findByPk(pollId);
  if (!poll) throw fail(404, 'POLL_NOT_FOUND', 'Poll not found.');
  const post = await loadPostFor(req, poll.postId, { interactive: true });
  if (String(post.pollId) !== String(poll.id)) throw fail(404, 'POLL_NOT_FOUND', 'Poll not found.');
  const idx = Number((req.body || {}).optionIdx);
  if (!Number.isInteger(idx) || idx < 0 || idx >= (poll.options || []).length) throw fail(400, 'INVALID_OPTION', 'Pick one of the poll options.');
  if (new Date(poll.closesAt).getTime() <= Date.now()) throw fail(409, 'POLL_CLOSED', 'This poll has ended.');
  limiter.enforce(me, 'pulse_poll_vote');
  let duplicate = false;
  try {
    await M('FriendsPollVote').create({ pollId: poll.id, userId: me, optionIdx: idx });
  } catch (err) {
    if (!isUniqueError(err)) throw err;
    const mine = await M('FriendsPollVote').findOne({ where: { pollId: poll.id, userId: me } });
    if (!mine || Number(mine.optionIdx) !== idx) throw fail(409, 'ALREADY_VOTED', 'You already voted in this poll.', { myVote: mine ? Number(mine.optionIdx) : null });
    duplicate = true;
  }
  const tally = (await pollTallies([poll.id])).get(String(poll.id));
  send(res, duplicate ? 200 : 201, { poll: pollOut(poll, tally, idx, String(post.authorId) === me), duplicate });
};

// ═════════════════════════════════════════════════════════════════════════════
// Space cards (written by the Spaces phase; shown only while the spaces flag is on)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Creates or updates the Pulse card of a Space. Call it whenever a Space is created, rescheduled,
 * started, ended or cancelled. space = { id, campusId, hostId, entityId?, title, status }.
 * The card is visible while the Space is scheduled or live, and 'deleted' otherwise.
 */
const upsertSpaceCard = async (space, { transaction } = {}) => {
  const FriendsPost = M('FriendsPost');
  const status = ['scheduled', 'live'].includes(space.status) ? 'visible' : 'deleted';
  const existing = await FriendsPost.findOne({ where: { kind: 'space_card', spaceId: space.id }, transaction });
  if (existing) {
    existing.text = String(space.title || '').slice(0, P.MAX_TEXT);
    existing.status = status;
    existing.entityId = space.entityId || null;
    await existing.save({ fields: ['text', 'status', 'entityId'], transaction });
    return existing;
  }
  return FriendsPost.create({
    campusId: space.campusId,
    authorId: space.hostId,
    entityId: space.entityId || null,
    source: 'system',
    kind: 'space_card',
    spaceId: space.id,
    text: String(space.title || '').slice(0, P.MAX_TEXT),
    replyPolicy: 'none',
    status,
  }, { transaction });
};

// ═════════════════════════════════════════════════════════════════════════════
// Moderation (admin) — community-wide decisions come from the unified queue too
// ═════════════════════════════════════════════════════════════════════════════

const ADMIN_ACTIONS = ['remove', 'hide', 'restore', 'approve'];
const OPEN = reportsSvc.OPEN_STATUSES;

const reportKeys = (post) => [{ targetType: 'post', targetId: post.id }, { targetType: 'reply', targetId: post.id }];

const closeReports = async (post, { status, decision, actorId, actionId, note }) => {
  const keys = reportKeys(post);
  const [n] = await M('FriendsReport').update(
    { status, decision, resolvedBy: actorId, resolvedAt: new Date(), resolution: note || null, actionId },
    { where: { [Op.or]: keys, status: { [Op.in]: OPEN } } },
  );
  if (n) notifyAdmin('friends_report', 'updated', post.id, { scope: 'pulse' });
  return n;
};

const moderatePost = async (actorId, post, action, reason) => {
  if (!ADMIN_ACTIONS.includes(action)) throw fail(400, 'INVALID_ACTION', `Action must be one of ${ADMIN_ACTIONS.join(', ')}.`);
  if (post.status === 'deleted') throw fail(404, 'POST_NOT_FOUND', 'Post not found.');
  if (['remove', 'hide'].includes(action) && (!reason || reason.length < 3)) {
    throw fail(400, 'REASON_REQUIRED', 'Give a short reason. The author sees it and can appeal.');
  }
  if (action === 'restore' && post.status === 'visible') throw fail(409, 'ALREADY_VISIBLE', 'This post is already visible.');
  if (action === 'approve' && post.status !== 'pending_review') throw fail(409, 'NOT_PENDING', 'This post is not waiting for review.');
  const next = action === 'remove' ? 'removed' : action === 'hide' ? 'hidden' : 'visible';
  await setPostStatus(post, next, reason);
  const row = await audit.record({
    actorId,
    actorRole: 'admin',
    action,
    targetType: post.kind === 'reply' ? 'reply' : 'post',
    targetId: post.id,
    subjectUserId: ['remove', 'hide'].includes(action) ? post.authorId : null,
    anonymous: !!post.isAnonymous,
    reason: reason || null,
  });
  if (['remove', 'hide'].includes(action)) {
    await closeReports(post, { status: 'actioned', decision: action, actorId, actionId: row.id, note: reason });
    await notify('MOD_OUTCOME', [post.authorId], { id: row.id, dedupeKey: `decision:${row.id}`, data: { kind: 'decision', actionId: row.id } });
  }
  if (action === 'approve') await closeReports(post, { status: 'dismissed', decision: 'dismiss', actorId, actionId: row.id, note: reason || 'Approved after review' });
  trends.clearTrends(post.campusId);
  return row;
};

const adminCampus = async (raw) => {
  if (raw === undefined || raw === null || raw === '') return null;
  const id = requireUuid(String(raw), 'campus');
  const c = await M('Campus').findByPk(id);
  if (!c) throw fail(404, 'CAMPUS_NOT_FOUND', 'Campus not found.');
  return c.id;
};

// GET /admin/posts?campusId=&status=&kind=&q=&anonymous=&cursor=
const adminListPosts = async (req, res) => {
  const limit = cursor.pageSize(req.query.limit, 30);
  const campusId = await adminCampus(req.query.campusId);
  const and = [];
  if (campusId) and.push({ campusId });
  const status = req.query.status ? String(req.query.status) : null;
  if (status) {
    if (!P.POST_STATUS.includes(status)) throw fail(400, 'INVALID_STATUS', `status must be one of ${P.POST_STATUS.join(', ')}.`);
    and.push({ status });
  } else and.push({ status: { [Op.ne]: 'deleted' } });
  const kind = req.query.kind ? String(req.query.kind) : null;
  if (kind) {
    if (!P.POST_KINDS.includes(kind)) throw fail(400, 'INVALID_KIND', `kind must be one of ${P.POST_KINDS.join(', ')}.`);
    and.push({ kind });
  } else and.push({ kind: { [Op.in]: ['post', 'reply'] } });
  if (req.query.anonymous === 'true') and.push({ isAnonymous: true });
  if (req.query.anonymous === 'false') and.push({ isAnonymous: false });
  const q = typeof req.query.q === 'string' ? req.query.q.trim().replace(/[%_\\]/g, '').slice(0, 60) : '';
  if (q.length >= 2) and.push({ text: { [likeOp()]: `%${q}%` } });
  const after = cursor.after(req.query.cursor);
  if (after) and.push(after);
  const rows = await M('FriendsPost').findAll({ where: { [Op.and]: and }, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: limit + 1 });
  const { items, nextCursor } = cursor.page(rows, limit);
  const dtos = await serializePosts(req, items, null, { admin: true });
  const ids = items.map((p) => p.id);
  const reportRows = ids.length ? await M('FriendsReport').findAll({
    where: { targetType: { [Op.in]: ['post', 'reply'] }, targetId: { [Op.in]: ids }, status: { [Op.in]: OPEN } },
    attributes: ['targetId'],
  }) : [];
  const openReports = reportRows.reduce((m, r) => m.set(String(r.targetId), (m.get(String(r.targetId)) || 0) + 1), new Map());
  const campusOfPost = new Map(items.map((p) => [String(p.id), p.campusId]));
  send(res, 200, {
    items: dtos.map((d) => ({ ...d, campusId: campusOfPost.get(String(d.id)) || null, openReports: openReports.get(String(d.id)) || 0 })),
    nextCursor,
  });
};

// POST /admin/posts/:id/:action { reason }   action = remove | hide | restore | approve
const adminModPost = async (req, res) => {
  const id = requireUuid(req.params.id, 'post');
  const post = await M('FriendsPost').findByPk(id);
  if (!post || post.kind === 'space_card') throw fail(404, 'POST_NOT_FOUND', 'Post not found.');
  const reason = optText((req.body || {}).reason, 300, 'Reason');
  const row = await moderatePost(req.user.id, post, String(req.params.action), reason);
  send(res, 200, { ok: true, actionId: row.id, status: post.status });
};

// GET /admin/trends?campusId=  (fresh, uncached)
const adminTrends = async (req, res) => {
  const campusId = await adminCampus(req.query.campusId);
  if (!campusId) throw fail(400, 'CAMPUS_REQUIRED', 'Pick a campus.');
  send(res, 200, { items: await trends.getTrends(campusId, { fresh: true }) });
};

// GET /admin/stats?campusId=
const adminStats = async (req, res) => {
  const campusId = await adminCampus(req.query.campusId);
  const since = new Date(Date.now() - 24 * HOUR);
  const base = campusId ? { campusId } : {};
  const Post = M('FriendsPost');
  const [posts24h, replies24h, pending, removed, anonymous24h, authors] = await Promise.all([
    Post.count({ where: { ...base, kind: 'post', status: { [Op.ne]: 'deleted' }, createdAt: { [Op.gte]: since } } }),
    Post.count({ where: { ...base, kind: 'reply', status: { [Op.ne]: 'deleted' }, createdAt: { [Op.gte]: since } } }),
    Post.count({ where: { ...base, status: 'pending_review' } }),
    Post.count({ where: { ...base, status: { [Op.in]: ['removed', 'hidden'] } } }),
    Post.count({ where: { ...base, isAnonymous: true, kind: { [Op.in]: ['post', 'reply'] }, status: { [Op.ne]: 'deleted' }, createdAt: { [Op.gte]: since } } }),
    Post.count({ where: { ...base, kind: { [Op.in]: ['post', 'reply'] }, status: { [Op.ne]: 'deleted' }, createdAt: { [Op.gte]: since } }, distinct: true, col: 'authorId' }),
  ]);
  const imported = await Post.count({ where: { ...base, source: 'whisper' } });
  send(res, 200, { posts24h, replies24h, anonymous24h, activeAuthors24h: authors, pendingReview: pending, removedOrHidden: removed, importedWhispers: imported });
};

// POST /admin/backfill-whispers — re-runs the idempotent whisper import (decision D3).
const adminBackfill = async (req, res) => {
  const { backfillWhispers } = require('../scripts/backfill_whispers');
  const stats = await backfillWhispers(getSequelize());
  console.log(`[FRIENDS_AUDIT] admin pulse whisper backfill imported=${stats.imported}`);
  send(res, 200, { ok: true, stats });
};

// ═════════════════════════════════════════════════════════════════════════════
// Report / moderation target resolvers ('post' and 'reply' both resolve a FriendsPost)
// ═════════════════════════════════════════════════════════════════════════════

const sameCampusViewer = async (viewerId, campusId) => {
  if (!viewerId) return true;
  const p = await M('CampusProfile').findOne({ where: { userId: viewerId }, attributes: ['campusId'] });
  return !!p && String(p.campusId) === String(campusId);
};

const postResolver = {
  statuses: ['pending_review', 'hidden', 'removed', 'visible'],
  async load(id, { viewerId } = {}) {
    if (!isUuid(String(id))) return null;
    const p = await M('FriendsPost').findByPk(id);
    if (!p || p.status === 'deleted') return null;
    if (viewerId) {
      if (!(await sameCampusViewer(viewerId, p.campusId))) return null;
      const isMine = String(p.authorId) === String(viewerId);
      if (p.status !== 'visible' && !isMine) return null;
      if (!p.isAnonymous && !isMine && (await blocks.blockedIds(viewerId)).has(String(p.authorId))) return null;
    }
    return {
      ownerId: p.authorId,
      campusId: p.campusId,
      subTab: 'pulse',
      snapshot: {
        excerpt: targets.excerpt(p.text || ''),
        mediaIds: (p.media || []).map((m) => m.mediaId),
        link: p.link ? p.link.url : undefined,
        anonymous: !!p.isAnonymous,
        alias: p.isAnonymous ? p.aliasName : undefined,
        kind: p.kind,
        rootId: p.rootId || undefined,
        createdAt: p.createdAt,
      },
    };
  },
  async setStatus(id, status) {
    const p = await M('FriendsPost').findByPk(id);
    if (!p || p.status === 'deleted') return false;
    await setPostStatus(p, status, status === 'visible' ? null : 'Moderation decision');
    trends.clearTrends(p.campusId);
    return true;
  },
  async revealAuthor(id) {
    const p = await M('FriendsPost').findByPk(id, { attributes: ['authorId', 'isAnonymous'] });
    return p && p.isAnonymous ? p.authorId : null;
  },
  async currentState(id) {
    const p = await M('FriendsPost').findByPk(id);
    return p ? {
      exists: true, status: p.status, kind: p.kind, anonymous: !!p.isAnonymous, likeCount: p.likeCount, replyCount: p.replyCount,
      repostCount: p.repostCount, edited: !!p.editedAt, imported: p.source === 'whisper',
    } : { exists: false };
  },
};
targets.register('post', postResolver);
targets.register('reply', postResolver);

module.exports = {
  feed,
  getTrends: getTrendsRoute,
  hashtagFeed,
  userPosts,
  myPosts,
  getPost,
  listReplies,
  createPost,
  updatePost,
  deletePost,
  like: react('like', 'add'),
  unlike: react('like', 'remove'),
  repost: react('repost', 'add'),
  unrepost: react('repost', 'remove'),
  bookmark: react('bookmark', 'add'),
  unbookmark: react('bookmark', 'remove'),
  listBookmarks,
  votePoll,
  adminListPosts,
  adminModPost,
  adminTrends,
  adminStats,
  adminBackfill,
  // for the Spaces phase
  upsertSpaceCard,
  // internals for tests
  _internal: { setPostStatus, recountReplies, recountReaction },
};
