/**
 * First-order feedback box (owner, 27 Nov 2026). After a customer's first delivered order, Home asks once how it went:
 * stars + a few words sent to ZenWe (Admin > App feedback). Sending it earns +30 ZenWe Points (once, credited by the
 * server: backend/routes/feedbackRoutes.js). "Maybe later" hides it until their next delivered order (at most twice).
 *
 * "Rate ZenWe on Play Store" is a separate button with NO reward: Google Play does not allow rewarding store reviews,
 * and everyone sees it whatever stars they gave (asking only happy customers is not allowed either). It opens Google's
 * in-app review card (expo-store-review) when the phone can show it, else the Play Store page.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';
import { useAuth } from '../context/AuthContext';
import { apiFetch, readJson } from '../utils/auth';
import { useDietLight } from './local/dietLightTheme';
import { useLaunchSettled } from '../utils/introGate';

// Owner, 27 Nov 2026: no yellow / navy - the app's Veg / Non-veg accent (useDietLight) for the button and tick.
const NAVY = '#111827'; // dark text
// Owner, 27 Nov 2026: the box is mostly white (card, field, Play Store panel, icon circle) with light grey edges;
// the Veg / Non-veg accent on the Send button and the tick.
const LINE = '#E6E8EC';
const PACKAGE = (Constants.expoConfig as any)?.android?.package || 'com.srm.hostelbites';
const APP_VERSION = String((Constants.expoConfig as any)?.version || '');
const STAR_WORDS = ['', 'Bad', 'Not great', 'Okay', 'Good', 'Loved it'];

/** Google's in-app review card when the phone supports it, else the Play Store listing. Never rewarded. */
export async function openPlayStoreReview() {
  try {
    if (Platform.OS !== 'web' && (await StoreReview.isAvailableAsync()) && (await StoreReview.hasAction())) {
      await StoreReview.requestReview();
      return;
    }
  } catch { /* fall through to the listing */ }
  const web = `https://play.google.com/store/apps/details?id=${PACKAGE}`;
  if (Platform.OS === 'android') Linking.openURL(`market://details?id=${PACKAGE}`).catch(() => Linking.openURL(web).catch(() => {}));
  else Linking.openURL(web).catch(() => {});
}

type Step = 'ask' | 'thanks';

function FirstOrderFeedbackBox({ visible, points, onClose, onSent }: { visible: boolean; points: number; onClose: (dismissed: boolean) => void; onSent: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [step, setStep] = useState<Step>('ask');
  const [busy, setBusy] = useState(false);
  const [earned, setEarned] = useState(0);
  const [error, setError] = useState('');
  const d = useDietLight();

  useEffect(() => { if (visible) { setRating(0); setComment(''); setStep('ask'); setBusy(false); setEarned(0); setError(''); } }, [visible]);

  const send = async () => {
    if (!rating || busy) return;
    setBusy(true); setError('');
    try {
      const res = await apiFetch('/api/feedback/first-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim(), platform: Platform.OS, appVersion: APP_VERSION }),
      });
      const data = await readJson(res);
      if (!res.ok) { setError((data && data.message) || 'Could not send it. Please try again.'); setBusy(false); return; }
      setEarned(Number(data && data.pointsAwarded) || 0);
      setStep('thanks');
      onSent();
    } catch {
      setError('Could not send it. Check your connection and try again.');
    }
    setBusy(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onClose(step === 'ask')} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.backdrop}>
        <View style={st.card} accessibilityViewIsModal>
          {step === 'ask' ? (
            <>
              <View style={st.badge}><Ionicons name="chatbubble-ellipses" size={26} color={d.acc} /></View>
              <Text style={st.title} accessibilityRole="header">How was your first ZenWe order?</Text>
              <Text style={st.sub}>Tell us how it went and get <Text style={st.bold}>+{points} ZenWe Points</Text>.</Text>

              <View style={st.stars} accessibilityRole="radiogroup" accessibilityLabel="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setRating(n)} hitSlop={6} accessibilityRole="radio" accessibilityState={{ selected: rating === n }} accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}>
                    <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={36} color={n <= rating ? '#F5B301' : '#CBD0D8'} />
                  </Pressable>
                ))}
              </View>
              <Text style={st.starWord}>{rating ? STAR_WORDS[rating] : 'Tap a star'}</Text>

              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="What did you like? What should we fix? (optional)"
                placeholderTextColor="#9AA0AA"
                multiline
                maxLength={1000}
                style={st.input}
                accessibilityLabel="Your feedback"
              />
              {!!error && <Text style={st.error}>{error}</Text>}

              <Pressable onPress={send} disabled={!rating || busy} style={[st.primary, { backgroundColor: d.acc, borderColor: d.acc }, (!rating || busy) && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel={`Send feedback and get ${points} ZenWe Points`}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={st.primaryTxt}>Send feedback · +{points} points</Text>}
              </Pressable>
              <Pressable onPress={() => onClose(true)} style={st.later} accessibilityRole="button"><Text style={st.laterTxt}>Maybe later</Text></Pressable>
            </>
          ) : (
            <>
              <View style={[st.badge, { backgroundColor: d.soft, borderColor: d.acc }]}><Ionicons name="checkmark" size={30} color={d.acc} /></View>
              <Text style={st.title} accessibilityRole="header">Thank you!</Text>
              <Text style={st.sub}>{earned > 0 ? <>We added <Text style={st.bold}>{earned} ZenWe Points</Text> to your account.</> : 'We got your feedback.'}</Text>
              <View style={st.playBox}>
                <Text style={st.playTitle}>Enjoying ZenWe?</Text>
                <Text style={st.playSub}>A review on the Play Store helps other students find us.</Text>
                <Pressable onPress={() => { openPlayStoreReview(); }} style={st.play} accessibilityRole="button" accessibilityLabel="Rate ZenWe on the Play Store">
                  <Ionicons name="logo-google-playstore" size={17} color="#FFFFFF" />
                  <Text style={st.playTxt}>Rate ZenWe on Play Store</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => onClose(false)} style={st.later} accessibilityRole="button"><Text style={st.laterTxt}>Done</Text></Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Home's hook: asks the server whether to show the box (signed in, a delivered order, not sent yet, not dismissed
 * since the last delivery), at most once per Home visit, after a short pause so it never fights the intro or the
 * spin popup. `paused` holds it back (search open, another popup on screen).
 */
