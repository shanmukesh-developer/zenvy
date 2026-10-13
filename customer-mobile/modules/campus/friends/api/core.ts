/**
 * Zenvy Friends — request wrapper + foundation endpoints (/api/campus/friends).
 * Reuses the campus fetch helpers (timeout, friendly errors, CampusApiError with the server `code`).
 * Every sub-tab API (pulseApi, forumApi, …) builds on `friendsRequest`.
 */
import { API_URL } from '../../../../constants/api';
import { CampusApiError, campusFetch, getAuthHeaders, jsonOrThrow } from '../../campusApi';
import type { FriendsSubTab } from '../../../../types/campus';

export { CampusApiError };

type Query = Record<string, string | number | boolean | null | undefined>;

const toQuery = (q?: Query) => {
  if (!q) return '';
  const parts = Object.entries(q)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

/**
 * Signed-in JSON request to `/api/campus<path>`.
 * Throws CampusApiError (status + code + data) with a short, friendly message.
 */
export const friendsRequest = async <T = any>(
  path: string,
  opts: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: any; query?: Query; fallback?: string } = {}
): Promise<T> => {
  const headers = await getAuthHeaders();
  const res = await campusFetch(`${API_URL}/api/campus${path}${toQuery(opts.query)}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  return jsonOrThrow(res, opts.fallback || "Couldn't reach Friends right now. Please try again.");
};

/** New client id for idempotent creates (`clientId`): a retry returns the same row with duplicate:true. */
export const newClientId = (): string => {
  const c: any = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // RFC 4122 v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

// ── Error codes the UI reacts to ──────────────────────────────────────────────
export const FRIENDS_CODES = {
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
  FRIENDS_SANCTIONED: 'FRIENDS_SANCTIONED',
  FEATURE_OFF: 'FEATURE_OFF',
  GUIDELINES_REQUIRED: 'GUIDELINES_REQUIRED',
  GUIDELINES_VERSION_MISMATCH: 'GUIDELINES_VERSION_MISMATCH',
  RATE_LIMITED: 'RATE_LIMITED',
  CONTENT_BLOCKED: 'CONTENT_BLOCKED',
  CHAT_CLOSED: 'CHAT_CLOSED',
} as const;

export const errorCode = (e: any): string => (e && typeof e.code === 'string' ? e.code : '');
/** True when the error means "show the eligibility / guidelines gate again" (refetch eligibility). */
export const isGateError = (e: any) =>
  ['VERIFICATION_REQUIRED', 'FRIENDS_SANCTIONED', 'FEATURE_OFF', 'GUIDELINES_REQUIRED'].includes(errorCode(e));

// ── Types ─────────────────────────────────────────────────────────────────────
export type FriendsReason =
  | 'ACCOUNT_SUSPENDED'
  | 'CAMPUS_REQUIRED'
  | 'VERIFICATION_REQUIRED'
  | 'CAMPUS_INACTIVE'
  | 'FRIENDS_SANCTIONED'
  | 'FRIENDS_OFF';

export type FriendsSanctionScope = 'friends' | FriendsSubTab;

export interface FriendsSanctionInfo {
  scope: FriendsSanctionScope;
  /** ISO time; null = permanent. */
  until: string | null;
}

export interface FriendsEligibility {
  eligible: boolean;
  reasons: FriendsReason[];
  campus: { id: string; code: string; name: string } | null;
  verification: { status: 'unverified' | 'pending' | 'verified' | 'rejected'; verifiedAt: string | null };
  /** Effective flags (admin flag on AND the phase shipped). All false while the user is not eligible. */
  features: Record<FriendsSubTab, boolean>;
  /**
   * Optional (newer servers): flags as they are for the campus, before this student's eligibility.
   * Lets the app list a sub-tab and explain the gate (verify / restricted) instead of hiding it.
   */
  available?: Partial<Record<FriendsSubTab, boolean>>;
  sanctions: FriendsSanctionInfo[];
  sanction: FriendsSanctionInfo | null;
  guidelines: { version: number; accepted: boolean; acceptedVersion: number | null; url: string | null };
  connect: { eligible: boolean; reasons: string[] };
  limits: Record<string, { max: number; windowSec: number }>;
}

/** Named or anonymous author, exactly as the server's identity serializer outputs it. */
export type FriendsIdentity =
  | {
      anonymous?: false;
      userId: string;
      name: string;
      avatarUrl?: string | null;
      campusCode?: string | null;
      year?: number | null;
      branch?: string | null;
      verified?: boolean;
      badges?: string[];
      limited?: boolean;
      entity?: { id: string; name: string; handle?: string; verified?: boolean; type?: string } | null;
    }
  | { anonymous: true; alias: string; isMine?: boolean };

export interface FriendsNotifPrefs {
  replies: boolean;
  mentions: boolean;
  follows: boolean;
  forum: boolean;
  spaces: boolean;
  tasks: boolean;
  connect: boolean;
  moderation: boolean;
  lockScreenPreviews: boolean;
}

export interface FriendsSettings {
  profileVisibility: 'campus' | 'followers';
  showYear: boolean;
  showBranch: boolean;
  defaultAnonymous: boolean;
  notifPrefs: FriendsNotifPrefs;
  guidelinesVersion: number | null;
  guidelinesAcceptedAt: string | null;
}

export type FriendsSettingsPatch = Partial<Omit<FriendsSettings, 'notifPrefs' | 'guidelinesVersion' | 'guidelinesAcceptedAt'>> & {
  notifPrefs?: Partial<FriendsNotifPrefs>;
};

export interface FriendsGuidelines {
  version: number;
  text: string;
  url: string | null;
  accepted: boolean;
}

export interface FriendsUserCard {
  user: FriendsIdentity;
  stats: {
    karma: number;
    helpfulAnswers: number;
    resourcesShared: number;
    tasks: { tasksCompleted: number; ratingAvg: number | null; ratingCount: number };
  } | null;
  followerCount: number;
  followingCount: number;
  isMe: boolean;
  isFollowing: boolean;
  isMuted: boolean;
}

export type FollowTargetType = 'user' | 'entity';
export type MuteTargetType = 'user' | 'entity' | 'community' | 'hashtag';

// ── Foundation endpoints ──────────────────────────────────────────────────────
export const fetchFriendsEligibility = () =>
  friendsRequest<FriendsEligibility>('/friends/eligibility', { fallback: "Couldn't load Friends right now." });

export const fetchFriendsGuidelines = () =>
  friendsRequest<FriendsGuidelines>('/friends/guidelines', { fallback: "Couldn't load the guidelines." });

export const acceptFriendsGuidelines = (version: number) =>
  friendsRequest<{ accepted: boolean; version: number; acceptedAt: string; duplicate: boolean }>('/friends/guidelines/accept', {
    method: 'POST',
    body: { version },
    fallback: "Couldn't save that. Please try again.",
  });

export const fetchFriendsSettings = async (): Promise<FriendsSettings> =>
  (await friendsRequest<{ settings: FriendsSettings }>('/friends/settings', { fallback: "Couldn't load your Friends settings." })).settings;

export const updateFriendsSettings = async (patch: FriendsSettingsPatch): Promise<FriendsSettings> =>
  (
    await friendsRequest<{ settings: FriendsSettings }>('/friends/settings', {
      method: 'PUT',
      body: patch,
      fallback: "Couldn't save your settings. Please try again.",
    })
  ).settings;

export const fetchFriendsUser = (userId: string) =>
  friendsRequest<FriendsUserCard>(`/friends/users/${encodeURIComponent(userId)}`, { fallback: "Couldn't load this profile." });

export const followTarget = (targetType: FollowTargetType, targetId: string) =>
  friendsRequest<{ following?: boolean; duplicate?: boolean }>('/friends/follow', { method: 'POST', body: { targetType, targetId } });

export const unfollowTarget = (targetType: FollowTargetType, targetId: string) =>
  friendsRequest<{ following: false; removed: boolean }>('/friends/follow', { method: 'DELETE', query: { targetType, targetId } });

export const fetchFollowing = (opts: { type?: FollowTargetType; cursor?: string | null } = {}) =>
  friendsRequest<{
    items: ({ type: 'user'; user: FriendsIdentity } | { type: 'entity'; entity: any })[];
    nextCursor: string | null;
  }>('/friends/following', { query: { type: opts.type, cursor: opts.cursor } });

export const muteTarget = (targetType: MuteTargetType, targetId: string) =>
  friendsRequest<{ muted: boolean; duplicate?: boolean }>('/friends/mute', { method: 'POST', body: { targetType, targetId } });

export const unmuteTarget = (targetType: MuteTargetType, targetId: string) =>
  friendsRequest<{ muted: boolean }>('/friends/mute', { method: 'DELETE', query: { targetType, targetId } });

export interface FriendsMuteItem {
  targetType: MuteTargetType;
  targetId: string;
  createdAt?: string;
  user?: FriendsIdentity;
  label?: string;
}

export const fetchMutes = async (): Promise<FriendsMuteItem[]> => {
  const json = await friendsRequest<{ items?: any[] }>('/friends/mutes');
  return Array.isArray(json?.items) ? json.items : [];
};
