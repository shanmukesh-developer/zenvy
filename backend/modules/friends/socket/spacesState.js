/**
 * Friends > Spaces live room engine (Phase 5). One process on Render free, so live presence is held
 * in memory here and mirrored to FriendsSpaceMembers; Postgres stays authoritative for the Space itself
 * (status, removals, roles of people who left). With more than one instance this needs the socket.io
 * Redis adapter plus a shared store (documented; not needed today).
 *
 * Media is plain WebRTC between the apps (owner decision). The server never touches audio: it only
 * decides WHO may exchange signaling with whom.
 *   speaker  -> listener  : the speaker initiates, direction 'sendonly' (listener 'recvonly')
 *   speaker <-> speaker   : 'sendrecv', the smaller userId initiates
 *   listener <-> listener : nothing (listeners never publish audio)
 * When a role changes, every affected pair gets space:peer_close, and new pairs space:peer_connect.
 * space:signal is relayed only for a currently authorized pair, so a demoted or removed speaker's
 * later offers are dropped by the server even if their app misbehaves.
 *
 * Every mutation of one room runs under that room's lock (withLock), so caps hold under concurrency.
 */
const { getModel } = require('../index');
const S = require('../models/spaces/enums');
const identity = require('../services/identity');
const { isUniqueError } = require('../services/http');

const STATE_DEBOUNCE_MS = 250;
const ACTIVE_BUMP_MS = 60 * 1000;
const BOOT_AT = Date.now();

const rooms = new Map(); // spaceId -> Room
const locks = new Map(); // spaceId -> Promise (tail of the chain)
let nsp = null;

const setNsp = (n) => { if (n) nsp = n; };
const getNsp = () => nsp;
const M = (name) => getModel(name);
const roomKey = (spaceId) => `space:${spaceId}`;
const speaking = (role) => S.SPEAKING_ROLES.includes(role);

const ctl = () => require('../controllers/spacesController')._internal;

/** Runs fn with this Space's lock held (one mutation at a time per room). */
const withLock = (spaceId, fn) => {
  const key = String(spaceId);
  const prev = locks.get(key) || Promise.resolve();
  const run = prev.then(() => fn());
  const tail = run.catch(() => {});
  locks.set(key, tail);
  tail.then(() => { if (locks.get(key) === tail) locks.delete(key); });
  return run;
};

const socketById = (socketId) => {
  if (!nsp || !socketId) return null;
  try { return nsp.sockets.get(socketId) || null; } catch { return null; }
};

const emitTo = (member, event, payload) => {
  if (!nsp || !member || !member.connected || !member.socketId) return;
  nsp.to(member.socketId).emit(event, payload);
};

const trackSocket = (socket, spaceId, on) => {
  if (!socket) return;
  if (!socket.data.spaces) socket.data.spaces = new Set();
  if (on) socket.data.spaces.add(String(spaceId));
  else socket.data.spaces.delete(String(spaceId));
};

const saveMember = async (spaceId, userId, patch) => {
  try {
    await M('FriendsSpaceMember').update(patch, { where: { spaceId, userId } });
  } catch (err) {
    console.warn('[FRIENDS_SPACES_MEMBER_WARN]', err.message);
  }
};

// ── Room shape ───────────────────────────────────────────────────────────────

const makeRoom = (space) => ({
  id: String(space.id),
  campusId: String(space.campusId),
  hostId: String(space.hostId),
  participation: space.participation,
  maxSpeakers: space.maxSpeakers || S.maxSpeakers(),
  maxListeners: space.maxListeners || S.maxListeners(),
  peak: space.peakListeners || 0,
  members: new Map(), // userId -> Member
  emptySince: Date.now(),
  hostGoneSince: Date.now(),
  stateTimer: null,
  lastBump: 0,
  ended: false,
});

const counts = (room) => {
  let speakers = 0;
  let listeners = 0;
  let nonHostSpeakers = 0;
  for (const m of room.members.values()) {
    if (speaking(m.role)) {
      speakers++;
      if (m.role !== 'host') nonHostSpeakers++;
    } else listeners++;
  }
  return { speakers, listeners, nonHostSpeakers };
};

// The host's seat is always reserved, so a host who drops and rejoins never finds the stage full.
const speakerSeatFree = (room) => counts(room).nonHostSpeakers < room.maxSpeakers - 1;
const hasCohost = (room) => [...room.members.values()].some((m) => m.role === 'cohost');

