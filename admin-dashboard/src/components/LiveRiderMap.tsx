"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import io from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://hostelbites-backend-jwmt.onrender.com';

const CAMPUS_HUBS = [
  { name: 'SRM Central Arch (Main Gate)', lat: 12.8231, lon: 80.0453, tag: 'GATE', icon: '🏛️' },
  { name: 'Java Green Food Court', lat: 12.8245, lon: 80.0460, tag: 'KITCHEN HUB', icon: '🍔' },
  { name: 'Tech Park & University Building', lat: 12.8215, lon: 80.0440, tag: 'ACADEMIC', icon: '🏢' },
  { name: 'Hostel Zone (Amaravathi / Kaveri)', lat: 12.8255, lon: 80.0425, tag: 'HOSTELS', icon: '🛏️' },
];

export default function LiveRiderMap() {
  const [riders, setRiders] = useState<Record<string, { lat: number; lon: number; name?: string; updatedAt: number }>>({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('joinRoom', 'admin_room');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('RIDER_LOCATION_UPDATE', (data: { riderId: string; lat: number; lon: number; name?: string }) => {
      if (!data.riderId || typeof data.lat !== 'number' || typeof data.lon !== 'number') return;
      setRiders((prev) => ({
        ...prev,
        [data.riderId]: {
          lat: data.lat,
          lon: data.lon,
          name: data.name || data.riderId,
          updatedAt: Date.now()
        }
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Custom DivIcon for Riders
  const createRiderIcon = (id: string) => {
    return L.divIcon({
      className: 'zenvy-rider-pin',
      html: `
        <div style="
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          background: linear-gradient(135deg, #2563EB, #1D4ED8);
          border: 2px solid #93C5FD;
          border-radius: 50%;
          box-shadow: 0 0 20px rgba(37, 99, 235, 0.7);
          font-size: 18px;
          cursor: pointer;
        ">
          🛵
          <span style="
            position: absolute;
            top: -6px;
            right: -6px;
            width: 10px;
            height: 10px;
            background: #10B981;
            border: 2px solid #000;
            border-radius: 50%;
          "></span>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });
  };

  // Custom DivIcon for Campus Hubs
  const createHubIcon = (hub: typeof CAMPUS_HUBS[0]) => {
    return L.divIcon({
      className: 'zenvy-hub-pin',
      html: `
        <div style="
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(10, 10, 12, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(8px);
          padding: 3px 8px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          white-space: nowrap;
          cursor: pointer;
        ">
          <span style="font-size: 11px;">${hub.icon}</span>
          <span style="font-size: 9px; font-weight: 800; color: #F3F4F6; letter-spacing: 0.5px;">${hub.tag}</span>
        </div>
      `,
      iconSize: [70, 24],
      iconAnchor: [35, 12]
    });
  };

  const activeRidersCount = Object.keys(riders).length;

  return (
    <div className="h-[600px] w-full rounded-[40px] overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(37,99,235,0.15)] relative z-0">
      {/* Telemetry Status HUD */}
      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-3 bg-zinc-950/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 shadow-xl pointer-events-auto">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="text-[10px] font-black tracking-widest uppercase text-white">
            {isConnected ? 'RADAR ONLINE' : 'RECONNECTING'}
          </span>
        </div>
        <div className="h-3 w-px bg-white/10" />
        <span className="text-[10px] font-black text-sky-400 tracking-wider uppercase">
          {activeRidersCount} {activeRidersCount === 1 ? 'RIDER' : 'RIDERS'} LIVE
        </span>
      </div>

      {/* Map Surface */}
      <MapContainer
        center={[12.8231, 80.0453]}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {/* Campus Hub Markers */}
        {CAMPUS_HUBS.map((hub) => (
          <Marker
            key={hub.name}
            position={[hub.lat, hub.lon]}
            icon={createHubIcon(hub)}
          >
            <Popup className="zenvy-dark-popup">
              <div style={{ background: '#09090b', color: '#fff', padding: '10px 12px', borderRadius: '12px', minWidth: '180px' }}>
                <div style={{ fontSize: '10px', fontWeight: '900', color: '#38BDF8', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '2px' }}>
                  {hub.tag}
                </div>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#ffffff' }}>
                  {hub.name}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Live Rider Pins */}
        {Object.entries(riders).map(([id, pos]) => (
          <Marker
            key={id}
            position={[pos.lat, pos.lon]}
            icon={createRiderIcon(id)}
          >
            <Popup className="zenvy-dark-popup">
              <div style={{ background: '#09090b', color: '#fff', padding: '10px 12px', borderRadius: '12px', minWidth: '190px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '9px', fontWeight: '900', color: '#10B981', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    🟢 ACTIVE TRANSMISSION
                  </span>
                  <span style={{ fontSize: '9px', color: '#9CA3AF' }}>
                    #{id.slice(-6).toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#ffffff', marginBottom: '2px' }}>
                  {pos.name || 'Fleet Delivery Partner'}
                </div>
                <div style={{ fontSize: '10px', color: '#6B7280' }}>
                  Coords: {pos.lat.toFixed(4)}, {pos.lon.toFixed(4)}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
