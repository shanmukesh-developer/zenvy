import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { color, space, type } from '../../theme/tokens';
import { BOTTOM_INSET } from './insets';
import type { Tab } from '../../state/RiderProvider';

const TABS: { key: Tab; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { key: 'home', label: 'Home', icon: 'moped' },
  { key: 'orders', label: 'Orders', icon: 'clipboard-text-clock-outline' },
  { key: 'earnings', label: 'Earnings', icon: 'wallet-outline' },
  { key: 'profile', label: 'Profile', icon: 'account-circle-outline' },
];

export function BottomTabBar({ tab, onChange, homeBadge }: { tab: Tab; onChange: (t: Tab) => void; homeBadge?: number }) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {TABS.map((t) => {
        const on = t.key === tab;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
            onPress={() => onChange(t.key)}
            style={styles.tab}
          >
            <View>
              <MaterialCommunityIcons name={t.icon} size={28} color={on ? color.text : color.textMuted} />
              {t.key === 'home' && homeBadge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{homeBadge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[type.label, { color: on ? color.text : color.textMuted, fontWeight: on ? '800' : '600' }]}>{t.label}</Text>
            {on ? <View style={styles.indicator} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.border,
    paddingBottom: BOTTOM_INSET,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: space.xs, minHeight: 64, gap: 2 },
  indicator: { position: 'absolute', top: 0, width: 36, height: 3, borderRadius: 2, backgroundColor: color.text },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: color.online,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: color.textInverse, fontSize: 12, fontWeight: '800' },
});
