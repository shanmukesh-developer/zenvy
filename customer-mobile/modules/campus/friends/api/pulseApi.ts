/**
 * Zenvy Friends > Pulse (/api/campus/pulse). Contract: backend_contract.md "Friends (pulse)".
 * Every call goes through `friendsRequest`, so errors arrive as CampusApiError with the server `code`.
 */
import { friendsRequest, newClientId, FriendsIdentity } from './core';

// ── Limits (mirrors the server; the server is authoritative) ────────────────
export const PULSE_LIMITS = {
  text: 280,
  media: 4,
  pollOptions: { min: 2, max: 4 },
  pollLabel: 40,
  pollHours: { min: 1, max: 168, default: 24 },
  hashtagsPerPost: 10,
  pageSize: 20,
} as const;

export const PULSE_POLL_DURATIONS: { hours: number; label: string }[] = [
  { hours: 1, label: '1 hour' },
  { hours: 6, label: '6 hours' },
  { hours: 24, label: '1 day' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
];

// ── Enums ─────────────────────────────────────────────────────────────────────
export type PulseFeedTab = 'campus' | 'following';
export type PulseReplyPolicy = 'everyone' | 'following' | 'none';
export type PulseStatus = 'visible' | 'pending_review' | 'hidden' | 'removed' | 'deleted';

// ── DTOs ──────────────────────────────────────────────────────────────────────
export interface PulsePollOption {
  idx: number;
  label: string;
  /** Present only when `showResults`. */
  votes?: number;
}

export interface PulsePoll {
  id: string;
  options: PulsePollOption[];
  totalVotes?: number;
  myVote: number | null;
  closesAt: string;
  closed: boolean;
  showResults: boolean;
}

export interface PulseReplyTo {
  id: string;
  author?: FriendsIdentity;
  unavailable?: true;
}

export interface PulsePost {
  kind: 'post' | 'reply';
  id: string;
  rootId: string | null;
  parentId: string | null;
  replyTo: PulseReplyTo | null;
  text: string;
  hashtags: string[];
  media: { mediaId: string; url: string }[];
  link: { url: string; host: string } | null;
  poll: PulsePoll | null;
  author: FriendsIdentity;
  replyPolicy: PulseReplyPolicy;
  canReply: boolean;
  status: PulseStatus;
  underReview: boolean;
  removedReason?: string | null;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  liked: boolean;
  reposted: boolean;
  bookmarked: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canRepost: boolean;
  mine?: boolean;
  /** Imported from the old Whispers board. */
  imported?: boolean;
  createdAt: string;
  editedAt: string | null;
}

export interface PulseRepost {
  kind: 'repost';
  /** Reaction id (not the post id). */
  id: string;
  repostedBy: FriendsIdentity | null;
  repostedAt: string;
  post: PulsePost;
}

export interface PulseSpaceCard {
  kind: 'space_card';
  id: string;
  spaceId: string;
  title: string;
  topic: string | null;
  host: FriendsIdentity;
  status: 'scheduled' | 'live';
  scheduledFor: string | null;
  startedAt: string | null;
  participantCount: number;
  interestedCount: number;
  reminded: boolean;
  createdAt: string;
}

export type PulseFeedItem = PulsePost | PulseRepost | PulseSpaceCard;

export interface PulseTrend {
  rank: number;
  hashtagId: string;
  tag: string;
  /** Distinct people who used the tag in the window. */
  people: number;
  posts: number;
}

export interface PulseHashtagInfo {
  id: string | null;
  tag: string;
  postCount: number;
  lastUsedAt?: string | null;
  muted: boolean;
}

export interface PulsePage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PulseFeedPage extends PulsePage<PulseFeedItem> {
  tab: PulseFeedTab;
  /** Top trends; only on the first Campus page. */
  trends?: PulseTrend[];
}

export interface PulseEntityOption {
  id: string;
  name: string;
  handle?: string | null;
  type?: string;
  avatarUrl?: string | null;
  verified?: boolean;
}

export interface PulseCreateInput {
  text: string;
  mediaIds?: string[];
  link?: string | null;
  poll?: { options: string[]; durationHours: number } | null;
  replyPolicy?: PulseReplyPolicy;
  anonymous?: boolean;
  parentId?: string | null;
  entityId?: string | null;
  clientId?: string;
}

export interface PulseCounts {
  likeCount: number;
  replyCount: number;
  repostCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const enc = encodeURIComponent;
const list = <T>(json: any): PulsePage<T> => ({
  items: Array.isArray(json?.items) ? json.items : [],
  nextCursor: typeof json?.nextCursor === 'string' && json.nextCursor ? json.nextCursor : null,
});

/** Text length the way the server counts it (Unicode code points, so an emoji counts once). */
export const pulseLength = (s: string) => Array.from(s || '').length;

// ── Feeds and discovery ───────────────────────────────────────────────────────
export const fetchPulseFeed = async (tab: PulseFeedTab, cursor?: string | null): Promise<PulseFeedPage> => {
  const json = await friendsRequest<any>('/pulse/feed', {
    query: { tab, cursor, limit: PULSE_LIMITS.pageSize },
    fallback: "Couldn't load Pulse right now.",
  });
  return { tab, ...list<PulseFeedItem>(json), trends: Array.isArray(json?.trends) ? json.trends : undefined };
};

export const fetchPulseTrends = async (): Promise<{ items: PulseTrend[]; windowHours: number; minPeople: number }> => {
  const json = await friendsRequest<any>('/pulse/trends', { fallback: "Couldn't load trends." });
  return {
    items: Array.isArray(json?.items) ? json.items : [],
    windowHours: Number(json?.windowHours) || 24,
    minPeople: Number(json?.minPeople) || 2,
  };
};

export const fetchPulseHashtag = async (tag: string, cursor?: string | null): Promise<PulsePage<PulsePost> & { hashtag: PulseHashtagInfo }> => {
  const json = await friendsRequest<any>(`/pulse/hashtags/${enc(tag.replace(/^#/, ''))}`, {
    query: { cursor },
    fallback: "Couldn't load this hashtag.",
  });
  return { ...list<PulsePost>(json), hashtag: json?.hashtag || { id: null, tag, postCount: 0, muted: false } };
};

export const fetchPulseUserPosts = async (userId: string, cursor?: string | null) =>
  list<PulsePost>(await friendsRequest<any>(`/pulse/users/${enc(userId)}/posts`, { query: { cursor }, fallback: "Couldn't load posts." }));

export const fetchMyPulsePosts = async (cursor?: string | null) =>
  list<PulsePost>(await friendsRequest<any>('/pulse/mine', { query: { cursor }, fallback: "Couldn't load your posts." }));

export const fetchPulseBookmarks = async (cursor?: string | null) =>
  list<PulsePost>(await friendsRequest<any>('/pulse/bookmarks', { query: { cursor }, fallback: "Couldn't load your bookmarks." }));

// ── Posts and replies ─────────────────────────────────────────────────────────
export const fetchPulsePost = async (id: string): Promise<{ post: PulsePost | null; parent: PulsePost | null; root: PulsePost | null }> => {
  const json = await friendsRequest<any>(`/pulse/posts/${enc(id)}`, { fallback: "Couldn't load this post." });
  return { post: json?.post || null, parent: json?.parent || null, root: json?.root || null };
};

/** Direct replies, oldest first. */
export const fetchPulseReplies = async (id: string, cursor?: string | null) =>
  list<PulsePost>(await friendsRequest<any>(`/pulse/posts/${enc(id)}/replies`, { query: { cursor }, fallback: "Couldn't load replies." }));

export const createPulsePost = async (input: PulseCreateInput): Promise<{ post: PulsePost; duplicate: boolean; underReview: boolean }> => {
  const body: any = {
    text: input.text,
    clientId: input.clientId || newClientId(),
  };
  if (input.mediaIds && input.mediaIds.length) body.mediaIds = input.mediaIds;
  if (input.link) body.link = input.link;
  if (input.poll) body.poll = input.poll;
  if (input.replyPolicy) body.replyPolicy = input.replyPolicy;
  if (typeof input.anonymous === 'boolean') body.anonymous = input.anonymous;
  if (input.parentId) body.parentId = input.parentId;
  if (input.entityId) body.entityId = input.entityId;
  const json = await friendsRequest<any>('/pulse/posts', { method: 'POST', body, fallback: "Couldn't post that. Please try again." });
  return { post: json.post, duplicate: !!json.duplicate, underReview: !!json.underReview || json?.post?.status === 'pending_review' };
};

export const updatePulsePost = async (id: string, text: string): Promise<{ post: PulsePost; underReview: boolean }> => {
  const json = await friendsRequest<any>(`/pulse/posts/${enc(id)}`, { method: 'PATCH', body: { text }, fallback: "Couldn't save your edit." });
  return { post: json.post, underReview: !!json.underReview };
};

export const deletePulsePost = (id: string) =>
  friendsRequest<{ deleted: boolean }>(`/pulse/posts/${enc(id)}`, { method: 'DELETE', fallback: "Couldn't delete it. Please try again." });

// ── Interactions (idempotent) ─────────────────────────────────────────────────
export const setPulseLike = (id: string, on: boolean) =>
  friendsRequest<{ liked: boolean } & PulseCounts>(`/pulse/posts/${enc(id)}/like`, { method: on ? 'POST' : 'DELETE' });

export const setPulseRepost = (id: string, on: boolean) =>
  friendsRequest<{ reposted: boolean } & PulseCounts>(`/pulse/posts/${enc(id)}/repost`, { method: on ? 'POST' : 'DELETE' });

export const setPulseBookmark = (id: string, on: boolean) =>
  friendsRequest<{ bookmarked: boolean }>(`/pulse/posts/${enc(id)}/bookmark`, { method: on ? 'POST' : 'DELETE' });

export const votePulsePoll = async (pollId: string, optionIdx: number): Promise<{ poll: PulsePoll; duplicate: boolean }> => {
  const json = await friendsRequest<any>(`/pulse/polls/${enc(pollId)}/vote`, { method: 'POST', body: { optionIdx }, fallback: "Couldn't record your vote." });
  return { poll: json.poll, duplicate: !!json.duplicate };
};

// ── Space cards (Spaces API; only reachable while Spaces is on) ───────────────
export const setSpaceReminder = (spaceId: string, on: boolean) =>
  friendsRequest<{ reminded?: boolean; interestedCount?: number }>(`/spaces/${enc(spaceId)}/remind`, {
    method: on ? 'POST' : 'DELETE',
    fallback: "Couldn't update the reminder.",
  });

// ── Verified clubs / official accounts I manage (composer "post as") ─────────
let managedCache: PulseEntityOption[] | null = null;
/**
 * Entities this student may post as. Older servers without the endpoint (404) mean "none":
 * the composer then hides the picker. Cached for the app session.
 */
export const fetchManagedEntities = async (): Promise<PulseEntityOption[]> => {
  if (managedCache) return managedCache;
  try {
    const json = await friendsRequest<any>('/pulse/entities/mine', { fallback: "Couldn't load your clubs." });
    managedCache = Array.isArray(json?.items) ? json.items : [];
  } catch (e: any) {
    if (e?.status === 404) managedCache = [];
    else throw e;
  }
  return managedCache || [];
};
