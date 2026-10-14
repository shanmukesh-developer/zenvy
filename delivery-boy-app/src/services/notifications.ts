// Push: permission, Android channels, FCM token registration (once per token), listeners,
// plus the short "soundbox" chime played before a voice announcement.
import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { saveFcmToken } from './deliveryApi';
import { getItem, setItem } from './session';
import { KEYS } from '../config';

const REGISTERED_KEY = KEYS.pushRegistered;
const ALERT_CHANNEL = 'delivery-alerts-v2';
const CHIME_CHANNEL = 'zenvy-chime-v1';

Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const data = (n?.request?.content?.data as any) || {};
    const chime = data.chime === true;
    // App open + new-order push: the in-app order card, chime and voice already cover it.
    // Playing the push sound too would stack two sounds on top of the announcement.
    const coveredInApp = data.type === 'NEW_ORDER';
    // A chime is a sound cue only: no banner over the app while it is open.
    return {
      shouldShowBanner: !chime && !coveredInApp,
      shouldShowList: !chime,
      shouldPlaySound: chime || !coveredInApp,
      shouldSetBadge: false,
    };
  },
});

let channelsReady: Promise<void> | null = null;

function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (!channelsReady) {
    channelsReady = (async () => {
      await Notifications.setNotificationChannelAsync(ALERT_CHANNEL, {
        name: 'Delivery alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250, 250, 250],
        lightColor: '#0E9F5B',
        sound: 'default',
      });
      await Notifications.setNotificationChannelAsync(CHIME_CHANNEL, {
        name: 'Order sounds',
        description: 'Short sound before a voice announcement',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        enableVibrate: false,
      });
    })().catch(() => {
      channelsReady = null;
    });
  }
  return channelsReady ?? Promise.resolve();
}

async function hasPermission(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).status === 'granted';
  } catch {
    return false;
  }
}

export type ChimeKind = 'order' | 'money' | 'info' | 'alert';

const PATTERNS: Record<ChimeKind, number[]> = {
  order: [0, 350, 150, 350, 150, 600],
  money: [0, 120, 80, 120],
  info: [0, 120],
  alert: [0, 500, 200, 500],
};

/**
 * Distinctive cue: vibration pattern + the system notification sound (a silent-banner local notification
 * that removes itself). Never throws. `text` is the notification body when it shows in the tray.
 */
export async function playChime(kind: ChimeKind, text: string): Promise<void> {
  try {
    Vibration.vibrate(PATTERNS[kind]);
  } catch {
    // no vibrator
  }
  if (!(await hasPermission())) return;
  try {
    await ensureChannels();
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: 'Zenvy Rider', body: text, sound: 'default', data: { chime: true } },
      trigger: Platform.OS === 'android' ? { channelId: CHIME_CHANNEL } : null,
    });
    setTimeout(() => {
      Notifications.dismissNotificationAsync(id).catch(() => {});
    }, 6000);
  } catch {
    // sound is best effort
  }
}

/** Ask permission and send the device (FCM) token to the server. Safe to call repeatedly. */
export async function registerForPush(riderId: string): Promise<void> {
  try {
    await ensureChannels();
    const perm = await Notifications.getPermissionsAsync();
    let granted = perm.status === 'granted';
    if (!granted) granted = (await Notifications.requestPermissionsAsync()).status === 'granted';
    if (!granted) return;
    // The server sends through FCM, so only the native device token is useful.
    const device = await Notifications.getDevicePushTokenAsync();
    const token = typeof device?.data === 'string' ? device.data : '';
    if (!token) return;
    const marker = `${riderId}:${token}`;
    if ((await getItem(REGISTERED_KEY)) === marker) return;
    await saveFcmToken(token);
    await setItem(REGISTERED_KEY, marker);
  } catch {
    // Push is best effort; polling still finds orders while the app is open.
  }
}

export function onPushTokenChange(riderId: string): () => void {
  const sub = Notifications.addPushTokenListener(async (t) => {
    const token = typeof t?.data === 'string' ? t.data : '';
    if (!token) return;
    try {
      await saveFcmToken(token);
      await setItem(REGISTERED_KEY, `${riderId}:${token}`);
    } catch {
      // retried on next start
    }
  });
  return () => sub.remove();
}

/**
 * Logout: forget the local marker AND invalidate this phone's FCM token. The store's logout first asks the
 * server to drop the token (POST /delivery/fcm-token/remove, best effort); once FCM deletes it every push
 * to it fails anyway, so a logged-out phone stops getting this rider's order / tip / cancellation pushes.
 * The next login asks FCM for a fresh token and registers that one.
 */
/** The device token this phone last registered for `riderId` (from the local marker), or null. */
export async function registeredPushToken(riderId: string): Promise<string | null> {
  const marker = await getItem(REGISTERED_KEY);
  const prefix = `${riderId}:`;
  return riderId && marker && marker.startsWith(prefix) ? marker.slice(prefix.length) || null : null;
}

export async function forgetPushRegistration(): Promise<void> {
  await setItem(REGISTERED_KEY, '');
  try {
    await Promise.race([
      Notifications.unregisterForNotificationsAsync(),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
  } catch {
    // best effort: no Firebase on this build / no network
  }
}

export function onPushReceived(cb: (data: Record<string, any>) => void): () => void {
  const sub = Notifications.addNotificationReceivedListener((n) => {
    const data = (n.request.content.data as any) || {};
    if (data.chime === true) return; // our own chime
    cb(data);
  });
  return () => sub.remove();
}

// Ids of notification taps already routed, so the launch tap and the listener never both act on one tap.
const handledTaps = new Set<string>();
let launchTapChecked = false;

export function onPushTapped(cb: (data: Record<string, any>) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const data = (r.notification.request.content.data as any) || {};
    if (data.chime === true) return;
    const key = r.notification.request.identifier;
    if (key) {
      if (handledTaps.has(key)) return;
      handledTaps.add(key);
    }
    cb(data);
  });
  return () => sub.remove();
}

/**
 * The tap that launched a killed app is not delivered to listeners registered later. Read it once per app
 * run (null when the app was not opened from a notification, or it was already routed).
 */
export async function takeLaunchPushTap(): Promise<Record<string, any> | null> {
  if (launchTapChecked) return null;
  launchTapChecked = true;
  try {
    const r = await Notifications.getLastNotificationResponseAsync();
    if (!r) return null;
    const data = (r.notification.request.content.data as any) || {};
    if (data.chime === true) return null;
    const key = r.notification.request.identifier;
    if (key) {
      if (handledTaps.has(key)) return null;
      handledTaps.add(key);
    }
    return data;
  } catch {
    return null;
  }
}
