"use client";
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

const LeafletMapSub = dynamic(() => import('./LeafletMapSub'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/50 rounded-[32px]">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/50">Loading Tactical Map...</p>
    </div>
  )
});

interface RiderMapProps {
  riderPos?: [number, number];
  destinationPos?: [number, number];
  orders?: { lat: number, lng: number, type: 'store' | 'drop' }[];
}

export default function RiderMap({ riderPos, destinationPos, orders = [] }: RiderMapProps) {
  const [center, setCenter] = useState<[number, number]>([16.4632, 80.5064]);

  useEffect(() => {
    if (riderPos) {
      setCenter(riderPos);
    }
  }, [riderPos]);

  const markers: { position: [number, number]; type: 'rider' | 'store' | 'drop'; label: string }[] = [];
  if (riderPos) markers.push({ position: riderPos, type: 'rider', label: 'You' });
  
  orders.forEach(o => {
    markers.push({ position: [o.lat, o.lng], type: o.type, label: o.type });
  });

  return (
    <div className="w-full h-full rounded-[32px] overflow-hidden border border-white/5 relative shadow-2xl">
      <LeafletMapSub 
        center={center} 
        markers={markers}
        route={riderPos && destinationPos ? [riderPos, destinationPos] : undefined}
      />
      
      {/* HUD Overlay */}
      <div className="absolute top-4 right-4 z-[1000] glass px-3 py-1.5 rounded-xl border border-white/10">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
           <span className="text-[9px] font-black text-white uppercase tracking-widest">Live GPS</span>
        </div>
      </div>
    </div>
  );
}
