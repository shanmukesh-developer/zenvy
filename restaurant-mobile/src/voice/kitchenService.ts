// Bridge to the native Android kitchen foreground service (android/…/KitchenServiceModule.kt), used when the
// native build includes it. It keeps the process (and socket) alive with the screen locked, and for new
// orders in the background it wakes the screen, posts a heads-up notification (with sound) and speaks.
// Every call is a no-op when the module is missing (Expo Go, web, iOS).
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

const Kitchen: any = (NativeModules as any).KitchenServiceModule;

export const hasKitchenService = () => Platform.OS === 'android' && !!Kitchen?.speakOrder;

let started = false;

export async function startKitchenService(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    if (Number(Platform.Version) >= 33) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    if (Kitchen?.startKitchenService) {
      await Kitchen.startKitchenService();
      started = true;
    }
  } catch (err) {
    console.warn('[KITCHEN_SERVICE_START]', err);
  }
}

export async function stopKitchenService(): Promise<void> {
  if (Platform.OS !== 'android' || !Kitchen?.stopKitchenService || !started) return;
  started = false;
  try {
    await Kitchen.stopKitchenService();
  } catch (err) {
    console.warn('[KITCHEN_SERVICE_STOP]', err);
  }
}

/**
 * Native new-order alert: wake screen + vibration + heads-up notification, then speaks `text` with the
 * service's Telugu TTS. Pass text '' for notification only (voice off, or a non-Telugu language that the
 * JS engine speaks instead). Returns false when the native module is not available.
 */
export async function nativeOrderAlert(text: string, orderNum: string, amount: string): Promise<boolean> {
  if (!hasKitchenService()) return false;
  try {
    await Kitchen.speakOrder(text, orderNum, amount);
    return true;
  } catch (err) {
    console.warn('[KITCHEN_SERVICE_SPEAK]', err);
    return false;
  }
}
