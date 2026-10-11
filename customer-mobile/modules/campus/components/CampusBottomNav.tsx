import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MessageSquare, Flame, GraduationCap, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CampusColors, CampusLayout } from '../../../constants/campusTheme';
import { CampusTab } from '../../../types/campus';

interface CampusBottomNavProps {
  activeTab: CampusTab;
  onSelectTab: (tab: CampusTab) => void;
  unreadCount?: number;
}

export const CampusBottomNav: React.FC<CampusBottomNavProps> = ({
  activeTab,
  onSelectTab,
  unreadCount = 0,
}) => {
  const tabs: { key: CampusTab; label: string; icon: typeof MessageSquare }[] = [
    { key: 'chats', label: 'Chats', icon: MessageSquare },
    { key: 'pulse', label: 'Pulse', icon: Flame },
    { key: 'study', label: 'Study', icon: GraduationCap },
    { key: 'you', label: 'You', icon: User },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const IconComponent = tab.icon;

        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabButton}
            onPress={() => {
              if (!isActive) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelectTab(tab.key);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${tab.label} tab`}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrapper, isActive && styles.activeIconWrapper]}>
              <IconComponent
                size={22}
                color={isActive ? CampusColors.accent : CampusColors.muted}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              {tab.key === 'chats' && unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: CampusColors.card,
    borderTopWidth: 1,
    borderTopColor: CampusColors.line,
    paddingVertical: 8,
    paddingBottom: 20, // accounts for home bar indicator
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 8,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    minHeight: CampusLayout.touchTargetMin,
  },
  iconWrapper: {
    position: 'relative',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: CampusLayout.radius.pill,
  },
  activeIconWrapper: {
    backgroundColor: CampusColors.accentSoft,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: CampusColors.muted,
    marginTop: 2,
  },
  activeTabLabel: {
    color: CampusColors.accent,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 4,
    backgroundColor: CampusColors.accent,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: CampusColors.card,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
