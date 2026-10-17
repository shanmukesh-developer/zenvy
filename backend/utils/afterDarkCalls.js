// B1: After Dark call rooms (afterdark_call_<friendshipId>) shared across instances.
//
// Without Redis (or while it is down) server.js keeps its in-memory maps (activeCallRooms / callHosts):
// today's behaviour. While Redis is ready the participant list and the host live in Redis, so two
// friends connected to different instances see the same call:
//   'zenvy:adcall:<room>'       HASH socketId -> { p: participant, j: joinedAt }   (6 h, refreshed)
//   'zenvy:adcall:<room>:host'  socket id of the host                               (6 h, refreshed)
// Emits go through the Redis adapter (io.to(room) / io.to(socketId) reach every instance). Entries of
// sockets that vanished without a disconnect (instance crash) are pruned on the next join.
const redis = require('./redis');
const cluster = require('./socketCluster');

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_PARTICIPANTS = 20;

const keys = (callRoom) => ({ h: `adcall:${callRoom}`, host: `adcall:${callRoom}:host` });
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };

/** Use the shared store for this event? (Redis configured, adapter installed and Redis ready.) */
const active = () => cluster.isClustered() && redis.isReady();

const readAll = async (callRoom) => {
  const k = keys(callRoom);
  const res = await redis.tryCmd((c) => c.multi().hgetall(k.h).get(k.host).exec());
  if (!Array.isArray(res) || res.some((r) => r[0])) return null;
  const raw = res[0][1] || {};
  const entries = Object.entries(raw)
    .map(([sid, v]) => ({ sid, v: parse(v) }))
    .filter((e) => e.v && e.v.p)
    .sort((a, b) => (a.v.j || 0) - (b.v.j || 0));
  return { entries, host: res[1][1] || null };
};

const listOf = (state) => state.entries.map((e) => ({ ...e.v.p, isHost: state.host === e.sid }));

const save = (callRoom, sid, entry) => {
  const k = keys(callRoom);
  return redis.tryCmd((c) => c.multi().hset(k.h, sid, JSON.stringify(entry)).pexpire(k.h, TTL_MS).pexpire(k.host, TTL_MS).exec());
};

const emitList = async (io, callRoom, state) => {
  const s = state || (await readAll(callRoom));
  if (!s) return;
  io.to(callRoom).emit('call_participants_list', { participants: listOf(s) });
};

const trackOnSocket = (socket, callRoom, on) => {
  if (!socket._adCallRooms) socket._adCallRooms = new Set();
  if (on) socket._adCallRooms.add(callRoom);
  else socket._adCallRooms.delete(callRoom);
};

/**
 * join_after_dark_call. participant: { userId, socketId, userName, mute, video, isSpeaker, requestToSpeak }.
 * onFirst(): called when this socket started the call (ring the friend). Returns false when Redis failed
 * (the caller then uses the in-memory path).
 */
const join = async (io, socket, callRoom, participant, onFirst) => {
  const k = keys(callRoom);
  let state = await readAll(callRoom);
  if (!state) return false;
  // Prune sockets that are gone everywhere (crashed instance, lost disconnect).
  if (state.entries.length) {
    const found = await cluster.fetchSocketsChecked(io.in(callRoom));
    // Only prune on a complete answer from every instance (never drop a participant on a timeout).
    const live = found.certain ? new Set(found.sockets.map((s) => s.id)) : null;
    const stale = live ? state.entries.filter((e) => e.sid !== socket.id && !live.has(e.sid)).map((e) => e.sid) : [];
    if (stale.length) {
      await redis.tryCmd((c) => c.hdel(k.h, ...stale));
      state = { entries: state.entries.filter((e) => !stale.includes(e.sid)), host: stale.includes(state.host) ? null : state.host };
    }
  }
  const others = state.entries.filter((e) => e.sid !== socket.id);
  if (others.length >= MAX_PARTICIPANTS) {
    socket.emit('call_error', { message: 'This lounge is full (Max 20 participants).' });
    return true;
  }
  socket.join(callRoom);
  trackOnSocket(socket, callRoom, true);
  let host = state.host;
  if (!others.length || !host) {
    host = socket.id;
    await redis.tryCmd((c) => c.set(k.host, socket.id, 'PX', TTL_MS));
  }
  const p = { ...participant, isHost: host === socket.id };
  const mine = state.entries.find((e) => e.sid === socket.id);
  await save(callRoom, socket.id, { p, j: mine ? mine.v.j : Date.now() });

  if (!others.length && typeof onFirst === 'function') {
    try { onFirst(); } catch (err) { console.error('[AFTER_DARK_CALL_RING_ERR]', err.message); }
  }
  const after = await readAll(callRoom);
  if (after) io.to(callRoom).emit('call_participants_list', { participants: listOf(after) });
  socket.to(callRoom).emit('user_joined_call', p);
  return true;
};

