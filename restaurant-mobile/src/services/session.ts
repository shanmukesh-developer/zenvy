// Session storage for the restaurant JWT and a whitelisted copy of the store profile.
// NOTE (open item): expo-secure-store is not installed (same as the rider app), so the token stays in
// AsyncStorage. Switching to SecureStore later only needs loadToken / saveToken / clearToken changed here.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE } from '../constants/api';
import type { StoreProfile } from '../types';

const PROFILE_FIELDS = [
  'id', 'name', 'location', 'imageUrl', 'operatingHours', 'isOpenNow', 'isOffline',
  'vendorType', 'commissionRate', 'commissionType', 'deliveryTime',
] as const;

async function safeGet(key: string): Promise<string | null> {
  try { return await AsyncStorage.getItem(key); } catch { return null; }
}
async function safeSet(key: string, value: string): Promise<void> {
  try { await AsyncStorage.setItem(key, value); } catch { /* storage unavailable: keep working from memory */ }
}
async function safeRemove(keys: string[]): Promise<void> {
  for (const k of keys) {
    try { await AsyncStorage.removeItem(k); } catch { /* ignore */ }
  }
}

/** Only the fields the app needs; never the password hash the old login response carried. */
export function pickProfile(raw: any): StoreProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id || raw._id;
  if (typeof id !== 'string' || !id) return null;
  const out: any = {};
  for (const f of PROFILE_FIELDS) if (raw[f] !== undefined) out[f] = raw[f];
  out.id = id;
  out.name = typeof raw.name === 'string' ? raw.name : '';
  if (typeof out.operatingHours === 'string') {
    try { out.operatingHours = JSON.parse(out.operatingHours); } catch { out.operatingHours = null; }
  }
  return out as StoreProfile;
}

async function loadToken(): Promise<string | null> {
  const t = (await safeGet(STORAGE.token)) || (await safeGet(STORAGE.legacyToken));
  const clean = t ? t.replace(/['"]+/g, '').trim() : '';
  return clean || null;
}
async function saveToken(token: string): Promise<void> {
  await safeSet(STORAGE.token, token);
}
async function clearToken(): Promise<void> {
  await safeRemove([STORAGE.token, STORAGE.legacyToken]);
}

export async function loadSession(): Promise<{ token: string | null; restaurant: StoreProfile | null }> {
  const token = await loadToken();
  let raw = await safeGet(STORAGE.restaurant);
  const fromLegacy = !raw;
  if (!raw) raw = await safeGet(STORAGE.legacyRestaurant);
  let restaurant: StoreProfile | null = null;
  if (raw) {
    try { restaurant = pickProfile(JSON.parse(raw)); } catch { restaurant = null; }
  }
  // Migrate the old KDS keys once (the old profile copy contained the bcrypt hash: drop it).
  if (token && restaurant) {
    await saveToken(token);
    if (fromLegacy) await safeSet(STORAGE.restaurant, JSON.stringify(restaurant));
  }
  await safeRemove([STORAGE.legacyToken, STORAGE.legacyRestaurant]);
  if (!token || !restaurant) return { token: null, restaurant: null };
  return { token, restaurant };
}

export async function saveSession(token: string, restaurant: StoreProfile): Promise<void> {
  await saveToken(token);
  await safeSet(STORAGE.restaurant, JSON.stringify(restaurant));
}

export async function saveProfile(restaurant: StoreProfile): Promise<void> {
  await safeSet(STORAGE.restaurant, JSON.stringify(restaurant));
}

export async function clearSession(): Promise<void> {
  await clearToken();
  await safeRemove([STORAGE.restaurant, STORAGE.legacyRestaurant]);
}

export async function loadSavedId(): Promise<string | null> {
  const v = (await safeGet(STORAGE.savedId)) || (await safeGet(STORAGE.legacySavedId));
  await safeRemove([STORAGE.legacySavedId]);
  if (v) await safeSet(STORAGE.savedId, v);
  return v || null;
}
export async function setSavedId(id: string | null): Promise<void> {
  if (id) await safeSet(STORAGE.savedId, id);
  else await safeRemove([STORAGE.savedId]);
}

export async function loadSoundOn(): Promise<boolean> {
  const v = await safeGet(STORAGE.soundOn);
  return v !== '0';
}
export async function saveSoundOn(on: boolean): Promise<void> {
  await safeSet(STORAGE.soundOn, on ? '1' : '0');
}
