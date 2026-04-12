"use client";
import React, { useEffect, useState } from 'react';

export default function SpeedoWidget() {
  const [speed, setSpeed] = useState<number | null>(null);
  const [direction, setDirection] = useState<string>('—');

  const headingToDirection = (h: number) => {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(h / 45) % 8];
  };

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const spd = pos.coords.speed;
        setSpeed(spd !== null ? Math.round(spd * 3.6) : 0); // m/s → km/h
        if (pos.coords.heading !== null) setDirection(headingToDirection(pos.coords.heading));
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const speedVal = speed ?? 0;
  const isMoving = speedVal > 2;

  return (
    <div className="bg-[#111113] border border-white/5 rounded-[24px] p-4 flex items-center gap-4">
      <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center shrink-0">
        <span className={`text-lg font-black leading-none ${isMoving ? 'text-emerald-400' : 'text-gray-600'}`}>{speedVal}</span>
        <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">km/h</span>
      </div>
      <div className="flex-1">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Live Speedo</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-sm font-black ${isMoving ? 'text-white' : 'text-gray-500'}`}>
            {isMoving ? 'In Motion' : 'Stationary'}
          </span>
          {direction !== '—' && (
            <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded font-black text-gray-400">{direction}</span>
          )}
        </div>
        {speedVal > 50 && (
          <p className="text-[8px] text-yellow-500 font-black uppercase tracking-widest mt-0.5 animate-pulse">⚠️ Reduce Speed</p>
        )}
      </div>
    </div>
  );
}
