import React from 'react';
import { View } from 'react-native';
import { CampusColors } from '../../../../constants/campusTheme';
import { CampusProfileData, CampusUserData } from '../../../../types/campus';
import { CommunityFeed } from '../../feed/CommunityFeed';
import { PulseTab } from '../../tabs/PulseTab';
import { Segmented, S } from '../../ui';

/** Old campus feed segments (deep links: ?segment=posts|wall|pulse). */
export type LegacyFeedSegment = 'posts' | 'wall' | 'pulse';

export const isLegacyFeedSegment = (v: unknown): v is LegacyFeedSegment => v === 'posts' || v === 'wall' || v === 'pulse';

export interface LegacyPulseProps {
  profile: CampusProfileData | null;
  user: CampusUserData | null;
  segment: LegacyFeedSegment;
  onChangeSegment: (s: LegacyFeedSegment) => void;
  onOpenWhispers: () => void;
  onOpenNightQuestion: () => void;
  onOpenBranchWars: () => void;
}

/**
 * The campus feed that used to be the Feed tab, kept whole inside Friends > Pulse:
 * Posts (community posts, reviews, birthdays), The Wall (photo contest), and Whispers & 9 PM
 * (9 PM question, Branch Wars, Today). Shown only while the pulse flag is off (pre-launch / older
 * server); with Pulse on, PulseHome is the feed and these live in its Campus Moments strip.
 */
export const LegacyPulse: React.FC<LegacyPulseProps> = ({
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
