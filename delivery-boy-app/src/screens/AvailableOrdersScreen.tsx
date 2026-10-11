import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { color, space, type } from '../theme/tokens';
import { Banner, EmptyState, ErrorState } from '../components/ui/Basics';
import { IconButton } from '../components/ui/Buttons';
import { PoolOrderCard } from '../components/rider/OrderCards';
import { useRider } from '../state/RiderProvider';

export function AvailableOrdersScreen({ onBack }: { onBack: () => void }) {
  const r = useRider();
  const [refreshing, setRefreshing] = useState(false);
  const list = r.pending.data; // newest first (sorted in the provider)

  const disabledLabel = !r.isOnline ? 'Go online to accept' : 'Needs internet';
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.top}>
        <IconButton icon="arrow-left" onPress={onBack} accessibilityLabel="Back" />
        <Text style={[type.title2, { color: color.text, flex: 1 }]}>Available orders</Text>
      </View>
      {!r.isOnline ? <Banner tone="warning" icon="power" text="You're not on duty. Go online on Home to accept orders." /> : null}
      <FlatList
        data={list}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: space.md, gap: space.md, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await r.refreshOrders();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={r.pending.error ? <ErrorState message={r.pending.error} onRetry={r.refreshOrders} /> : null}
        ListEmptyComponent={
          r.pending.error ? null : <EmptyState icon="bell-sleep-outline" title="No orders right now" body="We'll alert you when one comes in." />
        }
        renderItem={({ item }) => (
          <PoolOrderCard
            order={item}
            fix={r.fix}
            canAccept={r.isOnline && r.connected}
            disabledLabel={disabledLabel}
            onAccept={() => r.accept(item)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, paddingBottom: space.xs },
});
