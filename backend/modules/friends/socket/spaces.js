/**
 * Friends > Spaces socket events on the authenticated /campus namespace (Phase 5, plain WebRTC).
 * Contract: backend_contract.md "Friends (spaces)". The room engine is socket/spacesState.js.
 *
 * Every event answers through its ack ({ ok:true, ... } | { ok:false, code, error }); space:signal's
 * ack is optional. Checks, in order: the spaces flag, the Friends gate (verified, same campus, not
 * sanctioned, guidelines accepted), then the room rules (live member on THIS socket, role).
 * Nothing here trusts a client-sent role, campus or user id: roles come from the room engine,
 * which is mirrored from FriendsSpaceMembers.
 */
const { getModel } = require('../index');
const eligibility = require('../services/eligibility');
const flags = require('../services/featureFlags');
const limiter = require('../services/limiter');
const blocks = require('../services/blocks');
const audit = require('../services/audit');
const reportsSvc = require('../services/reports');
const ice = require('../services/ice');
const { isUuid } = require('../services/http');
const S = require('../models/spaces/enums');
const state = require('./spacesState');

const SEC = 1000;
const MIN = 60 * SEC;

limiter.define('space_join', 30, MIN);
limiter.define('space_action', 120, MIN); // hand / invite / role / mute / remove, per user
limiter.define('space_signal', 120, 10 * SEC); // per socket
limiter.define('space_report', 10, 60 * MIN);

const EVENTS = [
  'space:join', 'space:leave', 'space:hand', 'space:invite_speaker', 'space:respond_invite', 'space:set_role',
  'space:mute', 'space:self_mute', 'space:remove', 'space:end', 'space:signal', 'space:report',
];

const M = (name) => getModel(name);

class EventError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    this.extra = extra;
  }
}
const no = (code, message, extra) => new EventError(code, message, extra);

const reply = (ack, payload) => { if (typeof ack === 'function') ack(payload); };
const failure = (err) => {
  if (err instanceof EventError || err instanceof state.RoomError) return { ok: false, code: err.code, error: err.message, ...(err.extra || {}) };
  if (err && err.status && err.code) return { ok: false, code: err.code, error: err.message, ...(err.extra || {}) }; // FriendsError
  console.error('[FRIENDS_SPACES_SOCKET_ERR]', err && err.message ? err.message : err);
  return { ok: false, code: 'SERVER_ERROR', error: 'Something went wrong. Please try again.' };
};

const requireSpaceId = (data) => {
  const id = data && data.spaceId;
  if (!isUuid(String(id || ''))) throw no('INVALID_ID', 'That Space id is not valid.');
  return String(id);
};

/** Flag first (so an off feature never reveals anything), then the Friends gate with guidelines. */
const gate = async (userId) => {
  const [ctx, cfg] = await Promise.all([eligibility.loadContext(userId), flags.getConfig()]);
  if (!flags.isEnabled(cfg, 'spaces')) throw no('FEATURE_OFF', 'Spaces are not available yet.', { feature: 'spaces' });
  eligibility.assertAllowed(ctx, cfg, 'spaces', { write: true });
  return { ctx, cfg };
};

const rate = (key, action) => {
  const r = limiter.take(key, action);
  if (!r.ok) throw no('RATE_LIMITED', 'You are doing that too often. Please try again later.', { retryAfter: r.retryAfterSec });
};

/** The caller's live member on THIS socket (a replaced socket is not a member any more). */
const meOnSocket = (spaceId, userId, socket) => {
  const room = state.getRoom(spaceId);
  if (!room) throw no('NOT_IN_SPACE', 'Join the Space first.');
  const me = room.members.get(String(userId));
  if (!me || me.socketId !== socket.id || !me.connected) throw no('NOT_IN_SPACE', 'Join the Space first.');
  return { room, me };
};

