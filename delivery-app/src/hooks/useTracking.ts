"use client";
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://hostelbites-backend-zqba.onrender.com';

export const useTracking = (orderId: string, riderName: string) => {
  const socketRef = useRef<Socket | null>(null);
  const watchIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    // Initialize socket
    socketRef.current = io(SOCKET_URL);

    // Join order room
    socketRef.current.emit('joinOrder', orderId);

    const startTracking = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const permissions = await Geolocation.checkPermissions();
          if (permissions.location !== 'granted') {
            await Geolocation.requestPermissions();
          }

          watchIdRef.current = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 10000 },
            (position) => {
              if (position && socketRef.current) {
                socketRef.current.emit('updateLocation', {
                  orderId,
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                  riderName
                });
              }
            }
          );
        } catch (err) {
          console.error('GPS tracking error:', err);
        }
      } else {
        // Fallback simulate movement for web/dev
        const interval = setInterval(() => {
          if (socketRef.current) {
            const lat = 16.506 + (Math.random() - 0.5) * 0.005;
            const lng = 80.648 + (Math.random() - 0.5) * 0.005;
            socketRef.current.emit('updateLocation', {
              orderId,
              lat,
              lng,
              riderName
            });
          }
        }, 5000);
        return interval;
      }
    };

    const simInterval = startTracking();

    return () => {
      if (watchIdRef.current) {
        Geolocation.clearWatch({ id: watchIdRef.current });
      }
      simInterval.then(iv => iv && clearInterval(iv));
      socketRef.current?.disconnect();
    };
  }, [orderId, riderName]);

  return { socket: socketRef.current };
};
