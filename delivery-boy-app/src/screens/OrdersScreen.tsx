// Delivery history grouped by IST day.
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { color, space, type } from '../theme/tokens';
import { Badge, EmptyState, ErrorState, Skeleton } from '../components/ui/Basics';
import { Sheet } from '../components/ui/Sheet';
import { HistoryRow } from '../components/rider/EarningsBits';
import { useRider } from '../state/RiderProvider';
import { dayLabel, istDayKey, rupees, timeIST } from '../services/format';
import type { RiderOrder } from '../types';

export function OrdersScreen() {
  const r = useRider();
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<RiderOrder | null>(null);

  useEffect(() => {
    r.refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sections = useMemo(() => {
    const groups = new Map<string, RiderOrder[]>();
    for (const o of r.history.data ?? []) {
      const key = o.deliveredAt ? istDayKey(o.deliveredAt) : 'unknown';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(o);
    }
    return [...groups.entries()].map(([key, data]) => ({
      key,
      title: key === 'unknown' ? 'Earlier' : dayLabel(key),
      total: data.reduce((s, o) => s + (o.earning ?? 0), 0),
      data,
    }));
  }, [r.history.data]);

  const loading = !r.history.loaded && !r.history.data;
  const stale = r.history.error && r.history.data;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.head}>
        <Text style={[type.title1, { color: color.text }]}>Orders</Text>
        {stale && r.history.updatedAt ? (
          <Text style={[type.bodySm, { color: color.warning }]}>Last updated {timeIST(r.history.updatedAt)}</Text>
        ) : null}
      </View>
      {loading ? (
        <View style={{ padding: space.md, gap: space.sm }}>
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(o) => o.id}
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await r.refreshHistory();
                setRefreshing(false);
              }}
            />
          }
          ListHeaderComponent={r.history.error && !r.history.data ? (
            <View style={{ padding: space.md }}>
              <ErrorState message={r.history.error} onRetry={r.refreshHistory} />
            </View>
          ) : null}
          ListEmptyComponent={
            r.history.error ? null : (
              <EmptyState icon="clipboard-text-outline" title="No deliveries yet" body="Your completed orders will show here." />
            )
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHead}>
              <Text style={[type.title3, { color: color.text, flex: 1 }]}>{section.title}</Text>
              <Text style={[type.body, { color: color.textSecondary, fontWeight: '700' }]}>
                {section.data.length} · {rupees(section.total)}
              </Text>
            </View>
          )}
          renderItem={({ item }) => <HistoryRow order={item} onPress={() => setDetail(item)} />}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: color.border, marginLeft: 64 }} />}
          ListFooterComponent={
            r.history.data && r.history.data.length ? (
              <Text style={[type.bodySm, styles.footer]}>Showing your last {Math.min(100, r.history.data.length)} deliveries</Text>
            ) : null
          }
        />
      )}

      <Sheet visible={!!detail} onClose={() => setDetail(null)} title={detail ? `Order #${detail.shortId}` : ''}>
        {detail ? (
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
              <Badge tone="online" icon="check" label="Delivered" />
              {detail.paymentMethod === 'COD' ? <Badge tone="cash" label="Cash" /> : detail.paymentMethod ? <Badge tone="prepaid" label="Prepaid" /> : null}
            </View>
            <Detail label="Store" value={detail.restaurantName} />
            <Detail label="Drop" value={detail.dropAddress} />
            <Detail label="Delivered" value={detail.deliveredAt ? `${dayLabel(istDayKey(detail.deliveredAt))}, ${timeIST(detail.deliveredAt)}` : null} />
            <Detail label="Items" value={detail.items.map((i) => `${i.quantity}× ${i.name}`).join('\n') || null} />
            <Detail label="Order total" value={detail.finalPrice !== null ? rupees(detail.finalPrice) : null} />
            <Detail label="You earned" value={detail.earning !== null ? rupees(detail.earning) : null} />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={[type.label, { color: color.textMuted }]}>{label.toUpperCase()}</Text>
      <Text style={[type.body, { color: color.text }]}>{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { padding: space.md, paddingBottom: space.xs, gap: 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.xs, backgroundColor: color.bg },
  footer: { color: color.textMuted, textAlign: 'center', padding: space.lg },
});
