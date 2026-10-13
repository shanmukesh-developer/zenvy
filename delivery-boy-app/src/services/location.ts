// GPS for distance-to-store and live tracking. Runs only while on duty or holding an active order.
// Foreground: watchPositionAsync. Background (the rider switched to Google Maps to navigate): a
// location task with an Android foreground service, so the process and its socket stay alive and the
// customer map / admin radar keep moving during the ride. Background permission is asked once, with an
// explanation, only when tracking starts (on duty / holding an order); declining keeps foreground-only.
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { getItem, setItem } from './session';

export interface Fix {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  ts: number;
}

let sub: Location.LocationSubscription | null = null;
let gen = 0; // bumps on every start/stop so a late watch result after stop is discarded
let lastFix: Fix | null = null;
/** Current consumer of fixes from either source; null while tracking is stopped. */
let listener: ((f: Fix) => void) | null = null;

const BG_TASK = 'zenvy-rider-location';
const BG_ASKED_KEY = '@zenvy_rider_bg_location_asked';

function toFix(loc: Location.LocationObject): Fix {
  return {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    heading: Number.isFinite(loc.coords.heading ?? NaN) && (loc.coords.heading ?? -1) >= 0 ? loc.coords.heading : null,
    speed: Number.isFinite(loc.coords.speed ?? NaN) && (loc.coords.speed ?? -1) >= 0 ? loc.coords.speed : null,
    ts: loc.timestamp,
  };
}

function deliver(f: Fix): void {
  // Drop out-of-order fixes (the watch and the background task both report while in the foreground).
  if (lastFix && f.ts < lastFix.ts) return;
  lastFix = f;
  listener?.(f);
}

// Must be defined at module load (also when Android restarts the JS context for the task).
if (!TaskManager.isTaskDefined(BG_TASK)) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(BG_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    if (!listener) {
      // Tracking was stopped (logout / off duty) or the app was killed: never keep tracking on our own.
      Location.stopLocationUpdatesAsync(BG_TASK).catch(() => {});
      return;
    }
    const latest = data.locations[data.locations.length - 1];
    deliver(toFix(latest));
  });
}

async function ensureBackgroundPermission(): Promise<boolean> {
  try {
    const cur = await Location.getBackgroundPermissionsAsync();
    if (cur.status === 'granted') return true;
    if (!cur.canAskAgain || (await getItem(BG_ASKED_KEY)) === '1') return false;
    await setItem(BG_ASKED_KEY, '1');
    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Keep live tracking during rides',
        'When you open Google Maps to navigate, Zenvy Rider needs "Allow all the time" location so the customer can still see you on the map. It is only used while you are on duty or delivering, and a notification shows whenever it is on.',
        [
          { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Continue', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
    if (!ok) return false;
    return (await Location.requestBackgroundPermissionsAsync()).status === 'granted';
  } catch {
    return false;
  }
}

async function startBackgroundUpdates(my: number): Promise<void> {
  if (!(await ensureBackgroundPermission()) || my !== gen) return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(BG_TASK)) return;
    await Location.startLocationUpdatesAsync(BG_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000,
      distanceInterval: 15,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.OtherNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Zenvy Rider is on duty',
        notificationBody: 'Sharing your live location with the customer while you deliver.',
        notificationColor: '#C9A84C',
        killServiceOnDestroy: true,
      },
    });
    if (my !== gen) stopBackgroundUpdates(); // stopped while starting
  } catch {
    // no background support on this build: foreground tracking still works
  }
}

function stopBackgroundUpdates(): void {
  Location.hasStartedLocationUpdatesAsync(BG_TASK)
    .then((on) => (on ? Location.stopLocationUpdatesAsync(BG_TASK) : undefined))
    .catch(() => {});
}

export function getLastFix(): Fix | null {
  return lastFix;
}

export async function startTracking(onFix: (f: Fix) => void): Promise<'granted' | 'denied'> {
  listener = onFix;
  if (sub) return 'granted';
  const my = ++gen;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return 'denied';
    const s = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 15 },
      (loc) => deliver(toFix(loc)),
    );
    if (my !== gen) {
      s.remove();
      return 'granted';
    }
    sub = s;
    startBackgroundUpdates(my);
    return 'granted';
  } catch {
    return 'denied';
  }
}

export function stopTracking(): void {
  gen++;
  listener = null;
  try {
    sub?.remove();
  } catch {
    // ignore
  }
  sub = null;
  stopBackgroundUpdates();
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
