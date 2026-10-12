import React from 'react';
import { View } from 'react-native';
import { CampusColors } from '../../../constants/campusTheme';
import { CampusProfileData, CampusUserData } from '../../../types/campus';
import { CommunityFeed } from '../feed/CommunityFeed';
import { PulseTab } from './PulseTab';
import { Segmented, S } from '../ui';

export type FeedSegment = 'posts' | 'wall' | 'pulse';

interface FeedTabProps {
  profile: CampusProfileData | null;
  user: CampusUserData | null;
  segment: FeedSegment;
  onChangeSegment: (s: FeedSegment) => void;
  onOpenWhispers: () => void;
  onOpenNightQuestion: () => void;
  onOpenBranchWars: () => void;
}

/**
 * Feed = everything social on campus in one place:
 * Posts (community posts, reviews, birthdays), The Wall (photo contest), Pulse (Whispers, 9 PM question, Branch Wars).
 */
export const FeedTab: React.FC<FeedTabProps> = ({
  profile,
  user,
  segment,
  onChangeSegment,
  onOpenWhispers,
  onOpenNightQuestion,
  onOpenBranchWars,
}) => (
  <View style={{ flex: 1, backgroundColor: CampusColors.paper }}>
    <Segmented
      style={{ marginHorizontal: S.lg, marginTop: S.md }}
      value={segment}
      onChange={onChangeSegment}
      options={[
        { key: 'posts', label: 'Posts' },
        { key: 'wall', label: 'The Wall' },
        { key: 'pulse', label: 'Whispers & 9 PM' },
      ]}
    />
    {/* One feed instance for Posts + The Wall so drafts and scroll survive switching. */}
    <View style={{ flex: 1, display: segment === 'pulse' ? 'none' : 'flex' }}>
      <CommunityFeed embedded tab={segment === 'wall' ? 'wall' : 'all'} />
    </View>
    {segment === 'pulse' && (
      <PulseTab
        mode="feed"
        profile={profile}
        user={user}
        onOpenWhispers={onOpenWhispers}
        onOpenNightQuestion={onOpenNightQuestion}
        onOpenBranchWars={onOpenBranchWars}
      />
    )}
  </View>
);
