/**
 * Zenvy Friends — Spaces (live audio rooms) REST API, `/api/campus/spaces`.
 * Contract: backend_contract.md "Friends (spaces)" FS-2. The live room itself (join, hands, roles,
 * mute, remove, WebRTC signaling) runs on the existing `/campus` socket: see spaces/spacesSocket.ts.
 * Spaces are never recorded: every payload carries `recording:false`.
 */
import { friendsRequest, newClientId, errorCode, FriendsIdentity } from './core';

const enc = encodeURIComponent;

export type SpaceStatus = 'scheduled' | 'live' | 'ended' | 'cancelled' | 'expired';
export type SpaceRole = 'host' | 'cohost' | 'speaker' | 'listener';
export type SpaceParticipation = 'request' | 'open';
export type SpaceModStatus = 'visible' | 'pending_review' | 'hidden' | 'removed';
export type SpaceEndReason = 'host_ended' | 'host_left' | 'empty' | 'server_restart' | 'moderation' | 'admin' | 'cancelled' | 'expired';
export type SpaceListStatus = 'live' | 'scheduled' | 'mine';

export interface SpaceSpeaker {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  verified?: boolean;
  role: SpaceRole;
}

export interface Space {
  id: string;
  title: string;
  topic: string | null;
  description: string | null;
  participation: SpaceParticipation;
  visibility: 'campus';
  status: SpaceStatus;
  /** UTC ISO; shown in the device's local time. */
  scheduledFor: string | null;
  startedAt: string | null;
  endedAt: string | null;
  endReason: SpaceEndReason | null;
  host: FriendsIdentity;
  isHost: boolean;
  /** My live role (only while live and I'm in the room). */
  myRole: SpaceRole | null;
  /** I was removed by the host: I can't rejoin. */
  removed: boolean;
  reminded: boolean;
  interestedCount: number;
  participantCount: number;
  speakerCount: number;
  listenerCount: number;
  speakers: SpaceSpeaker[];
  limits: { maxSpeakers: number; maxListeners: number };
  full: { speakers: boolean; listeners: boolean };
  recording: false;
  canStart: boolean;
  canEdit: boolean;
  canCancel: boolean;
  canEnd: boolean;
  canRemind: boolean;
  createdAt: string;
  /** Host only. */
  modStatus?: SpaceModStatus;
  underReview?: boolean;
}

export interface SpacesMeta {
  text: { titleMin: number; titleMax: number; topicMax: number; descriptionMax: number };
  participation: { key: SpaceParticipation; label: string; hint: string }[];
  schedule: { minMinutes: number; maxDays: number; expireAfterMinutes: number; reminderLeadMinutes: number; timezone?: string };
  caps: { maxSpeakers: number; maxListeners: number };
  reconnectGraceSec: number;
  recording: false;
  notRecorded: string;
  network: { turn: boolean; note: string | null };
  limits: Record<string, { max: number; windowSec: number }>;
}

/** Used until /meta answers (same numbers as the server defaults). */
export const SPACES_DEFAULT_META: SpacesMeta = {
  text: { titleMin: 3, titleMax: 80, topicMax: 40, descriptionMax: 300 },
  participation: [
    { key: 'request', label: 'Raise hand to speak', hint: 'Hosts accept who comes on stage.' },
    { key: 'open', label: 'Open stage', hint: 'Anyone who raises a hand gets a free seat.' },
  ],
  schedule: { minMinutes: 5, maxDays: 30, expireAfterMinutes: 60, reminderLeadMinutes: 10 },
  caps: { maxSpeakers: 6, maxListeners: 40 },
  reconnectGraceSec: 20,
  recording: false,
  notRecorded: 'Spaces are live only. They are never recorded or transcribed.',
  network: { turn: false, note: null },
  limits: {},
};

export interface SpaceInput {
  title: string;
  topic?: string | null;
  description?: string | null;
  participation?: SpaceParticipation;
  /** Exactly one of startNow / scheduledFor (ISO 8601 with a timezone). */
  startNow?: boolean;
  scheduledFor?: string | null;
  /** Host as a verified club / official account I manage. */
  entityId?: string | null;
  clientId?: string;
}

export type SpacePatch = Partial<Pick<SpaceInput, 'title' | 'topic' | 'description' | 'participation' | 'scheduledFor'>>;

// ── Reads ─────────────────────────────────────────────────────────────────────
export const fetchSpacesMeta = () => friendsRequest<SpacesMeta>('/spaces/meta', { fallback: "Couldn't load Spaces settings." });

export const fetchSpaces = (status: SpaceListStatus, cursor?: string | null) =>
  friendsRequest<{ items: Space[]; nextCursor: string | null }>('/spaces', {
    query: { status, cursor: cursor || undefined },
    fallback: "Couldn't load Spaces right now.",
  });

export const fetchSpace = async (id: string): Promise<Space> =>
  (await friendsRequest<{ space: Space }>(`/spaces/${enc(id)}`, { fallback: "Couldn't load this Space." })).space;

