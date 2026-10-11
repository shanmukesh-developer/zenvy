"use client";
import React, { useEffect, useState, createContext, useContext, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/lib/config';
import { getToken, subscribe } from '@/lib/session';


interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  refreshSocket: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  refreshSocket: () => {}
});

export const useAdminSocket = () => useContext(SocketContext);

export default function AdminSocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const initSocket = useCallback(() => {
    const token = getToken();

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = io(SOCKET_URL.replace(/\/$/, ""), {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: { token }
    });

    const joinAdminRoom = () => {
      console.log('[ADMIN_SOCKET] Connected with socket ID:', socket.id, 'Joining admin-room...');
      socket.emit('joinAdmin');
    };

    socket.on('connect', () => {
      setIsConnected(true);
      joinAdminRoom();
    });

    socket.on('reconnect', () => {
      console.log('[ADMIN_SOCKET] Reconnected. Re-joining admin-room...');
      setIsConnected(true);
      joinAdminRoom();
    });

    socket.on('disconnect', (reason) => {
      console.warn('[ADMIN_SOCKET] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('[ADMIN_SOCKET] Connection error:', err.message);
    });

    socketRef.current = socket;

    // Anti-sleep heartbeat ping to keep Render server awake
    const keepAliveInterval = setInterval(() => {
      fetch(`${SOCKET_URL}/api/health`, { cache: 'no-store' }).catch(() => {});
      if (socket.connected) {
         socket.emit('admin_ping', { timestamp: Date.now() });
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => {
       clearInterval(keepAliveInterval);
    };
  }, []);

  // Reconnect whenever the admin signs in or out so the socket uses the current token.
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => setSessionToken(getToken());
    sync();
    return subscribe(sync);
  }, []);

  useEffect(() => {
    if (!sessionToken) return;
    const cleanupInterval = initSocket();
    return () => {
      if (typeof cleanupInterval === 'function') cleanupInterval();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [initSocket, sessionToken]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected, refreshSocket: initSocket }}>
      {children}
    </SocketContext.Provider>
  );
}