const ROLE_ORDER = { host: 0, cohost: 1, speaker: 2, listener: 3 };
const participantOf = (m) => ({
  userId: m.userId,
  name: m.ident.name,
  avatarUrl: m.ident.avatarUrl || null,
  verified: !!m.ident.verified,
  role: m.role,
  hand: !!m.hand,
  invited: !!m.invited,
  muted: !!m.muted,
  mutedByHost: !!m.mutedByHost,
  connected: !!m.connected,
});

const snapshot = (room) => {
  const list = [...room.members.values()].sort((a, b) => (ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
    || ((a.hand ? 0 : 1) - (b.hand ? 0 : 1))
    || ((a.hand && b.hand) ? a.hand - b.hand : 0)
    || (a.joinedAt - b.joinedAt));
  const c = counts(room);
  return {
    spaceId: room.id,
    status: room.ended ? 'ended' : 'live',
    participants: list.map(participantOf),
    speakerCount: c.speakers,
    listenerCount: c.listeners,
    limits: { maxSpeakers: room.maxSpeakers, maxListeners: room.maxListeners },
    recording: false,
  };
};

const flushState = (room) => {
  room.stateTimer = null;
  if (!nsp || room.ended) return;
  nsp.to(roomKey(room.id)).emit('space:state', snapshot(room));
};

/** Debounced (250 ms) state snapshot to everyone in the room. */
const scheduleState = (room) => {
  if (!room || room.ended || room.stateTimer) return;
  room.stateTimer = setTimeout(() => flushState(room), STATE_DEBOUNCE_MS);
  if (room.stateTimer.unref) room.stateTimer.unref();
};

// ── Peer topology ────────────────────────────────────────────────────────────

/** How two members connect, or null when they must not exchange anything. */
const pairOf = (a, b) => {
  const sa = speaking(a.role);
  const sb = speaking(b.role);
  if (sa && sb) return { kind: 'both', initiator: String(a.userId) < String(b.userId) ? a.userId : b.userId };
  if (sa) return { kind: 'one', speaker: a.userId };
  if (sb) return { kind: 'one', speaker: b.userId };
  return null;
};

const connectPair = (room, a, b) => {
  if (!a.connected || !b.connected) return;
  const p = pairOf(a, b);
  if (!p) return;
  const dirFor = (me) => {
    if (p.kind === 'both') return { initiator: String(p.initiator) === String(me.userId), direction: 'sendrecv' };
    const isSpeaker = String(p.speaker) === String(me.userId);
    return { initiator: isSpeaker, direction: isSpeaker ? 'sendonly' : 'recvonly' };
  };
  emitTo(a, 'space:peer_connect', { spaceId: room.id, peerUserId: b.userId, ...dirFor(a) });
  emitTo(b, 'space:peer_connect', { spaceId: room.id, peerUserId: a.userId, ...dirFor(b) });
};

const closePair = (room, a, b) => {
  emitTo(a, 'space:peer_close', { spaceId: room.id, peerUserId: b.userId });
  emitTo(b, 'space:peer_close', { spaceId: room.id, peerUserId: a.userId });
};

/** Re-plans every pair involving `member` (after a join, rejoin or role change). */
const replanPeers = (room, member, { close = true } = {}) => {
  for (const other of room.members.values()) {
    if (other.userId === member.userId) continue;
    if (close) closePair(room, member, other);
    connectPair(room, member, other);
  }
};

/** Is this pair allowed to exchange signaling right now? */
const pairAuthorized = (room, fromId, toId) => {
  const a = room.members.get(String(fromId));
  const b = room.members.get(String(toId));
  if (!a || !b || !a.connected || !b.connected || a.userId === b.userId) return null;
  const p = pairOf(a, b);
  return p ? { a, b, p } : null;
};

// ── Load / hydrate ───────────────────────────────────────────────────────────

const getRoom = (spaceId) => rooms.get(String(spaceId)) || null;

/** Room for a live Space; created (and stale DB presence cleared) when this process has none. */
const ensureRoom = async (space) => {
  let room = rooms.get(String(space.id));
  if (room) return room;
  room = makeRoom(space);
  rooms.set(room.id, room);
  // Nobody is connected to a room this process just created: any member rows still "present" are
  // left over from a restart or a crash.
  try {
    await M('FriendsSpaceMember').update({ leftAt: new Date(), handRaisedAt: null }, { where: { spaceId: space.id, leftAt: null } });
  } catch (err) {
    console.warn('[FRIENDS_SPACES_HYDRATE_WARN]', err.message);
  }
  return room;
};

const identityFor = async (userId, reqLike) => {
  try {
    const ids = await identity.loadIdentities(reqLike || null, [userId], { viewerId: userId });
    const i = ids.get(String(userId));
    if (i) return { name: i.name, avatarUrl: i.avatarUrl || null, verified: !!i.verified };
  } catch { /* fall through */ }
  return { name: 'Student', avatarUrl: null, verified: false };
};

const bumpActive = async (room, force = false) => {
  const now = Date.now();
  if (!force && now - room.lastBump < ACTIVE_BUMP_MS) return;
  room.lastBump = now;
  try {
    await M('FriendsSpace').update({ lastActiveAt: new Date(now) }, { where: { id: room.id } });
  } catch (err) {
    console.warn('[FRIENDS_SPACES_ACTIVE_WARN]', err.message);
  }
};

const notePeak = async (room) => {
  const { listeners } = counts(room);
  if (listeners <= room.peak) return;
  room.peak = listeners;
  try {
    await M('FriendsSpace').update({ peakListeners: listeners }, { where: { id: room.id } });
  } catch { /* stats only */ }
};

// ── Join / leave ─────────────────────────────────────────────────────────────

class RoomError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    this.extra = extra;
  }
}

