"use client";
import { useEffect } from 'react';
import { Socket } from 'socket.io-client';

export const useTracking = (orderId: string, riderName: string, riderId?: string, socket?: Socket | null) => {
  useEffect(() => {
    if (!orderId || !socket) return;

    // Join order room
    socket.emit('joinOrder', orderId);

    let watchId: number | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    const startTracking = () => {
      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            if (socket.connected) {
              const { latitude, longitude } = position.coords;
              socket.emit('updateLocation', {
                orderId,
                lat: latitude,
                lng: longitude,
                riderName,
                riderId
              });
              console.log(`[GPS] Real position update: ${latitude}, ${longitude}`);
            }
          },
          (error) => {
            console.warn("[GPS] Real tracking failed, switching to simulation:", error.message);
            startSimulation();
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
      } else {
        startSimulation();
      }
    };

    const startSimulation = () => {
      if (fallbackInterval) return;
      fallbackInterval = setInterval(() => {
        if (socket.connected) {
          const lat = 16.4632 + (Math.random() - 0.5) * 0.003;
          const lng = 80.5064 + (Math.random() - 0.5) * 0.003;
          socket.emit('updateLocation', {
            orderId,
            lat,
            lng,
            riderName,
            riderId
          });
        }
      }, 5000);
    };

    startTracking();

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [orderId, riderName, riderId, socket]);

  return { socket };
};
