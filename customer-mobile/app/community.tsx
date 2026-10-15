import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Users } from '../components/lucide';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CampusColors } from '../constants/campusTheme';
import { FriendsColors } from '../modules/campus/friends/friendsTheme';
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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as any))}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.back}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color={CampusColors.ink} strokeWidth={2.2} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
            Community
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Stories, The Wall and campus moments
          </Text>
        </View>
        {/* Doorway to Friends: styled in the Friends night palette so the light → dark switch is expected. */}
        <TouchableOpacity
          onPress={() => router.push('/friends' as any)}
          accessibilityRole="button"
          accessibilityLabel="Open Friends in Campus Buddy"
          activeOpacity={0.85}
          style={styles.friendsBtn}
        >
          <LinearGradient colors={['#221D33', '#0C0B10']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View>
            <Users size={15} color={FriendsColors.accent} strokeWidth={2.4} />
          </View>
          <Text style={styles.friendsText}>Friends</Text>
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

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
    paddingRight: 16,
    paddingVertical: 6,
    minHeight: 60,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: CampusColors.line,
  },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: CampusColors.ink, letterSpacing: -0.4 },
  subtitle: { fontSize: 12, color: CampusColors.muted, marginTop: 1 },
  friendsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(200,182,255,0.35)',
  },
  friendsText: { color: FriendsColors.ink, fontWeight: '800', fontSize: 13, letterSpacing: 0.1 },
});
