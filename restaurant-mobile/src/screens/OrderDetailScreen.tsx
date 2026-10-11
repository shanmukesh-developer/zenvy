import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SUPPORT_PHONE } from '../constants/api';
import {
  callNumber, ElapsedText, InstructionsCallout, ItemLines, OrderActions, PastChip, PaymentBadge, PrepLine, RiderStatus,
} from '../components/OrderBits';
import { useOrderSheets } from '../components/OrderPickers';
import { Button, Card, EmptyState, IconButton } from '../components/ui';
import { clockIST, rupees } from '../services/orderModel';
import { useStore } from '../state/StoreProvider';
import { color, mono, space, type } from '../theme/tokens';

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.kv}>
      <Text style={[type.body, { color: color.textSecondary, flex: 1 }]}>{label}</Text>
      <Text style={[type.body, { color: color.text, fontWeight: strong ? '800' : '600', textAlign: 'right', flexShrink: 1 }]}>{value}</Text>
    </View>
  );
}

export default function OrderDetailScreen({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { orders, restaurant } = useStore();
  const { openAccept, openReject, sheets } = useOrderSheets();
  const order = orders.find((o) => o.id === orderId);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + space.xs }]}>
      <IconButton icon="arrow-back" label="Back" onPress={onBack} />
      <Text style={[type.title2, mono, { color: color.text, flex: 1 }]}>{order ? `#${order.shortId}` : 'Order'}</Text>
      {order ? <PaymentBadge order={order} large={false} /> : null}
    </View>
  );

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        {header}
        <EmptyState icon="receipt-outline" title="Order not found" body="It may be older than your latest 200 orders." action={{ label: 'Back to orders', onPress: onBack }} />
      </View>
    );
  }

  const help = () => {
    const text = encodeURIComponent(`Restaurant ${restaurant.name} (${restaurant.id}) needs help with order #${order.shortId}`);
    Linking.openURL(`https://wa.me/${SUPPORT_PHONE}?text=${text}`).catch(() => {});
  };
  const hasActions = order.stage === 'new' || order.stage === 'preparing' || order.stage === 'ready';

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      {header}
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xxl }}>
        <Card style={{ gap: space.sm }}>
          <View style={styles.kv}>
            <Text style={[type.title3, { color: color.text, flex: 1 }]}>{order.customerName || 'Customer'}</Text>
            <ElapsedText order={order} />
          </View>
          {order.customerPhone && order.stage !== 'past' ? (
            <Button label="Call customer" icon="call" variant="secondary" size="secondary" onPress={() => callNumber(order.customerPhone)} />
          ) : null}
          {order.deliveryAddress ? <Text style={[type.body, { color: color.textSecondary }]}>Deliver to: {order.deliveryAddress}</Text> : null}
        </Card>

        <Card style={{ gap: space.sm }}>
          <Text style={[type.label, { color: color.textMuted }]}>ITEMS ({order.itemCount})</Text>
          <ItemLines order={order} showPrices />
          <View style={styles.divider} />
          <Row label="Item total" value={rupees(order.totalPrice)} strong />
        </Card>

        <InstructionsCallout order={order} />
        <PrepLine order={order} />
        <RiderStatus order={order} />
        <PastChip order={order} />

        <Card style={{ gap: space.xs }}>
          <Text style={[type.label, { color: color.textMuted }]}>PAYMENT</Text>
          <Row label="Method" value={order.isCOD ? 'Cash on delivery' : order.paymentMethod === 'Wallet' ? 'Prepaid (Zenvy Wallet)' : order.paymentMethod || '—'} />
          {order.paymentStatus ? <Row label="Status" value={order.paymentStatus} /> : null}
          <Row label="Customer pays" value={rupees(order.finalPrice)} />
          {order.isCOD ? <Text style={[type.bodySm, { color: color.cash }]}>The rider collects the cash. You don't collect anything.</Text> : null}
        </Card>

        <Card style={{ gap: space.xs }}>
          <Text style={[type.label, { color: color.textMuted }]}>TIMELINE</Text>
          <Row label="Placed" value={clockIST(order.createdAt) || '—'} />
          {order.acceptedAt ? <Row label="Accepted" value={clockIST(order.acceptedAt)} /> : null}
          {order.readyAt ? <Row label="Ready" value={clockIST(order.readyAt)} /> : null}
          {order.deliveredAt ? <Row label="Delivered" value={clockIST(order.deliveredAt)} /> : null}
          {order.status === 'Cancelled' ? <Row label="Cancelled" value={clockIST(order.updatedAt) || '—'} /> : null}
        </Card>

        <Button label="Get help with this order" icon="logo-whatsapp" variant="secondary" size="secondary" onPress={help} />
      </ScrollView>
      {hasActions ? (
        <View style={[styles.bar, { paddingBottom: insets.bottom + space.sm }]}>
          <OrderActions order={order} onAccept={() => openAccept(order)} onReject={() => openReject(order)} />
        </View>
      ) : null}
      {sheets}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.sm, backgroundColor: color.surface, borderBottomWidth: 1, borderBottomColor: color.border },
  kv: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  divider: { height: 1, backgroundColor: color.surfaceAlt },
  bar: { backgroundColor: color.surface, borderTopWidth: 1, borderTopColor: color.border, paddingHorizontal: space.md, paddingTop: space.sm },
});
