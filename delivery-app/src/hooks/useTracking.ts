"use client";
import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';

export const useTracking = (orderIds: string[], riderName: string, riderId?: string, socket?: Socket | null) => {
  const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);

  useEffect(() => {
    if (!orderIds || !socket) return;

    // Join all order rooms
    orderIds.forEach(id => {
      if (id) socket.emit('joinOrder', id);
    });

    let watchId: number | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    const startTracking = () => {
      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setCoords({ lat: latitude, lng: longitude });
            
            if (socket.connected && orderIds.length > 0) {
              orderIds.forEach(orderId => {
                if (!orderId) return;
                socket.emit('updateLocation', {
                  orderId,
                  lat: latitude,
                  lng: longitude,
                  riderName,
                  riderId
                });
              });
              console.log(`[GPS] Multi-order broadcast (${orderIds.length} streams): ${latitude}, ${longitude}`);
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
        const lat = 16.4632 + (Math.random() - 0.5) * 0.003;
        const lng = 80.5064 + (Math.random() - 0.5) * 0.003;
        setCoords({ lat, lng });

        if (socket.connected && orderIds.length > 0) {
          orderIds.forEach(orderId => {
            if (!orderId) return;
            socket.emit('updateLocation', {
              orderId,
              lat,
              lng,
              riderName,
              riderId
            });
          });
        }
      }, 5000);
    };

    startTracking();

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIds, JSON.stringify(orderIds), riderName, riderId, socket]);

  return { socket, coords };
};