export function useFirstOrderFeedback(active: boolean, paused: boolean) {
  const { user, refreshUser } = useAuth() as any;
  const [state, setState] = useState<{ show: boolean; points: number }>({ show: false, points: 30 });
  const checking = useRef(false);
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    if (!user || checking.current) return;
    if (Date.now() - lastCheck.current < 60_000) return; // one check a minute is plenty
    checking.current = true; lastCheck.current = Date.now();
    try {
      const res = await apiFetch('/api/feedback/first-order', { noWakeRetry: true } as any);
      const data = await readJson(res);
      if (res.ok && data && data.show) setState({ show: true, points: Number(data.points) || 30 });
    } catch { /* quiet: it asks again next visit */ }
    checking.current = false;
  }, [user]);

  // Only once the app is fully on screen: intro finished and the full-screen store ad closed (or not shown), then
  // a few seconds on Home (owner, 27 Nov 2026: it used to appear while the app was still starting).
  const launchSettled = useLaunchSettled();
  useEffect(() => {
    if (!active || paused || !user || !launchSettled) return;
    const t = setTimeout(() => { check(); }, 3500);
    return () => clearTimeout(t);
  }, [active, paused, user, launchSettled, check]);

  const close = useCallback((dismissed: boolean) => {
    setState((s) => ({ ...s, show: false }));
    if (dismissed) apiFetch('/api/feedback/first-order/dismiss', { method: 'POST' }).catch(() => {});
  }, []);

  const element = (
    <FirstOrderFeedbackBox
      visible={state.show && !paused}
      points={state.points}
      onClose={close}
      onSent={() => { refreshUser?.().catch?.(() => {}); }}
    />
  );
  return { element };
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,20,30,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: LINE, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  badge: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: LINE },
  title: { color: NAVY, fontSize: 19, fontWeight: '900', textAlign: 'center', marginTop: 12 },
  sub: { color: '#4B5160', fontSize: 13.5, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  bold: { color: NAVY, fontWeight: '800' },
  stars: { flexDirection: 'row', gap: 8, marginTop: 16 },
  starWord: { color: NAVY, fontSize: 12.5, fontWeight: '700', marginTop: 6, minHeight: 16 },
  input: { alignSelf: 'stretch', minHeight: 84, maxHeight: 140, marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: LINE, backgroundColor: '#FFFFFF', padding: 12, fontSize: 14, color: '#1F2937', textAlignVertical: 'top' },
  error: { color: '#B42318', fontSize: 12.5, marginTop: 8, textAlign: 'center' },
  primary: { alignSelf: 'stretch', height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 14, borderWidth: 1 },
  primaryTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  later: { paddingVertical: 12, paddingHorizontal: 20 },
  laterTxt: { color: '#6B7280', fontSize: 13.5, fontWeight: '700' },
  playBox: { alignSelf: 'stretch', marginTop: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, padding: 14, alignItems: 'center' },
  playTitle: { color: NAVY, fontSize: 14.5, fontWeight: '800' },
  playSub: { color: '#4B5160', fontSize: 12.5, textAlign: 'center', marginTop: 3 },
  play: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, height: 42, paddingHorizontal: 18, borderRadius: 12, backgroundColor: NAVY },
  playTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
