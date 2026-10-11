// New-order ringing: repeating vibration + an announcement every RING_REPEAT_MS until stopRinging().
// In the background the native speakOrder (which posts a notification each call) is throttled.
import { AppState, Platform, Vibration } from 'react-native';
import { NATIVE_RING_MIN_GAP_MS, RING_REPEAT_MS } from '../constants/api';
import { announceNewOrder, stopSpeech } from './voiceAlert';

type OrderLike = { id: string; shortId?: string; totalPrice?: number };

let timer: ReturnType<typeof setInterval> | null = null;
let getCurrent: () => OrderLike | null = () => null;
let lastNativeAt = 0;
let ringingFor: string | null = null;

const PATTERN = [0, 700, 300, 700, 300, 700];

function ringOnce(first: boolean) {
  const order = getCurrent();
  if (!order) return;
  const background = AppState.currentState !== 'active';
  const now = Date.now();
  const useNative = (first || background) && now - lastNativeAt >= NATIVE_RING_MIN_GAP_MS;
  if (useNative) lastNativeAt = now;
  if (background && !useNative) return; // let the native notification breathe
  announceNewOrder(order, { native: useNative });
}

export function isRinging() {
  return timer !== null;
}

/** Starts (or keeps) ringing. `current` returns the newest unacknowledged order, or null. */
export function startRinging(current: () => OrderLike | null) {
  getCurrent = current;
  const order = current();
  if (!order) return;
  if (timer) {
    // Already ringing: a different new order announces itself right away.
    if (ringingFor !== order.id) {
      ringingFor = order.id;
      ringOnce(true);
    }
    return;
  }
  ringingFor = order.id;
  if (Platform.OS !== 'web') Vibration.vibrate(PATTERN, true);
  ringOnce(true);
  timer = setInterval(() => {
    if (Platform.OS !== 'web') Vibration.vibrate(PATTERN, true);
    ringOnce(false);
  }, RING_REPEAT_MS);
}

export function stopRinging() {
  if (timer) clearInterval(timer);
  timer = null;
  ringingFor = null;
  if (Platform.OS !== 'web') Vibration.cancel();
  stopSpeech();
}