const targetIn = (room, userId) => {
  if (!isUuid(String(userId || ''))) throw no('INVALID_ID', 'That person is not valid.');
  const t = room.members.get(String(userId));
  if (!t) throw no('NOT_IN_SPACE', 'That person is not in this Space.');
  return t;
};

const isMod = (m) => m.role === 'host' || m.role === 'cohost';
/** Host can act on anyone but themself; a co-host only on speakers and listeners. */
const canActOn = (actor, target) => {
  if (target.role === 'host') return false;
  if (actor.role === 'host') return true;
  return actor.role === 'cohost' && (target.role === 'speaker' || target.role === 'listener');
};

const auditSafe = (entry) => audit.recordSafe({ actorRole: 'self', ...entry, meta: { ...(entry.meta || {}), asRole: entry.asRole } });

// ── Handlers ─────────────────────────────────────────────────────────────────

const handlers = {
  async 'space:join'(socket, userId, data) {
    const spaceId = requireSpaceId(data);
    const { ctx } = await gate(userId);
    rate(userId, 'space_join');
    const space = await M('FriendsSpace').findByPk(spaceId);
    // Same 404 for "does not exist", "other campus", "blocked" and "hidden": ids cannot be probed.
    const notFound = () => no('NOT_FOUND', 'This Space is not available.');
    if (!space || String(space.campusId) !== String(ctx.profile.campusId)) throw notFound();
    const isHost = String(space.hostId) === String(userId);
    if (!isHost && space.modStatus !== 'visible') throw notFound();
    if (!isHost && (await blocks.blockedIds(userId)).has(String(space.hostId))) throw notFound();
    if (space.status !== 'live') throw no('SPACE_NOT_LIVE', space.status === 'scheduled' ? 'This Space has not started yet.' : 'This Space has ended.', { status: space.status });
    // Request-like view of the handshake so avatar URLs are absolute (campusHelpers.publicBase).
    const h = (socket.handshake && socket.handshake.headers) || {};
    const reqLike = h.host ? { protocol: String(h['x-forwarded-proto'] || 'http').split(',')[0].trim(), get: (k) => (String(k).toLowerCase() === 'host' ? h.host : undefined) } : null;
    const { room, member, rejoined } = await state.join(space, socket, userId, reqLike);
    const iceCfg = ice.iceServersFor(userId);
    return {
      ok: true,
      spaceId,
      role: member.role,
      rejoined,
      state: state.snapshot(room),
      iceServers: iceCfg.iceServers,
      turn: !!iceCfg.turn,
      ...(iceCfg.expiresAt ? { iceExpiresAt: iceCfg.expiresAt } : {}),
      limits: { maxSpeakers: room.maxSpeakers, maxListeners: room.maxListeners, signalBytes: S.SIGNAL_MAX_BYTES },
      recording: false,
      after: () => state.announceJoin(room, member),
    };
  },

  async 'space:leave'(socket, userId, data) {
    const spaceId = requireSpaceId(data);
    const left = await state.leave(spaceId, userId, socket.id);
    return { ok: true, left };
  },

  async 'space:hand'(socket, userId, data) {
    const spaceId = requireSpaceId(data);
    await gate(userId);
    rate(userId, 'space_action');
    const raised = data.raised === true;
    return state.withLock(spaceId, async () => {
      const { room, me } = meOnSocket(spaceId, userId, socket);
      // A host / co-host lowering someone else's hand = declining their request to speak.
      if (data.userId && String(data.userId) !== String(userId)) {
        if (!isMod(me)) throw no('NOT_ALLOWED', 'Only the host or a co-host can do that.');
        if (raised) throw no('NOT_ALLOWED', 'You can only lower someone else\'s hand.');
        const t = targetIn(room, data.userId);
        if (t.hand || t.invited) await state.setHand(room, t, false);
        return { ok: true, hand: false };
      }
      if (state.speaking(me.role)) throw no('ALREADY_SPEAKER', 'You are already on stage.');
      if (!raised) {
        await state.setHand(room, me, false);
        return { ok: true, hand: false, role: me.role };
      }
      // Open Spaces: a raised hand takes a free speaker seat straight away (the user asked to speak).
      if (room.participation === 'open' && state.speakerSeatFree(room)) {
        await state.setRole(room, me, 'speaker', { forced: false });
        return { ok: true, hand: false, role: me.role };
      }
      await state.setHand(room, me, true);
      return { ok: true, hand: true, role: me.role };
    });
  },

  async 'space:invite_speaker'(socket, userId, data) {
    const spaceId = requireSpaceId(data);
    await gate(userId);
    rate(userId, 'space_action');
    return state.withLock(spaceId, async () => {
      const { room, me } = meOnSocket(spaceId, userId, socket);
      if (!isMod(me)) throw no('NOT_ALLOWED', 'Only the host or a co-host can invite speakers.');
      const t = targetIn(room, data.userId);
      if (state.speaking(t.role)) throw no('ALREADY_SPEAKER', 'They are already on stage.');
      if (!t.connected) throw no('NOT_CONNECTED', 'They are reconnecting. Try again in a moment.');
      if (!state.speakerSeatFree(room)) throw no('ROOM_FULL', 'All speaker seats are taken.', { kind: 'speakers', max: room.maxSpeakers });
      t.invited = true;
      state.scheduleState(room);
      const nsp = state.getNsp();
      if (nsp) nsp.to(t.socketId).emit('space:invited', { spaceId, byRole: me.role });
      return { ok: true, invited: true };
    });
  },

  async 'space:respond_invite'(socket, userId, data) {
    const spaceId = requireSpaceId(data);
    await gate(userId);
    rate(userId, 'space_action');
    return state.withLock(spaceId, async () => {
      const { room, me } = meOnSocket(spaceId, userId, socket);
      if (!me.invited || state.speaking(me.role)) throw no('NO_INVITE', 'There is no invitation to answer.');
      if (data.accept !== true) {
        await state.setHand(room, me, false);
        return { ok: true, role: me.role };
      }
      if (!state.speakerSeatFree(room)) {
        me.invited = false;
        state.scheduleState(room);
        throw no('ROOM_FULL', 'All speaker seats were taken.', { kind: 'speakers', max: room.maxSpeakers });
      }
      await state.setRole(room, me, 'speaker', { forced: false });
      return { ok: true, role: me.role };
    });
  },

  async 'space:set_role'(socket, userId, data) {
    const spaceId = requireSpaceId(data);
    await gate(userId);
    rate(userId, 'space_action');
    const role = String(data.role || '');
    if (!['cohost', 'speaker', 'listener'].includes(role)) throw no('INVALID_ROLE', 'That role is not valid.');
    return state.withLock(spaceId, async () => {
      const { room, me } = meOnSocket(spaceId, userId, socket);
      const t = targetIn(room, data.userId);
      const self = t.userId === me.userId;
      if (t.role === role) return { ok: true, role, unchanged: true };
      if (self) {
        // Anyone on stage (but the host) may step down to the audience; nobody promotes themself.
        if (me.role === 'host' || role !== 'listener') throw no('NOT_ALLOWED', 'You cannot change your own role like that.');
        await state.setRole(room, me, 'listener', { forced: false });
        return { ok: true, role: 'listener' };
      }
      if (!isMod(me) || !canActOn(me, t)) throw no('NOT_ALLOWED', 'You cannot change this person\'s role.');
      if (role === 'cohost' && me.role !== 'host') throw no('NOT_ALLOWED', 'Only the host can make co-hosts.');
      // Putting someone on stage needs their consent: invite them (space:invite_speaker) first.
      if (t.role === 'listener') throw no('INVITE_FIRST', 'Invite them to speak first.');
      const before = t.role;
      await state.setRole(room, t, role, { forced: true });
      if (role === 'cohost' || before === 'cohost') {
        auditSafe({ actorId: userId, asRole: me.role, action: role === 'cohost' ? 'role_grant' : 'role_revoke', targetType: 'space', targetId: spaceId, subjectUserId: t.userId, meta: { from: before, to: role } });
      }
      return { ok: true, role };
    });
  },

  async 'space:mute'(socket, userId, data) {
    const spaceId = requireSpaceId(data);
    await gate(userId);
    rate(userId, 'space_action');
    return state.withLock(spaceId, async () => {
      const { room, me } = meOnSocket(spaceId, userId, socket);
      const t = targetIn(room, data.userId);
      if (!isMod(me) || t.userId === me.userId || !canActOn(me, t)) throw no('NOT_ALLOWED', 'You cannot mute this person.');
      if (!state.speaking(t.role)) throw no('NOT_SPEAKER', 'Only people on stage can be muted.');
      await state.muteByHost(room, t);
      auditSafe({ actorId: userId, asRole: me.role, action: 'space_mute', targetType: 'space', targetId: spaceId, subjectUserId: t.userId });
      return { ok: true, mutedByHost: true };
    });
  },

  async 'space:self_mute'(socket, userId, data) {
    const spaceId = requireSpaceId(data);
    rate(userId, 'space_action');
    return state.withLock(spaceId, async () => {
      const { room, me } = meOnSocket(spaceId, userId, socket);
      if (!state.speaking(me.role)) throw no('NOT_SPEAKER', 'Only people on stage have a microphone.');
      await state.selfMute(room, me, data.muted === true);
      return { ok: true, muted: me.muted, mutedByHost: me.mutedByHost };
    });
  },

  async 'space:remove'(socket, userId, data) {
    const spaceId = requireSpaceId(data);
    await gate(userId);
    rate(userId, 'space_action');
    return state.withLock(spaceId, async () => {
      const { room, me } = meOnSocket(spaceId, userId, socket);
      const t = targetIn(room, data.userId);
      if (!isMod(me) || t.userId === me.userId || !canActOn(me, t)) throw no('NOT_ALLOWED', 'You cannot remove this person.');
      await state.remove(room, t, userId);
      auditSafe({ actorId: userId, asRole: me.role, action: 'space_remove', targetType: 'space', targetId: spaceId, subjectUserId: t.userId });
      return { ok: true, removed: true };
    });
  },

  async 'space:end'(socket, userId, data) {
    const spaceId = requireSpaceId(data);
    await gate(userId);
    const room = state.getRoom(spaceId);
    const me = room && room.members.get(String(userId));
    if (!me || me.socketId !== socket.id) throw no('NOT_IN_SPACE', 'Join the Space first.');
    if (me.role !== 'host') throw no('NOT_ALLOWED', 'Only the host can end the Space.');
    const done = await require('../controllers/spacesController')._internal.finishSpace(spaceId, { to: 'ended', from: ['live'], reason: 'host_ended' });
    return { ok: true, ended: !!done };
  },

  async 'space:signal'(socket, userId, data) {
    const spaceId = requireSpaceId(data);
    if (!flags.isEnabled(flags.peekConfig(), 'spaces')) throw no('FEATURE_OFF', 'Spaces are not available yet.');
    rate(`sock:${socket.id}`, 'space_signal');
    const p = data.payload;
    if (!p || typeof p !== 'object' || !['offer', 'answer', 'ice'].includes(p.type)) throw no('BAD_SIGNAL', 'That signal is not valid.');
    const clean = { type: p.type };
    if (p.type === 'ice') {
      if (!p.candidate || typeof p.candidate !== 'object') throw no('BAD_SIGNAL', 'That signal is not valid.');
      clean.candidate = {
        candidate: String(p.candidate.candidate || ''),
        sdpMid: p.candidate.sdpMid == null ? null : String(p.candidate.sdpMid),
        sdpMLineIndex: Number.isInteger(p.candidate.sdpMLineIndex) ? p.candidate.sdpMLineIndex : null,
      };
    } else {
      if (typeof p.sdp !== 'string' || !p.sdp) throw no('BAD_SIGNAL', 'That signal is not valid.');
      clean.sdp = p.sdp;
    }
    if (Buffer.byteLength(JSON.stringify(clean), 'utf8') > S.SIGNAL_MAX_BYTES) throw no('SIGNAL_TOO_LARGE', 'That signal is too large.');
    const room = state.getRoom(spaceId);
    if (!room) throw no('NOT_IN_SPACE', 'Join the Space first.');
    const me = room.members.get(String(userId));
    if (!me || me.socketId !== socket.id) throw no('NOT_IN_SPACE', 'Join the Space first.');
    const pair = state.pairAuthorized(room, userId, data.toUserId);
    if (!pair) throw no('NOT_AUTHORIZED_PAIR', 'You cannot connect to that person.');
    // Listeners never publish: they may answer a speaker's offer and send ICE, never offer.
    if (clean.type === 'offer' && !state.speaking(me.role)) throw no('NOT_SPEAKER', 'Listeners cannot send audio.');
    const nsp = state.getNsp();
    if (nsp) nsp.to(pair.b.socketId).emit('space:signal', { spaceId, fromUserId: me.userId, payload: clean });
    return { ok: true };
  },

  async 'space:report'(socket, userId, data) {
    const spaceId = requireSpaceId(data);
    await gate(userId);
    rate(userId, 'space_report');
    const Member = M('FriendsSpaceMember');
    const mine = await Member.findOne({ where: { spaceId, userId } });
    if (!mine) throw no('NOT_IN_SPACE', 'Join the Space first.');
    const category = String(data.category || '');
    const note = typeof data.note === 'string' ? data.note.trim().slice(0, 500) || null : null;
    let result;
    if (data.userId && String(data.userId) !== String(userId)) {
      // A person in the Space: the report targets their profile (so a sanction hits them, not the host),
      // tagged as a Spaces report with the room as context.
      if (!isUuid(String(data.userId))) throw no('INVALID_ID', 'That person is not valid.');
      const theirs = await Member.findOne({ where: { spaceId, userId: data.userId } });
      if (!theirs) throw no('NOT_IN_SPACE', 'That person was not in this Space.');
      result = await reportsSvc.fileReport({ reporterId: userId, targetType: 'profile', targetId: String(data.userId), category, note });
      if (!result.duplicate) {
        const space = await M('FriendsSpace').findByPk(spaceId, { attributes: ['id', 'title'] });
        const snap = { ...(result.report.snapshot || {}), space: { id: spaceId, title: space ? space.title : null, role: theirs.role } };
        await result.report.update({ subTab: 'spaces', snapshot: snap });
      }
    } else {
      result = await reportsSvc.fileReport({ reporterId: userId, targetType: 'space', targetId: spaceId, category, note });
    }
    return { ok: true, reportId: result.report.id, duplicate: !!result.duplicate, status: 'received' };
  },
};

const register = (campusNsp, socket) => {
  state.setNsp(campusNsp);
  const userId = socket.user && socket.user.id ? String(socket.user.id) : null;
  for (const ev of EVENTS) {
    socket.on(ev, async (data, ack) => {
      if (!userId) return reply(ack, { ok: false, code: 'ACCOUNT_REQUIRED', error: 'Sign in first.' });
      const body = data && typeof data === 'object' ? data : {};
      try {
        const out = await handlers[ev](socket, userId, body);
        const after = out && out.after;
        if (after) delete out.after;
        reply(ack, out);
        if (after) after();
      } catch (err) {
        // Signals without an ack are dropped silently (high volume, nothing to show the user).
        reply(ack, failure(err));
      }
    });
  }
  socket.on('disconnect', () => state.onDisconnect(socket));
};

module.exports = { register, EVENTS, handlers };
