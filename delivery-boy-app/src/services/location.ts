// GPS for distance-to-store and live tracking. Runs only while on duty or holding an active order.
import * as Location from 'expo-location';

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

export function getLastFix(): Fix | null {
  return lastFix;
}

export async function startTracking(onFix: (f: Fix) => void): Promise<'granted' | 'denied'> {
  if (sub) return 'granted';
  const my = ++gen;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return 'denied';
    const s = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 15 },
      (loc) => {
        const f: Fix = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          heading: Number.isFinite(loc.coords.heading ?? NaN) && (loc.coords.heading ?? -1) >= 0 ? loc.coords.heading : null,
          speed: Number.isFinite(loc.coords.speed ?? NaN) && (loc.coords.speed ?? -1) >= 0 ? loc.coords.speed : null,
          ts: loc.timestamp,
        };
        lastFix = f;
        onFix(f);
      },
    );
    if (my !== gen) s.remove();
    else sub = s;
    return 'granted';
  } catch {
    return 'denied';
  }
}

export function stopTracking(): void {
  gen++;
  try {
    sub?.remove();
  } catch {
    // ignore
  }
  sub = null;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
