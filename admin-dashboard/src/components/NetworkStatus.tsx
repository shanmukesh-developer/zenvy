"use client";
import { useAdminSocket } from '@/components/AdminSocketProvider';

export default function NetworkStatus() {
  const { isConnected } = useAdminSocket();

  return (
    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Live Sync Status</span>
        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${isConnected ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]'}`} />
      </div>
      <p className="text-[11px] font-bold text-gray-400">{isConnected ? 'LIVE REAL-TIME SYNC' : 'AUTO-POLLING STANDBY'}</p>
      <div className="mt-3 w-full h-1 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${isConnected ? 'w-[100%] bg-emerald-500' : 'w-[40%] bg-amber-500'}`} />
      </div>
    </div>
  );
}

