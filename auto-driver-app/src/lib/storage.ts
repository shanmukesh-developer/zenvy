// Session storage: the bearer token in expo-secure-store (Android Keystore, never in backups), the
// whitelisted driver profile + saved phone in AsyncStorage. Storage failures never crash the app.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { STORAGE } from '../config';
import type { DriverSelf } from '../types';

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

/** SecureStore keys allow only [A-Za-z0-9._-]. */
const SECURE_TOKEN_KEY = 'zenvy_autodriver_token';

async function secureGetToken(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(SECURE_TOKEN_KEY); } catch { return null; }
}
/** Falls back to AsyncStorage only when SecureStore is unavailable (web / keystore error). */
async function saveToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token);
    await safeRemove([STORAGE.token]);
  } catch {
    await safeSet(STORAGE.token, token);
  }
}
async function clearToken(): Promise<void> {
  try { await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY); } catch { /* ignore */ }
}

const PROFILE_FIELDS = ['id', 'name', 'phone', 'status', 'isOnline'] as const;
export type SavedDriver = Pick<DriverSelf, typeof PROFILE_FIELDS[number]>;

/** Only what the app needs to draw the first screen offline; documents etc. are always refetched. */
export function pickDriver(raw: any): SavedDriver | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : '',
    phone: typeof raw.phone === 'string' ? raw.phone : '',
    status: raw.status,
    isOnline: !!raw.isOnline,
  };
}

export async function loadSession(): Promise<{ token: string | null; driver: SavedDriver | null }> {
  const secure = await secureGetToken();
  const t = secure || (await safeGet(STORAGE.token));
  const token = t ? t.replace(/['"]+/g, '').trim() || null : null;
  if (token && !secure) await saveToken(token);
  const raw = await safeGet(STORAGE.driver);
  let driver: SavedDriver | null = null;
  if (raw) {
    try { driver = pickDriver(JSON.parse(raw)); } catch { driver = null; }
  }
  if (!token || !driver) return { token: null, driver: null };
  return { token, driver };
}

export async function saveSession(token: string, driver: SavedDriver): Promise<void> {
  await saveToken(token);
  await safeSet(STORAGE.driver, JSON.stringify(driver));
}
export async function saveDriver(driver: SavedDriver): Promise<void> {
  await safeSet(STORAGE.driver, JSON.stringify(driver));
}
export async function clearSession(): Promise<void> {
  await safeRemove([STORAGE.token, STORAGE.driver, STORAGE.queue]);
  await clearToken();
}

export async function loadSavedPhone(): Promise<string | null> {
  return (await safeGet(STORAGE.savedPhone)) || null;
}
export async function setSavedPhone(v: string | null): Promise<void> {
  if (v) await safeSet(STORAGE.savedPhone, v);
  else await safeRemove([STORAGE.savedPhone]);
}
