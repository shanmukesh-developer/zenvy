// Sticky store header: name + the big Online / Offline switch, the connection banner and sound-off banner.
import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SUPPORT_PHONE } from '../constants/api';
import { clockIST, formatHHMM } from '../services/orderModel';
import { useStore } from '../state/StoreProvider';
import { color, radius, space, touch, type } from '../theme/tokens';
import { Button, Sheet } from './ui';

export function OpenToggle() {
  const { store, openToggleSupported, setOpen } = useStore();
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [readOnlyInfo, setReadOnlyInfo] = useState(false);

  if (!store) {
    return <View style={[styles.pill, { backgroundColor: color.surfaceAlt }]}><ActivityIndicator color={color.textMuted} /></View>;
  }
  const switchedOn = store.isOpenNow;
  const live = store.isOpen;
  const bg = live ? color.open : color.closed;

  const change = async (open: boolean) => {
    setSaving(true);
    await setOpen(open);
    setSaving(false);
    setConfirm(false);
  };

  const onPress = () => {
    if (!openToggleSupported) { setReadOnlyInfo(true); return; }
    if (switchedOn) setConfirm(true);
    else change(true);
  };

  return (
    <>
      <Pressable
        onPress={onPress}
        disabled={saving}
        accessibilityRole="switch"
        accessibilityState={{ checked: switchedOn, busy: saving }}
        accessibilityLabel={live ? 'Store online, accepting orders. Tap to go offline' : 'Store offline. Tap to go online'}
        style={({ pressed }) => [styles.pill, { backgroundColor: bg }, pressed && { opacity: 0.85 }]}
      >
        {saving ? <ActivityIndicator color={color.textInverse} /> : (
          <>
            <Text style={[type.label, { color: color.textInverse }]}>{live ? 'ONLINE' : 'OFFLINE'}</Text>
            <View style={[styles.track, { alignItems: switchedOn ? 'flex-end' : 'flex-start' }]}>
              <View style={styles.knob} />
            </View>
          </>
        )}
      </Pressable>

      <Sheet visible={confirm} onClose={() => setConfirm(false)} title="Go offline?">
        <Text style={[type.body, { color: color.textSecondary, marginBottom: space.md }]}>
          Customers can't order until you open again. Orders already placed stay on your screen.
        </Text>
        <View style={{ gap: space.xs }}>
          <Button label="Go offline" variant="reject" onPress={() => change(false)} loading={saving} />
          <Button label="Stay online" variant="secondary" size="secondary" onPress={() => setConfirm(false)} />
        </View>
      </Sheet>

      <Sheet visible={readOnlyInfo} onClose={() => setReadOnlyInfo(false)} title="Store status">
        <Text style={[type.body, { color: color.textSecondary, marginBottom: space.md }]}>
          Changing your store status from the app is not available yet. Ask Zenvy support to change your hours.
        </Text>
        <Button label="Call Zenvy support" icon="call" variant="primary" onPress={() => Linking.openURL(`tel:+${SUPPORT_PHONE}`).catch(() => {})} />
      </Sheet>
    </>
  );
}

export function StoreHeader() {
  const insets = useSafeAreaInsets();
  const { restaurant, store } = useStore();
  const name = store?.name || restaurant.name;
  let statusLine = '';
  let statusColor: string = color.textMuted;
  if (store) {
    if (store.isOpen) {
      statusLine = 'Online — accepting orders';
      statusColor = color.openDark;
    } else {
      statusLine = store.isOpenNow
        ? `Closed — outside your hours${store.opensAt ? ` · Opens ${formatHHMM(store.opensAt)}` : ''}`
        : `Offline — you closed the store${store.opensAt ? ` · Hours start ${formatHHMM(store.opensAt)}` : ''}`;
      statusColor = color.closed;
    }
  }
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.xs }]}>
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={[type.title2, { color: color.text }]} numberOfLines={1}>{name}</Text>
          {statusLine ? <Text style={[type.bodySm, { color: statusColor, fontWeight: '700' }]} numberOfLines={2}>{statusLine}</Text> : null}
        </View>
        <OpenToggle />
      </View>
      {store?.isOffline ? (
        <View style={[styles.notice, { backgroundColor: color.infoTint }]}>
          <Ionicons name="information-circle" size={18} color={color.info} />
          <Text style={[type.bodySm, { color: color.info, flex: 1 }]}>Orders skip your kitchen (managed by Zenvy)</Text>
        </View>
      ) : null}
    </View>
  );
}

export function ConnectionBanner() {
  const { conn, retryConnection, lastSyncedAt } = useStore();
  if (conn === 'online') return null;
  if (conn === 'offline') {
    return (
      <View style={[styles.banner, { backgroundColor: color.alert }]} accessibilityLiveRegion="assertive">
        <Ionicons name="cloud-offline" size={22} color={color.textInverse} />
        <View style={{ flex: 1 }}>
          <Text style={[type.body, { color: color.textInverse, fontWeight: '800' }]}>You're offline — orders will NOT ring.</Text>
          <Text style={[type.bodySm, { color: color.textInverse }]}>
            Check internet.{lastSyncedAt ? ` Last updated ${clockIST(lastSyncedAt)}` : ''}
          </Text>
        </View>
        <Pressable onPress={retryConnection} accessibilityRole="button" accessibilityLabel="Retry connection" style={styles.retry}>
          <Text style={[type.label, { color: color.alertDark }]}>RETRY</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={[styles.banner, { backgroundColor: color.warningTint, borderBottomWidth: 1, borderBottomColor: color.cashBorder }]} accessibilityLiveRegion="polite">
      <ActivityIndicator color={color.warning} />
      <Text style={[type.body, { color: color.warning, fontWeight: '700', flex: 1 }]}>
        {conn === 'connecting' ? 'Connecting to Zenvy…' : 'Reconnecting… new orders may be delayed'}
      </Text>
    </View>
  );
}

export function SoundOffBanner({ onFix }: { onFix: () => void }) {
  const { soundOn } = useStore();
  if (soundOn) return null;
  return (
    <Pressable onPress={onFix} accessibilityRole="button" style={[styles.banner, { backgroundColor: color.alertTint }]}>
      <Ionicons name="volume-mute" size={22} color={color.alert} />
      <Text style={[type.body, { color: color.alertDark, fontWeight: '800', flex: 1 }]}>Order sound is OFF</Text>
      <Text style={[type.label, { color: color.alertDark }]}>TURN ON</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: color.surface, paddingHorizontal: space.md, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: color.border, gap: space.xs },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pill: { minWidth: 128, height: touch.icon + 4, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: space.sm, paddingRight: 6, gap: space.xs },
  track: { width: 52, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.35)', padding: 3, justifyContent: 'center' },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: color.surface },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.xs, borderRadius: radius.sm, padding: space.xs },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, minHeight: 52 },
  retry: { backgroundColor: color.surface, borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: touch.minHit, justifyContent: 'center' },
});
