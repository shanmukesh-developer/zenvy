"use client";
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Icon, DivIcon, LeafletMouseEvent } from 'leaflet';

interface LeafletMapSubProps {
  center: [number, number];
  markerPosition: [number, number];
  onMapClick: (latlng: { lat: number, lng: number }) => void;
  icon?: Icon | DivIcon | null; // Leaflet icon instance
}

function MapEvents({ onClick }: { onClick: (latlng: { lat: number, lng: number }) => void }) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onClick(e.latlng);
    }
  });
  return null;
}

export default function LeafletMapSub({ center, markerPosition, onMapClick, icon }: LeafletMapSubProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return (
    <MapContainer
      center={center}
      zoom={16}
      zoomControl={false}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      <MapEvents onClick={onMapClick} />
      {icon && <Marker position={markerPosition} icon={icon} />}
    </MapContainer>
  );
}
