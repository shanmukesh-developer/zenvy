/**
 * Zenvy Friends > Forum (/api/campus/forum). Contract: backend_contract.md "Friends (forum)".
 * Every call goes through `friendsRequest`, so errors arrive as CampusApiError with the server `code`.
 */
import { friendsRequest, newClientId, FriendsIdentity } from './core';

// ── Enums ─────────────────────────────────────────────────────────────────────
export type ForumPostType = 'question' | 'discussion' | 'review' | 'resource' | 'guidance' | 'campus_info';
export type ForumSort = 'hot' | 'new' | 'top';
export type ForumTopWindow = 'day' | 'week' | 'month' | 'year' | 'all';
export type ForumCommentSort = 'best' | 'new' | 'old';
export type ForumContentStatus = 'visible' | 'pending_review' | 'hidden' | 'removed' | 'deleted';
export type ReviewKind = 'course' | 'professor' | 'hostel' | 'mess' | 'club' | 'placement';
export type ReviewStatus = 'published' | 'pending_review' | 'hidden' | 'removed';
export type CommunityRole = 'owner' | 'moderator';
export type ForumPostModAction = 'pin' | 'unpin' | 'lock' | 'unlock' | 'remove' | 'restore' | 'approve';
export type ForumCommentModAction = 'remove' | 'restore' | 'approve';

export const FORUM_POST_TYPES: ForumPostType[] = ['question', 'discussion', 'review', 'resource', 'guidance', 'campus_info'];
export const REVIEW_KINDS: ReviewKind[] = ['course', 'professor', 'hostel', 'mess', 'club', 'placement'];
export const FORUM_MAX_DEPTH = 5;
export const FORUM_LIMITS = {
  title: { min: 5, max: 150 },
  body: 5000,
  comment: 3000,
  media: 4,
  links: 5,
  pros: 500,
  cons: 500,
  period: 40,
  response: { min: 10, max: 1500 },
  communityName: { min: 3, max: 60 },
  communityDescription: 300,
  modReason: 300,
} as const;

/** Context fields a review may carry (server whitelist). */
export type ReviewContextKey = 'course' | 'section' | 'semester' | 'year' | 'role' | 'company' | 'roomType' | 'attendance' | 'grade';
export type ReviewContext = Partial<Record<ReviewContextKey, string>>;

// ── DTOs ──────────────────────────────────────────────────────────────────────
export interface FreshersGuideRef {
  postId: string;
  title: string;
  isOfficial: boolean;
  label: 'official' | 'student';
  updatedAt: string;
}

export interface ForumCommunity {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  rules: string[];
  kind: 'default' | 'custom';
  allowAnonymous: boolean;
  allowedTypes: ForumPostType[];
  status: 'active' | 'pending' | 'archived';
  memberCount: number;
  postCount: number;
  isMember: boolean;
  myRole: CommunityRole | null;
  freshersGuide: FreshersGuideRef | null;
  moderators?: { role: CommunityRole; user: FriendsIdentity }[];
}

export interface ForumReviewResponse {
  id: string;
  body: string;
  responderRole: 'faculty' | 'official' | 'admin';
  responder: { name: string; official: true; avatarUrl?: string | null; [k: string]: any };
  createdAt: string;
  editedAt: string | null;
}

export interface ForumReview {
  id: string;
  targetId: string;
  target: { id: string; kind: ReviewKind; name: string } | null;
  rating: number;
  pros: string | null;
  cons: string | null;
  periodLabel: string | null;
  context: ReviewContext;
  status: ReviewStatus;
  underReview: boolean;
  isMine?: boolean;
  response: ForumReviewResponse | null;
  createdAt: string;
  editedAt: string | null;
}

export interface ForumPost {
  id: string;
  communityId: string;
  community: { id: string; slug: string; name: string } | null;
  type: ForumPostType;
  title: string;
  body: string;
  bodyTruncated: boolean;
  media: { mediaId: string; url: string }[];
  links: { url: string; host: string }[];
  author: FriendsIdentity;
  isOfficial: boolean;
  label: 'official' | 'student';
  isPinned: boolean;
  isFreshersGuide: boolean;
  isLocked: boolean;
  bestCommentId: string | null;
  status: ForumContentStatus;
  underReview: boolean;
  removedReason?: string | null;
  up: number;
  down: number;
  score: number;
  commentCount: number;
  myVote: -1 | 0 | 1;
  bookmarked: boolean;
  canEdit: boolean;
  canModerate: boolean;
  review?: ForumReview;
  createdAt: string;
  editedAt: string | null;
  lastActivityAt: string;
}

