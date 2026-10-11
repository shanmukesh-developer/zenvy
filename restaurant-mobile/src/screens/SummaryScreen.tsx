// "Today" (IST), computed from the real orders list. No invented payouts or ratings.
import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/ui';
import { istDayKey, isTodayIST, rupees, TIMED_OUT_REASON, todayIST } from '../services/orderModel';
import { useStore } from '../state/StoreProvider';
import { color, radius, space, type } from '../theme/tokens';

function Tile({ label, value, caption, tint }: { label: string; value: string; caption?: string; tint?: string }) {
  return (
    <Card style={styles.tile}>
      <Text style={[type.label, { color: color.textMuted }]}>{label.toUpperCase()}</Text>
      <Text style={[type.money, { color: tint || color.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {caption ? <Text style={[type.bodySm, { color: color.textSecondary }]}>{caption}</Text> : null}
    </Card>
  );
}

const dayLabel = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getUTCDay()]} ${d}`;
};

export default function SummaryScreen() {
  const { orders, refreshing, refreshOrders } = useStore();

  const s = useMemo(() => {
    const today = orders.filter((o) => isTodayIST(o.createdAt));
    const live = today.filter((o) => o.status !== 'Cancelled');
    const delivered = today.filter((o) => o.status === 'Delivered');
    const inProgress = live.filter((o) => o.status !== 'Delivered' && o.status !== 'Pending');
    const cancelled = today.filter((o) => o.status === 'Cancelled');
    const missed = cancelled.filter((o) => TIMED_OUT_REASON.test(o.cancellationReason || ''));
    const cod = live.filter((o) => o.isCOD);
    const prepaid = live.filter((o) => !o.isCOD);
    const prepTimes = today
      .map((o) => (o.acceptedAt && o.readyAt ? (new Date(o.readyAt).getTime() - new Date(o.acceptedAt).getTime()) / 60000 : NaN))
      .filter((m) => Number.isFinite(m) && m >= 0 && m < 600);
    const sum = (arr: typeof orders, f: 'totalPrice' | 'finalPrice') => arr.reduce((a, o) => a + (o[f] || 0), 0);

    // Last 7 IST days from the same list.
    const days: { key: string; orders: number; sales: number }[] = [];
    const now = Date.now();
    for (let i = 6; i >= 0; i--) days.push({ key: istDayKey(now - i * 86400000), orders: 0, sales: 0 });
    for (const o of orders) {
      if (!o.createdAt || o.status === 'Cancelled') continue;
      const d = days.find((x) => x.key === istDayKey(o.createdAt as string));
      if (!d) continue;
      d.orders += 1;
      if (o.status === 'Delivered') d.sales += o.totalPrice;
    }
    return {
      orders: live.length,
      sales: sum(delivered, 'totalPrice'),
      inProgress: sum(inProgress, 'totalPrice'),
      cancelled: cancelled.length,
      missed: missed.length,
      codN: cod.length, codAmt: sum(cod, 'finalPrice'),
      preN: prepaid.length, preAmt: sum(prepaid, 'finalPrice'),
      avgPrep: prepTimes.length ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length) : null,
      prepN: prepTimes.length,
      days,
      maxDay: Math.max(1, ...days.map((d) => d.orders)),
    };
  }, [orders]);

  const todayKey = todayIST();

  return (
    <ScrollView
      contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xxl * 2 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refreshOrders({ pull: true })} colors={[color.text]} />}
    >
      <Text style={[type.title1, { color: color.text }]}>Today</Text>
      <View style={styles.grid}>
        <Tile label="Orders" value={String(s.orders)} caption="Not counting cancelled" />
        <Tile label="Sales" value={rupees(s.sales)} caption="Delivered today · food value before Zenvy commission" tint={color.openDark} />
      </View>
      <Text style={[type.body, { color: color.textSecondary }]}>In progress {rupees(s.inProgress)}</Text>
      <View style={styles.grid}>
        <Tile label="Rejected / cancelled" value={String(s.cancelled)} caption={`Missed (timed out): ${s.missed}`} tint={s.cancelled ? color.alert : undefined} />
        <Tile
          label="Avg prep time"
          value={s.avgPrep !== null ? `${s.avgPrep} min` : '—'}
          caption={s.avgPrep !== null ? `From ${s.prepN} order${s.prepN === 1 ? '' : 's'} (accept → ready)` : 'Shown once prep times are recorded'}
        />
      </View>
      <View style={styles.grid}>
        <Tile label="Cash (COD)" value={String(s.codN)} caption={`${rupees(s.codAmt)} collected by riders`} tint={color.cash} />
        <Tile label="Prepaid" value={String(s.preN)} caption={`${rupees(s.preAmt)} paid by Wallet`} tint={color.prepaid} />
      </View>

      <Card style={{ gap: space.sm }}>
        <Text style={[type.title3, { color: color.text }]}>Last 7 days</Text>
        {s.days.map((d) => (
          <View key={d.key} style={styles.dayRow} accessibilityLabel={`${dayLabel(d.key)}: ${d.orders} orders, ${rupees(d.sales)} delivered sales`}>
            <Text style={[type.bodySm, { color: color.text, width: 64, fontWeight: d.key === todayKey ? '800' : '500' }]}>
              {d.key === todayKey ? 'Today' : dayLabel(d.key)}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { width: `${(d.orders / s.maxDay) * 100}%` }]} />
            </View>
            <Text style={[type.bodySm, { color: color.text, width: 96, textAlign: 'right' }]}>{d.orders} · {rupees(d.sales)}</Text>
          </View>
        ))}
        <Text style={[type.bodySm, { color: color.textMuted }]}>Orders (excl. cancelled) · delivered sales. Based on your latest 200 orders.</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1, gap: 4 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 28 },
  barTrack: { flex: 1, height: 12, backgroundColor: color.surfaceAlt, borderRadius: radius.pill, overflow: 'hidden' },
  bar: { height: 12, backgroundColor: color.open, borderRadius: radius.pill },
});
