"use client";
import React, { useEffect, useState, createContext, useContext, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'https://hostelbites-backend-jwmt.onrender.com';

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
    let token: string | null = null;
    try {
      const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      if (userData) {
        const user = JSON.parse(userData);
        token = user.token || null;
      }
    } catch {}

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
  }, []);

  useEffect(() => {
    initSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [initSocket]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected, refreshSocket: initSocket }}>
      {children}
    </SocketContext.Provider>
  );
}
