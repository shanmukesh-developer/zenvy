import React from 'react';
import { FriendsEmpty } from '../shared/FriendsEmpty';
import { SUB_TAB_META } from '../shared/SubTabBar';
import { FriendsColors } from '../friendsTheme';

export interface ConnectHomeProps {
  /** Item id from a deep link (/friends?tab=friends&sub=connect&id=...). */
  focusId?: string | null;
  /** Open a campus chat (task / match chats reuse ChatDetailScreen). */
  onOpenChat?: (chatId: string, name: string) => void;
}

/**
 * Friends > Connect entry (Phase 0 stub). Only mounted when the server reports the `connect` feature
 * on, which needs the phase to have shipped, so students never see this placeholder.
 */
export const ConnectHome: React.FC<ConnectHomeProps> = () => {
  const Icon = SUB_TAB_META.connect.icon;
  return (
    <FriendsEmpty
      icon={<Icon size={22} color={FriendsColors.accent} />}
      title="Connect is coming soon"
      subtitle="Meet verified students from your campus. 18+ only, opt-in."
    />
  );
};
