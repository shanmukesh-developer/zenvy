import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
} from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

export type RiderTab = 'active' | 'available' | 'leaderboard' | 'profile';

interface SegmentedNavProps {
  activeTab: RiderTab;
  onChangeTab: (tab: RiderTab) => void;
  activeCount: number;
  availableCount: number;
}

export const SegmentedNav: React.FC<SegmentedNavProps> = ({
  activeTab,
  onChangeTab,
  activeCount,
  availableCount,
}) => {
  const handlePress = (tab: RiderTab) => {
    Vibration.vibrate(25);
    onChangeTab(tab);
  };

  return (
    <View style={styles.navContainer}>
      {/* Tab 1: Active Runs */}
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'active' && styles.tabButtonActive]}
        onPress={() => handlePress('active')}
        activeOpacity={0.8}
      >
        <Text
          style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}
        >
          ACTIVE
        </Text>
        {activeCount > 0 && (
          <View
            style={[
              styles.badgeChip,
              activeTab === 'active'
                ? styles.badgeChipActive
                : styles.badgeChipInactive,
            ]}
          >
            <Text style={styles.badgeText}>{activeCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Tab 2: Dispatch Radar */}
      <TouchableOpacity
        style={[
          styles.tabButton,
          activeTab === 'available' && styles.tabButtonActive,
        ]}
        onPress={() => handlePress('available')}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'available' && styles.tabTextActive,
          ]}
        >
          RADAR
        </Text>
        {availableCount > 0 && (
          <View
            style={[
              styles.badgeChip,
              activeTab === 'available'
                ? styles.badgeChipGold
                : styles.badgeChipInactive,
            ]}
          >
            <Text style={styles.badgeText}>{availableCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Tab 3: Leaderboard */}
      <TouchableOpacity
        style={[
          styles.tabButton,
          activeTab === 'leaderboard' && styles.tabButtonActive,
        ]}
        onPress={() => handlePress('leaderboard')}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'leaderboard' && styles.tabTextActive,
          ]}
        >
          RANKS
        </Text>
      </TouchableOpacity>

      {/* Tab 4: Profile */}
      <TouchableOpacity
        style={[
          styles.tabButton,
          activeTab === 'profile' && styles.tabButtonActive,
        ]}
        onPress={() => handlePress('profile')}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'profile' && styles.tabTextActive,
          ]}
        >
          FLEET ID
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  navContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F1118',
    borderRadius: RADIUS.pill,
    padding: 4,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    gap: 5,
  },
  tabButtonActive: {
    backgroundColor: COLORS.bgCardElevated,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 122, 0.35)',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  badgeChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.pill,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeChipActive: {
    backgroundColor: COLORS.emerald,
  },
  badgeChipGold: {
    backgroundColor: COLORS.gold,
  },
  badgeChipInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
