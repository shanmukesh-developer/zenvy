"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useAdminSocket } from '@/components/AdminSocketProvider';


// SRM University AP (Neerukonda / Mangalagiri) - same coordinates as the dashboard CHECKPOINTS.
const CAMPUS_HUBS = [
  { name: 'SRM AP Main Gate', lat: 16.4673, lon: 80.5002, tag: 'GATE', icon: '🏛️' },
  { name: 'Academic Block', lat: 16.4635, lon: 80.5065, tag: 'ACADEMIC', icon: '🏢' },
  { name: 'Hostel Sector', lat: 16.4618, lon: 80.5068, tag: 'HOSTELS', icon: '🛏️' },
  { name: 'Neerukonda', lat: 16.4715, lon: 80.5055, tag: 'VILLAGE', icon: '📍' },
];
const CAMPUS_CENTER: [number, number] = [16.4650, 80.5040];

export default function LiveRiderMap() {
  const [riders, setRiders] = useState<Record<string, { lat: number; lon: number; name?: string; updatedAt: number }>>({});

  // Uses the dashboard's authenticated admin socket (already in admin-room). The server streams
  // rider positions to admin-room as `admin_rider_location`; a pin is drawn only when the event
  // carries real coordinates (lat/lng), never an invented position.
  const { socket, isConnected } = useAdminSocket();

  useEffect(() => {
    if (!socket) return;
    const onLocation = (data: { riderId?: string; riderName?: string; lat?: number; lng?: number; latitude?: number; longitude?: number; isOnline?: boolean }) => {
      const riderId = data?.riderId;
      const lat = Number(data?.lat ?? data?.latitude);
      const lon = Number(data?.lng ?? data?.longitude);
      if (!riderId || !Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return;
      setRiders((prev) => ({
        ...prev,
        [riderId]: { lat, lon, name: data.riderName || prev[riderId]?.name || riderId, updatedAt: Date.now() },
      }));
    };
    const onOffline = (data: { riderId?: string }) => {
      const riderId = data?.riderId;
      if (!riderId) return;
      setRiders((prev) => {
        if (!prev[riderId]) return prev;
        const next = { ...prev };
        delete next[riderId];
        return next;
      });
    };
    socket.on('admin_rider_location', onLocation);
    socket.on('admin_rider_offline', onOffline);
    return () => {
      socket.off('admin_rider_location', onLocation);
      socket.off('admin_rider_offline', onOffline);
    };
  }, [socket]);

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
        center={CAMPUS_CENTER}
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
