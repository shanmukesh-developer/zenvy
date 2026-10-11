// Push: permission, Android channel, FCM token registration (once per token), listeners.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { saveFcmToken } from './deliveryApi';
import { getItem, setItem } from './session';

const REGISTERED_KEY = '@zenvy_rider_push_registered';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('delivery-alerts-v2', {
    name: 'Delivery Alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250, 250, 250, 250, 250],
    lightColor: '#FF231F7A',
    sound: 'alert',
  });
}

/** Ask permission and send the device (FCM) token to the server. Safe to call repeatedly. */
export async function registerForPush(riderId: string): Promise<void> {
  try {
    await ensureChannel();
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

export async function forgetPushRegistration(): Promise<void> {
  await setItem(REGISTERED_KEY, '');
}

export function onPushReceived(cb: (data: Record<string, any>) => void): () => void {
  const sub = Notifications.addNotificationReceivedListener((n) => cb((n.request.content.data as any) || {}));
  return () => sub.remove();
}

export function onPushTapped(cb: (data: Record<string, any>) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((r) =>
    cb((r.notification.request.content.data as any) || {}),
  );
  return () => sub.remove();
}
