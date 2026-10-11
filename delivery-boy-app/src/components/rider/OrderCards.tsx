import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { color, space, type } from '../../theme/tokens';
import { Badge, Card } from '../ui/Basics';
import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { CountdownBar } from '../ui/CountdownBar';
import { DistanceLine, PaymentChip } from './OrderBits';
import { itemCount, STEPS, stepIndex, storeStatusLabel } from '../../services/orderModel';
import { minutesAgo, rupees } from '../../services/format';
import type { Fix } from '../../services/location';
import type { RiderOrder } from '../../types';

const OFFER_SECONDS = 30;

function PoolBody({ order, fix }: { order: RiderOrder; fix: Fix | null }) {
  const count = itemCount(order);
  const ago = minutesAgo(order.createdAt);
  const store = storeStatusLabel(order.status);
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.topRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.label, { color: color.textMuted }]}>YOU EARN</Text>
          <Text style={[type.money, { color: color.text }]}>{order.earning !== null ? rupees(order.earning) : '—'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <PaymentChip order={order} />
          {store ? <Badge tone="info" label={store} /> : null}
        </View>
      </View>
      <View style={styles.leg}>
        <MaterialCommunityIcons name="storefront-outline" size={22} color={color.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={[type.title3, { color: color.text }]}>{order.restaurantName ?? 'Store'}</Text>
          {order.restaurantAddress ? <Text style={[type.bodySm, { color: color.textSecondary }]}>{order.restaurantAddress}</Text> : null}
        </View>
      </View>
      <View style={styles.leg}>
        <MaterialCommunityIcons name="map-marker-outline" size={22} color={color.textSecondary} />
        <Text style={[type.body, { color: color.text, flex: 1 }]} numberOfLines={3}>
          {order.dropAddress ?? '—'}
        </Text>
      </View>
      <DistanceLine order={order} fix={fix} />
      <Text style={[type.bodySm, { color: color.textMuted }]}>
        {[count ? `${count} item${count === 1 ? '' : 's'}` : null, ago ? `Placed ${ago}` : null].filter(Boolean).join(' · ')}
      </Text>
    </View>
  );
}

/** The "new order" offer on Home, with a visual 30 s timer. */
export function IncomingOrderCard({
  order,
  fix,
  connected,
  onAccept,
  onReject,
}: {
  order: RiderOrder;
  fix: Fix | null;
  connected: boolean;
  onAccept: () => Promise<boolean>;
  onReject: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Card style={{ gap: space.md, borderWidth: 2, borderColor: color.online }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <MaterialCommunityIcons name="bell-ring-outline" size={22} color={color.onlineDark} />
        <Text style={[type.title3, { color: color.onlineDark }]}>New order</Text>
      </View>
      <PoolBody order={order} fix={fix} />
      <CountdownBar key={order.id} seconds={OFFER_SECONDS} onExpire={onReject} paused={busy} />
      <View style={styles.actions}>
        <SecondaryButton title="Reject" tone="danger" onPress={onReject} disabled={busy} style={{ flex: 1 }} />
        <PrimaryButton
          title={connected ? 'Accept' : 'Needs internet'}
          icon={connected ? 'check-bold' : 'wifi-off'}
          variant="online"
          disabled={!connected}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await onAccept();
            } finally {
              setBusy(false);
            }
          }}
          style={{ flex: 2 }}
        />
      </View>
    </Card>
  );
}

/** Compact pool card for the full list. */
export function PoolOrderCard({
  order,
  fix,
  canAccept,
  disabledLabel,
  onAccept,
}: {
  order: RiderOrder;
  fix: Fix | null;
  canAccept: boolean;
  disabledLabel: string;
  onAccept: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Card style={{ gap: space.md }}>
      <PoolBody order={order} fix={fix} />
      <PrimaryButton
        title={canAccept ? 'Accept' : disabledLabel}
        variant="online"
        size="lg"
        disabled={!canAccept}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await onAccept();
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}

export function ActiveOrderCard({ order, syncing, onContinue }: { order: RiderOrder; syncing: boolean; onContinue: () => void }) {
  const step = STEPS[stepIndex(order.status)];
  const toDrop = ['PickedUp', 'ArrivedAtGate'].includes(order.status);
  return (
    <Card style={{ gap: space.sm }} onPress={onContinue} accessibilityLabel={`Order ${order.shortId}, ${step.title}`}>
      <View style={styles.topRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[type.label, { color: color.textMuted }]}>#{order.shortId} · NOW</Text>
          <Text style={[type.title2, { color: color.text }]}>{step.title}</Text>
        </View>
        {syncing ? <Badge tone="warning" icon="clock-outline" label="Waiting to sync" /> : <PaymentChip order={order} />}
      </View>
      <View style={styles.leg}>
        <MaterialCommunityIcons name={toDrop ? 'map-marker' : 'storefront'} size={22} color={color.text} />
        <Text style={[type.body, { color: color.text, flex: 1, fontWeight: '700' }]} numberOfLines={2}>
          {toDrop ? order.dropAddress ?? '—' : order.restaurantName ?? 'Store'}
        </Text>
      </View>
      <PrimaryButton title="Continue" icon="arrow-right" size="lg" onPress={onContinue} />
    </Card>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  leg: { flexDirection: 'row', gap: space.xs, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
});