// ── Writes ────────────────────────────────────────────────────────────────────
export const createSpace = (input: SpaceInput) =>
  friendsRequest<{ space: Space; duplicate: boolean; underReview?: boolean }>('/spaces', {
    method: 'POST',
    body: { ...input, clientId: input.clientId || newClientId() },
    fallback: "Couldn't create your Space. Please try again.",
  });

export const updateSpace = (id: string, patch: SpacePatch) =>
  friendsRequest<{ space: Space; rescheduled: boolean }>(`/spaces/${enc(id)}`, {
    method: 'PATCH',
    body: patch,
    fallback: "Couldn't save your changes. Please try again.",
  });

export const startSpace = (id: string) =>
  friendsRequest<{ space: Space; duplicate: boolean }>(`/spaces/${enc(id)}/start`, { method: 'POST', fallback: "Couldn't start the Space." });

export const cancelSpace = (id: string) =>
  friendsRequest<{ space: Space; duplicate: boolean }>(`/spaces/${enc(id)}/cancel`, { method: 'POST', fallback: "Couldn't cancel the Space." });

export const endSpace = (id: string) =>
  friendsRequest<{ space: Space; duplicate: boolean }>(`/spaces/${enc(id)}/end`, { method: 'POST', fallback: "Couldn't end the Space." });

export const setSpaceRemind = (id: string, on: boolean) =>
  friendsRequest<{ reminded: boolean; interestedCount: number; duplicate?: boolean }>(`/spaces/${enc(id)}/remind`, {
    method: on ? 'POST' : 'DELETE',
    fallback: "Couldn't update the reminder.",
  });

// ── Errors ────────────────────────────────────────────────────────────────────
/** Short, human message for any Spaces REST or socket error. */
export const spaceErrorMessage = (e: any, fallback = 'Please try again.'): string => {
  switch (errorCode(e)) {
    case 'RATE_LIMITED':
      return "You're doing that a lot. Please wait a bit and try again.";
    case 'GUIDELINES_REQUIRED':
      return 'Please accept the community guidelines first.';
    case 'FEATURE_OFF':
      return 'Spaces is switched off right now.';
    case 'VERIFICATION_REQUIRED':
      return 'Verify your college email to use Spaces.';
    case 'FRIENDS_SANCTIONED':
      return 'Spaces is restricted for your account. See Me › Friends privacy & safety.';
    case 'SPACE_NOT_FOUND':
    case 'NOT_FOUND':
      return 'This Space is no longer available.';
    case 'INVALID_ID':
      return 'That link is not valid.';
    case 'TOO_SHORT':
    case 'TOO_LONG':
    case 'INVALID_INPUT':
    case 'INVALID_PARTICIPATION':
      return e?.message || 'Please check the details and try again.';
    case 'INVALID_SCHEDULE':
      return e?.message || 'Pick a start time between 5 minutes and 30 days from now.';
    case 'CONTENT_BLOCKED':
      return "Part of this breaks the community guidelines. Please reword it.";
    case 'NOT_ENTITY_MANAGER':
      return 'You can only host as a verified club or account you manage.';
    case 'ALREADY_HOSTING':
      return 'You are already hosting a live Space. End it first.';
    case 'TOO_MANY_SCHEDULED':
      return e?.message || 'You have too many upcoming Spaces.';
    case 'NOT_HOST':
      return 'Only the host can do that.';
    case 'NOT_SCHEDULED':
      return 'This Space is no longer scheduled.';
    case 'NOT_LIVE':
      return 'This Space is not live.';
    case 'UNDER_REVIEW':
      return 'This Space is waiting for a quick moderator check before it can start.';
    case 'STATE_CHANGED':
      return 'This Space just changed. We refreshed it for you.';
    case 'HOST_CANNOT_REMIND':
      return "You're the host. You'll be there.";
    case 'SPACE_NOT_LIVE':
      return e?.status === 'scheduled' || e?.data?.status === 'scheduled' ? 'This Space has not started yet.' : 'This Space has ended.';
    case 'SPACE_REMOVED':
      return 'You were removed from this Space by the host.';
    case 'ROOM_FULL':
      return (e?.kind || e?.data?.kind) === 'speakers' ? 'All speaker seats are taken.' : 'This Space is full right now. Try again in a bit.';
    case 'NOT_IN_SPACE':
      return 'You are not in this Space any more.';
    case 'NOT_ALLOWED':
      return e?.message || "You can't do that.";
    case 'INVITE_FIRST':
      return 'Invite them to speak first. Nobody goes on stage without saying yes.';
    case 'ALREADY_SPEAKER':
      return 'Already on stage.';
    case 'NOT_CONNECTED':
      return 'They are reconnecting. Try again in a moment.';
    case 'NO_INVITE':
      return 'That invitation is no longer open.';
    case 'NOT_SPEAKER':
      return 'Only people on stage can do that.';
    case 'ACCOUNT_REQUIRED':
      return 'Please sign in again.';
    default:
      return e?.message && String(e.message).length < 160 ? String(e.message) : fallback;
  }
};
