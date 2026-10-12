// AsyncStorage wrappers: session (JWT + whitelisted stall profile), saved login phone, voice settings.
// Every read/write is guarded: storage failures never crash the app (it keeps working from memory).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE } from '../config';
import type { StoreProfile } from '../types';

const PROFILE_FIELDS = [
  'id', 'name', 'location', 'imageUrl', 'campus', 'operatingHours', 'isOpenNow', 'vendorType', 'whatsappNumber', 'phone',
] as const;

export async function safeGet(key: string): Promise<string | null> {
  try { return await AsyncStorage.getItem(key); } catch { return null; }
}
export async function safeSet(key: string, value: string): Promise<void> {
  try { await AsyncStorage.setItem(key, value); } catch { /* keep working from memory */ }
}
export async function safeRemove(keys: string[]): Promise<void> {
  for (const k of keys) {
    try { await AsyncStorage.removeItem(k); } catch { /* ignore */ }
  }
}

/** Only the fields the app needs; never the password hash. */
export function pickProfile(raw: any): StoreProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id || raw._id;
  if (typeof id !== 'string' || !id) return null;
  const out: any = {};
  for (const f of PROFILE_FIELDS) if (raw[f] !== undefined && raw[f] !== null) out[f] = raw[f];
  out.id = id;
  out.name = typeof raw.name === 'string' ? raw.name : '';
  if (typeof out.operatingHours === 'string') {
    try { out.operatingHours = JSON.parse(out.operatingHours); } catch { out.operatingHours = null; }
  }
  return out as StoreProfile;
}

export async function loadSession(): Promise<{ token: string | null; restaurant: StoreProfile | null }> {
  const t = await safeGet(STORAGE.token);
  const token = t ? t.replace(/['"]+/g, '').trim() || null : null;
  const raw = await safeGet(STORAGE.vendor);
  let restaurant: StoreProfile | null = null;
  if (raw) {
    try { restaurant = pickProfile(JSON.parse(raw)); } catch { restaurant = null; }
  }
  if (!token || !restaurant) return { token: null, restaurant: null };
  return { token, restaurant };
}

export async function saveSession(token: string, restaurant: StoreProfile): Promise<void> {
  await safeSet(STORAGE.token, token);
  await safeSet(STORAGE.vendor, JSON.stringify(restaurant));
}

export async function saveProfile(restaurant: StoreProfile): Promise<void> {
  await safeSet(STORAGE.vendor, JSON.stringify(restaurant));
}

export async function clearSession(): Promise<void> {
  await safeRemove([STORAGE.token, STORAGE.vendor]);
}

export async function loadSavedPhone(): Promise<string | null> {
  return (await safeGet(STORAGE.savedPhone)) || null;
}
export async function setSavedPhone(v: string | null): Promise<void> {
  if (v) await safeSet(STORAGE.savedPhone, v);
  else await safeRemove([STORAGE.savedPhone]);
}
