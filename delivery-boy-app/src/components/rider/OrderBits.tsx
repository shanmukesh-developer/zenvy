import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { color, radius, space, type } from '../../theme/tokens';
import { Badge } from '../ui/Basics';
import { STEPS, stepIndex } from '../../services/orderModel';
import { rupees, km } from '../../services/format';
import { haversineKm, Fix } from '../../services/location';
import type { RiderOrder } from '../../types';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** "Cash order ₹X" / "Prepaid". Nothing when the server did not send a payment method. */
export function PaymentChip({ order }: { order: RiderOrder }) {
  if (order.paymentMethod === 'COD') {
    const amt = order.amountToCollect ?? order.finalPrice;
    if (order.amountToCollect === 0) return <Badge tone="prepaid" icon="check-decagram" label="Paid: no cash" />;
    return <Badge tone="cash" icon="cash" label={amt ? `Collect ${rupees(amt)} cash` : 'Cash on delivery'} />;
  }
  if (order.paymentMethod) return <Badge tone="prepaid" icon="check-decagram" label={`Prepaid (${order.paymentMethod})`} />;
  return null;
}

/** Drop-step money instruction for the rider. */
export function CollectCashBanner({ order }: { order: RiderOrder }) {
  if (order.paymentMethod === 'COD' && (order.amountToCollect ?? 0) > 0) {
    return (
      <View style={[styles.cash, { backgroundColor: color.cashTint, borderColor: color.cashBorder }]} accessibilityRole="alert">
        <MaterialCommunityIcons name="cash-multiple" size={32} color={color.cash} />
        <View style={{ flex: 1 }}>
          <Text style={[type.label, { color: color.cash }]}>CASH ON DELIVERY</Text>
          <Text style={[type.title1, { color: color.cash }]}>Collect {rupees(order.amountToCollect)} cash</Text>
        </View>
      </View>
    );
  }
  if (order.paymentMethod === 'COD') {
    return (
      <View style={[styles.cash, { backgroundColor: color.prepaidTint, borderColor: color.prepaidTint }]}>
        <MaterialCommunityIcons name="check-decagram" size={28} color={color.prepaid} />
        <Text style={[type.title3, { color: color.prepaid, flex: 1 }]}>Already paid: don't collect cash</Text>
      </View>
    );
  }
  if (order.paymentMethod) {
    return (
      <View style={[styles.cash, { backgroundColor: color.prepaidTint, borderColor: color.prepaidTint }]}>
        <MaterialCommunityIcons name="wallet-outline" size={28} color={color.prepaid} />
        <Text style={[type.title3, { color: color.prepaid, flex: 1 }]}>
          Prepaid ({order.paymentMethod === 'Wallet' ? 'Wallet' : order.paymentMethod}): don't collect cash
        </Text>
      </View>
    );
  }
  return null;
}

/** Store → drop with the current destination highlighted. */
export function RouteBlock({ order, focus }: { order: RiderOrder; focus: 'store' | 'drop' | 'none' }) {
  return (
    <View style={styles.route}>
      <RouteStop
        icon="storefront-outline"
        label="Pick up"
        title={order.restaurantName ?? 'Store'}
        sub={order.restaurantAddress}
        active={focus === 'store'}
        done={focus === 'drop'}
      />
      <View style={styles.routeLine} />
      <RouteStop
        icon="map-marker-outline"
        label="Drop"
        title={order.dropAddress ?? '—'}
        sub={order.customerName}
        active={focus === 'drop'}
      />
    </View>
  );
}

function RouteStop({ icon, label, title, sub, active, done }: { icon: IconName; label: string; title: string; sub?: string | null; active?: boolean; done?: boolean }) {
  return (
    <View style={styles.stop}>
      <View style={[styles.stopIcon, active && { backgroundColor: color.text }, done && { backgroundColor: color.onlineTint }]}>
        <MaterialCommunityIcons name={done ? 'check' : icon} size={20} color={active ? color.textInverse : done ? color.onlineDark : color.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.label, { color: color.textMuted }]}>{label}</Text>
        <Text style={[active ? type.title2 : type.title3, { color: done ? color.textMuted : color.text }]}>{title}</Text>
        {sub ? <Text style={[type.bodySm, { color: color.textSecondary }]}>{sub}</Text> : null}
      </View>
    </View>
  );
}