/** Tombstones (deleted / removed / blocked) have body:null and author:null. */
export interface ForumComment {
  id: string;
  postId: string;
  parentId: string | null;
  depth: number;
  body: string | null;
  author: FriendsIdentity | null;
  status: ForumContentStatus | 'blocked';
  underReview?: boolean;
  removedReason?: string | null;
  isOfficialReply?: boolean;
  up?: number;
  down?: number;
  score?: number;
  myVote?: -1 | 0 | 1;
  canEdit?: boolean;
  createdAt: string;
  editedAt?: string | null;
}

export interface ReviewTarget {
  id: string;
  kind: ReviewKind;
  name: string;
  meta: { department?: string | null; code?: string | null; block?: string | null };
  status: 'active' | 'pending' | 'hidden';
  reviewCount: number;
  average: number | null;
  distribution?: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface ForumModReport {
  reportId: string;
  reportIds: string[];
  targetType: 'forum_post' | 'forum_comment' | 'review';
  targetId: string;
  postId: string | null;
  communityId: string;
  reportCount: number;
  categories: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  snapshot: { excerpt: string; anonymous: boolean; alias?: string | null };
  isSystem: boolean;
  lastReportedAt: string;
}

export interface ForumModLogItem {
  id: string;
  action: string;
  actorRole: 'community_mod' | 'admin' | 'system';
  moderator: FriendsIdentity | { name: string } | null;
  targetType: string;
  targetId: string;
  reason: string | null;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ReviewInput {
  targetId: string;
  rating: number;
  pros?: string;
  cons?: string;
  periodLabel?: string;
  context?: ReviewContext;
}

export interface CreatePostInput {
  type: ForumPostType;
  title: string;
  body?: string;
  mediaIds?: string[];
  links?: string[];
  anonymous?: boolean;
  freshersGuide?: boolean;
  review?: ReviewInput;
  /** Reuse the same id when retrying the same draft (server returns the first post with duplicate:true). */
  clientId?: string;
}

const enc = encodeURIComponent;

// ── Communities ───────────────────────────────────────────────────────────────
export const fetchCommunities = async (): Promise<ForumCommunity[]> => {
  const json = await friendsRequest<{ items: ForumCommunity[] }>('/forum/communities', { fallback: "Couldn't load communities." });
  return Array.isArray(json?.items) ? json.items : [];
};

export const fetchCommunity = async (idOrSlug: string): Promise<ForumCommunity> =>
  (await friendsRequest<{ community: ForumCommunity }>(`/forum/communities/${enc(idOrSlug)}`, { fallback: "Couldn't load this community." })).community;

export const requestCommunity = (input: { name: string; description?: string; rules?: string[] }) =>
  friendsRequest<{ community: ForumCommunity; status: 'pending' }>('/forum/communities', {
    method: 'POST',
    body: input,
    fallback: "Couldn't send the request. Please try again.",
  });

export const updateCommunity = async (
  id: string,
  patch: Partial<Pick<ForumCommunity, 'name' | 'description' | 'rules' | 'allowAnonymous' | 'allowedTypes'>>
): Promise<ForumCommunity> =>
  (
    await friendsRequest<{ community: ForumCommunity }>(`/forum/communities/${enc(id)}`, {
      method: 'PUT',
      body: patch,
      fallback: "Couldn't save the community.",
    })
  ).community;

export const joinCommunity = (id: string) =>
  friendsRequest<{ isMember: true; duplicate: boolean; memberCount: number }>(`/forum/communities/${enc(id)}/join`, { method: 'POST' });

export const leaveCommunity = (id: string) =>
  friendsRequest<{ isMember: false; removed: boolean; memberCount: number }>(`/forum/communities/${enc(id)}/leave`, { method: 'POST' });

// ── Posts ─────────────────────────────────────────────────────────────────────
export const fetchCommunityPosts = (
  communityId: string,
  opts: { sort?: ForumSort; t?: ForumTopWindow; type?: ForumPostType | null; q?: string; cursor?: string | null; limit?: number } = {}
) =>
  friendsRequest<{ sort: ForumSort; pinned: ForumPost[]; items: ForumPost[]; nextCursor: string | null }>(
    `/forum/communities/${enc(communityId)}/posts`,
    {
      query: { sort: opts.sort || 'hot', t: opts.sort === 'top' ? opts.t : undefined, type: opts.type || undefined, q: opts.q, cursor: opts.cursor, limit: opts.limit },
      fallback: "Couldn't load posts.",
    }
  );

export const createForumPost = (communityId: string, input: CreatePostInput) =>
  friendsRequest<{ post: ForumPost; duplicate: boolean; underReview?: boolean }>(`/forum/communities/${enc(communityId)}/posts`, {
    method: 'POST',
    body: { ...input, clientId: input.clientId || newClientId() },
    fallback: "Couldn't publish your post. Please try again.",
  });

export const fetchForumPost = async (id: string): Promise<ForumPost> =>
  (await friendsRequest<{ post: ForumPost }>(`/forum/posts/${enc(id)}`, { fallback: "Couldn't load this post." })).post;

export const updateForumPost = (id: string, patch: { title?: string; body?: string; links?: string[]; mediaIds?: string[] }) =>
  friendsRequest<{ post: ForumPost; underReview: boolean }>(`/forum/posts/${enc(id)}`, {
    method: 'PATCH',
    body: patch,
    fallback: "Couldn't save your changes.",
  });

export const deleteForumPost = (id: string) => friendsRequest<{ deleted: true }>(`/forum/posts/${enc(id)}`, { method: 'DELETE' });

export const bookmarkForumPost = (id: string, on: boolean) =>
  friendsRequest<{ bookmarked: boolean }>(`/forum/posts/${enc(id)}/bookmark`, { method: on ? 'POST' : 'DELETE' });

export const fetchForumBookmarks = (cursor?: string | null) =>
  friendsRequest<Page<ForumPost>>('/forum/bookmarks', { query: { cursor }, fallback: "Couldn't load your saved posts." });

export const fetchMyForumPosts = (cursor?: string | null) =>
  friendsRequest<Page<ForumPost>>('/forum/mine', { query: { cursor }, fallback: "Couldn't load your posts." });

export const searchForum = (q: string, opts: { communityId?: string | null; type?: ForumPostType | null; cursor?: string | null } = {}) =>
  friendsRequest<Page<ForumPost>>('/forum/search', {
    query: { q, communityId: opts.communityId || undefined, type: opts.type || undefined, cursor: opts.cursor },
    fallback: "Couldn't search right now.",
  });

// ── Comments ──────────────────────────────────────────────────────────────────
export const fetchForumComments = (postId: string, opts: { sort?: ForumCommentSort; cursor?: string | null } = {}) =>
  friendsRequest<{ sort: ForumCommentSort; bestCommentId: string | null; items: ForumComment[]; replies: ForumComment[]; nextCursor: string | null }>(
    `/forum/posts/${enc(postId)}/comments`,
    { query: { sort: opts.sort || 'best', cursor: opts.cursor }, fallback: "Couldn't load comments." }
  );

export const createForumComment = (postId: string, input: { body: string; parentId?: string | null; anonymous?: boolean; clientId?: string }) =>
  friendsRequest<{ comment: ForumComment; duplicate: boolean; underReview?: boolean }>(`/forum/posts/${enc(postId)}/comments`, {
    method: 'POST',
    body: { ...input, parentId: input.parentId || undefined, clientId: input.clientId || newClientId() },
    fallback: "Couldn't post your comment. Please try again.",
  });

export const updateForumComment = (id: string, body: string) =>
  friendsRequest<{ comment: ForumComment; underReview: boolean }>(`/forum/comments/${enc(id)}`, {
    method: 'PATCH',
    body: { body },
    fallback: "Couldn't save your comment.",
  });

export const deleteForumComment = (id: string) => friendsRequest<{ deleted: true }>(`/forum/comments/${enc(id)}`, { method: 'DELETE' });

// ── Votes and best answer ─────────────────────────────────────────────────────
export const voteForum = (targetType: 'forum_post' | 'forum_comment', targetId: string, value: -1 | 0 | 1) =>
  friendsRequest<{ targetType: string; targetId: string; up: number; down: number; score: number; myVote: -1 | 0 | 1 }>('/forum/vote', {
    method: 'PUT',
    body: { targetType, targetId, value },
    fallback: "Couldn't save your vote.",
  });

export const setBestAnswer = (postId: string, commentId: string) =>
  friendsRequest<{ bestCommentId: string; duplicate: boolean }>(`/forum/posts/${enc(postId)}/best-answer`, { method: 'POST', body: { commentId } });

export const clearBestAnswer = (postId: string) =>
  friendsRequest<{ bestCommentId: null }>(`/forum/posts/${enc(postId)}/best-answer`, { method: 'DELETE' });

// ── Reviews ───────────────────────────────────────────────────────────────────
export const fetchReviewTargets = (opts: { kind?: ReviewKind | null; q?: string; cursor?: string | null } = {}) =>
  friendsRequest<Page<ReviewTarget>>('/forum/review-targets', {
    query: { kind: opts.kind || undefined, q: opts.q, cursor: opts.cursor },
    fallback: "Couldn't load review pages.",
  });

export const requestReviewTarget = (input: { kind: ReviewKind; name: string; meta?: { department?: string; code?: string; block?: string } }) =>
  friendsRequest<{ target: ReviewTarget; status: string; duplicate: boolean }>('/forum/review-targets', {
    method: 'POST',
    body: input,
    fallback: "Couldn't send the request.",
  });

export const fetchReviewTarget = (id: string, cursor?: string | null) =>
  friendsRequest<{ target: ReviewTarget; items: ForumPost[]; nextCursor: string | null; myReview: { id: string; status: ReviewStatus } | null }>(
    `/forum/review-targets/${enc(id)}`,
    { query: { cursor }, fallback: "Couldn't load reviews." }
  );

export const updateReview = (
  id: string,
  patch: { rating?: number; pros?: string; cons?: string; periodLabel?: string; context?: ReviewContext; title?: string; body?: string }
) =>
  friendsRequest<{ post: ForumPost; underReview: boolean }>(`/forum/reviews/${enc(id)}`, {
    method: 'PATCH',
    body: patch,
    fallback: "Couldn't save your review.",
  });

export const deleteReview = (id: string) => friendsRequest<{ deleted: true }>(`/forum/reviews/${enc(id)}`, { method: 'DELETE' });

export const respondToReview = (reviewId: string, body: string, edit = false) =>
  friendsRequest<{ response: ForumReviewResponse }>(`/forum/reviews/${enc(reviewId)}/response`, {
    method: edit ? 'PATCH' : 'POST',
    body: { body },
    fallback: "Couldn't post your reply.",
  });

export const deleteReviewResponse = (reviewId: string) =>
  friendsRequest<{ deleted: true }>(`/forum/reviews/${enc(reviewId)}/response`, { method: 'DELETE' });

// ── Community moderators ──────────────────────────────────────────────────────
export const modPost = (postId: string, action: ForumPostModAction, reason?: string) =>
  friendsRequest<any>(`/forum/mod/posts/${enc(postId)}/${action}`, { method: 'POST', body: { reason: reason || undefined } });

export const modComment = (commentId: string, action: ForumCommentModAction, reason?: string) =>
  friendsRequest<any>(`/forum/mod/comments/${enc(commentId)}/${action}`, { method: 'POST', body: { reason: reason || undefined } });

export const fetchModReports = async (communityId?: string | null): Promise<ForumModReport[]> => {
  const json = await friendsRequest<{ items: ForumModReport[] }>('/forum/mod/reports', {
    query: { communityId: communityId || undefined },
    fallback: "Couldn't load reports.",
  });
  return Array.isArray(json?.items) ? json.items : [];
};

export const dismissModReport = (reportId: string, reason?: string) =>
  friendsRequest<{ ok: true; reportsClosed: number }>(`/forum/mod/reports/${enc(reportId)}/dismiss`, {
    method: 'POST',
    body: { reason: reason || undefined },
  });

export const fetchModLog = (communityId: string, cursor?: string | null) =>
  friendsRequest<Page<ForumModLogItem>>(`/forum/communities/${enc(communityId)}/modlog`, { query: { cursor }, fallback: "Couldn't load the mod log." });
