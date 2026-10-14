import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CampusColors } from '../constants/campusTheme';
import { LegacyFeedSegment, LegacyPulse } from '../modules/campus/friends/pulse/LegacyPulse';

/**
 * Community home (the Home 💬 button): Posts (48-hour stories, reviews, celebrations/birthdays),
 * The Wall (event photo contest) and Whispers & 9 PM. Whispers, the 9 PM question and Branch Wars
 * open inside Campus Buddy, which also holds Friends (Pulse, Forum, Tasks, Connect, Spaces).
 */
export default function CommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<LegacyFeedSegment>('posts');
  const openInBuddy = (screen: 'whispers' | 'nightQuestion' | 'branchWars') =>
    router.push({ pathname: '/friends', params: { screen } } as any);

  return (
    <View style={{ flex: 1, backgroundColor: CampusColors.paper, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 }}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as any))}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={{ fontSize: 22, color: CampusColors.ink }}>←</Text>
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: CampusColors.ink }}>Community</Text>
        <TouchableOpacity
          onPress={() => router.push('/friends' as any)}
          accessibilityRole="button"
          accessibilityLabel="Open Friends in Campus Buddy"
          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: CampusColors.ink }}
        >
          <Text style={{ color: CampusColors.paper, fontWeight: '800', fontSize: 12 }}>👥 Friends</Text>
        </TouchableOpacity>
      </View>
      <LegacyPulse
        profile={null}
        user={null}
        segment={segment}
        onChangeSegment={setSegment}
        onOpenWhispers={() => openInBuddy('whispers')}
        onOpenNightQuestion={() => openInBuddy('nightQuestion')}
        onOpenBranchWars={() => openInBuddy('branchWars')}
      />
    </View>
  );
}
