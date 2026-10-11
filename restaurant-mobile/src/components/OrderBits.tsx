// Pieces shared by the order card, the order detail and the new-order alert.
import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { agoText, clockIST, minutesSince, rupees } from '../services/orderModel';
import { useNow, useStore } from '../state/StoreProvider';
import { color, radius, space, type } from '../theme/tokens';
import { Badge, Button, IconButton } from './ui';
import type { Order } from '../types';

export const callNumber = (phone: string | null | undefined) => {
  if (!phone) return;
  Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => {});
};

export function PaymentBadge({ order, large }: { order: Order; large?: boolean }) {
  if (order.isCOD) {
    return (
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Badge text="COD" icon="cash-outline" fg={color.cash} bg={color.cashTint} border={color.cashBorder} />
        {large !== false ? <Text style={[type.label, { color: color.cash }]}>Rider collects {rupees(order.finalPrice)}</Text> : null}
      </View>
    );
  }
  return <Badge text="PREPAID" icon="wallet-outline" fg={color.prepaid} bg={color.prepaidTint} />;
}

export function ElapsedText({ order, inverse }: { order: Order; inverse?: boolean }) {
  const now = useNow();
  const mins = minutesSince(order.createdAt, now);
  const isNew = order.stage === 'new';
  const tint = inverse ? color.textInverse : isNew && mins >= 12 ? color.alert : isNew && mins >= 8 ? color.warning : color.textMuted;
  return (
    <Text style={[type.bodySm, { color: tint, fontWeight: isNew && mins >= 8 ? '800' : '500' }]}>
      {order.stage === 'past' ? clockIST(order.createdAt) : agoText(order.createdAt, now)}
    </Text>
  );
}

export function ItemLines({ order, showPrices, inverse, max }: { order: Order; showPrices?: boolean; inverse?: boolean; max?: number }) {
  const fg = inverse ? color.textInverse : color.text;
  const sub = inverse ? 'rgba(255,255,255,0.85)' : color.textMuted;
  const list = max ? order.items.slice(0, max) : order.items;
  const more = order.items.length - list.length;
  if (order.items.length === 0) {
    return <Text style={[type.bodySm, { color: sub }]}>Loading items…</Text>;
  }
  return (
    <View style={{ gap: space.xs }}>
      {list.map((it) => (
        <View key={it.key}>
          <View style={styles.lineRow}>
            <Text style={[type.itemLine, { color: fg, minWidth: 40, fontWeight: '800' }]}>{it.quantity} ×</Text>
            <Text style={[type.itemLine, { color: fg, flex: 1 }]}>{it.name}</Text>
            {it.isAddOn ? <Badge text="Add-on" fg={color.info} bg={color.infoTint} /> : null}
            {showPrices ? (
              <Text style={[type.body, { color: fg, fontWeight: '700' }]}>{it.lineTotal !== null ? rupees(it.lineTotal) : '—'}</Text>
            ) : null}
          </View>
          {it.customizations ? <Text style={[type.bodySm, { color: sub, marginLeft: 40 }]}>{it.customizations}</Text> : null}
          {showPrices && it.unitPrice !== null && it.quantity > 1 ? (
            <Text style={[type.bodySm, { color: sub, marginLeft: 40 }]}>{rupees(it.unitPrice)} × {it.quantity}</Text>
          ) : null}
        </View>
      ))}
      {more > 0 ? <Text style={[type.bodySm, { color: sub, marginLeft: 40 }]}>+ {more} more item{more > 1 ? 's' : ''}</Text> : null}
    </View>
  );
}

export function InstructionsCallout({ order }: { order: Order }) {
  if (!order.instructions.length) return null;
  return (
    <View style={styles.callout} accessibilityLabel={`Customer instructions: ${order.instructions.join('. ')}`}>
      <Ionicons name="chatbubble-ellipses-outline" size={20} color={color.warning} />
      <View style={{ flex: 1 }}>
        <Text style={[type.label, { color: color.warning }]}>CUSTOMER NOTE</Text>
        {order.instructions.map((t, i) => (
          <Text key={i} style={[type.body, { color: color.text }]}>{t}</Text>
        ))}
      </View>
    </View>
  );
}

export function RiderStatus({ order }: { order: Order }) {
  if (order.stage !== 'preparing' && order.stage !== 'ready' && order.stage !== 'pickedUp') return null;
  let icon: keyof typeof Ionicons.glyphMap = 'bicycle';
  let text: string;
  if (order.stage === 'pickedUp') text = order.status === 'ArrivedAtGate' ? 'Rider at the customer’s gate' : 'Out for delivery';
  else if (order.status === 'Picking') { text = `${order.riderName || 'Rider'} is at your store`; icon = 'storefront'; }
  else if (!order.deliveryPartnerId) { text = 'Looking for a rider…'; icon = 'search'; }
  else text = `${order.riderName || 'Rider'} assigned`;
  return (
    <View style={styles.rider}>
      <Ionicons name={icon} size={20} color={color.info} />
      <Text style={[type.body, { color: color.info, flex: 1, fontWeight: '700' }]}>{text}</Text>
      {order.deliveryPartnerId && order.riderPhone && order.stage !== 'pickedUp' ? (
        <IconButton icon="call" label={`Call rider ${order.riderName || ''}`} onPress={() => callNumber(order.riderPhone)} tint={color.info} bg={color.surface} />
      ) : null}
    </View>
  );
}

