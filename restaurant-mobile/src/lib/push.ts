// Push + ring sound (expo-notifications).
//  - Order pushes while the app is closed: the server (utils/storePush.js) sends FCM pushes on channel
//    'delivery-alerts-v2' for every new order and cancellation. We register this phone's FCM token with
//    POST /api/restaurants/fcm-token after login and remove it on logout.
//  - Ring: a short loud ring (assets/sounds/alert.wav, bundled into res/raw by the expo-notifications
//    plugin) played through a local notification on an alarm-volume channel. It does not depend on the
//    TTS engine, so a broken / missing voice never means a silent new order.
// Every function is best effort and never throws.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registerPushToken, removePushToken } from './api';
import { safeGet, safeSet } from './storage';

const APP: 'restaurant' | 'vendor' = 'restaurant';
const APP_TITLE = 'Zenvy Restaurant';
const REGISTERED_KEY = '@zenvy_restaurant_push_registered';
/** Same id the server sends store pushes on (utils/storePush.js). */
export const ORDERS_CHANNEL = 'delivery-alerts-v2';
const RING_CHANNEL = 'zenvy-ring-v1';
const RING_SOUND = 'alert.wav';
/** Length of assets/sounds/alert.wav (+ a little slack). */
export const RING_SOUND_MS = 2600;

const isNative = Platform.OS === 'android' || Platform.OS === 'ios';

if (isNative) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async (n) => {
        const data = (n?.request?.content?.data as any) || {};
        const ring = data.ring === true;
        // App open + order push: the socket, the order card, the ring and the voice already cover it.
        const coveredInApp = data.type === 'NEW_ORDER' || data.type === 'ORDER_CANCELLED';
        return {
          shouldShowBanner: !ring && !coveredInApp,
          shouldShowList: !coveredInApp,
          shouldPlaySound: ring || !coveredInApp,
          shouldSetBadge: false,
        };
      },
    });
  } catch { /* module missing in this build */ }
}

let channelsReady: Promise<boolean> | null = null;
function ensureChannels(): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(true);
  if (!channelsReady) {
    channelsReady = (async () => {
      const alarm = {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      };
      await Notifications.setNotificationChannelAsync(ORDERS_CHANNEL, {
        name: 'New orders',
        description: 'New orders and cancellations, also when the app is closed',
        importance: Notifications.AndroidImportance.MAX,
        sound: RING_SOUND,
        audioAttributes: alarm,
        vibrationPattern: [0, 600, 250, 600, 250, 600],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });
      await Notifications.setNotificationChannelAsync(RING_CHANNEL, {
        name: 'Order ring',
        description: 'Loud ring while a new order is waiting',
        importance: Notifications.AndroidImportance.MAX,
        sound: RING_SOUND,
        audioAttributes: alarm,
        enableVibrate: false, // the app vibrates itself (its own pattern)
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });
      return true;
    })().catch(() => {
      channelsReady = null;
      return false;
    });
  }
  return channelsReady;
}

async function hasPermission(ask: boolean): Promise<boolean> {
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.status === 'granted') return true;
    if (!ask || cur.canAskAgain === false) return false;
    return (await Notifications.requestPermissionsAsync()).status === 'granted';
  } catch {
    return false;
  }
}

/** Plays the ring once. false = it could not (web, notifications blocked, old build): use a fallback. */
export async function playRing(text = 'New order waiting'): Promise<boolean> {
  if (!isNative) return false;
  try {
    if (!(await hasPermission(false))) return false;
    if (!(await ensureChannels())) return false;
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: APP_TITLE, body: text, sound: RING_SOUND, data: { ring: true } },
      trigger: Platform.OS === 'android' ? { channelId: RING_CHANNEL } : null,
    });
    setTimeout(() => { Notifications.dismissNotificationAsync(id).catch(() => {}); }, RING_SOUND_MS + 3000);
    return true;
  } catch {
    return false;
  }
}

let currentToken: string | null = null;

/** Ask permission, then send this phone's FCM token to the server (once per store + token). */
export async function registerStorePush(storeId: string): Promise<void> {
  if (!isNative || !storeId) return;
  try {
    await ensureChannels();
    if (!(await hasPermission(true))) return;
    // The server sends through FCM, so only the native device token is useful. Without
    // google-services.json in the build this throws: order alerts then work only while the app runs.
    const device = await Notifications.getDevicePushTokenAsync();
    const token = typeof device?.data === 'string' ? device.data : '';
    if (!token) return;
    currentToken = token;
    const marker = `${storeId}:${token}`;
    if ((await safeGet(REGISTERED_KEY)) === marker) return;
    await registerPushToken(token, APP);
    await safeSet(REGISTERED_KEY, marker);
  } catch (err) {
    console.warn('[PUSH_REGISTER]', (err as any)?.message || err);
  }
}

/** Re-sends the token when FCM rotates it. Returns the unsubscribe function. */
export function onPushTokenChange(storeId: string): () => void {
  if (!isNative) return () => {};
  try {
    const sub = Notifications.addPushTokenListener(async (t) => {
      const token = typeof t?.data === 'string' ? t.data : '';
      if (!token || !storeId) return;
      currentToken = token;
      try {
        await registerPushToken(token, APP);
        await safeSet(REGISTERED_KEY, `${storeId}:${token}`);
      } catch { /* retried on the next start */ }
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

/** Logout: stop pushes to this phone (call while the session token is still valid). */
export async function unregisterStorePush(): Promise<void> {
  if (!isNative) return;
  try {
    let token = currentToken;
    if (!token) {
      const device = await Notifications.getDevicePushTokenAsync().catch(() => null);
      token = typeof device?.data === 'string' ? device.data : null;
    }
    await safeSet(REGISTERED_KEY, '');
    currentToken = null;
    if (token) await removePushToken(token);
  } catch { /* the server prunes stale tokens itself */ }
}

/** Order pushes (received while open, or tapped): `cb` gets the push data ({ type, orderId }). */
export function onOrderPush(cb: (data: { type?: string; orderId?: string }) => void): () => void {
  if (!isNative) return () => {};
  try {
    const recv = Notifications.addNotificationReceivedListener((n) => {
      const data = (n.request.content.data as any) || {};
      if (data.ring === true) return;
      cb(data);
    });
    const tap = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = (r.notification.request.content.data as any) || {};
      if (data.ring === true) return;
      cb(data);
    });
    return () => { recv.remove(); tap.remove(); };
  } catch {
    return () => {};
  }
}
