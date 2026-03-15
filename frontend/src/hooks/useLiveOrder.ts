"use client";
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const useLiveOrder = (orderId: string) => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [riderName, setRiderName] = useState<string>('');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!orderId) return;

    socketRef.current = io(SOCKET_URL);
    socketRef.current.emit('joinOrder', orderId);

    socketRef.current.on('locationUpdated', (data) => {
      setLocation({ lat: data.lat, lng: data.lng });
      setRiderName(data.riderName);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [orderId]);

  return { location, riderName };
};
