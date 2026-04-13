"use client";
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

interface LeafletMapSubProps {
  center: [number, number];
  markers: { position: [number, number]; label: string; type: 'rider' | 'store' | 'drop' }[];
  route?: [number, number][];
}

export default function LeafletMapSub({ center, markers, route }: LeafletMapSubProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Fix leaflet marker icons
    delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }, []);

  if (!mounted) return null;

  const getIcon = (type: string) => {
    if (type === 'rider') {
      return L.divIcon({
        html: `<div style="background-color: #10b981; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(16, 185, 129, 0.5);"></div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
    }
    if (type === 'store') {
       return L.divIcon({
        html: `<div style="background-color: #facc15; width: 20px; height: 20px; border-radius: 4px; border: 2px solid black;">🏪</div>`,
        className: 'flex items-center justify-center text-[10px]',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
    }
    return L.divIcon({
        html: `<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;">📍</div>`,
        className: 'flex items-center justify-center text-[10px]',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
  };

  return (
    <MapContainer
      center={center}
      zoom={15}
      zoomControl={false}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {markers.map((m, i) => (
        <Marker key={i} position={m.position} icon={getIcon(m.type)} />
      ))}
      {route && <Polyline positions={route} color="#10b981" weight={4} opacity={0.6} dashArray="10, 10" />}
    </MapContainer>
  );
}
