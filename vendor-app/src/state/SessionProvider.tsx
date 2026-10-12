// Logged-in store + token. Restores the saved session on launch; any 401 logs out with a message.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { configureHttp } from '../lib/http';
import { clearSession, loadSession, pickProfile, saveProfile, saveSession } from '../lib/storage';
import { stopKitchenService } from '../voice/kitchenService';
import { stopVoice } from '../voice/voice';
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

  const signOut = useCallback(async (msg?: string) => {
    stopVoice();
    stopKitchenService();
    tokenRef.current = null;
    setToken(null);
    setRestaurant(null);
    setNotice(msg || null);
    await clearSession();
  }, []);

  useEffect(() => {
    configureHttp({
      getToken: () => tokenRef.current,
      onUnauthorized: () => { if (tokenRef.current) signOut(SESSION_EXPIRED); },
    });
  }, [signOut]);

  useEffect(() => {
    let alive = true;
    loadSession()
      .then(({ token: t, restaurant: r }) => {
        if (!alive) return;
        tokenRef.current = t;
        setToken(t);
        setRestaurant(r);
      })
      .catch(() => { /* start logged out */ })
      .finally(() => { if (alive) setReady(true); });
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
      const clean: Partial<StoreProfile> = {};
      (Object.keys(patch) as (keyof StoreProfile)[]).forEach((k) => {
        if (patch[k] !== undefined) (clean as any)[k] = patch[k];
      });
      const next = { ...prev, ...clean, id: prev.id };
      if (JSON.stringify(next) === JSON.stringify(prev)) return prev;
      saveProfile(next);
      return next;
    });
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo<SessionCtx>(() => ({
    ready, token, restaurant, notice, signIn, signOut, updateProfile, clearNotice,
  }), [ready, token, restaurant, notice, signIn, signOut, updateProfile, clearNotice]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