/**
 * Adds (or re-attaches) a user to a live Space. Caller has checked eligibility, campus, blocks,
 * moderation and status. Returns { room, member, rejoined, replacedSocketId }.
 */
const join = (space, socket, userId, reqLike = null) => withLock(space.id, async () => {
  const uid = String(userId);
  // The caller read the Space before waiting for this lock: if it ended (or was taken down) in the
  // meantime, teardown already ran and ensureRoom would resurrect a zombie room for an ended Space.
  if (!rooms.has(String(space.id))) {
    const fresh = await M('FriendsSpace').findByPk(space.id, { attributes: ['id', 'status', 'modStatus'] });
    if (!fresh || fresh.status !== 'live') throw new RoomError('SPACE_NOT_LIVE', 'This Space has ended.', { status: fresh ? fresh.status : 'ended' });
    if (fresh.modStatus !== 'visible' && uid !== String(space.hostId)) throw new RoomError('NOT_FOUND', 'This Space is not available.');
  }
  const room = await ensureRoom(space);
  if (room.ended) throw new RoomError('SPACE_NOT_LIVE', 'This Space has ended.', { status: 'ended' });
  const Member = M('FriendsSpaceMember');
  let row = await Member.findOne({ where: { spaceId: room.id, userId: uid } });
  if (row && row.removedAt) throw new RoomError('SPACE_REMOVED', 'You were removed from this Space.');

  let member = room.members.get(uid);
  let rejoined = false;
  let replacedSocketId = null;
  if (member) {
    rejoined = true;
    if (member.socketId && member.socketId !== socket.id) {
      replacedSocketId = member.socketId;
      const old = socketById(member.socketId);
      if (old) {
        old.emit('space:replaced', { spaceId: room.id });
        old.leave(roomKey(room.id));
        trackSocket(old, room.id, false);
      }
    }
    if (member.graceTimer) clearTimeout(member.graceTimer);
    member.graceTimer = null;
    member.connected = true;
    member.socketId = socket.id;
  } else {
    const isHost = uid === room.hostId;
    let role = 'listener';
    if (isHost) role = 'host';
    else if (row && row.role === 'cohost' && speakerSeatFree(room)) role = 'cohost';
    if (role === 'listener' && counts(room).listeners >= room.maxListeners) {
      throw new RoomError('ROOM_FULL', 'This Space is full right now.', { kind: 'listeners', max: room.maxListeners });
    }
    member = {
      userId: uid,
      role,
      hand: null,
      invited: false,
      muted: role !== 'listener', // speakers start muted; the app unmutes on the user's tap
      mutedByHost: false,
      connected: true,
      socketId: socket.id,
      graceTimer: null,
      joinedAt: Date.now(),
      ident: await identityFor(uid, reqLike),
    };
    const now = new Date();
    const patch = { role, joinedAt: now, leftAt: null, handRaisedAt: null, mutedByHost: false };
    if (row) await row.update(patch);
    else {
      try {
        row = await Member.create({ spaceId: room.id, userId: uid, ...patch });
      } catch (err) {
        if (!isUniqueError(err)) throw err;
        await Member.update(patch, { where: { spaceId: room.id, userId: uid } });
      }
    }
    room.members.set(uid, member);
  }
  room.emptySince = null;
  if (uid === room.hostId) room.hostGoneSince = null;
  socket.join(roomKey(room.id));
  trackSocket(socket, room.id, true);
  notePeak(room);
  bumpActive(room, !rejoined);
  return { room, member, rejoined, replacedSocketId };
});

