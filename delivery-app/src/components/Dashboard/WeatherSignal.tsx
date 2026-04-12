"use client";
import React, { useEffect, useState } from 'react';

const WMO_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear', icon: '☀️' },
  1: { label: 'Mostly Clear', icon: '🌤️' },
  2: { label: 'Partly Cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Foggy', icon: '🌫️' },
  48: { label: 'Icy Fog', icon: '🌫️' },
  51: { label: 'Drizzle', icon: '🌦️' },
  61: { label: 'Rain', icon: '🌧️' },
  71: { label: 'Snow', icon: '❄️' },
  80: { label: 'Showers', icon: '🌦️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
};

function getNetworkQuality(): { label: string; color: string; bars: number } {
  const conn = (navigator as any).connection;
  if (!conn) return { label: 'Unknown', color: 'text-gray-500', bars: 2 };
  const type = conn.effectiveType;
  if (type === '4g') return { label: '4G', color: 'text-emerald-400', bars: 4 };
  if (type === '3g') return { label: '3G', color: 'text-yellow-400', bars: 3 };
  if (type === '2g') return { label: '2G', color: 'text-orange-400', bars: 2 };
  return { label: 'Slow', color: 'text-red-400', bars: 1 };
}

export default function WeatherSignal() {
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);
  const [network, setNetwork] = useState(getNetworkQuality());

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`
        );
        const d = await r.json();
        setWeather({
          temp: Math.round(d.current_weather.temperature),
          code: d.current_weather.weathercode
        });
      } catch {}
    });

    const conn = (navigator as any).connection;
    if (conn) {
      const update = () => setNetwork(getNetworkQuality());
      conn.addEventListener('change', update);
      return () => conn.removeEventListener('change', update);
    }
  }, []);

  const wInfo = weather ? (WMO_CODES[weather.code] || { label: 'Unknown', icon: '🌡️' }) : null;

  return (
    <div className="bg-[#111113] border border-white/5 rounded-[24px] p-4 flex items-center justify-between mb-4">
      {/* Weather */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">{wInfo?.icon ?? '🌡️'}</span>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Conditions</p>
          <p className="text-sm font-black text-white">
            {weather ? `${weather.temp}°C · ${wInfo?.label}` : 'Loading...'}
          </p>
        </div>
      </div>
      {/* Network */}
      <div className="flex items-center gap-2">
        <div className="flex items-end gap-[2px] h-5">
          {[1,2,3,4].map(b => (
            <div
              key={b}
              className={`w-1.5 rounded-sm transition-all ${b <= network.bars ? network.color.replace('text-', 'bg-') : 'bg-white/10'}`}
              style={{ height: `${b * 5}px` }}
            />
          ))}
        </div>
        <span className={`text-[10px] font-black ${network.color}`}>{network.label}</span>
      </div>
    </div>
  );
}
