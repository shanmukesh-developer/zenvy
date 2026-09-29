import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import * as Speech from 'expo-speech';

const { KitchenServiceModule } = NativeModules;

/**
 * Starts the persistent Android Kitchen Foreground Service
 * Keeps WebSocket alive 24/7 so orders ring out loud even with screen locked or app closed!
 */
export const startKitchenForegroundService = async () => {
  if (Platform.OS === 'android') {
    try {
      if (Platform.Version >= 33) {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
      if (KitchenServiceModule?.startKitchenService) {
        await KitchenServiceModule.startKitchenService();
        console.log('✅ [KITCHEN_SERVICE] Foreground service started successfully');
      }
    } catch (err) {
      console.warn('[KITCHEN_SERVICE_START_ERR]', err);
    }
  }
};

export const stopKitchenForegroundService = async () => {
  if (Platform.OS === 'android' && KitchenServiceModule?.stopKitchenService) {
    try {
      await KitchenServiceModule.stopKitchenService();
    } catch (err) {
      console.warn('[KITCHEN_SERVICE_STOP_ERR]', err);
    }
  }
};

// PhonePe dual-frequency iconic chime tone (Web Audio fallback)
const playPhonePeChime = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      // First tone (1046 Hz - PhonePe signature first bell)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(1046, ctx.currentTime);
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.16);

      // Second tone (1318 Hz - PhonePe signature second bell)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(1318, ctx.currentTime + 0.14);
      gain2.gain.setValueAtTime(0.35, ctx.currentTime + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.14);
      osc2.stop(ctx.currentTime + 0.45);
    } catch (e) {}
  }
};

/**
 * Zenvy Kitchen Voice Dispatch Announcer (PhonePe / Paytm Soundbox Pure Telugu Style)
 * Announces incoming orders out loud in authentic Telugu:
 * "జెన్వీ లో [రూపాయలు] కొత్త ఆర్డర్ వచ్చింది! రసీదు నంబర్ [నంబర్]."
 */
export const announceNewOrder = async (order: any) => {
  try {
    const rawId = order?._id || order?.id || '';
    const orderNum = order?.orderNumber || (rawId ? rawId.slice(-4).toUpperCase() : '101');
    const amount = order?.totalAmount || order?.totalPrice || order?.total || '';

    // Play PhonePe chime on web
    playPhonePeChime();

    // Pure Telugu PhonePe SmartSpeaker announcement
    let announcement = '';
    if (amount) {
      announcement = `జెన్వీ లో ${amount} రూపాయల కొత్త ఆర్డర్ వచ్చింది! రసీదు నంబర్ ${orderNum}.`;
    } else {
      announcement = `జెన్వీ లో కొత్త ఆర్డర్ వచ్చింది! రసీదు నంబర్ ${orderNum}.`;
    }

    // 1. If on Android with our native Foreground Service, invoke native order alert!
    // This wakes up the screen, shows heads-up notification, and speaks out loud even if app is backgrounded/locked!
    if (Platform.OS === 'android' && KitchenServiceModule?.speakOrder) {
      try {
        await KitchenServiceModule.speakOrder(announcement, String(orderNum), String(amount));
        return;
      } catch (nativeErr) {
        console.warn('[NATIVE_SPEAK_ERR]', nativeErr);
      }
    }

    // 2. Fallback to Web Speech or expo-speech
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(announcement);
        utterance.rate = 0.88;
        utterance.pitch = 1.05;
        utterance.lang = 'te-IN';

        const voices = window.speechSynthesis.getVoices();
        const teluguVoice = voices.find(v => v.lang.toLowerCase().includes('te'));
        if (teluguVoice) utterance.voice = teluguVoice;

        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
        }, 200);
      }
    } else {
      Speech.stop();

      let voiceIdentifier: string | undefined = undefined;
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const teluguVoice = voices.find(v => v.language.toLowerCase().includes('te'));
        if (teluguVoice) voiceIdentifier = teluguVoice.identifier;
      } catch (err) {}

      Speech.speak(announcement, {
        language: 'te-IN',
        voice: voiceIdentifier,
        pitch: 1.02,
        rate: 0.88,
      });
    }
  } catch (err) {
    console.warn('[VOICE_ALERT_ANNOUNCEMENT_ERROR]', err);
  }
};

/**
 * Status change voice notification in pure Telugu
 */
export const announceStatusUpdate = async (status: string, orderId?: string) => {
  try {
    const shortId = orderId ? orderId.slice(-4).toUpperCase() : '';
    let msg = '';
    if (status === 'Accepted' || status === 'Preparing') {
      msg = `ఆర్డర్ నంబర్ ${shortId} కిచెన్‌లో తయారవుతోంది.`;
    } else if (status === 'ReadyForPickup' || status === 'Ready for Pickup') {
      msg = `ఆర్డర్ నంబర్ ${shortId} సిద్ధంగా ఉంది! డెలివరీ బాయ్ సమాచారం అందుకున్నారు.`;
    } else if (status === 'PickedUp') {
      msg = `ఆర్డర్ నంబర్ ${shortId} డెలివరీ కోసం బయలుదేరింది.`;
    }

    if (!msg) return;

    if (Platform.OS === 'android' && KitchenServiceModule?.speakOrder) {
      try {
        await KitchenServiceModule.speakOrder(msg, shortId, '');
        return;
      } catch (nativeErr) {}
    }

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.rate = 0.90;
        utterance.lang = 'te-IN';
        const voices = window.speechSynthesis.getVoices();
        const teluguVoice = voices.find(v => v.lang.toLowerCase().includes('te'));
        if (teluguVoice) utterance.voice = teluguVoice;
        window.speechSynthesis.speak(utterance);
      }
    } else {
      Speech.stop();
      let voiceIdentifier: string | undefined = undefined;
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const teluguVoice = voices.find(v => v.language.toLowerCase().includes('te'));
        if (teluguVoice) voiceIdentifier = teluguVoice.identifier;
      } catch (e) {}

      Speech.speak(msg, {
        language: 'te-IN',
        voice: voiceIdentifier,
        pitch: 1.0,
        rate: 0.90,
      });
    }
  } catch (err) {
    console.warn('[VOICE_ALERT_STATUS_ERROR]', err);
  }
};

/**
 * Test voice synthesizer in PhonePe Telugu style
 */
export const testVoiceAlert = () => {
  announceNewOrder({
    orderNumber: '8892',
    customerName: 'షణ్ముఖ్',
    items: [{ name: 'చికెన్ దమ్ బిర్యానీ' }, { name: 'థమ్స్ అప్' }],
    totalAmount: '240',
  });
};