export function PrepLine({ order }: { order: Order }) {
  const now = useNow();
  if (order.stage !== 'preparing' || !order.estDuration) return null;
  const acceptedMs = order.acceptedAt ? new Date(order.acceptedAt).getTime() : NaN;
  if (!Number.isFinite(acceptedMs)) {
    return <Text style={[type.body, { color: color.textSecondary }]}>Prep {order.estDuration} min</Text>;
  }
  const due = acceptedMs + order.estDuration * 60000;
  const left = Math.round((due - now) / 60000);
  const late = left < 0;
  return (
    <View style={[styles.prep, late && { backgroundColor: color.alertTint }]}>
      <Ionicons name="timer-outline" size={20} color={late ? color.alert : color.textSecondary} />
      <Text style={[type.body, { color: late ? color.alert : color.textSecondary, fontWeight: '700' }]}>
        Prep {order.estDuration} min · Ready by {clockIST(due)} · {late ? `${-left} min late` : `${left} min left`}
      </Text>
    </View>
  );
}

export function PastChip({ order }: { order: Order }) {
  if (order.stage !== 'past') return null;
  if (order.status === 'Delivered') {
    return <Badge text={`Delivered ${clockIST(order.deliveredAt || order.updatedAt)}`} icon="checkmark-done" fg={color.openDark} bg={color.openTint} />;
  }
  return (
    <View style={[styles.prep, { backgroundColor: color.alertTint }]}>
      <Ionicons name="close-circle" size={18} color={color.alert} />
      <Text style={[type.bodySm, { color: color.alertDark, fontWeight: '700', flex: 1 }]}>
        Cancelled{order.cancellationReason ? ` — ${order.cancellationReason}` : ''}
      </Text>
    </View>
  );
}

/** Stage buttons: New → Reject / Accept; Preparing → MARK READY; Ready → info strip. */
export function OrderActions({ order, onAccept, onReject }: { order: Order; onAccept: () => void; onReject: () => void }) {
  const { busy, markReady } = useStore();
  const b = busy[order.id];
  if (order.stage === 'new') {
    return (
      <View style={styles.actions}>
        <Button label="Reject" variant="rejectOutline" onPress={onReject} disabled={!!b} loading={b === 'reject'} style={{ flex: 1 }} />
        <Button label="Accept" variant="accept" icon="checkmark" onPress={onAccept} disabled={!!b} loading={b === 'accept'} style={{ flex: 2 }} />
      </View>
    );
  }
  if (order.stage === 'preparing') {
    return (
      <View style={{ gap: space.xs }}>
        <Button label="MARK READY" variant="primary" icon="bag-check" onPress={() => markReady(order)} disabled={!!b} loading={b === 'ready'} />
        <Button label="Reject order" variant="ghost" size="secondary" textColor={color.alert} onPress={onReject} disabled={!!b} />
      </View>
    );
  }
  if (order.stage === 'ready') {
    if (order.status === 'Picking') {
      return (
        <View style={{ gap: space.xs }}>
          <View style={styles.strip}><Text style={[type.body, { color: color.text, fontWeight: '700' }]}>Rider at store — hand over when packed</Text></View>
          {!order.readyAt ? (
            <Button label="Food packed — tell rider" variant="secondary" size="secondary" icon="bag-check" onPress={() => markReady(order)} disabled={!!b} loading={b === 'ready'} />
          ) : null}
        </View>
      );
    }
    return (
      <View style={styles.strip}>
        <Text style={[type.body, { color: color.text, fontWeight: '700' }]}>
          {order.deliveryPartnerId ? 'Packed · waiting for the rider' : 'Packed · waiting for a rider'}
        </Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  callout: { flexDirection: 'row', gap: space.xs, backgroundColor: color.warningTint, borderRadius: radius.md, padding: space.sm, borderWidth: 1, borderColor: color.cashBorder },
  rider: { flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: color.infoTint, borderRadius: radius.md, paddingLeft: space.sm, paddingRight: 4, minHeight: 52 },
  prep: { flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: color.surfaceAlt, borderRadius: radius.md, padding: space.xs },
  actions: { flexDirection: 'row', gap: space.sm },
  strip: { backgroundColor: color.openTint, borderRadius: radius.md, padding: space.sm, minHeight: 52, justifyContent: 'center' },
});
