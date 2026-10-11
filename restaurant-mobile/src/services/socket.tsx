// One authenticated Socket.io connection per logged-in store. Joins restaurant_<id> on EVERY connect
// (room membership is lost on reconnect) and never gives up reconnecting.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../constants/api';
import type { ConnStatus } from '../types';

interface SocketCtx {
  socket: Socket | null;
  status: ConnStatus;
  /** Increments on every (re)connect + room join: consumers refetch when it changes. */
  connectCount: number;
  retry: () => void;
}

const Ctx = createContext<SocketCtx>({ socket: null, status: 'connecting', connectCount: 0, retry: () => {} });

const OFFLINE_AFTER_MS = 15000;

export function SocketProvider({
  token,
  restaurantId,
  onAuthError,
  children,
}: {
  token: string;
  restaurantId: string;
  onAuthError: () => void;
  children: React.ReactNode;
}) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [connectCount, setConnectCount] = useState(0);
  const authErrRef = useRef(onAuthError);
  authErrRef.current = onAuthError;

  useEffect(() => {
    const s = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });
    let offlineTimer: ReturnType<typeof setTimeout> | null = null;
    const armOffline = () => {
      if (offlineTimer) return;
      offlineTimer = setTimeout(() => setStatus('offline'), OFFLINE_AFTER_MS);
    };
    const clearOffline = () => {
      if (offlineTimer) clearTimeout(offlineTimer);
      offlineTimer = null;
    };

    s.on('connect', () => {
      clearOffline();
      s.emit('joinRestaurant', restaurantId);
      setStatus('online');
      setConnectCount((n) => n + 1);
    });
    s.on('disconnect', (reason) => {
      setStatus('reconnecting');
      armOffline();
      // The server closed us on purpose: socket.io will not retry by itself.
      if (reason === 'io server disconnect') s.connect();
    });
    s.on('connect_error', (err: any) => {
      if (/authentication error/i.test(String(err?.message || ''))) {
        authErrRef.current();
        return;
      }
      setStatus((prev) => (prev === 'offline' ? 'offline' : 'reconnecting'));
      armOffline();
    });

    setSocket(s);
    return () => {
      clearOffline();
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
    };
  }, [token, restaurantId]);

  const retry = useCallback(() => {
    if (socket && !socket.connected) {
      setStatus('reconnecting');
      socket.connect();
    }
  }, [socket]);

  return <Ctx.Provider value={{ socket, status, connectCount, retry }}>{children}</Ctx.Provider>;
}

export const useSocket = () => useContext(Ctx);
