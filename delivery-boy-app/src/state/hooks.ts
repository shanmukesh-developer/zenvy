import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Network from 'expo-network';
import { getItem, setItem } from '../services/session';
import { DISMISS_TTL_MS, KEYS } from '../config';

/** true while the app is in the foreground. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/** Device connectivity from expo-network (true until proven otherwise). */
export function useNetwork(): boolean {
  const [connected, setConnected] = useState(true);
  useEffect(() => {
    let mounted = true;
    Network.getNetworkStateAsync()
      .then((s) => mounted && setConnected(s.isConnected !== false && s.isInternetReachable !== false))
      .catch(() => {});
    const sub = Network.addNetworkStateListener((s) => {
      setConnected(s.isConnected !== false && s.isInternetReachable !== false);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return connected;
}

/** setInterval that always calls the latest callback; pass null delay to pause. */
export function useInterval(cb: () => void, delay: number | null) {
  const saved = useRef(cb);
  saved.current = cb;
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

const DISMISSED_KEY = KEYS.dismissed;

/** Pool orders the rider rejected or let time out (hidden for 30 minutes). */
export function useDismissedOrders() {
  const [dismissed, setDismissed] = useState<Record<string, number>>({});
  useEffect(() => {
    getItem(DISMISSED_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as Record<string, number>;
        const now = Date.now();
        // merge: keep anything dismissed before storage finished loading
        setDismissed((cur) => ({ ...Object.fromEntries(Object.entries(parsed).filter(([, exp]) => exp > now)), ...cur }));
      } catch {
        // ignore
      }
    });
  }, []);
  const dismiss = useCallback((orderId: string) => {
    setDismissed((prev) => {
      const now = Date.now();
      const next = Object.fromEntries(Object.entries(prev).filter(([, exp]) => exp > now));
      next[orderId] = now + DISMISS_TTL_MS;
      setItem(DISMISSED_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  /** Logout / account switch: the next rider on this phone must see every pool order. */
  const resetDismissed = useCallback(() => {
    setDismissed({});
    setItem(DISMISSED_KEY, '{}');
  }, []);
  return { dismiss, dismissed, resetDismissed };
}
