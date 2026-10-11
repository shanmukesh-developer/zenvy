// Session storage for the rider token, cached profile and small offline caches.
// NOTE (open item): expo-secure-store is not installed, so the token stays in AsyncStorage under the
// existing key. Swapping to SecureStore later only needs loadToken/saveToken/clearToken changed here.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_PROFILE_KEY, STORAGE_TOKEN_KEY } from '../constants/api';
import type { RiderProfile } from '../types';

const CACHE_PREFIX = '@zenvy_rider_cache:';

async function safeGet(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function safeSet(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // storage full or unavailable: the app keeps working from memory
  }
}

export async function loadSession(): Promise<{ token: string | null; profile: RiderProfile | null }> {
  const [token, rawProfile] = await Promise.all([safeGet(STORAGE_TOKEN_KEY), safeGet(STORAGE_PROFILE_KEY)]);
  let profile: RiderProfile | null = null;
  if (rawProfile) {
    try {
      const p = JSON.parse(rawProfile);
      // Only trust caches written by this app version (they carry an id and isApproved).
      if (p && typeof p.id === 'string' && typeof p.isApproved === 'boolean') profile = p;
    } catch {
      profile = null;
    }
  }
  return { token: token ? token.replace(/['"]+/g, '').trim() || null : null, profile };
}

export async function saveToken(token: string): Promise<void> {
  await safeSet(STORAGE_TOKEN_KEY, token);
}

export async function saveProfile(profile: RiderProfile): Promise<void> {
  await safeSet(STORAGE_PROFILE_KEY, JSON.stringify(profile));
}

export async function clearSession(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    await AsyncStorage.removeMany([STORAGE_TOKEN_KEY, STORAGE_PROFILE_KEY, ...ours]);
  } catch {
    // ignore
  }
}

/** Last good server result, shown when offline with a "Last updated" time. */
export interface Cached<T> {
  savedAt: number;
  data: T;
}

export async function readCache<T>(name: string): Promise<Cached<T> | null> {
  const raw = await safeGet(CACHE_PREFIX + name);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.savedAt === 'number' ? (parsed as Cached<T>) : null;
  } catch {
    return null;
  }
}

export async function writeCache<T>(name: string, data: T): Promise<void> {
  await safeSet(CACHE_PREFIX + name, JSON.stringify({ savedAt: Date.now(), data }));
}

export async function getItem(key: string): Promise<string | null> {
  return safeGet(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  await safeSet(key, value);
}
