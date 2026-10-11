// Earnings from real data only: /stats/today, /stats/week (or history), profile lifetime totals.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { color, radius, space, type } from '../theme/tokens';
import { Card, EmptyState, ErrorState, Skeleton } from '../components/ui/Basics';
import { EarningsHero, HistoryRow, WeekBars } from '../components/rider/EarningsBits';
import { useRider } from '../state/RiderProvider';
import { istDayKey, lastNDayKeys, rupees, timeIST, todayKey } from '../services/format';

export function EarningsScreen() {
  const r = useRider();
  const [seg, setSeg] = useState<'today' | 'week'>('today');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    r.refreshEarnings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tKey = todayKey();
  const weekKeys = useMemo(() => new Set(lastNDayKeys(7)), []);
  const todayRows = useMemo(
    () => (r.history.data ?? []).filter((o) => o.deliveredAt && istDayKey(o.deliveredAt) === tKey),
    [r.history.data, tKey],
  );
  const weekRows = useMemo(
    () => (r.history.data ?? []).filter((o) => o.deliveredAt && weekKeys.has(istDayKey(o.deliveredAt))),
    [r.history.data, weekKeys],
  );

  // Cash in hand today: server value, else from history rows that carry the payment method.
  const historyHasMethod = (r.history.data ?? []).some((o) => o.paymentMethod);
  const codToday =
    r.today.data?.codCollected ??
    (historyHasMethod ? todayRows.filter((o) => o.paymentMethod === 'COD').reduce((s, o) => s + (o.finalPrice ?? 0), 0) : null);

  const stats = r.today.data;
  const loading = !r.today.loaded && !stats;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await r.refreshEarnings();
            setRefreshing(false);
          }}
        />
      }
    >
      <Text style={[type.title1, { color: color.text }]}>Earnings</Text>
      {r.today.error && r.today.updatedAt ? (
        <Text style={[type.bodySm, { color: color.warning }]}>Offline. Last updated {timeIST(r.today.updatedAt)}</Text>
      ) : null}

      <View style={styles.seg} accessibilityRole="tablist">
        {(['today', 'week'] as const).map((k) => (
          <Pressable
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: seg === k }}
            onPress={() => setSeg(k)}
            style={[styles.segBtn, seg === k && styles.segOn]}
          >
            <Text style={[type.title3, { color: seg === k ? color.textInverse : color.textSecondary, fontSize: 16 }]}>
              {k === 'today' ? 'Today' : 'This week'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <Skeleton height={140} />
      ) : r.today.error && !stats ? (
        <ErrorState message={r.today.error} onRetry={r.refreshEarnings} />
      ) : seg === 'today' ? (
        <>
          <EarningsHero
            label="TODAY"
            amount={stats?.earnings ?? 0}
            sub={
              stats && stats.orders > 0
                ? `${stats.orders} deliver${stats.orders === 1 ? 'y' : 'ies'} · avg ${rupees(stats.earnings / stats.orders)} per order`
                : 'No deliveries yet today'
            }
          />
          {codToday !== null && codToday !== undefined && codToday > 0 ? (
            <Card style={{ gap: 4, borderWidth: 2, borderColor: color.cashBorder, backgroundColor: color.cashTint }}>
              <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center' }}>
                <MaterialCommunityIcons name="cash-multiple" size={24} color={color.cash} />
                <Text style={[type.title3, { color: color.cash, flex: 1 }]}>Cash in hand today: {rupees(codToday)}</Text>
              </View>
              <Text style={[type.bodySm, { color: color.textSecondary }]}>Hand this cash to Zenvy as instructed by your fleet admin.</Text>
            </Card>
          ) : null}
          {todayRows.length ? (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {todayRows.map((o) => (
                <HistoryRow key={o.id} order={o} onPress={() => r.setTab('orders')} />
              ))}
            </Card>
          ) : (
            <EmptyState icon="wallet-outline" title="No earnings yet today" body="Go online and complete deliveries to earn." />
          )}
        </>
      ) : (
        <>
          <EarningsHero
            label="LAST 7 DAYS"
            amount={r.week?.totalEarnings ?? null}
            sub={r.week ? `${r.week.totalOrders} deliver${r.week.totalOrders === 1 ? 'y' : 'ies'}` : null}
          />
          {r.week ? (
            <Card>
              <WeekBars days={r.week.days} />
              {r.week.source === 'history' ? (
                <Text style={[type.bodySm, { color: color.textMuted, marginTop: space.xs }]}>Based on your last 100 deliveries.</Text>
              ) : null}
            </Card>
          ) : null}
          {weekRows.length ? (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {weekRows.map((o) => (
                <HistoryRow key={o.id} order={o} onPress={() => r.setTab('orders')} />
              ))}
            </Card>
          ) : (
            <EmptyState icon="calendar-week" title="No deliveries this week" />
          )}
        </>
      )}

      <Card style={{ gap: space.sm }}>
        <Text style={[type.label, { color: color.textMuted }]}>LIFETIME</Text>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1 }}>
            <Text style={[type.title2, { color: color.text }]}>{rupees(r.profile?.totalEarnings ?? null)}</Text>
            <Text style={[type.bodySm, { color: color.textMuted }]}>Total earned</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.title2, { color: color.text }]}>{r.profile?.completedCount ?? '—'}</Text>
            <Text style={[type.bodySm, { color: color.textMuted }]}>Deliveries</Text>
          </View>
        </View>
      </Card>

      <View style={styles.note}>
        <MaterialCommunityIcons name="bank-outline" size={22} color={color.textSecondary} />
        <Text style={[type.bodySm, { color: color.textSecondary, flex: 1 }]}>
          Payouts are settled by Zenvy. Contact support for payout questions.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.md, paddingBottom: space.xxl },
  seg: { flexDirection: 'row', backgroundColor: color.surfaceAlt, borderRadius: radius.pill, padding: 4 },
  segBtn: { flex: 1, minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: color.primary },
  note: { flexDirection: 'row', gap: space.xs, alignItems: 'center', padding: space.md, borderRadius: radius.md, backgroundColor: color.surfaceAlt },
});
