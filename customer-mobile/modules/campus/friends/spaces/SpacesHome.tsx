import React from 'react';
import { FriendsEmpty } from '../shared/FriendsEmpty';
import { SUB_TAB_META } from '../shared/SubTabBar';
import { FriendsColors } from '../friendsTheme';

export interface SpacesHomeProps {
  /** Item id from a deep link (/friends?tab=friends&sub=spaces&id=...). */
  focusId?: string | null;
  /** Open a campus chat (task / match chats reuse ChatDetailScreen). */
  onOpenChat?: (chatId: string, name: string) => void;
}

/**
 * Friends > Spaces entry (Phase 0 stub). Only mounted when the server reports the `spaces` feature
 * on, which needs the phase to have shipped, so students never see this placeholder.
 */
export const SpacesHome: React.FC<SpacesHomeProps> = () => {
  const Icon = SUB_TAB_META.spaces.icon;
  return (
    <FriendsEmpty
      icon={<Icon size={22} color={FriendsColors.accent} />}
      title="Spaces is coming soon"
      subtitle="Live audio rooms hosted by students and clubs. Not recorded."
    />
  );
};
