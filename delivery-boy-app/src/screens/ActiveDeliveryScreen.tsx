// One order as a step flow: Go to store → Pick up → Go to customer → Hand over (PIN) → Delivered.
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { color, radius, space, type } from '../theme/tokens';
import { Badge, Card, Row } from '../components/ui/Basics';
import { IconButton, PrimaryButton, SecondaryButton } from '../components/ui/Buttons';
import { Sheet } from '../components/ui/Sheet';
import { PinPad } from '../components/ui/PinPad';
import { BOTTOM_INSET } from '../components/ui/insets';
import {
  CollectCashBanner,
  ContactBar,
  DistanceLine,
  InstructionsList,
  ItemChecklist,
  ItemsSummary,
  PaymentChip,
  RouteBlock,
  StepHeader,
} from '../components/rider/OrderBits';
import { useRider } from '../state/RiderProvider';
import { canUnassign, firstName, isDialable, STEPS, stepFor, stepIndex, storeStatusLabel } from '../services/orderModel';
import * as links from '../services/links';
import { rupees } from '../services/format';
import type { RiderOrder } from '../types';

// Item ticks survive leaving and re-opening the screen (memory only).
const tickStore = new Map<string, Set<number>>();

export function ActiveDeliveryScreen({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const r = useRider();
  const live = r.active.data.find((o) => o.id === orderId) ?? null;
  const snapshot = useRef<RiderOrder | null>(live);
  if (live) snapshot.current = live;

  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [done, setDone] = useState<{ earning: number | null; cash: number | null; order: RiderOrder } | null>(null);
  const [ticked, setTicked] = useState<Set<number>>(() => tickStore.get(orderId) ?? new Set());
  const [confirmUnticked, setConfirmUnticked] = useState(false);
  const [menu, setMenu] = useState(false);
  const [unassignOpen, setUnassignOpen] = useState(false);

  // Order vanished (cancelled / released) and we did not just deliver it: leave.
  useEffect(() => {
    if (!live && !done && r.active.loaded) onClose();
  }, [live, done, r.active.loaded, onClose]);

  const order = live ?? done?.order ?? snapshot.current;
  if (!order) return null;

  const step = stepFor(order.status);
  const syncing = r.syncPendingIds.has(order.id);
  const isLocked = locked || order.pinLocked;
  const custName = firstName(order.customerName);
  const others = r.active.data.filter((o) => o.id !== order.id);

  const toggleTick = (i: number) => {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      tickStore.set(order.id, next);
      return next;
    });
  };

  const runAdvance = async () => {
    setBusy(true);
    try {
      await r.advance(order);
    } finally {
      setBusy(false);
    }
  };

  const runDeliver = async () => {
    setBusy(true);
    setPinMsg(null);
    try {
      const res = await r.deliver(order, pin);
      if (res.ok) {
        tickStore.delete(order.id);
        setDone({ earning: res.earning, cash: res.cash, order });
        return;
      }
      if (res.kind === 'invalid') {
        setShakeKey((k) => k + 1);
        setPin('');
        setPinMsg(res.attemptsLeft !== null ? `Wrong PIN. ${res.attemptsLeft} ${res.attemptsLeft === 1 ? 'try' : 'tries'} left.` : res.message);
      } else if (res.kind === 'locked') {
        setLocked(true);
        setPinMsg(res.message);
      } else {
        setPinMsg(res.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const callCustomer = order.customerPhone ? () => links.call(order.customerPhone) : null;
  const callStore = isDialable(order.restaurantPhone) ? () => links.call(order.restaurantPhone) : null;
  const helpPrefill = `Order #${order.shortId}: `;

  // ── Step content + primary action ────────────────────────────────────────
  let title = STEPS[stepIndex(order.status)].title;
  let body: React.ReactNode = null;
  let primary: React.ReactNode = null;

  if (step === 'TO_STORE') {
    const storeChip = storeStatusLabel(order.status);
    body = (
      <>
        <RouteBlock order={order} focus="store" />
        <View style={styles.chips}>
          {storeChip ? <Badge tone={order.status === 'ReadyForPickup' ? 'online' : 'info'} label={storeChip} /> : null}
          <PaymentChip order={order} />
        </View>
        <DistanceLine order={order} fix={r.fix} />
        <ContactBar
          actions={[
            { icon: 'navigation-variant', label: 'Navigate', tone: 'primary', onPress: () => navigate(order, 'store', r.showToast) },
            ...(callStore ? [{ icon: 'phone' as const, label: 'Call store', onPress: callStore }] : []),
          ]}
        />
        <Card style={{ gap: space.xs }}>
          <Text style={[type.label, { color: color.textMuted }]}>ITEMS TO COLLECT</Text>
          <ItemsSummary order={order} />
        </Card>
      </>
    );
    primary = <PrimaryButton title="Arrived at store" icon="storefront-check-outline" loading={busy} onPress={runAdvance} />;
  } else if (step === 'AT_STORE') {
    const allTicked = order.items.length === 0 || ticked.size >= order.items.length;
    body = (
      <>
        <View style={{ gap: 2 }}>
          <Text style={[type.title2, { color: color.text }]}>{order.restaurantName ?? 'Store'}</Text>
          <Text style={[type.body, { color: color.textSecondary }]}>Check every item before you leave the store.</Text>
        </View>
        <ItemChecklist order={order} ticked={ticked} onToggle={toggleTick} />
        <InstructionsList items={order.instructions} />
        {callStore ? <ContactBar actions={[{ icon: 'phone', label: 'Call store', onPress: callStore }]} /> : null}
      </>
    );
    primary = (
      <PrimaryButton
        title="Picked up"
        icon="package-variant-closed-check"
        loading={busy}
        onPress={() => (allTicked ? runAdvance() : setConfirmUnticked(true))}
      />
    );
  } else if (step === 'TO_DROP') {
    body = (
      <>
        <RouteBlock order={order} focus="drop" />
        <InstructionsList items={order.instructions} />
        <ContactBar
          actions={[
            { icon: 'navigation-variant', label: 'Navigate', tone: 'primary', onPress: () => navigate(order, 'drop', r.showToast) },
            ...(callCustomer ? [{ icon: 'phone' as const, label: 'Call customer', onPress: callCustomer }] : []),
          ]}
        />
        <CollectCashBanner order={order} />
      </>
    );
    primary = <PrimaryButton title="Arrived at drop" icon="map-marker-check-outline" loading={busy} onPress={runAdvance} />;
  } else if (step === 'AT_DROP') {
    title = 'Hand over';
    const pinNeeded = order.hasDeliveryPin;
    body = (
      <>
        <CollectCashBanner order={order} />
        {isLocked ? (
          <Card style={{ gap: space.sm, borderWidth: 2, borderColor: color.danger }}>
            <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center' }}>
              <MaterialCommunityIcons name="lock-alert" size={28} color={color.danger} />
              <Text style={[type.title3, { color: color.danger, flex: 1 }]}>PIN locked: contact support</Text>
            </View>
            <Text style={[type.body, { color: color.textSecondary }]}>
              {pinMsg || 'Too many wrong PINs. Zenvy support can complete this delivery for you.'}
            </Text>
            <PrimaryButton
              title="Raise ticket"
              icon="lifebuoy"
              size="lg"
              onPress={() => r.setOverlay({ kind: 'support', prefill: `${helpPrefill}delivery PIN locked at handover.` })}
            />
            {callCustomer ? <SecondaryButton title="Call customer" icon="phone" onPress={callCustomer} /> : null}
          </Card>
        ) : pinNeeded ? (
          <>
            <Text style={[type.title3, { color: color.text, textAlign: 'center' }]}>
              Ask {custName ?? 'the customer'} for the 4-digit PIN in their Zenvy app
            </Text>
            <PinPad value={pin} onChange={(v) => { setPin(v); setPinMsg(null); }} shakeKey={shakeKey} disabled={busy} />
            {pinMsg ? (
              <Text style={[type.body, { color: color.danger, textAlign: 'center', fontWeight: '700' }]} accessibilityRole="alert">
                {pinMsg}
              </Text>
            ) : null}
          </>
        ) : (
          <Card>
            <Text style={[type.body, { color: color.text }]}>This order has no delivery PIN. Hand it over to {custName ?? 'the customer'}.</Text>
          </Card>
        )}
        <ContactBar
          actions={[
            ...(callCustomer ? [{ icon: 'phone' as const, label: 'Call', onPress: callCustomer }] : []),
            ...(order.customerPhone
              ? [{ icon: 'whatsapp' as const, label: 'WhatsApp', onPress: () => links.whatsapp(order.customerPhone, `Hi${custName ? ' ' + custName : ''}, your Zenvy rider is here with your order. Please share the 4-digit delivery PIN from your Zenvy app.`) }]
              : []),
            { icon: 'navigation-variant', label: 'Navigate', onPress: () => navigate(order, 'drop', r.showToast) },
          ]}
        />
      </>
    );
    if (!isLocked) {
      primary = (
        <PrimaryButton
          title={!r.connected ? 'Connect to the internet to verify the PIN' : 'Deliver'}
          icon={r.connected ? 'check-bold' : 'wifi-off'}
          variant="online"
          loading={busy}
          disabled={!r.connected || (pinNeeded && pin.length !== 4)}
          onPress={runDeliver}
        />
      );
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <IconButton icon="arrow-left" onPress={onClose} accessibilityLabel="Back" />
        <View style={{ flex: 1 }}>
          <Text style={[type.label, { color: color.textMuted }]}>ORDER #{order.shortId}</Text>
          <Text style={[type.title2, { color: color.text }]}>{title}</Text>
        </View>
        <IconButton icon="dots-vertical" onPress={() => setMenu(true)} accessibilityLabel="More options" />
      </View>
      <View style={{ paddingHorizontal: space.md }}>
        <StepHeader order={order} syncing={syncing} />
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {body}
        {order.earning !== null ? (
          <Text style={[type.bodySm, { color: color.textMuted }]}>You earn {rupees(order.earning)} for this order.</Text>
        ) : null}
      </ScrollView>
      {primary ? <View style={styles.footer}>{primary}</View> : null}

      {/* Not every item ticked */}
      <Sheet visible={confirmUnticked} onClose={() => setConfirmUnticked(false)} title="Not all items ticked">
        <Text style={[type.body, { color: color.textSecondary }]}>Picked up anyway? Make sure nothing is missing from the bag.</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <SecondaryButton title="Check again" onPress={() => setConfirmUnticked(false)} style={{ flex: 1 }} />
          <PrimaryButton
            title="Picked up"
            size="lg"
            onPress={() => {
              setConfirmUnticked(false);
              runAdvance();
            }}
            style={{ flex: 1 }}
          />
        </View>
      </Sheet>

      {/* Overflow menu */}
      <Sheet visible={menu} onClose={() => setMenu(false)} title={`Order #${order.shortId}`}>
        {canUnassign(order.status) ? (
          <Row
            icon="close-circle-outline"
            label="Can't do this order"
            value="Give it back so another rider can take it"
            tint={color.danger}
            onPress={() => {
              setMenu(false);
              setUnassignOpen(true);
            }}
          />
        ) : null}
        <Row
          icon="lifebuoy"
          label="Get help"
          value="Raise a ticket with Zenvy support"
          onPress={() => {
            setMenu(false);
            r.setOverlay({ kind: 'support', prefill: helpPrefill });
          }}
        />
        <Row
          icon="share-variant-outline"
          label="Share order ID"
          value={order.id}
          onPress={() => {
            setMenu(false);
            Share.share({ message: `Zenvy order #${order.shortId} (${order.id})` }).catch(() => {});
          }}
        />
      </Sheet>

      {/* Unassign */}
      <Sheet visible={unassignOpen} onClose={() => setUnassignOpen(false)} title="Can't do this order?">
        <Text style={[type.body, { color: color.textSecondary }]}>
          The order goes back to other riders. Only do this if you really can't pick it up. Frequent drops may be reviewed by your fleet admin.
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <SecondaryButton title="Keep order" onPress={() => setUnassignOpen(false)} style={{ flex: 1 }} />
          <PrimaryButton
            title="Give back"
            variant="danger"
            size="lg"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              const ok = await r.unassign(order);
              setBusy(false);
              setUnassignOpen(false);
              if (ok) onClose();
            }}
            style={{ flex: 1 }}
          />
        </View>
      </Sheet>

      {/* Delivered */}
      <Sheet visible={!!done} onClose={onClose} blocking>
        {done ? (
          <View style={{ alignItems: 'center', gap: space.sm }}>
            <View style={styles.doneIcon}>
              <MaterialCommunityIcons name="check-bold" size={44} color={color.textInverse} />
            </View>
            <Text style={[type.title1, { color: color.text }]}>Delivered</Text>
            {done.earning !== null ? <Text style={[type.money, { color: color.onlineDark }]}>+{rupees(done.earning)}</Text> : null}
            {done.earning !== null ? <Text style={[type.body, { color: color.textSecondary }]}>earned for this order</Text> : null}
            {done.cash ? (
              <View style={styles.cashDone}>
                <MaterialCommunityIcons name="cash" size={22} color={color.cash} />
                <Text style={[type.title3, { color: color.cash }]}>Cash collected {rupees(done.cash)}</Text>
              </View>
            ) : null}
            <View style={{ alignSelf: 'stretch', gap: space.sm, marginTop: space.sm }}>
              {others.length ? (
                <PrimaryButton
                  title="Next order"
                  icon="arrow-right"
                  onPress={() => {
                    const next = others[0];
                    setDone(null);
                    r.openDelivery(next.id);
                  }}
                />
              ) : null}
              <SecondaryButton title="Back to home" icon="home-outline" onPress={onClose} />
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

function navigate(order: RiderOrder, to: 'store' | 'drop', toast: (t: string, k?: 'error') => void) {
  const dest = to === 'store' ? { coords: order.pickupCoords, address: order.restaurantAddress ?? order.restaurantName } : { address: order.dropAddress };
  links.openNavigation(dest).then((ok) => {
    if (!ok) toast('No address to navigate to. Call for directions.', 'error');
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, paddingBottom: space.sm },
  body: { padding: space.md, gap: space.md, paddingBottom: space.xxl },
  chips: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  footer: { padding: space.md, paddingBottom: BOTTOM_INSET + space.sm, backgroundColor: color.surface, borderTopWidth: 1, borderTopColor: color.border, gap: space.sm },
  doneIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: color.online, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  cashDone: { flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: color.cashTint, borderRadius: radius.md, padding: space.sm },
});
