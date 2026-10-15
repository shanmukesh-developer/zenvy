/**
 * Connect data lifecycle: transactions, ending a match, full deletion, and retention purges.
 *
 * deleteConnectData(userId) — one transaction (DELETE /connect/profile, admin removal, account cleanup):
 *   - the ConnectProfile row (no soft delete);
 *   - every ConnectPhoto row and EVERY CampusMedia row the user owns with purpose 'connect' or
 *     'liveness_selfie' (the bytes live in Postgres, so this really deletes the images);
 *   - swipes in both directions;
 *   - every match of the user, its Connect conversation and all messages in it (for both people);
 *   - Connect consents are marked withdrawn (the record that consent was given and withdrawn is kept);
 *   - FriendsReport snapshots are kept as lawful evidence (they hold text excerpts only).
 *   Afterwards the other people's apps get `friends:connect_updated {matchId, status:'ended'}` and every
 *   socket leaves the deleted chat rooms, so nothing more is delivered.
 *
 * purge() — retention (runs from the router timer and POST /connect/admin/jobs/run):
 *   - ended matches (unmatched / blocked) older than CONNECT_CHAT_RETENTION_DAYS (default 30): their
 *     messages and conversation are deleted; the match row stays (purgedAt) so the pair cannot rematch;
 *   - liveness selfies still waiting for a decision after 30 days are deleted (status back to 'none').
 */
const { Op } = require('sequelize');
const { getModel, getSequelize } = require('../index');

const DAY = 24 * 60 * 60 * 1000;
const LIVENESS_PENDING_MAX_DAYS = 30;
const MEDIA_PURPOSES = ['connect', 'liveness_selfie'];

const M = (name) => getModel(name);

const retentionDays = () => {
  const n = Number(process.env.CONNECT_CHAT_RETENTION_DAYS);
  return Number.isFinite(n) && n >= 1 && n <= 365 ? n : 30;
};

// SQLite (dev / tests) has one connection for ':memory:' and cannot run two transactions at once, so
// Connect transactions are queued there. Postgres runs them concurrently; the unique indexes and the
// conditional UPDATEs keep them correct.
let chain = Promise.resolve();
const serial = (fn) => {
  const run = chain.then(() => fn());
  chain = run.catch(() => {});
  return run;
};
const runTx = (fn) => {
  const seq = getSequelize();
  if (seq.getDialect() === 'postgres') return seq.transaction((t) => fn(t));
  // IMMEDIATE: these transactions read before they write; a deferred SQLite transaction then fails
  // with SQLITE_BUSY when another connection wrote in between.
  return serial(() => seq.transaction({ type: require('sequelize').Transaction.TYPES.IMMEDIATE }, (t) => fn(t)));
};

// ── Realtime (best effort; the app also refetches on focus) ──────────────────
let ioRef = null;
const setIo = (io) => { if (io) ioRef = io; };
const nsp = () => (ioRef && typeof ioRef.of === 'function' ? ioRef.of('/campus') : null);

/** Tells users' apps something changed. Payloads never carry names, photos or user ids. */
const emitTo = (userIds, event, payload) => {
  try {
    const n = nsp();
    if (!n) return;
    for (const u of new Set((userIds || []).filter(Boolean).map(String))) n.to(`user:${u}`).emit(event, payload);
  } catch { /* best effort */ }
};

/** Every socket of these users leaves the chat room, so a stale socket receives nothing more. */
const leaveChat = (userIds, conversationId) => {
  try {
    const n = nsp();
    if (!n || !conversationId) return;
    for (const u of new Set((userIds || []).filter(Boolean).map(String))) n.in(`user:${u}`).socketsLeave(`chat:${conversationId}`);
  } catch { /* best effort */ }
};

const pairOf = (match) => [String(match.userLowId), String(match.userHighId)];

/**
 * active -> unmatched | blocked (conditional, so only one caller wins) and closes the chat.
 * @returns {Promise<boolean>} true when this call ended the match
 */
