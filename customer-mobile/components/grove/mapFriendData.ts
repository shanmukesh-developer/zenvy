/**
 * mapFriendData.ts — maps backend friend records to the grove's Friend type.
 *
 * Backend shape (from friendController / friendsList endpoint):
 *   { friendshipId, friendId, name, nickname, phone, profileImage,
 *     streakCount, lastInteractionAt, statusText, statusEmoji,
 *     statusBgIndex, statusSeenBy, theme, conversationId }
 *
 * Grove shape:
 *   { id, name, avatarUrl?, streak, daysSinceContact, unread?,
 *     mutuals?, stories? }
 */
import type { Friend, Story } from './friendTree';

/** Raw backend friend record */
export interface BackendFriend {
  friendshipId: string;
  friendId: string;
  name: string;
  originalName?: string;
  nickname?: string;
  phone?: string;
  profileImage?: string | null;
  streakCount: number;
  lastInteractionAt?: string;
  statusText?: string;
  statusEmoji?: string;
  statusBgIndex?: number;
  statusSeenBy?: string[];
  theme?: string;
  conversationId?: string;
  unread?: number;
  mutuals?: string[];
}

/**
 * Compute daysSinceContact from ISO date string.
 * Returns 0 if the interaction was today.
 */
function daysSince(isoDate?: string): number {
  if (!isoDate) return 30; // no record → treat as dormant
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

/**
 * Convert a status update into a grove "story" (renders as fruit on the branch).
 * Since the backend doesn't have a dedicated stories system yet,
 * we synthesise one story from statusText + statusEmoji if present.
 */
function statusToStory(
  bf: BackendFriend,
  myUserId: string,
): Story[] {
  if (!bf.statusText) return [];
  const seen = (bf.statusSeenBy ?? []).includes(myUserId);
  // Use a deterministic hue based on the bg index
  const hues = [24, 210, 190, 45, 300, 140, 0];
  const hue = hues[(bf.statusBgIndex ?? 0) % hues.length];
  return [
    {
      id: `status-${bf.friendshipId}`,
      postedAt: bf.lastInteractionAt
        ? new Date(bf.lastInteractionAt).getTime()
        : Date.now() - 3_600_000,
      seen,
      caption: `${bf.statusEmoji ?? ''} ${bf.statusText}`.trim(),
      hue,
    },
  ];
}

/**
 * Map one backend friend → grove Friend.
 * `myUserId` is needed to check if we've already seen their status.
 */
export function mapOneFriend(bf: BackendFriend, myUserId: string): Friend {
  return {
    id: bf.friendId,
    name: bf.nickname || bf.name,
    avatarUrl: bf.profileImage ?? undefined,
    streak: bf.streakCount ?? 0,
    daysSinceContact: daysSince(bf.lastInteractionAt),
    unread: bf.unread ?? 0,
    mutuals: bf.mutuals ?? [],
    stories: statusToStory(bf, myUserId),
  };
}

/**
 * Map an entire friends list.
 * Cap at `maxTree` for the canopy (default 9); return the rest separately.
 */
export function mapFriends(
  list: BackendFriend[],
  myUserId: string,
  maxTree = 9,
): { treeFriends: Friend[]; overflow: BackendFriend[] } {
  const mapped = list.map(bf => mapOneFriend(bf, myUserId));
  return {
    treeFriends: mapped.slice(0, maxTree),
    overflow: list.slice(maxTree),
  };
}
