/**
 * Friends > Spaces live-room helpers on the existing authenticated `/campus` socket
 * (contract FS-3). Every client event acks `{ok:true,...}` or `{ok:false, code, error, ...}`;
 * `spaceEmit` turns a refusal into a thrown SpaceSocketError carrying the server code.
 * Roles always come from the server; nothing here decides who may speak.
 */
import { connectCampusSocket, getCampusConnectionState, getCampusSocket, subscribeCampusConnection } from '../../campusSocketClient';
import type { SpaceRole } from '../api/spacesApi';

const ACK_TIMEOUT_MS = 15000;

export class SpaceSocketError extends Error {
  code: string;
  data: any;
  constructor(message: string, code: string, data: any = null) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

export interface SpaceParticipant {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  verified?: boolean;
  role: SpaceRole;
  hand: boolean;
  invited: boolean;
  muted: boolean;
  mutedByHost: boolean;
  connected: boolean;
}

export interface SpaceRoomState {
  spaceId: string;
  status: 'live' | 'ended';
  participants: SpaceParticipant[];
  speakerCount: number;
  listenerCount: number;
  limits: { maxSpeakers: number; maxListeners: number };
  recording: false;
}

export interface SpaceIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface SpaceJoinAck {
  ok: true;
  spaceId: string;
  role: SpaceRole;
  rejoined: boolean;
  state: SpaceRoomState;
  iceServers: SpaceIceServer[];
  turn: boolean;
  iceExpiresAt?: string;
  limits: { maxSpeakers: number; maxListeners: number; signalBytes: number };
  recording: false;
}

export type SpaceSignalPayload =
  | { type: 'offer' | 'answer'; sdp: string }
  | { type: 'ice'; candidate: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null } };

/** Server → client events (payloads as in the contract). */
export interface SpaceServerEvents {
  'space:state': SpaceRoomState;
  'space:peer_connect': { spaceId: string; peerUserId: string; initiator: boolean; direction: 'sendonly' | 'recvonly' | 'sendrecv' };
  'space:peer_close': { spaceId: string; peerUserId: string };
  'space:signal': { spaceId: string; fromUserId: string; payload: SpaceSignalPayload };
  'space:role': { spaceId: string; role: SpaceRole; forced: boolean };
  'space:invited': { spaceId: string; byRole: SpaceRole };
  'space:muted_by_host': { spaceId: string };
  'space:removed': { spaceId: string };
  'space:replaced': { spaceId: string };
  'space:ended': { spaceId: string; reason: string };
}

/** Emit a `space:*` event and wait for its ack. Rejects with SpaceSocketError on refusal or timeout. */
export const spaceEmit = <T = any>(event: string, payload: Record<string, any>, timeoutMs = ACK_TIMEOUT_MS): Promise<T> =>
  new Promise((resolve, reject) => {
    const s = connectCampusSocket();
    s.timeout(timeoutMs).emit(event, payload, (err: any, res: any) => {
      if (err) {
        reject(new SpaceSocketError("Couldn't reach the Space. Check your connection and try again.", 'TIMEOUT'));
        return;
      }
      if (!res || res.ok !== true) {
        const r = res || {};
        reject(new SpaceSocketError(String(r.error || 'Something went wrong. Please try again.'), String(r.code || 'SERVER_ERROR'), r));
        return;
      }
      resolve(res as T);
    });
  });

/** Fire-and-forget signal (high volume; the server drops unauthorized pairs). */
export const sendSpaceSignal = (spaceId: string, toUserId: string, payload: SpaceSignalPayload) => {
  const s = getCampusSocket();
  if (s.connected) s.emit('space:signal', { spaceId, toUserId, payload });
};

/** Subscribe to one server event for one Space. Returns an unsubscribe function. */
export const onSpaceEvent = <E extends keyof SpaceServerEvents>(event: E, spaceId: string, handler: (p: SpaceServerEvents[E]) => void) => {
  const s = getCampusSocket();
  const fn = (p: any) => {
    if (p && String(p.spaceId) === String(spaceId)) handler(p);
  };
  s.on(event as string, fn);
  return () => {
    s.off(event as string, fn);
  };
};

// ── Commands ──────────────────────────────────────────────────────────────────
export const joinSpaceRoom = (spaceId: string) => spaceEmit<SpaceJoinAck>('space:join', { spaceId });
export const leaveSpaceRoom = (spaceId: string) => spaceEmit<{ ok: true; left: boolean }>('space:leave', { spaceId }, 6000);
export const setSpaceHand = (spaceId: string, raised: boolean) => spaceEmit<{ ok: true; hand: boolean; role: SpaceRole }>('space:hand', { spaceId, raised });
/** Host / co-host: decline someone's request to speak. */
export const declineSpaceHand = (spaceId: string, userId: string) => spaceEmit<{ ok: true; hand: false }>('space:hand', { spaceId, userId, raised: false });
export const inviteSpaceSpeaker = (spaceId: string, userId: string) => spaceEmit<{ ok: true; invited: true }>('space:invite_speaker', { spaceId, userId });
export const respondSpaceInvite = (spaceId: string, accept: boolean) => spaceEmit<{ ok: true; role: SpaceRole }>('space:respond_invite', { spaceId, accept });
export const setSpaceRole = (spaceId: string, userId: string, role: 'cohost' | 'speaker' | 'listener') =>
  spaceEmit<{ ok: true; role: SpaceRole }>('space:set_role', { spaceId, userId, role });
export const muteSpaceMember = (spaceId: string, userId: string) => spaceEmit<{ ok: true }>('space:mute', { spaceId, userId });
export const selfMuteSpace = (spaceId: string, muted: boolean) => spaceEmit<{ ok: true; muted: boolean; mutedByHost: boolean }>('space:self_mute', { spaceId, muted });
export const removeSpaceMember = (spaceId: string, userId: string) => spaceEmit<{ ok: true }>('space:remove', { spaceId, userId });
export const endSpaceRoom = (spaceId: string) => spaceEmit<{ ok: true; ended: boolean }>('space:end', { spaceId });
export const reportInSpace = (spaceId: string, input: { userId?: string | null; category: string; note?: string }) =>
  spaceEmit<{ ok: true; reportId: string; duplicate: boolean }>('space:report', {
    spaceId,
    category: input.category,
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.note ? { note: input.note } : {}),
  });

/**
 * Re-join after the live connection drops and comes back (network change, app resume, server
 * deploy). The server keeps the seat and role for its grace period, then re-sends every
 * peer connection. Returns an unsubscribe function.
 */
export const keepSpaceJoined = (spaceId: string, onRejoin: (ack: SpaceJoinAck | null, err: SpaceSocketError | null) => void, onDown?: () => void) => {
  // Only a drop after we were connected counts: the first connect delivers the original
  // (buffered) join, so re-joining then would just churn every peer connection.
  let seenConnected = getCampusConnectionState() === 'connected';
  let wasDown = false;
  return subscribeCampusConnection((state) => {
    if (state === 'connected') {
      if (!seenConnected) {
        seenConnected = true;
        return;
      }
      if (!wasDown) return;
      wasDown = false;
      joinSpaceRoom(spaceId)
        .then((ack) => onRejoin(ack, null))
        .catch((e) => onRejoin(null, e instanceof SpaceSocketError ? e : new SpaceSocketError(String(e?.message || 'Reconnect failed'), 'TIMEOUT')));
    } else if ((state === 'disconnected' || state === 'connecting') && seenConnected) {
      if (!wasDown) onDown?.();
      wasDown = true;
    }
  });
};
