import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { color, radius, space, type } from '../../theme/tokens';
import { Badge } from '../ui/Basics';
import { rupees, shortWeekday, timeIST } from '../../services/format';
import { itemCount } from '../../services/orderModel';
import type { RiderOrder, WeekDay } from '../../types';

export function EarningsHero({ label, amount, sub }: { label: string; amount: number | null; sub?: string | null }) {
  return (
    <View style={styles.hero}>
      <Text style={[type.label, { color: color.textInverse, opacity: 0.85 }]}>{label}</Text>
      <Text style={[type.money, { color: color.textInverse }]}>{rupees(amount)}</Text>
      {sub ? <Text style={[type.body, { color: color.textInverse, opacity: 0.9 }]}>{sub}</Text> : null}
    </View>
  );
}

/** Seven plain bars, each labelled with its ₹ value. */
export function WeekBars({ days }: { days: WeekDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.earnings));
  return (
    <View style={styles.bars} accessibilityLabel="Earnings per day, last 7 days">
      {days.map((d) => (
        <View key={d.date} style={styles.barCol} accessibilityLabel={`${shortWeekday(d.date)} ${rupees(d.earnings)}, ${d.orders} orders`}>
          <Text style={[type.label, { color: color.textSecondary, fontSize: 12 }]} numberOfLines={1}>
            {d.earnings ? rupees(d.earnings) : '—'}
          </Text>
          <View style={styles.barTrack}>
            <View style={[styles.bar, { height: `${Math.max(d.earnings ? 6 : 0, (d.earnings / max) * 100)}%` }]} />
          </View>
          <Text style={[type.label, { color: color.textMuted }]}>{shortWeekday(d.date)}</Text>
        </View>
      ))}
    </View>
  );
}

export function HistoryRow({ order, onPress }: { order: RiderOrder; onPress: () => void }) {
  const n = itemCount(order);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: color.surfaceAlt }]}>
      <View style={styles.rowIcon}>
        <MaterialCommunityIcons name="check" size={20} color={color.onlineDark} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.body, { color: color.text, fontWeight: '700' }]} numberOfLines={1}>
          {order.restaurantName ?? 'Store'}
        </Text>
        <Text style={[type.bodySm, { color: color.textSecondary }]} numberOfLines={1}>
          → {order.dropAddress ?? '—'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Text style={[type.bodySm, { color: color.textMuted }]}>
            {timeIST(order.deliveredAt)}
            {n ? ` · ${n} item${n === 1 ? '' : 's'}` : ''}
          </Text>
          {order.paymentMethod === 'COD' ? <Badge tone="cash" label="Cash" /> : order.paymentMethod ? <Badge tone="prepaid" label="Prepaid" /> : null}
        </View>
      </View>
      <Text style={[type.title3, { color: color.text }]}>{order.earning !== null ? rupees(order.earning) : '—'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: color.primary, borderRadius: radius.xl, padding: space.lg, gap: 4 },
  bars: { flexDirection: 'row', gap: 6, height: 170, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barTrack: { flex: 1, width: '70%', justifyContent: 'flex-end', backgroundColor: color.surfaceAlt, borderRadius: radius.sm, overflow: 'hidden' },
  bar: { width: '100%', backgroundColor: color.online, borderRadius: radius.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, paddingHorizontal: space.md, backgroundColor: color.surface },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.onlineTint, alignItems: 'center', justifyContent: 'center' },
});
