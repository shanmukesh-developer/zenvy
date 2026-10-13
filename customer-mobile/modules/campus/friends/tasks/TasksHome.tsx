import React from 'react';
import { FriendsEmpty } from '../shared/FriendsEmpty';
import { SUB_TAB_META } from '../shared/SubTabBar';
import { FriendsColors } from '../friendsTheme';

export interface TasksHomeProps {
  /** Item id from a deep link (/friends?tab=friends&sub=tasks&id=...). */
  focusId?: string | null;
  /** Open a campus chat (task / match chats reuse ChatDetailScreen). */
  onOpenChat?: (chatId: string, name: string) => void;
}

/**
 * Friends > Tasks entry (Phase 0 stub). Only mounted when the server reports the `tasks` feature
 * on, which needs the phase to have shipped, so students never see this placeholder.
 */
export const TasksHome: React.FC<TasksHomeProps> = () => {
  const Icon = SUB_TAB_META.tasks.icon;
  return (
    <FriendsEmpty
      icon={<Icon size={22} color={FriendsColors.accent} />}
      title="Tasks is coming soon"
      subtitle="Ask for help or lend a hand: notes, errands, tutoring and more."
    />
  );
};
