import React from 'react';
import { View, Text } from 'react-native';
import { CampusColors } from '../../../constants/campusTheme';
import { CampusProfileData, CampusUserData } from '../../../types/campus';
import { PulseTab } from './PulseTab';
import { LiveZones } from '../components/LiveZones';
import { T, S } from '../ui';

export type CampusSegment = 'around' | 'study';

interface CampusTabProps {
  profile: CampusProfileData | null;
  user: CampusUserData | null;
  segment: CampusSegment;
  onChangeSegment: (s: CampusSegment) => void;
  onOpenLostFound: () => void;
  onOpenRides: () => void;
  onOpenRoom: (slug: string) => void;
  onOpenStudySync: () => void;
  onOpenAssignment: (id: string) => void;
  onOpenClasswork: () => void;
  studyRefreshKey: number;
}

/** Campus = useful things around campus (today, Lost & Found, Rides, campus spots). */
export const CampusTab: React.FC<CampusTabProps> = ({
  profile,
  user,
  segment,
  onChangeSegment,
  onOpenLostFound,
  onOpenRides,
  onOpenRoom,
  onOpenStudySync,
  onOpenAssignment,
  onOpenClasswork,
  studyRefreshKey,
}) => (
  <View style={{ flex: 1, backgroundColor: CampusColors.paper }}>
    {/* Study mode removed (owner, 14 Oct): Campus is just "Around campus". */}
    <PulseTab
      mode="campus"
      profile={profile}
      user={user}
      onOpenWhispers={() => {}}
      onOpenNightQuestion={() => {}}
      onOpenBranchWars={() => {}}
      onOpenLostFound={onOpenLostFound}
      onOpenRidePool={onOpenRides}
      footer={
        <View style={{ marginTop: S.sm }}>
          <Text style={[T.kicker, { marginBottom: 4 }]}>Campus spots</Text>
          <Text style={[T.small, { marginBottom: S.md }]}>Open chat rooms for the library, mess, gym and more.</Text>
          <LiveZones onOpenRoom={onOpenRoom} />
        </View>
      }
    />
  </View>
);