const endMatch = async (matchId, { status = 'unmatched', by = null, transaction } = {}) => {
  const exec = async (t) => {
    const ConnectMatch = M('ConnectMatch');
    const [n] = await ConnectMatch.update(
      { status, endedAt: new Date(), endedBy: by },
      { where: { id: matchId, status: 'active' }, transaction: t },
    );
    if (n !== 1) return null;
    const match = await ConnectMatch.findByPk(matchId, { transaction: t });
    if (match && match.conversationId) {
      await M('Conversation').update({ closedAt: new Date() }, { where: { id: match.conversationId, closedAt: null }, transaction: t });
    }
    return match;
  };
  const match = transaction ? await exec(transaction) : await runTx(exec);
  if (match && !transaction) afterEnded(match);
  return !!match;
};

/** Realtime side of an ended match (call after the transaction committed). */
const afterEnded = (match) => {
  const users = pairOf(match);
  leaveChat(users, match.conversationId);
  emitTo(users, 'friends:connect_updated', { matchId: match.id, status: 'ended' });
};

const markLegacyConnectBlocks = async (u, matches, transaction) => {
  const Friendship = M('Friendship');
  if (!Friendship) return;
  const fb = require('../../../utils/friendshipBlocks');
  const rows = await Friendship.findAll({ where: { status: 'blocked', [Op.or]: [{ requesterId: u }, { recipientId: u }] }, transaction });
  const legacy = rows.filter((r) => Object.values(fb.blockersOf(r)).some((src) => !src));
  if (!legacy.length) return;
  const peers = legacy.map((r) => String(r.requesterId) === u ? String(r.recipientId) : String(r.requesterId));
  const swipes = await M('ConnectSwipe').findAll({
    where: { [Op.or]: [{ fromUserId: u, toUserId: { [Op.in]: peers } }, { toUserId: u, fromUserId: { [Op.in]: peers } }] },
    attributes: ['fromUserId', 'toUserId'], transaction,
  });
  const viaConnect = new Set();
  swipes.forEach((s) => viaConnect.add(String(s.fromUserId) === u ? String(s.toUserId) : String(s.fromUserId)));
  matches.forEach((m) => viaConnect.add(String(m.userLowId) === u ? String(m.userHighId) : String(m.userLowId)));
  for (const r of legacy) {
    const peer = String(r.requesterId) === u ? String(r.recipientId) : String(r.requesterId);
    if (!viaConnect.has(peer)) continue;
    const meta = fb.blockersOf(r);
    Object.keys(meta).forEach((k) => { if (!meta[k]) meta[k] = 'connect'; });
    await r.update({ blockMeta: JSON.stringify(meta) }, { transaction });
  }
};

/** Deletes everything Connect holds about one user. Returns counts of what was deleted. */
const deleteConnectData = async (userId) => {
  const u = String(userId);
  const out = await runTx(async (transaction) => {
    const profile = await M('ConnectProfile').findOne({ where: { userId: u }, transaction });
    const matches = await M('ConnectMatch').findAll({
      where: { [Op.or]: [{ userLowId: u }, { userHighId: u }] },
      transaction,
    });
    const convIds = matches.map((m) => m.conversationId).filter(Boolean);
    let messages = 0;
    let conversations = 0;
    if (convIds.length) {
      messages = await M('Message').destroy({ where: { conversationId: { [Op.in]: convIds } }, transaction });
      conversations = await M('Conversation').destroy({ where: { id: { [Op.in]: convIds }, refType: 'connect' }, transaction });
    }
    const matchCount = matches.length
      ? await M('ConnectMatch').destroy({ where: { id: { [Op.in]: matches.map((m) => m.id) } }, transaction })
      : 0;
    // Blocks made before block sources were stored are recognised as Connect blocks only through
    // the swipe / match history deleted below. Record the source first so those block-list entries
    // stay masked afterwards (B2).
    await markLegacyConnectBlocks(u, matches, transaction);
    const swipes = await M('ConnectSwipe').destroy({ where: { [Op.or]: [{ fromUserId: u }, { toUserId: u }] }, transaction });
    const photos = await M('ConnectPhoto').destroy({ where: { userId: u }, transaction });
    const CampusMedia = M('CampusMedia');
    const media = CampusMedia
      ? await CampusMedia.destroy({ where: { ownerId: u, purpose: { [Op.in]: MEDIA_PURPOSES } }, transaction })
      : 0;
    const FriendsConsent = M('FriendsConsent');
    const consentsWithdrawn = FriendsConsent
      ? (await FriendsConsent.update(
        { withdrawnAt: new Date() },
        { where: { userId: u, kind: { [Op.in]: ['connect', 'connect_age_declaration', 'liveness'] }, withdrawnAt: null }, transaction },
      ))[0]
      : 0;
    const profiles = profile ? await M('ConnectProfile').destroy({ where: { id: profile.id }, transaction }) : 0;
    return {
      matches,
      summary: { profile: profiles, photos, media, swipes, matches: matchCount, conversations, messages, consentsWithdrawn },
    };
  });
  for (const m of out.matches) {
    const users = pairOf(m);
    leaveChat(users, m.conversationId);
    const other = users.find((x) => x !== u);
    if (m.status === 'active') emitTo([other], 'friends:connect_updated', { matchId: m.id, status: 'ended' });
    emitTo([u], 'friends:connect_updated', { matchId: m.id, status: 'deleted' });
  }
  return out.summary;
};

