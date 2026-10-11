import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { rupees } from '../services/orderModel';
import { color, elevation, mono, radius, space, type } from '../theme/tokens';
import {
  callNumber, ElapsedText, InstructionsCallout, ItemLines, OrderActions, PastChip, PaymentBadge, PrepLine, RiderStatus,
} from './OrderBits';
import { IconButton } from './ui';
import type { Order } from '../types';

function OrderCardBase({ order, onOpen, onAccept, onReject }: {
  order: Order; onOpen: (o: Order) => void; onAccept: (o: Order) => void; onReject: (o: Order) => void;
}) {
  const isNew = order.stage === 'new';
  const active = order.stage === 'new' || order.stage === 'preparing' || order.stage === 'ready';
  return (
    <View style={[styles.card, isNew && styles.cardNew]}>
      <Pressable
        onPress={() => onOpen(order)}
        accessibilityRole="button"
        accessibilityLabel={`Order ${order.shortId}, ${order.itemCount} items, open details`}
        style={({ pressed }) => [{ gap: space.sm }, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.orderId, mono, { color: color.text }]}>#{order.shortId}</Text>
            <ElapsedText order={order} />
          </View>
          <PaymentBadge order={order} />
        </View>

        <View style={styles.row}>
          <Text style={[type.title3, { color: color.text, flex: 1 }]} numberOfLines={1}>
            {order.customerName || 'Customer'}
          </Text>
          {active && order.customerPhone ? (
            <IconButton icon="call" label={`Call customer ${order.customerName || ''}`} onPress={() => callNumber(order.customerPhone)} />
          ) : null}
        </View>

        <ItemLines order={order} max={order.stage === 'past' ? 3 : undefined} />
        <InstructionsCallout order={order} />

        <View style={[styles.row, styles.footer]}>
          <Text style={[type.body, { color: color.text, fontWeight: '800' }]}>Item total {rupees(order.totalPrice)}</Text>
          {isNew ? <Text style={[type.bodySm, { color: color.textMuted }]}>{order.itemCount} item{order.itemCount === 1 ? '' : 's'}</Text> : null}
        </View>
      </Pressable>

      <PrepLine order={order} />
      <RiderStatus order={order} />
      <PastChip order={order} />
      <OrderActions order={order} onAccept={() => onAccept(order)} onReject={() => onReject(order)} />
    </View>
  );
}

export const OrderCard = memo(OrderCardBase);

const styles = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: color.border, ...elevation.card },
  cardNew: { borderColor: color.alert, borderWidth: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  footer: { justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: color.surfaceAlt, paddingTop: space.sm },
});