/** Announces a (re)joined member to its peers and refreshes the room state. Call after the ack. */
const announceJoin = (room, member) => {
  replanPeers(room, member, { close: true });
  scheduleState(room);
};

/** Removes a member from the live room (explicit leave, grace expiry or removal). Lock held by caller. */
const dropMember = async (room, member, { reason = 'left', removedBy = null } = {}) => {
  if (!room.members.has(member.userId)) return false;
  if (member.graceTimer) clearTimeout(member.graceTimer);
  member.graceTimer = null;
  for (const other of room.members.values()) if (other.userId !== member.userId) closePair(room, member, other);
  room.members.delete(member.userId);
  const sock = socketById(member.socketId);
  if (sock) {
    sock.leave(roomKey(room.id));
    trackSocket(sock, room.id, false);
  }
  const now = new Date();
  const patch = { leftAt: now, handRaisedAt: null };
  if (reason === 'removed') Object.assign(patch, { removedAt: now, removedBy, role: 'listener' });
  else if (member.role === 'speaker') patch.role = 'listener'; // speakers go back to the audience; host / co-host keep their role
  await saveMember(room.id, member.userId, patch);
  if (member.userId === room.hostId) room.hostGoneSince = Date.now();
  if (!room.members.size) room.emptySince = Date.now();
  scheduleState(room);
  return true;
};

const leave = (spaceId, userId, socketId) => withLock(spaceId, async () => {
  const room = getRoom(spaceId);
  const member = room && room.members.get(String(userId));
  if (!member) return false;
  if (socketId && member.socketId !== socketId) return false; // a replaced socket cannot remove its successor
  return dropMember(room, member, { reason: 'left' });
});

/** A socket went away: keep the seat for the grace period, then mark the member left. */
const onDisconnect = (socket) => {
  const spaces = socket.data && socket.data.spaces ? [...socket.data.spaces] : [];
  for (const spaceId of spaces) {
    withLock(spaceId, async () => {
      const room = getRoom(spaceId);
      if (!room) return;
      const member = [...room.members.values()].find((m) => m.socketId === socket.id);
      if (!member || !member.connected) return;
      member.connected = false;
      for (const other of room.members.values()) if (other.userId !== member.userId) emitTo(other, 'space:peer_close', { spaceId: room.id, peerUserId: member.userId });
      scheduleState(room);
      const sid = socket.id;
      member.graceTimer = setTimeout(() => {
        withLock(spaceId, async () => {
          const r = getRoom(spaceId);
          const m = r && r.members.get(member.userId);
          if (!m || m.connected || m.socketId !== sid) return; // came back in time
          await dropMember(r, m, { reason: 'left' });
        }).catch((err) => console.warn('[FRIENDS_SPACES_GRACE_WARN]', err.message));
      }, S.graceMs());
      if (member.graceTimer.unref) member.graceTimer.unref();
    }).catch((err) => console.warn('[FRIENDS_SPACES_DISCONNECT_WARN]', err.message));
  }
};

// ── Role / hand / mute / remove ─────────────────────────────────────────────

/** Changes a member's role, tells them, and re-plans their peer connections. Lock held by caller. */
const setRole = async (room, member, role, { forced = false } = {}) => {
  if (member.role === role) return false;
  member.role = role;
  member.hand = null;
  member.invited = false;
  if (!speaking(role)) { member.muted = false; member.mutedByHost = false; } else if (forced) member.muted = true;
  emitTo(member, 'space:role', { spaceId: room.id, role, forced: !!forced });
  replanPeers(room, member, { close: true });
  await saveMember(room.id, member.userId, { role, handRaisedAt: null, ...(speaking(role) ? {} : { mutedByHost: false }) });
  scheduleState(room);
  return true;
};

const setHand = async (room, member, raised) => {
  member.hand = raised ? Date.now() : null;
  if (!raised) member.invited = false;
  await saveMember(room.id, member.userId, { handRaisedAt: raised ? new Date(member.hand) : null });
  scheduleState(room);
};

const muteByHost = async (room, member) => {
  member.muted = true;
  member.mutedByHost = true;
  emitTo(member, 'space:muted_by_host', { spaceId: room.id });
  await saveMember(room.id, member.userId, { mutedByHost: true });
  scheduleState(room);
};