/** Retention purges (idempotent; safe to run twice or from two instances). */
const purge = async () => {
  const stats = { chatsPurged: 0, messagesDeleted: 0, selfiesExpired: 0 };
  const cutoff = new Date(Date.now() - retentionDays() * DAY);
  const ended = await M('ConnectMatch').findAll({
    where: { status: { [Op.in]: ['unmatched', 'blocked'] }, purgedAt: null, endedAt: { [Op.lt]: cutoff } },
    limit: 200,
  });
  for (const m of ended) {
    await runTx(async (transaction) => {
      const [n] = await M('ConnectMatch').update({ purgedAt: new Date() }, { where: { id: m.id, purgedAt: null }, transaction });
      if (n !== 1) return;
      if (m.conversationId) {
        stats.messagesDeleted += await M('Message').destroy({ where: { conversationId: m.conversationId }, transaction });
        await M('Conversation').destroy({ where: { id: m.conversationId, refType: 'connect' }, transaction });
        await M('ConnectMatch').update({ conversationId: null }, { where: { id: m.id }, transaction });
      }
      stats.chatsPurged++;
    });
  }
  const stale = await M('ConnectProfile').findAll({
    where: { livenessStatus: 'pending', livenessSubmittedAt: { [Op.lt]: new Date(Date.now() - LIVENESS_PENDING_MAX_DAYS * DAY) } },
    limit: 200,
  });
  for (const p of stale) {
    const [n] = await M('ConnectProfile').update(
      { livenessStatus: 'none', livenessMediaId: null, livenessSubmittedAt: null, livenessNote: 'Your selfie check expired before it was reviewed. Please try again.' },
      { where: { id: p.id, livenessStatus: 'pending' } },
    );
    if (n === 1) {
      if (p.livenessMediaId && M('CampusMedia')) await M('CampusMedia').destroy({ where: { id: p.livenessMediaId, ownerId: p.userId } });
      stats.selfiesExpired++;
    }
  }
  return stats;
};

// ── Timer (no-op under NODE_ENV=test or CONNECT_JOBS=off) ────────────────────
let timer = null;
let running = null;
const runJobs = () => {
  if (!running) running = purge().finally(() => { running = null; });
  return running;
};
const start = () => {
  if (timer || process.env.NODE_ENV === 'test' || process.env.CONNECT_JOBS === 'off') return false;
  const tick = () => runJobs().catch((err) => console.warn('[CONNECT_JOBS_WARN]', err.message));
  setTimeout(() => {
    tick();
    timer = setInterval(tick, 60 * 60 * 1000);
    if (timer.unref) timer.unref();
  }, 90 * 1000).unref?.();
  timer = true;
  return true;
};

module.exports = {
  runTx,
  setIo,
  emitTo,
  leaveChat,
  endMatch,
  afterEnded,
  deleteConnectData,
  purge,
  runJobs,
  start,
  retentionDays,
  MEDIA_PURPOSES,
};