export function ContactBar({ actions }: { actions: { icon: IconName; label: string; onPress: () => void; tone?: 'primary' | 'default' }[] }) {
  if (!actions.length) return null;
  return (
    <View style={styles.contactBar}>
      {actions.map((a) => (
        <Pressable
          key={a.label}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          onPress={a.onPress}
          style={({ pressed }) => [
            styles.contact,
            a.tone === 'primary' && { backgroundColor: color.info, borderColor: color.info },
            pressed && { opacity: 0.8 },
          ]}
        >
          <MaterialCommunityIcons name={a.icon} size={24} color={a.tone === 'primary' ? color.textInverse : color.text} />
          <Text style={[type.label, { color: a.tone === 'primary' ? color.textInverse : color.text }]} numberOfLines={1}>
            {a.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function ItemChecklist({ order, ticked, onToggle }: { order: RiderOrder; ticked: Set<number>; onToggle: (i: number) => void }) {
  return (
    <View style={{ gap: space.xs }}>
      {order.items.map((it, i) => {
        const on = ticked.has(i);
        return (
          <Pressable
            key={i}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${it.quantity} times ${it.name}`}
            onPress={() => onToggle(i)}
            style={[styles.checkRow, on && { backgroundColor: color.onlineTint, borderColor: color.online }]}
          >
            <MaterialCommunityIcons name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={28} color={on ? color.onlineDark : color.textSecondary} />
            <Text style={[type.title3, { color: color.text, minWidth: 36 }]}>{it.quantity}×</Text>
            <Text style={[type.body, { color: color.text, flex: 1 }]}>{it.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ItemsSummary({ order }: { order: RiderOrder }) {
  if (!order.items.length) return null;
  return (
    <View style={{ gap: 4 }}>
      {order.items.map((it, i) => (
        <Text key={i} style={[type.body, { color: color.textSecondary }]}>
          <Text style={{ fontWeight: '800', color: color.text }}>{it.quantity}× </Text>
          {it.name}
        </Text>
      ))}
    </View>
  );
}

export function InstructionsList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <View style={styles.instructions}>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <MaterialCommunityIcons name="note-text-outline" size={20} color={color.info} />
        <Text style={[type.label, { color: color.info }]}>CUSTOMER NOTES</Text>
      </View>
      {items.map((s, i) => (
        <Text key={i} style={[type.body, { color: color.text }]}>
          • {s}
        </Text>
      ))}
    </View>
  );
}

export function StepHeader({ order, syncing }: { order: RiderOrder; syncing?: boolean }) {
  const idx = stepIndex(order.status);
  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {STEPS.map((s, i) => (
          <View key={s.key} style={[styles.dot, { backgroundColor: i <= idx ? color.online : color.border }]} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' }}>
        <Text style={[type.label, { color: color.textMuted }]}>
          STEP {idx + 1} OF {STEPS.length}
        </Text>
        {syncing ? <Badge tone="warning" icon="clock-outline" label="Waiting to sync" /> : null}
      </View>
    </View>
  );
}

/** Real distances only: GPS→store (both known) and store→drop (server value). */
export function DistanceLine({ order, fix }: { order: RiderOrder; fix: Fix | null }) {
  const toStore = fix && order.pickupCoords ? haversineKm(fix, order.pickupCoords) : null;
  const parts: string[] = [];
  if (toStore !== null) parts.push(`${km(toStore)} to store`);
  if (order.distanceKm !== null) parts.push(`${km(order.distanceKm)} trip`);
  if (!parts.length) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <MaterialCommunityIcons name="map-marker-distance" size={18} color={color.textSecondary} />
      <Text style={[type.bodySm, { color: color.textSecondary }]}>{parts.join(' · ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cash: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.lg, borderWidth: 2 },
  route: { gap: 0 },
  routeLine: { width: 2, height: 18, backgroundColor: color.border, marginLeft: 19 },
  stop: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  stopIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  contactBar: { flexDirection: 'row', gap: space.xs },
  contact: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  instructions: { gap: 6, padding: space.md, borderRadius: radius.md, backgroundColor: color.infoTint },
  dot: { flex: 1, height: 6, borderRadius: 3 },
});
