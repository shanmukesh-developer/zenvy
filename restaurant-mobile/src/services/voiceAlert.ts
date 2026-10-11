// Kitchen sound: the native Android foreground service (gitignored android/ folder, used when present)
// plus expo-speech / Web Speech fallbacks. Announcements are in Telugu, PhonePe-soundbox style.
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import * as Speech from 'expo-speech';

const KitchenServiceModule: any = (NativeModules as any).KitchenServiceModule;

export const hasNativeKitchenService = () => Platform.OS === 'android' && !!KitchenServiceModule?.speakOrder;

/** Keeps the process (and the socket) alive with the screen locked, on builds that include the native service. */
export const startKitchenForegroundService = async () => {
  if (Platform.OS !== 'android') return;
  try {
    if (Number(Platform.Version) >= 33) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    if (KitchenServiceModule?.startKitchenService) await KitchenServiceModule.startKitchenService();
  } catch (err) {
    console.warn('[KITCHEN_SERVICE_START_ERR]', err);
  }
};

export const stopKitchenForegroundService = async () => {
  if (Platform.OS !== 'android' || !KitchenServiceModule?.stopKitchenService) return;
  try {
    await KitchenServiceModule.stopKitchenService();
  } catch (err) {
    console.warn('[KITCHEN_SERVICE_STOP_ERR]', err);
  }
};

// Two-tone chime (web only; native relies on TTS + vibration + the service's notification sound).
const playWebChime = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const tone = (freq: number, start: number, end: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(vol, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + end);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + end);
    };
    tone(1046, 0, 0.16, 0.3);
    tone(1318, 0.14, 0.45, 0.35);
  } catch {
    // no audio
  }
};

let teluguVoiceId: string | undefined;
let voiceLooked = false;
async function teluguVoice(): Promise<string | undefined> {
  if (voiceLooked) return teluguVoiceId;
  voiceLooked = true;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    teluguVoiceId = voices.find((v) => v.language.toLowerCase().startsWith('te'))?.identifier;
  } catch {
    teluguVoiceId = undefined;
  }
  return teluguVoiceId;
}

async function speak(text: string) {
  if (Platform.OS === 'web') {
    playWebChime();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      u.lang = 'te-IN';
      const v = window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith('te'));
      if (v) u.voice = v;
      setTimeout(() => window.speechSynthesis.speak(u), 200);
    }
    return;
  }
  Speech.stop();
  Speech.speak(text, { language: 'te-IN', voice: await teluguVoice(), pitch: 1.02, rate: 0.9 });
}

export function stopSpeech() {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    } else {
      Speech.stop();
    }
  } catch {
    // ignore
  }
}

export function newOrderPhrase(order: { shortId?: string; totalPrice?: number } | null): string {
  const num = order?.shortId ? order.shortId.split('').join(' ') : '';
  const amount = order?.totalPrice ? Math.round(order.totalPrice) : 0;
  if (!num) return 'జెన్వీ లో కొత్త ఆర్డర్ వచ్చింది!';
  return amount
    ? `జెన్వీ లో ${amount} రూపాయల కొత్త ఆర్డర్ వచ్చింది! ఆర్డర్ నంబర్ ${num}.`
    : `జెన్వీ లో కొత్త ఆర్డర్ వచ్చింది! ఆర్డర్ నంబర్ ${num}.`;
}

/**
 * Announces a new order. With `native` (first ring, or in the background) the Android service shows a
 * heads-up notification, wakes the screen and speaks; otherwise expo-speech / Web Speech is used.
 */
export async function announceNewOrder(order: { shortId?: string; totalPrice?: number } | null, opts: { native?: boolean } = {}) {
  const text = newOrderPhrase(order);
  if (opts.native && hasNativeKitchenService()) {
    try {
      await KitchenServiceModule.speakOrder(text, order?.shortId || '', order?.totalPrice ? String(Math.round(order.totalPrice)) : '');
      return;
    } catch (err) {
      console.warn('[NATIVE_SPEAK_ERR]', err);
    }
  }
  try {
    await speak(text);
  } catch (err) {
    console.warn('[VOICE_ALERT_ERR]', err);
  }
}

/** Settings → "Test alert sound": a real non-order phrase (no fake order). */
export async function playTestAlert() {
  await speak('ఇది టెస్ట్ అలర్ట్. This is a test alert.');
}
