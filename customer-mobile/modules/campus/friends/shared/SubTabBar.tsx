import React from 'react';
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Sparkles, Mic, MessagesSquare, ClipboardList, Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { FriendsSubTab } from '../../../../types/campus';
import { FriendsColors, FS, fui } from '../friendsTheme';

export const SUB_TAB_META: Record<FriendsSubTab, { label: string; icon: typeof Sparkles; description: string }> = {
  pulse: { label: 'Pulse', icon: Sparkles, description: "What's happening on campus" },
  spaces: { label: 'Spaces', icon: Mic, description: 'Live audio rooms' },
  forum: { label: 'Forum', icon: MessagesSquare, description: 'Questions, guides and reviews' },
  tasks: { label: 'Tasks', icon: ClipboardList, description: 'Help each other out' },
  connect: { label: 'Connect', icon: Heart, description: 'Meet people (18+)' },
};

/** Scrollable segmented control listing only the sub-tabs the server says are on. */
export const SubTabBar: React.FC<{
  tabs: FriendsSubTab[];
  value: FriendsSubTab;
  onChange: (t: FriendsSubTab) => void;
  badges?: Partial<Record<FriendsSubTab, number>>;
}> = ({ tabs, value, onChange, badges }) => (
  <View style={styles.wrap}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="tablist">
      {tabs.map((t) => {
        const meta = SUB_TAB_META[t];
        const active = t === value;
        const Icon = meta.icon;
        const badge = badges?.[t] || 0;
        return (
          <TouchableOpacity
            key={t}
            style={[fui.pill, { minHeight: 40 }, active && fui.pillActive]}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync().catch(() => {});
              onChange(t);
            }}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${meta.label}. ${meta.description}${badge ? `. ${badge} new` : ''}`}
          >
            <Icon size={15} color={active ? FriendsColors.accentInk : FriendsColors.muted} strokeWidth={2.2} />
            <Text style={[fui.pillText, active && fui.pillTextActive]}>{meta.label}</Text>
            {badge > 0 ? (
              <View style={[styles.badge, active && { backgroundColor: FriendsColors.accentInk }]}>
                <Text style={[styles.badgeText, active && { color: FriendsColors.accent }]}>{badge > 99 ? '99+' : badge}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: 1, borderBottomColor: FriendsColors.line, backgroundColor: FriendsColors.bg },
  row: { paddingHorizontal: FS.lg, paddingVertical: FS.sm, gap: FS.sm },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: FriendsColors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { fontSize: 10, fontWeight: '800', color: FriendsColors.accentInk },
});
