import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { color, radius, space, type } from '../../theme/tokens';
import { PulseDot } from '../ui/Basics';
import { rupees } from '../../services/format';
import type { TodayStats } from '../../types';

export function DutyToggle({ online, busy, onPress }: { online: boolean; busy: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: online, busy }}
      accessibilityLabel={online ? "You're online. Tap to go offline" : "You're offline. Tap to go online"}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, { backgroundColor: online ? color.online : color.offline }, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.knobWrap}>
        {busy ? (
          <ActivityIndicator color={color.textInverse} />
        ) : online ? (
          <PulseDot />
        ) : (
          <MaterialCommunityIcons name="power" size={26} color={color.textInverse} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.title3, { color: color.textInverse }]}>{online ? "You're online" : "You're offline"}</Text>
        <Text style={[type.bodySm, { color: color.textInverse, opacity: 0.9 }]}>
          {busy ? 'Updating…' : online ? 'Looking for orders · Tap to go offline' : 'Tap to go online'}
        </Text>
      </View>
      <View style={[styles.switch, online && { alignItems: 'flex-end', backgroundColor: color.onlineDark }]}>
        <View style={styles.switchKnob} />
      </View>
    </Pressable>
  );
}

export function TodayStrip({
  stats,
  rating,
  onPress,
}: {
  stats: TodayStats | null;
  rating: number | null;
  onPress: () => void;
}) {
  const tiles = [
    { label: 'Today', value: stats ? rupees(stats.earnings) : '—' },
    { label: 'Orders', value: stats ? String(stats.orders) : '—' },
    { label: 'Rating', value: rating !== null ? rating.toFixed(1) : 'New' },
  ];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Open earnings" onPress={onPress} style={styles.strip}>
      {tiles.map((t, i) => (
        <View key={t.label} style={[styles.tile, i > 0 && { borderLeftWidth: 1, borderLeftColor: color.border }]}>
          <Text style={[type.title2, { color: color.text }]}>{t.value}</Text>
          <Text style={[type.label, { color: color.textMuted }]}>{t.label}</Text>
        </View>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 72,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    gap: space.sm,
  },
  knobWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  switch: { width: 56, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.25)', padding: 3, alignItems: 'flex-start', justifyContent: 'center' },
  switchKnob: { width: 26, height: 26, borderRadius: 13, backgroundColor: color.surface },
  strip: { flexDirection: 'row', backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border },
  tile: { flex: 1, alignItems: 'center', paddingVertical: space.sm, gap: 2 },
});
