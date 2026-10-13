/**
 * Zenvy Friends — safety endpoints for students: reports, appeals and "decisions about me".
 * These stay open to unverified and restricted accounts, so anyone can report and appeal.
 * (Admin moderation lives in the admin dashboard; scoped community moderator tools arrive with Forum.)
 */
import { friendsRequest } from './core';

export type ReportTargetType =
  | 'post'
  | 'reply'
  | 'forum_post'
  | 'forum_comment'
  | 'review'
  | 'review_response'
  | 'profile'
  | 'message'
  | 'task'
  | 'task_application'
  | 'space'
  | 'connect_profile'
  | 'connect_photo'
  | 'community';

export type ReportCategory =
  | 'spam'
  | 'impersonation'
  | 'harassment'
  | 'threat'
  | 'privacy'
  | 'sexual'
  | 'hate'
  | 'academic_integrity'
  | 'defamation'
  | 'self_harm'
  | 'other';

/** Shown in this order in the report sheet. */
export const REPORT_CATEGORIES: { key: ReportCategory; label: string; hint: string }[] = [
  { key: 'harassment', label: 'Harassment or bullying', hint: 'Targeting, insulting or ganging up on someone' },
  { key: 'threat', label: 'Threat or violence', hint: 'Threatening to hurt someone' },
  { key: 'self_harm', label: 'Self-harm or suicide', hint: 'Someone may be at risk' },
  { key: 'privacy', label: 'Private information', hint: 'Phone, room number, photos or chats shared without consent' },
  { key: 'sexual', label: 'Sexual content', hint: 'Unwanted or explicit sexual content' },
  { key: 'hate', label: 'Hate speech', hint: 'Attacks on caste, religion, gender, region and similar' },
  { key: 'impersonation', label: 'Impersonation', hint: 'Pretending to be someone else or an official account' },
  { key: 'academic_integrity', label: 'Academic dishonesty', hint: 'Exam-taking, proxy attendance, selling graded work' },
  { key: 'defamation', label: 'False accusation', hint: 'Unsupported allegations about a real person' },
  { key: 'spam', label: 'Spam or scam', hint: 'Ads, repeated posts, suspicious links' },
  { key: 'other', label: 'Something else', hint: 'Tell us what is wrong' },
];

export const REPORT_NOTE_MAX = 500;
export const APPEAL_TEXT_MIN = 10;
export const APPEAL_TEXT_MAX = 1000;

export interface ReportResult {
  reportId: string;
  status: 'received';
  duplicate?: boolean;
}

export const fileReport = (input: { targetType: ReportTargetType; targetId: string; category: ReportCategory; note?: string }) =>
  friendsRequest<ReportResult>('/friends/reports', {
    method: 'POST',
    body: { ...input, note: input.note ? input.note.slice(0, REPORT_NOTE_MAX) : undefined },
    fallback: "Couldn't send the report. Please try again.",
  });

export interface MyReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  category: ReportCategory;
  status: 'received' | 'in_review' | 'closed';
  outcome: 'action_taken' | 'no_action' | null;
  createdAt: string;
  resolvedAt: string | null;
}

export const fetchMyReports = (cursor?: string | null) =>
  friendsRequest<{ items: MyReport[]; nextCursor: string | null }>('/friends/reports/mine', {
    query: { cursor },
    fallback: "Couldn't load your reports.",
  });

export interface MyAppeal {
  id: string;
  actionId: string;
  text: string;
  status: string;
  note: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export const fileAppeal = (actionId: string, text: string) =>
  friendsRequest<{ appealId: string; status: 'open' }>('/friends/appeals', {
    method: 'POST',
    body: { actionId, text: text.slice(0, APPEAL_TEXT_MAX) },
    fallback: "Couldn't send your appeal. Please try again.",
  });

export const fetchMyAppeals = async (): Promise<MyAppeal[]> => {
  const json = await friendsRequest<{ items?: MyAppeal[] }>('/friends/appeals/mine', { fallback: "Couldn't load your appeals." });
  return Array.isArray(json?.items) ? json.items : [];
};

export interface MyModerationAction {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  createdAt: string;
  appealable: boolean;
  appeal: { id: string; status: string } | null;
}

export interface MyModeration {
  sanctions: { id: string; scope: string; until: string | null }[];
  actions: MyModerationAction[];
}

export const fetchMyModeration = async (): Promise<MyModeration> => {
  const json = await friendsRequest<Partial<MyModeration>>('/friends/moderation/mine', { fallback: "Couldn't load your account status." });
  return {
    sanctions: Array.isArray(json?.sanctions) ? json.sanctions : [],
    actions: Array.isArray(json?.actions) ? json.actions : [],
  };
};

/** Plain-language label for a moderation action shown to the affected student. */
export const moderationActionLabel = (action: string): string => {
  switch (action) {
    case 'remove':
      return 'Content removed';
    case 'hide':
    case 'hide_pending':
      return 'Content hidden for review';
    case 'warn':
      return 'Warning';
    case 'sanction':
      return 'Restriction';
    case 'reject':
      return 'Submission rejected';
    case 'restore':
      return 'Content restored';
    case 'lift_sanction':
      return 'Restriction lifted';
    case 'appeal_upheld':
      return 'Appeal reviewed: decision kept';
    case 'appeal_reversed':
      return 'Appeal accepted: decision reversed';
    default:
      return 'Moderation decision';
  }
};

export const sanctionScopeLabel = (scope: string) =>
  scope === 'friends' ? 'all of Friends' : scope.charAt(0).toUpperCase() + scope.slice(1);
