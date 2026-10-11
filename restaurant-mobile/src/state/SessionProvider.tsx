// Logged-in store + token. Restores the saved session on launch; any 401 logs out with a message.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { configureApiClient } from '../services/apiClient';
import { clearSession, loadSession, pickProfile, saveProfile, saveSession } from '../services/session';
import { stopRinging } from '../services/alertLoop';
import { stopKitchenForegroundService } from '../services/voiceAlert';
import type { StoreProfile } from '../types';

interface SessionCtx {
  ready: boolean;
  token: string | null;
  restaurant: StoreProfile | null;
  /** Message shown on the login screen after a forced logout. */
  notice: string | null;
  signIn: (token: string, rawRestaurant: any) => Promise<void>;
  signOut: (notice?: string) => Promise<void>;
  updateProfile: (patch: Partial<StoreProfile>) => void;
  clearNotice: () => void;
}

const Ctx = createContext<SessionCtx | null>(null);

export const SESSION_EXPIRED = 'Your session expired. Please log in again.';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<StoreProfile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  const signOut = useCallback(async (msg?: string) => {
    stopRinging();
    stopKitchenForegroundService();
    tokenRef.current = null;
    setToken(null);
    setRestaurant(null);
    setNotice(msg || null);
    await clearSession();
  }, []);

  useEffect(() => {
    configureApiClient({
      getToken: () => tokenRef.current,
      onUnauthorized: () => {
        if (tokenRef.current) signOut(SESSION_EXPIRED);
      },
    });
  }, [signOut]);

  useEffect(() => {
    let alive = true;
    loadSession().then(({ token: t, restaurant: r }) => {
      if (!alive) return;
      tokenRef.current = t;
      setToken(t);
      setRestaurant(r);
      setReady(true);
    });
    return () => { alive = false; };
  }, []);

  const signIn = useCallback(async (t: string, raw: any) => {
    const profile = pickProfile(raw);
    if (!profile) throw new Error('Login response was missing the store details. Please try again.');
    await saveSession(t, profile);
    tokenRef.current = t;
    setNotice(null);
    setRestaurant(profile);
    setToken(t);
  }, []);

  const updateProfile = useCallback((patch: Partial<StoreProfile>) => {
    setRestaurant((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch, id: prev.id };
      saveProfile(next);
      return next;
    });
  }, []);

  const value = useMemo<SessionCtx>(() => ({
    ready, token, restaurant, notice, signIn, signOut, updateProfile, clearNotice: () => setNotice(null),
  }), [ready, token, restaurant, notice, signIn, signOut, updateProfile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
