import React from 'react';
import { FriendsEmpty } from '../shared/FriendsEmpty';
import { SUB_TAB_META } from '../shared/SubTabBar';
import { FriendsColors } from '../friendsTheme';

export interface ForumHomeProps {
  /** Item id from a deep link (/friends?tab=friends&sub=forum&id=...). */
  focusId?: string | null;
  /** Open a campus chat (task / match chats reuse ChatDetailScreen). */
  onOpenChat?: (chatId: string, name: string) => void;
}

/**
 * Friends > Forum entry (Phase 0 stub). Only mounted when the server reports the `forum` feature
 * on, which needs the phase to have shipped, so students never see this placeholder.
 */
export const ForumHome: React.FC<ForumHomeProps> = () => {
  const Icon = SUB_TAB_META.forum.icon;
  return (
    <FriendsEmpty
      icon={<Icon size={22} color={FriendsColors.accent} />}
      title="Forum is coming soon"
      subtitle="Questions, freshers guides and honest reviews from your campus."
    />
  );
};
