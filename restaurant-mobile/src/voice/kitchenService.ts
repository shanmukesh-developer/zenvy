// Bridge to the native Android kitchen foreground service (plugins/kitchen-service/*.kt, copied into android/ by plugins/withKitchenService.js on prebuild), used when the
// native build includes it. It keeps the process (and socket) alive with the screen locked, and for new
// orders in the background it wakes the screen, posts a heads-up notification (with sound) and speaks.
// Every call is a no-op when the module is missing (Expo Go, web, iOS).
import { NativeModules, Platform } from 'react-native';
import { ensureNotificationPermission } from '../lib/push';
import { orderNotification, VoiceLang } from './phrases';

const Kitchen: any = (NativeModules as any).KitchenServiceModule;

export const hasKitchenService = () => Platform.OS === 'android' && !!Kitchen?.speakOrder;

/** Safe to call again (e.g. on every app resume): re-starts the service if Android stopped it. */
export async function startKitchenService(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    // One shared permission request with push registration (two system prompts at once lose one answer).
    await ensureNotificationPermission(true);
    if (Kitchen?.startKitchenService) await Kitchen.startKitchenService();
  } catch (err) {
    console.warn('[KITCHEN_SERVICE_START]', err);
  }
}

/**
 * Stops the service and releases its wakelock (store closed / logout). No "started" guard: after an app
 * restart the sticky service may still be running from the previous launch.
 */
export async function stopKitchenService(): Promise<void> {
  if (Platform.OS !== 'android' || !Kitchen?.stopKitchenService) return;
  try {
    await Kitchen.stopKitchenService();
  } catch (err) {
    console.warn('[KITCHEN_SERVICE_STOP]', err);
  }
}

/**
 * Native new-order alert: wake screen + vibration + heads-up notification (title / body in `lang`), then
 * speaks `text` with the service's Telugu TTS. Pass text '' for notification only (voice off, or a non-Telugu
 * language that the JS engine speaks instead). One notification per order: a re-ring replaces it.
 * `silent`: the app's own ring already sounded, so the heads-up comes without a second sound (needs a native
 * build with alertOrderV2; older builds ignore it). Returns false when the native module is not available.
 */
export async function nativeOrderAlert(text: string, orderNum: string, amount: string, lang: VoiceLang, silent = false): Promise<boolean> {
  if (!hasKitchenService()) return false;
  try {
    if (Kitchen.alertOrderV2) {
      const { title, body } = orderNotification(orderNum, amount, lang);
      await Kitchen.alertOrderV2(text, orderNum, amount, title, body, silent);
    } else if (Kitchen.alertOrder) {
      const { title, body } = orderNotification(orderNum, amount, lang);
      await Kitchen.alertOrder(text, orderNum, amount, title, body);
    } else {
      await Kitchen.speakOrder(text, orderNum, amount); // older native build: Telugu text only
    }
    return true;
  } catch (err) {
    console.warn('[KITCHEN_SERVICE_SPEAK]', err);
    return false;
  }
}

/** Removes the order's heads-up notification (accepted / rejected / silenced / cancelled). */
export function cancelNativeOrderAlert(orderNum: string): void {
  if (Platform.OS !== 'android' || !orderNum || !Kitchen?.cancelOrderAlert) return;
  Kitchen.cancelOrderAlert(orderNum).catch(() => { /* ignore */ });
}