const selfMute = async (room, member, muted) => {
  member.muted = !!muted;
  const clearHost = !muted && member.mutedByHost;
  if (clearHost) member.mutedByHost = false;
  if (clearHost) await saveMember(room.id, member.userId, { mutedByHost: false });
  scheduleState(room);
};

const remove = async (room, member, actorId) => {
  emitTo(member, 'space:removed', { spaceId: room.id });
  await dropMember(room, member, { reason: 'removed', removedBy: actorId });
};

// ── End / sweep ──────────────────────────────────────────────────────────────

/** Tears the live room down after the Space row was finished (ended / cancelled / removed). */
const teardown = (spaceId, reason) => {
  const room = getRoom(spaceId);
  if (!room) return false;
  room.ended = true;
  if (room.stateTimer) clearTimeout(room.stateTimer);
  room.stateTimer = null;
  if (nsp) nsp.to(roomKey(room.id)).emit('space:ended', { spaceId: room.id, reason });
  for (const m of room.members.values()) {
    if (m.graceTimer) clearTimeout(m.graceTimer);
    const sock = socketById(m.socketId);
    if (sock) {
      sock.leave(roomKey(room.id));
      trackSocket(sock, room.id, false);
    }
  }
  room.members.clear();
  rooms.delete(room.id);
  return true;
};

/**
 * Abandoned-room rules for rooms this process holds:
 *   host gone > SPACES_HOST_GONE_MS (2 min) with no co-host present -> ended 'host_left'
 *   nobody present > SPACES_EMPTY_MS (5 min)                         -> ended 'empty'
 * Also refreshes lastActiveAt for occupied rooms (used after a restart). Returns [{spaceId, reason}].
 */
const sweep = async (now = Date.now()) => {
  const out = [];
  for (const room of [...rooms.values()]) {
    let reason = null;
    if (!room.members.size && room.emptySince && now - room.emptySince > S.emptyMs()) reason = 'empty';
    else if (!room.members.has(room.hostId) && room.hostGoneSince && now - room.hostGoneSince > S.hostGoneMs() && !hasCohost(room)) reason = 'host_left';
    if (reason) {
      try {
        if (await ctl().finishSpace(room.id, { to: 'ended', from: ['live'], reason })) out.push({ spaceId: room.id, reason });
        else teardown(room.id, reason); // the row was already finished elsewhere
      } catch (err) {
        console.warn('[FRIENDS_SPACES_SWEEP_WARN]', err.message);
      }
    } else if (room.members.size) {
      await bumpActive(room);
    }
  }
  return out;
};

const liveCounts = (spaceId) => {
  const room = getRoom(spaceId);
  if (!room) return { participants: 0, speakers: 0, listeners: 0 };
  const c = counts(room);
  return { participants: room.members.size, speakers: c.speakers, listeners: c.listeners };
};

/** Public speaker list of a live room (names are public inside the campus; no listener list). */
const speakersOf = (spaceId) => {
  const room = getRoom(spaceId);
  if (!room) return [];
  return [...room.members.values()].filter((m) => speaking(m.role))
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.joinedAt - b.joinedAt)
    .map((m) => ({ userId: m.userId, name: m.ident.name, avatarUrl: m.ident.avatarUrl || null, verified: !!m.ident.verified, role: m.role }));
};

const roleOf = (spaceId, userId) => {
  const room = getRoom(spaceId);
  const m = room && room.members.get(String(userId));
  return m ? m.role : null;
};

/** Tests only: forget one room (or every room) as a process restart would. */
const _resetForTests = (spaceId) => {
  for (const room of [...rooms.values()]) {
    if (spaceId && room.id !== String(spaceId)) continue;
    if (room.stateTimer) clearTimeout(room.stateTimer);
    for (const m of room.members.values()) if (m.graceTimer) clearTimeout(m.graceTimer);
    rooms.delete(room.id);
    locks.delete(room.id);
  }
};

module.exports = {
  BOOT_AT,
  RoomError,
  setNsp,
  getNsp,
  withLock,
  getRoom,
  ensureRoom,
  join,
  announceJoin,
  leave,
  onDisconnect,
  dropMember,
  setRole,
  setHand,
  muteByHost,
  selfMute,
  remove,
  teardown,
  sweep,
  snapshot,
  scheduleState,
  counts,
  speakerSeatFree,
  pairAuthorized,
  liveCounts,
  speakersOf,
  roleOf,
  speaking,
  _rooms: rooms,
  _resetForTests,
};
