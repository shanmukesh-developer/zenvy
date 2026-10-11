import React, { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, Vibration, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../constants/api';
import { Button, Card, Sheet } from '../components/ui';
import { formatHHMM } from '../services/orderModel';
import { playTestAlert } from '../services/voiceAlert';
import { useSession } from '../state/SessionProvider';
import { useStore } from '../state/StoreProvider';
import { color, space, touch, type } from '../theme/tokens';

function LinkRow({ icon, label, sub, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={24} color={color.text} />
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: color.text, fontWeight: '700' }]}>{label}</Text>
        {sub ? <Text style={[type.bodySm, { color: color.textMuted }]}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={color.textMuted} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const { restaurant, store, soundOn, setSoundOn } = useStore();
  const { signOut } = useSession();
  const [confirmOut, setConfirmOut] = useState(false);
  const hours = store?.operatingHours || restaurant.operatingHours || null;
  const name = store?.name || restaurant.name;
  const location = store?.location || restaurant.location;

  const wa = () => {
    const text = encodeURIComponent(`Restaurant ${name} (${restaurant.id}) needs help`);
    Linking.openURL(`https://wa.me/${SUPPORT_PHONE}?text=${text}`).catch(() => {});
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xxl * 2 }}>
      <Card style={{ gap: 4 }}>
        <Text style={[type.title2, { color: color.text }]}>{name}</Text>
        {location ? <Text style={[type.body, { color: color.textSecondary }]}>{location}</Text> : null}
        <Text style={[type.body, { color: color.textSecondary }]}>
          Hours: {hours?.start && hours?.end && hours.start !== hours.end ? `${formatHHMM(hours.start)} – ${formatHHMM(hours.end)}` : 'Open all day'}
        </Text>
        <Text style={[type.bodySm, { color: color.textMuted }]} selectable>Restaurant ID: {restaurant.id}</Text>
      </Card>

      <Text style={[type.label, { color: color.textMuted }]}>ALERTS</Text>
      <Card style={{ gap: space.sm }}>
        <View style={styles.row}>
          <Ionicons name={soundOn ? 'volume-high' : 'volume-mute'} size={24} color={soundOn ? color.text : color.alert} />
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { color: color.text, fontWeight: '700' }]}>Order sound</Text>
            <Text style={[type.bodySm, { color: soundOn ? color.textMuted : color.alert }]}>
              {soundOn ? 'Rings and vibrates until you accept or reject' : 'OFF — new orders will not ring'}
            </Text>
          </View>
          <Switch
            value={soundOn}
            onValueChange={setSoundOn}
            accessibilityLabel="Order sound"
            trackColor={{ true: color.open, false: color.border }}
            thumbColor={color.surface}
            style={{ transform: [{ scale: 1.2 }] }}
          />
        </View>
        <Button
          label="Test alert sound"
          icon="musical-notes"
          variant="secondary"
          size="secondary"
          onPress={() => {
            if (Platform.OS !== 'web') Vibration.vibrate([0, 500, 200, 500]);
            playTestAlert();
          }}
        />
        <Text style={[type.bodySm, { color: color.textMuted }]}>
          Tip: keep the app open on the Orders screen with the volume up. Keep the phone charging during service.
        </Text>
      </Card>

      <Text style={[type.label, { color: color.textMuted }]}>SUPPORT</Text>
      <Card style={{ paddingVertical: 0 }}>
        <LinkRow icon="call" label="Call Zenvy partner support" sub={SUPPORT_PHONE_DISPLAY} onPress={() => Linking.openURL(`tel:+${SUPPORT_PHONE}`).catch(() => {})} />
        <View style={{ height: 1, backgroundColor: color.surfaceAlt }} />
        <LinkRow icon="logo-whatsapp" label="WhatsApp support" sub="Menu changes, payouts, hours, anything else" onPress={wa} />
      </Card>

      <Button label="Log out" icon="log-out-outline" variant="rejectOutline" size="secondary" onPress={() => setConfirmOut(true)} />

      <Sheet visible={confirmOut} onClose={() => setConfirmOut(false)} title="Log out?">
        <Text style={[type.body, { color: color.textSecondary, marginBottom: space.md }]}>
          New orders will not ring on this phone after you log out.
        </Text>
        <View style={{ gap: space.xs }}>
          <Button label="Log out" variant="reject" onPress={() => { setConfirmOut(false); signOut(); }} />
          <Button label="Cancel" variant="secondary" size="secondary" onPress={() => setConfirmOut(false)} />
        </View>
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch.secondary + 8 },
});
