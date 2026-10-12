// Order stage tabs (with counts) and the bottom navigation (plain state, no tab library needed).
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, radius, space, touch } from '../theme';
import type { IconName } from '../ui/kit';
import type { OrderStage } from '../types';

export const STAGE_TABS: { key: OrderStage; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'pickedUp', label: 'Picked up' },
  { key: 'past', label: 'Past' },
];

export function StageTabs({ value, onChange, counts }: {
  value: OrderStage; onChange: (s: OrderStage) => void; counts: Record<OrderStage, number>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={styles.tabsBar}>
      {STAGE_TABS.map((t) => {
        const sel = t.key === value;
        const n = counts[t.key];
        const hot = t.key === 'new' && n > 0;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={`${t.label}, ${n} orders`}
            style={[styles.tab, sel && styles.tabSel, hot && !sel && { borderColor: color.alert, borderWidth: 2 }]}
          >
            <Text style={[font.body, { color: sel ? color.textInverse : color.text, fontWeight: '800' }]}>{t.label}</Text>
            {t.key !== 'past' || n > 0 ? (
              <View style={[styles.count, hot ? { backgroundColor: color.alert } : sel ? { backgroundColor: 'rgba(255,255,255,0.25)' } : null]}>
                <Text style={[font.label, { color: hot || sel ? color.textInverse : color.text }]}>{n}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export type MainTab = 'orders' | 'menu' | 'today' | 'settings';
const NAV: { key: MainTab; label: string; icon: IconName; iconSel: IconName }[] = [
  { key: 'orders', label: 'Orders', icon: 'receipt-outline', iconSel: 'receipt' },
  { key: 'menu', label: 'Menu', icon: 'restaurant-outline', iconSel: 'restaurant' },
  { key: 'today', label: 'Today', icon: 'stats-chart-outline', iconSel: 'stats-chart' },
  { key: 'settings', label: 'Settings', icon: 'settings-outline', iconSel: 'settings' },
];

export function BottomNav({ value, onChange, badge }: { value: MainTab; onChange: (t: MainTab) => void; badge?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, space.xs) }]} accessibilityRole="tablist">
      {NAV.map((n) => {
        const sel = n.key === value;
        return (
          <Pressable
            key={n.key}
            onPress={() => onChange(n.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={n.key === 'orders' && badge ? `${n.label}, ${badge} new` : n.label}
            style={styles.navItem}
          >
            <View>
              <Ionicons name={sel ? n.iconSel : n.icon} size={26} color={sel ? color.text : color.textMuted} />
              {n.key === 'orders' && badge ? (
                <View style={styles.navBadge}><Text style={[font.label, { color: color.textInverse, fontSize: 11 }]}>{badge}</Text></View>
              ) : null}
            </View>
            <Text style={[font.label, { color: sel ? color.text : color.textMuted }]}>{n.label}</Text>
            {sel ? <View style={styles.navBar} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabsBar: { flexGrow: 0, backgroundColor: color.bg },
  tabs: { paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.xs },
  tab: {
    minHeight: touch.min, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: color.surface,
    borderWidth: 1, borderColor: color.border, flexDirection: 'row', alignItems: 'center', gap: space.xs,
  },
  tabSel: { backgroundColor: color.text, borderColor: color.text },
  count: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 6, backgroundColor: color.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', backgroundColor: color.surface, borderTopWidth: 1, borderTopColor: color.border, paddingTop: space.xs },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 58, gap: 2 },
  navBar: { position: 'absolute', top: -space.xs, width: 36, height: 3, borderRadius: 2, backgroundColor: color.text },
  navBadge: { position: 'absolute', top: -4, right: -12, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: color.alert, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
});
