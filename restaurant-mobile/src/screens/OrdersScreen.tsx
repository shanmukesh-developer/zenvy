import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { OrderCard } from '../components/OrderCard';
import { useOrderSheets } from '../components/OrderPickers';
import { OrderTabs } from '../components/Nav';
import { SoundOffBanner } from '../components/StoreHeader';
import { Button, EmptyState, SkeletonCard } from '../components/ui';
import { isTodayIST } from '../services/orderModel';
import { useStore } from '../state/StoreProvider';
import { color, space, type } from '../theme/tokens';
import type { Order, OrderStage } from '../types';

const EMPTY: Record<OrderStage, { title: string; body: string }> = {
  new: { title: 'No new orders', body: 'Keep this screen open — new orders ring loudly.' },
  preparing: { title: 'Nothing cooking', body: 'Accepted orders show up here until you mark them ready.' },
  ready: { title: 'No orders waiting', body: 'Packed orders wait here for the rider.' },
  pickedUp: { title: 'Nothing on the road', body: 'Orders out for delivery show up here.' },
  past: { title: 'No past orders yet', body: 'Delivered and cancelled orders show up here.' },
};

export default function OrdersScreen({ onOpenOrder, onOpenSettings }: { onOpenOrder: (o: Order) => void; onOpenSettings: () => void }) {
  const { orders, ordersLoaded, ordersError, refreshing, refreshOrders } = useStore();
  const [tab, setTab] = useState<OrderStage>('new');
  const { openAccept, openReject, sheets } = useOrderSheets();

  const { counts, list } = useMemo(() => {
    const c: Record<OrderStage, number> = { new: 0, preparing: 0, ready: 0, pickedUp: 0, past: 0 };
    for (const o of orders) c[o.stage] += 1;
    let l = orders.filter((o) => o.stage === tab);
    if (tab === 'past') {
      // Today first, then older (each newest first, as the server sends them).
      l = [...l.filter((o) => isTodayIST(o.createdAt)), ...l.filter((o) => !isTodayIST(o.createdAt))];
    } else {
      // Active queues: oldest first so the kitchen works top-down.
      l = [...l].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    }
    return { counts: c, list: l };
  }, [orders, tab]);

  const renderItem = useCallback(
    ({ item }: { item: Order }) => <OrderCard order={item} onOpen={onOpenOrder} onAccept={openAccept} onReject={openReject} />,
    [onOpenOrder, openAccept, openReject],
  );

  return (
    <View style={{ flex: 1 }}>
      <SoundOffBanner onFix={onOpenSettings} />
      <OrderTabs value={tab} onChange={setTab} counts={counts} />
      {!ordersLoaded ? (
        ordersError ? (
          <View style={{ padding: space.md }}>
            <EmptyState icon="cloud-offline-outline" title="Couldn't load orders" body={ordersError} action={{ label: 'Retry', onPress: () => refreshOrders({ pull: true }) }} />
          </View>
        ) : (
          <View style={{ padding: space.md, gap: space.md }}><SkeletonCard /><SkeletonCard lines={2} /></View>
        )
      ) : (
        <FlatList
          data={list}
          keyExtractor={(o) => o.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Sep}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refreshOrders({ pull: true })} colors={[color.text]} />}
          ListHeaderComponent={ordersError ? (
            <View style={styles.err}>
              <Text style={[type.bodySm, { color: color.alertDark, flex: 1 }]}>{ordersError}</Text>
              <Button label="Retry" variant="secondary" size="secondary" onPress={() => refreshOrders({ pull: true })} />
            </View>
          ) : null}
          ListEmptyComponent={<EmptyState icon={tab === 'new' ? 'notifications-outline' : 'receipt-outline'} title={EMPTY[tab].title} body={EMPTY[tab].body} />}
          ListFooterComponent={tab === 'past' && list.length > 0 ? (
            <Text style={[type.bodySm, { color: color.textMuted, textAlign: 'center', marginTop: space.md }]}>Showing your latest 200 orders</Text>
          ) : null}
        />
      )}
      {sheets}
    </View>
  );
}

const Sep = () => <View style={{ height: space.md }} />;

const styles = StyleSheet.create({
  list: { padding: space.md, paddingBottom: space.xxl * 2 },
  err: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.alertTint, borderRadius: 12, padding: space.sm, marginBottom: space.md },
});
