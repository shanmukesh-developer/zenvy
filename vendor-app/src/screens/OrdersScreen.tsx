import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { StageTabs } from '../components/Nav';
import { OrderCard } from '../components/OrderCard';
import { useOrderSheets } from '../components/orderParts';
import { isTodayIST } from '../lib/model';
import { useStore } from '../state/StoreProvider';
import { color, font, space } from '../theme';
import { EmptyState, ErrorStrip, SkeletonCard } from '../ui/kit';
import type { Order, OrderStage } from '../types';

const EMPTY: Record<OrderStage, { title: string; body: string }> = {
  new: { title: 'No new orders', body: 'Keep the app open and the volume up. New orders ring and speak.' },
  accepted: { title: 'Nothing to prepare', body: 'Accepted orders wait here until you leave to deliver them.' },
  outForDelivery: { title: 'Nothing on the way', body: 'Orders you are delivering show here. Tap DELIVERED after you get the cash.' },
  done: { title: 'No finished orders yet', body: 'Delivered and cancelled orders show here.' },
};

export default function OrdersScreen({ onOpenOrder }: { onOpenOrder: (o: Order) => void }) {
  const { orders, ordersLoaded, ordersError, refreshing, refreshOrders } = useStore();
  const [tab, setTab] = useState<OrderStage>('new');
  const { openReject, openCancel, sheets } = useOrderSheets();

  const { counts, list } = useMemo(() => {
    const c: Record<OrderStage, number> = { new: 0, accepted: 0, outForDelivery: 0, done: 0 };
    for (const o of orders) c[o.stage] += 1;
    let l = orders.filter((o) => o.stage === tab);
    if (tab === 'done') {
      l = [...l.filter((o) => isTodayIST(o.createdAt)), ...l.filter((o) => !isTodayIST(o.createdAt))];
    } else {
      // Active queues: oldest first so the vendor works top-down.
      l = [...l].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    }
    return { counts: c, list: l };
  }, [orders, tab]);

  // Follow the order: when a tab empties and the next step has orders, move there once (less tapping).
  const last = useRef(counts);
  useEffect(() => {
    const prev = last.current;
    if (tab === 'new' && prev.new > 0 && counts.new === 0 && counts.accepted > 0) setTab('accepted');
    else if (tab === 'accepted' && prev.accepted > 0 && counts.accepted === 0 && counts.outForDelivery > 0) setTab('outForDelivery');
    last.current = counts;
  }, [counts, tab]);

  const renderItem = useCallback(
    ({ item }: { item: Order }) => <OrderCard order={item} onOpen={onOpenOrder} onReject={openReject} onCancel={openCancel} />,
    [onOpenOrder, openReject, openCancel],
  );

  const pull = useCallback(() => refreshOrders({ pull: true }), [refreshOrders]);

  return (
    <View style={{ flex: 1 }}>
      <StageTabs value={tab} onChange={setTab} counts={counts} />
      {!ordersLoaded ? (
        ordersError ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn't load orders" body={ordersError} action={{ label: 'Try again', onPress: pull, loading: refreshing }} />
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
          initialNumToRender={5}
          windowSize={7}
          removeClippedSubviews
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} colors={[color.text]} />}
          ListHeaderComponent={ordersError ? <View style={{ marginBottom: space.md }}><ErrorStrip text={ordersError} onRetry={pull} busy={refreshing} /></View> : null}
          ListEmptyComponent={<EmptyState icon={tab === 'new' ? 'notifications-outline' : 'receipt-outline'} title={EMPTY[tab].title} body={EMPTY[tab].body} />}
          ListFooterComponent={tab === 'done' && list.length > 0 ? (
            <Text style={[font.small, { color: color.textMuted, textAlign: 'center', marginTop: space.md }]}>Showing your latest 200 orders</Text>
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
});