/** Leave (explicit or on disconnect). */
const leave = async (io, socket, callRoom) => {
  trackOnSocket(socket, callRoom, false);
  const k = keys(callRoom);
  const state = await readAll(callRoom);
  if (!state) return false;
  const me = state.entries.find((e) => e.sid === socket.id);
  if (!me) return true;
  await redis.tryCmd((c) => c.hdel(k.h, socket.id));
  const rest = state.entries.filter((e) => e.sid !== socket.id);
  let host = state.host;
  if (!rest.length) {
    await redis.tryCmd((c) => c.del(k.h, k.host));
    host = null;
  } else if (state.host === socket.id || !rest.some((e) => e.sid === state.host)) {
    // Hand hosting to the longest-standing participant.
    host = rest[0].sid;
    await redis.tryCmd((c) => c.set(k.host, host, 'PX', TTL_MS));
  }
  const after = { entries: rest, host };
  io.to(callRoom).emit('call_participants_list', { participants: listOf(after) });
  socket.to(callRoom).emit('user_left_call', {
    userId: socket.user?.id || socket.id,
    socketId: socket.id,
    userName: me.v.p.userName || 'Friend',
  });
  return true;
};

/** update_call_state from a participant. */
const updateState = async (io, socket, callRoom, data) => {
  const state = await readAll(callRoom);
  if (!state) return false;
  const me = state.entries.find((e) => e.sid === socket.id);
  if (!me) return true;
  const p = me.v.p;
  if (data.mute !== undefined) p.mute = !!data.mute;
  if (data.video !== undefined) p.video = !!data.video;
  if (data.isSpeaker !== undefined && (state.host === socket.id || data.isSpeaker === false)) p.isSpeaker = !!data.isSpeaker;
  if (data.requestToSpeak !== undefined) p.requestToSpeak = !!data.requestToSpeak;
  await save(callRoom, socket.id, me.v);
  await emitList(io, callRoom, state);
  return true;
};

/** Host-only moderation: kind 'approve' (make speaker) or 'mute'. */
const moderate = async (io, socket, callRoom, targetSocketId, kind, groupId) => {
  const state = await readAll(callRoom);
  if (!state) return false;
  if (state.host !== socket.id) return true;
  const target = state.entries.find((e) => e.sid === targetSocketId);
  if (!target) return true;
  if (kind === 'approve') { target.v.p.isSpeaker = true; target.v.p.requestToSpeak = false; }
  else target.v.p.mute = true;
  await save(callRoom, targetSocketId, target.v);
  await emitList(io, callRoom, state);
  io.to(targetSocketId).emit(kind === 'approve' ? 'speaker_approved' : 'user_muted_by_host', { groupId });
  return true;
};

/** Rooms this socket joined through the shared store (for disconnect clean-up). */
const roomsOf = (socket) => Array.from(socket._adCallRooms || []);

module.exports = { active, join, leave, updateState, moderate, roomsOf, MAX_PARTICIPANTS };
