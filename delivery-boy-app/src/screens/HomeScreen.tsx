import React, { useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { color, radius, space, type } from '../theme/tokens';
import { Banner, EmptyState, ErrorState, Skeleton } from '../components/ui/Basics';
import { PrimaryButton, SecondaryButton } from '../components/ui/Buttons';
import { Sheet } from '../components/ui/Sheet';
import { DutyToggle, TodayStrip } from '../components/rider/DutyToggle';
import { ActiveOrderCard, IncomingOrderCard } from '../components/rider/OrderCards';
import { useRider } from '../state/RiderProvider';
import { firstName } from '../services/orderModel';

export function HomeScreen() {
  const r = useRider();
  const [refreshing, setRefreshing] = useState(false);
  const [confirmOffline, setConfirmOffline] = useState(false);

  const visiblePool = useMemo(
    () => r.pending.data.filter((o) => !((r.dismissedIds[o.id] ?? 0) > Date.now())),
    [r.pending.data, r.dismissedIds],
  );
  const incoming = r.isOnline ? visiblePool[0] : undefined;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([r.refreshOrders(), r.refreshToday(), r.refreshProfile()]);
    setRefreshing(false);
  };

  const toggleDuty = () => {
    if (r.isOnline && r.active.data.length > 0) {
      setConfirmOffline(true);
      return;
    }
    r.setDuty(!r.isOnline);
  };

  const name = firstName(r.profile?.name) ?? 'Rider';
  const initial = name.charAt(0).toUpperCase();
  const firstLoad = !r.active.loaded || (r.isOnline && !r.pending.loaded);

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[type.bodySm, { color: color.textMuted }]}>Zenvy Rider</Text>
            <Text style={[type.title2, { color: color.text }]}>Hi, {name}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => r.setTab('profile')} style={styles.avatar}>
            <Text style={[type.title3, { color: color.textInverse }]}>{initial}</Text>
          </Pressable>
        </View>

        <DutyToggle online={r.isOnline} busy={r.dutyBusy} onPress={toggleDuty} />
        <TodayStrip stats={r.today.data} rating={r.profile?.averageRating ?? null} onPress={() => r.setTab('earnings')} />

        {r.locationDenied ? (
          <View style={{ borderRadius: radius.md, overflow: 'hidden' }}>
            <Banner tone="info" icon="crosshairs-off" text="Location is off. Turn it on so customers can see you and distances show." />
          </View>
        ) : null}

        {r.active.data.length > 0 ? (
          <View style={{ gap: space.sm }}>
            <Text style={[type.title3, { color: color.text }]}>
              Active {r.active.data.length === 1 ? 'order' : `orders (${r.active.data.length})`}
            </Text>
            {r.active.data.map((o) => (
              <ActiveOrderCard key={o.id} order={o} syncing={r.syncPendingIds.has(o.id)} onContinue={() => r.openDelivery(o.id)} />
            ))}
          </View>
        ) : null}

        {r.active.error && !r.active.data.length ? <ErrorState message={r.active.error} onRetry={r.refreshOrders} /> : null}

        {firstLoad && r.connected ? (
          <View style={{ gap: space.sm }}>
            <Skeleton height={140} />
            <Skeleton height={220} />
          </View>
        ) : r.isOnline ? (
          incoming ? (
            <IncomingOrderCard
              key={incoming.id}
              order={incoming}
              fix={r.fix}
              connected={r.connected}
              onAccept={() => r.accept(incoming)}
              onReject={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                r.dismissOrder(incoming.id);
              }}
            />
          ) : r.pending.error ? (
            <ErrorState message={r.pending.error} onRetry={r.refreshOrders} />
          ) : (
            <EmptyState icon="bell-sleep-outline" title="No orders right now" body="We'll alert you when one comes in." />
          )
        ) : r.active.data.length === 0 ? (
          <EmptyState icon="power-plug-off-outline" title="Go online to start getting orders" body="Tap the button above when you're ready to ride." />
        ) : null}

        {r.isOnline && r.pending.data.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => r.setOverlay({ kind: 'available' })} style={styles.seeAll}>
            <MaterialCommunityIcons name="format-list-bulleted" size={22} color={color.info} />
            <Text style={[type.body, { color: color.info, fontWeight: '800', flex: 1 }]}>
              See all available orders ({r.pending.data.length})
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={24} color={color.info} />
          </Pressable>
        ) : null}
      </ScrollView>

      <Sheet visible={confirmOffline} onClose={() => setConfirmOffline(false)} title="Go offline?">
        <Text style={[type.body, { color: color.textSecondary }]}>
          You still have {r.active.data.length} active order{r.active.data.length === 1 ? '' : 's'}. You'll stop getting new orders but can finish these.
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <SecondaryButton title="Stay online" onPress={() => setConfirmOffline(false)} style={{ flex: 1 }} />
          <PrimaryButton
            title="Go offline"
            size="lg"
            onPress={() => {
              setConfirmOffline(false);
              r.setDuty(false);
            }}
            style={{ flex: 1 }}
          />
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.md, paddingBottom: space.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 56,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: color.infoTint,
  },
});
