import type { FriendsSubTab } from '../../types/campus';

/**
 * Where a campus / friends notification should open inside the Campus hub (/friends).
 * Shared by the push tap handler (GlobalAnnouncement) and the in-app inbox (notifications screen),
 * so both always land on the same screen.
 */
export type CampusLink = {
  tab?: 'chats' | 'friends' | 'campus' | 'me';
  /** Friends sub-tab: pulse | spaces | forum | tasks | connect. */
  sub?: FriendsSubTab;
  /** Id of the post / space / task / … the notification is about (handled by each sub-tab). */
  id?: string;
  /** Campus: around | study. Friends > Pulse (campus feed): posts | wall | pulse. */
  segment?: string;
  chatId?: string;
  chatName?: string;
  /** requests | friends | verification | groups | friends_safety */
  screen?: string;
};

const SUBS: readonly string[] = ['pulse', 'spaces', 'forum', 'tasks', 'connect'];
export const isFriendsSub = (v: unknown): v is FriendsSubTab => typeof v === 'string' && SUBS.includes(v);

const qs = (link: CampusLink) => {
  const parts = Object.entries(link)
    .filter(([, v]) => typeof v === 'string' && v)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `/friends?${parts.join('&')}` : '/friends';
};

/** Friends notification types (backend modules/friends/services/notify.js) and their default sub-tab. */
const FRIENDS_TYPE_SUB: Record<string, FriendsSubTab | null> = {
  FRIENDS_REPLY: 'pulse',
  FRIENDS_MENTION: 'pulse',
  FRIENDS_FOLLOW: 'pulse',
  FORUM_ANSWER: 'forum',
  FORUM_BEST_ANSWER: 'forum',
  SPACE_REMINDER: 'spaces',
  SPACE_UPDATED: 'spaces',
  TASK_APPLICATION: 'tasks',
  TASK_SELECTED: 'tasks',
  TASK_ACCEPTED: 'tasks',
  TASK_SUBMITTED: 'tasks',
  TASK_COMPLETED: 'tasks',
  TASK_REVIEW: 'tasks',
  TASK_CANCELLED: 'tasks',
  CONNECT_MATCH: 'connect',
};

/** Returns a /friends?... href for campus-related notification types, or null for anything else. */
export const campusHrefForNotification = (type?: string | null, rawData?: any): string | null => {
  let data: any = rawData;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      data = null;
    }
  }
  data = data && typeof data === 'object' ? data : {};
  const t = String(type || data.type || '');
  const kind = String(data.kind || '');
  const screen = String(data.screen || '');
  const chatId = data.chatId || data.conversationId;
  const id = typeof data.id === 'string' || typeof data.id === 'number' ? String(data.id) : undefined;

  // Moderation outcomes and appeal decisions: the user's own reports / decisions live under Me.
  if (t === 'MOD_OUTCOME' || t === 'APPEAL_DECIDED') return qs({ tab: 'me', screen: 'friends_safety' });
  // Zenvy Friends: { type, screen:'friends', sub, id }
  if (t in FRIENDS_TYPE_SUB || screen === 'friends') {
    const sub = isFriendsSub(data.sub) ? data.sub : FRIENDS_TYPE_SUB[t] || 'pulse';
    return qs({ tab: 'friends', sub, id });
  }

  if (screen === 'campus_verification' || t === 'CAMPUS_VERIFICATION') return qs({ tab: 'me', screen: 'verification' });
  if (screen === 'friend_requests' || t === 'FRIEND_REQUEST') return qs({ tab: 'me', screen: 'requests' });
  if (screen === 'campus_chat' || kind === 'CAMPUS_MESSAGE' || kind === 'CAMPUS_CALL') {
    return chatId ? qs({ tab: 'chats', chatId: String(chatId) }) : qs({ tab: 'chats' });
  }
  if (t === 'FRIEND_ACCEPTED' || t === 'friend_accepted' || t === 'NEW_CHAT_MESSAGE' || t === 'chat_message' || t === 'incoming_call') {
    return chatId ? qs({ tab: 'chats', chatId: String(chatId) }) : qs({ tab: 'chats' });
  }
  if (t === 'FRIEND_NUDGE') return qs({ tab: 'me', screen: 'friends' });
  // The old campus feed (posts, birthdays, The Wall) now lives in Friends > Pulse.
  if (t === 'BIRTHDAY_ALERT') return qs({ tab: 'friends', sub: 'pulse', segment: 'posts' });
  if (t.startsWith('WALL_') && t !== 'WALL_WINNER_REWARD') return qs({ tab: 'friends', sub: 'pulse', segment: 'wall' });
  // Legacy "After Dark" friend calls: that lounge is gone, Campus chats is the closest home.
  if (t === 'call') return qs({ tab: 'chats' });
  return null;
};
