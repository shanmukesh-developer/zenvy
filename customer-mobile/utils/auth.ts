import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ── Token Management (Encrypted via SecureStore) ──────────────────────────────
// SecureStore uses Android Keystore / iOS Keychain for hardware-backed encryption.
// Falls back to AsyncStorage on web where SecureStore is unavailable.

const TOKEN_KEY = 'zenvy_token';

export const isTokenExpired = (token: string): boolean => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return false; // If parsing fails, let backend handle verification
  }
};

export const getToken = async (): Promise<string | null> => {
  try {
    let token: string | null = null;
    if (Platform.OS === 'web') {
      token = await AsyncStorage.getItem(TOKEN_KEY);
    } else {
      token = await SecureStore.getItemAsync(TOKEN_KEY);
    }
    if (token && isTokenExpired(token)) {
      await removeToken();
      await removeUser();
      return null;
    }
    return token;
  } catch {
    // Fallback for environments where SecureStore isn't available
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token && isTokenExpired(token)) {
      await removeToken();
      await removeUser();
      return null;
    }
    return token;
  }
};

export const setToken = async (token: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(TOKEN_KEY, token);
      return;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // Fallback for environments where SecureStore isn't available
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }
};

export const removeToken = async (): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(TOKEN_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
};

// ── User Management ───────────────────────────────────────────────────────────
export const getUser = async (): Promise<any | null> => {
  const raw = await AsyncStorage.getItem('zenvy_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

export const setUser = async (user: any): Promise<void> => {
  await AsyncStorage.setItem('zenvy_user', JSON.stringify(user));
};

export const removeUser = async (): Promise<void> => {
  await AsyncStorage.removeItem('zenvy_user');
};

import { API_URL } from '../constants/api';

// ── Authenticated Fetch ───────────────────────────────────────────────────────
export const apiFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
  return fetch(fullUrl, { ...options, headers });
};

// ── Logout ────────────────────────────────────────────────────────────────────
export const logout = async (): Promise<void> => {
  await removeToken();
  await AsyncStorage.multiRemove(['zenvy_user', 'zenvy_favorites']);
};
