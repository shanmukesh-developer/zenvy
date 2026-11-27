/**
 * After-delivery spin pop-up (owner, 25 Nov 2026; utils/spinProgress). Bottom sheet in the app's modal style
 * (diet light theme, like DeleteAccountModal / the rating sheet):
 *   - this delivery completed a group of 5: "You earned a free spin!" + "Spin now" (opens the wheel, app/deals/spin)
 *   - otherwise: "N more orders to earn a free spin" with a small 5-step progress row.
 * `useSpinProgressPopup()` gives the element to render and `check(orderId?)` to call when a delivery is seen.
 */
import React, { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useDietLight } from './local/dietLightTheme';
import { useLaunchSections } from '../utils/launchSections';
import { spinPopupDue, type SpinProgress } from '../utils/spinProgress';

export function SpinProgressPopup({ data, onClose }: { data: SpinProgress | null; onClose: () => void }) {
  const router = useRouter();
  const { colors } = useTheme();
  const d = useDietLight();
  if (!data) return null;
  const earned = data.justEarnedSpin && data.spinsAvailable > 0;
  const per = Math.max(1, data.ordersPerSpin);
  const done = earned ? per : Math.min(per - 1, Math.max(0, data.progress));
  const toNext = Math.max(1, data.toNext);
  const open = (path: string) => { onClose(); setTimeout(() => router.push(path as any), 50); };
  const title = earned ? 'You earned a free spin!' : `${toNext} more order${toNext === 1 ? '' : 's'} to earn a free spin`;
  const body = earned
    ? `That was your ${data.deliveredCount}th delivered order. Spin the wheel for ZenWe Points or free delivery.${data.spinsAvailable > 1 ? ` You have ${data.spinsAvailable} spins ready.` : ''}`
    : `Order delivered. Every ${per} delivered orders earn a free spin: food, groceries, stalls, campus pickups and laundry all count.${data.spinsAvailable > 0 ? ` You already have ${data.spinsAvailable} spin${data.spinsAvailable === 1 ? '' : 's'} ready.` : ''}`;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={[s.card, { backgroundColor: colors.card, borderColor: d.edge }]} onPress={() => {}}>
          <View style={[s.iconWell, { backgroundColor: d.soft }]}>
            <Ionicons name={earned ? 'gift' : 'sparkles-outline'} size={30} color={d.acc} />
          </View>
          <Text style={[s.title, { color: colors.text }]} accessibilityRole="header">{title}</Text>
          <Text style={[s.body, { color: colors.textSecondary }]}>{body}</Text>

          <View style={s.steps} accessibilityLabel={`${done} of ${per} orders to your next spin`}>
            {Array.from({ length: per }).map((_, i) => (
              <View key={i} style={[s.step, { backgroundColor: i < done ? d.acc : d.track }]} />
            ))}
          </View>
          <Text style={[s.stepsLabel, { color: colors.textSecondary }]}>
            {earned ? `${per} of ${per} orders: spin unlocked` : `${done} of ${per} orders to your next spin`}
          </Text>

          {earned ? (
            <TouchableOpacity style={[s.primary, { backgroundColor: d.acc }]} onPress={() => open('/deals/spin')} accessibilityRole="button">
              <Text style={[s.primaryText, { color: d.onAcc }]}>Spin now</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[s.primary, { backgroundColor: d.acc }]} onPress={onClose} accessibilityRole="button">
              <Text style={[s.primaryText, { color: d.onAcc }]}>Got it</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.secondary} onPress={() => (earned ? onClose() : open('/deals'))} accessibilityRole="button">
            <Text style={[s.secondaryText, { color: earned ? colors.textSecondary : d.acc }]}>{earned ? 'Later' : 'See Spin & deals'}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** The pop-up element plus `check(orderId?)`. `blocked` holds it back while another sheet (rating) is open. */
export function useSpinProgressPopup(blocked = false) {
  const { user } = useAuth();
  const launch = useLaunchSections();
  const [data, setData] = useState<SpinProgress | null>(null);
  const uid = String((user as any)?._id || (user as any)?.id || '');
  const uidRef = useRef(uid);
  uidRef.current = uid;
  const dealsOn = launch.on('deals');
  const check = useCallback(async (orderId?: string | null) => {
    // No spins while the admins have Deals & spin paused (the server refuses them too).
    if (!uidRef.current || !dealsOn) return;
    const p = await spinPopupDue(uidRef.current, orderId);
    if (p && uidRef.current) setData(p);
  }, [dealsOn]);
  const close = useCallback(() => setData(null), []);
  const element = <SpinProgressPopup data={blocked ? null : data} onClose={close} />;
  return { element, check, open: !!data };
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 22, paddingBottom: 34, alignItems: 'center' },
  iconWell: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 21, marginTop: 6, textAlign: 'center' },
  steps: { flexDirection: 'row', gap: 6, marginTop: 18, alignSelf: 'stretch' },
  step: { flex: 1, height: 8, borderRadius: 4 },
  stepsLabel: { fontSize: 12, fontWeight: '700', marginTop: 8 },
  primary: { alignSelf: 'stretch', borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  primaryText: { fontSize: 16, fontWeight: '800' },
  secondary: { alignItems: 'center', marginTop: 8, padding: 10 },
  secondaryText: { fontSize: 15, fontWeight: '700' },
});
