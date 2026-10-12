/**
 * Where a campus / friends notification should open inside the Campus hub (/friends).
 * Shared by the push tap handler (GlobalAnnouncement) and the in-app inbox (notifications screen),
 * so both always land on the same screen.
 */
export type CampusLink = {
  tab?: 'chats' | 'feed' | 'campus' | 'me';
  segment?: string;
  chatId?: string;
  chatName?: string;
  /** requests | friends | verification | groups */
  screen?: string;
};

const qs = (link: CampusLink) => {
  const parts = Object.entries(link)
    .filter(([, v]) => typeof v === 'string' && v)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `/friends?${parts.join('&')}` : '/friends';
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

  if (screen === 'campus_verification' || t === 'CAMPUS_VERIFICATION') return qs({ tab: 'me', screen: 'verification' });
  if (screen === 'friend_requests' || t === 'FRIEND_REQUEST') return qs({ tab: 'me', screen: 'requests' });
  if (screen === 'campus_chat' || kind === 'CAMPUS_MESSAGE' || kind === 'CAMPUS_CALL') {
    return chatId ? qs({ tab: 'chats', chatId: String(chatId) }) : qs({ tab: 'chats' });
  }
  if (t === 'FRIEND_ACCEPTED' || t === 'friend_accepted' || t === 'NEW_CHAT_MESSAGE' || t === 'chat_message' || t === 'incoming_call') {
    return chatId ? qs({ tab: 'chats', chatId: String(chatId) }) : qs({ tab: 'chats' });
  }
  if (t === 'FRIEND_NUDGE') return qs({ tab: 'me', screen: 'friends' });
  if (t === 'BIRTHDAY_ALERT') return qs({ tab: 'feed', segment: 'posts' });
  if (t.startsWith('WALL_') && t !== 'WALL_WINNER_REWARD') return qs({ tab: 'feed', segment: 'wall' });
  // Legacy "After Dark" friend calls: that lounge is gone, Campus chats is the closest home.
  if (t === 'call') return qs({ tab: 'chats' });
  return null;
};
