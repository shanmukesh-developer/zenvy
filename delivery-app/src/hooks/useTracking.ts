"use client";
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const useTracking = (orderId: string, riderName: string) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!orderId) return;

    // Initialize socket
    socketRef.current = io(SOCKET_URL);

    // Join order room
    socketRef.current.emit('joinOrder', orderId);

    // Simulate location updates (since we're in a browser environment)
    const interval = setInterval(() => {
      if (socketRef.current) {
        // Randomly simulate movement within SRM AP vicinity
        const lat = 16.506 + (Math.random() - 0.5) * 0.01;
        const lng = 80.648 + (Math.random() - 0.5) * 0.01;
        
        socketRef.current.emit('updateLocation', {
          orderId,
          lat,
          lng,
          riderName
        });
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      socketRef.current?.disconnect();
    };
  }, [orderId, riderName]);

  return socketRef.current;
};
