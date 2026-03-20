"use client";
import { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';

import { socket } from '@/utils/socket';

export const useLiveOrder = (orderId: string) => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [riderName, setRiderName] = useState<string>('');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!orderId) return;

    socketRef.current = socket;
    socketRef.current.emit('joinOrder', orderId);

    socketRef.current.on('locationUpdated', (data) => {
      setLocation({ lat: data.lat, lng: data.lng });
      setRiderName(data.riderName);
    });

    return () => {
      socket.off('locationUpdated');
    };
  }, [orderId]);

  return { location, riderName };
};
