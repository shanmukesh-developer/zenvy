export type CampusVerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type CampusRole = 'student' | 'cr' | 'faculty' | 'club_admin' | 'moderator' | 'campus_admin';

export interface CampusItem {
  id: string;
  name: string;
  code: string;
  emailDomains: string[];
  city: string;
  isActive: boolean;
  settings?: {
    branches?: string[];
    hostelBlocks?: string[];
  };
}

export interface CampusProfileData {
  id: string;
  userId: string;
  campusId?: string;
  collegeId?: string;
  branch: string;
  year: number;
  section: string;
  hostelBlock?: string;
  roomNumber?: string;
  dob?: string;
  isAdult: boolean;
  verificationStatus: CampusVerificationStatus;
  collegeEmail?: string;
  idCardImageUrl?: string;
  verifiedAt?: string;
  roles: CampusRole[];
  bio?: string;
  interests: string[];
  buddyPoints: number;
  campus?: CampusItem;
  /** True when an ID-card photo is on file (the image itself is only sent as a signed link). */
  hasIdCard?: boolean;
}

export interface CampusUserData {
  id: string;
  name: string;
  phone: string;
  profileImage?: string;
  statusEmoji?: string;
  statusText?: string;
  friendCode?: string | null;
}

export type CampusTab = 'chats' | 'friends' | 'campus' | 'me';

/** Zenvy Friends sub-tabs, in display order. */
export type FriendsSubTab = 'pulse' | 'spaces' | 'forum' | 'tasks' | 'connect';
export const FRIENDS_SUB_TABS: readonly FriendsSubTab[] = ['pulse', 'spaces', 'forum', 'tasks', 'connect'];

/** Chat link to what created it (GET /api/campus/chats). null/absent = ordinary chat. */
export type CampusChatRefType = 'task' | 'connect';

export type CampusChatType = 'dm' | 'class' | 'club' | 'study' | 'ride' | 'secret';

export type CampusDeliveryStatus = 'clock' | 'sent' | 'delivered' | 'read';

// One row of GET /api/campus/chats
export interface CampusChatListItem {
  id: string;
  name: string;
  type: CampusChatType;
  isGroup: boolean;
  avatarUrl?: string | null;
  lastMessage: string;
  lastSenderId?: string | null;
  lastSender?: string | null;
  lastMessageAt?: string | Date | null;
  unreadCount: number;
  peerId?: string | null;
  /** Set when the chat belongs to a Friends task or a Connect match. */
  refType?: CampusChatRefType | null;
  refId?: string | null;
  /** Closed chats keep their history but refuse new messages and calls (CHAT_CLOSED). */
  closedAt?: string | null;
}

export interface CampusChatListResponse {
  chats: CampusChatListItem[];
}

// One message from GET /api/campus/chats/:id/messages
export interface CampusServerMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  type?: 'text' | 'image' | 'video' | 'audio' | 'doc' | 'poll' | 'system';
  mediaUrl?: string;
  replyTo?: { id: string; senderName: string; text: string };
  reactions?: Record<string, string>;
  isEdited?: boolean;
  isDeletedForEveryone?: boolean;
  deliveryStatus?: CampusDeliveryStatus;
  createdAt: string | Date;
}

export interface CampusChatMessagesResponse {
  messages: CampusServerMessage[];
  nextCursor: string | Date | null;
  hasMore: boolean;
}
