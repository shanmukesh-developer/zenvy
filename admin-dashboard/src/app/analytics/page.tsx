"use client";
import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

interface Metric {
  label: string;
  value: string;
  subtext: string;
  percent: number;
}

export default function AnalyticsIntel() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metric[]>([
    { label: 'System Bandwidth', value: '89.4 Mbps', subtext: 'Peak Usage', percent: 89 },
    { label: 'API Response Speed', value: '42.1 ms', subtext: 'Avg Latency', percent: 95 },
    { label: 'Cluster Elasticity', value: '94.2%', subtext: 'Load Tolerance', percent: 94 },
    { label: 'Sync Redundancy', value: '100%', subtext: 'Data Integrity', percent: 100 },
  ]);

  useEffect(() => {
     // Fetch aggregates or simulate loading delay for sync effect
     const timer = setTimeout(() => {
        setLoading(false);
     }, 1000);
     return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-12 animate-fade-in relative pb-20">
      <header className="flex justify-between items-center bg-white/5 p-8 rounded-[40px] border border-white/5 glass">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Nexus <span className="text-blue-500">Performance Intel</span></h2>
          <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">Deep Metrics & Node Bandwidth Tracking</p>
        </div>
        <div className="flex gap-4">
           <div className="glass px-10 py-4 rounded-3xl border border-white/10 flex flex-col items-center">
              <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Audit Node</span>
              <span className="text-xl font-black text-white tracking-tighter">SRM_ALPHA_01</span>
           </div>
        </div>
      </header>

      {loading ? (
        <div className="py-20 text-center font-black text-gray-500 animate-pulse tracking-widest uppercase">Aggregating Global Node Telemetry...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {metrics.map((metric, i) => (
              <div key={i} className="glass-card p-8 group overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/[0.03] blur-[40px] group-hover:bg-blue-600/[0.08] transition-all" />
                <p className="stat-label tracking-[0.2em]">{metric.label}</p>
                <div className="space-y-4 mt-2">
                   <h4 className="text-3xl font-black text-white">{metric.value}</h4>
                   <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.4)] transition-all duration-1000" style={{ width: `${metric.percent}%` }} />
                   </div>
                   <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">{metric.subtext}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
             <div className="glass-card p-10 space-y-6">
                <h3 className="text-xl font-black tracking-tighter uppercase text-white">Node response <span className="text-blue-500">Frequency</span></h3>
                <p className="text-xs text-gray-500 leading-relaxed max-w-lg">Continuous telemetry ping analysis from local SRM-Alpha hubs to visual interface pipeline routing.</p>
                {/* Simulated Chart via SVGs */}
                <div className="h-48 flex items-end gap-2 pt-10">
                   {[40, 60, 45, 80, 50, 90, 75, 40, 85, 60, 95, 30].map((h, i) => (
                      <div key={i} className="flex-1 bg-white/5 rounded-t-lg relative group overflow-hidden" style={{ height: `${h}%` }}>
                         <div className="absolute inset-x-0 bottom-0 bg-blue-500/30 group-hover:bg-blue-500/60 transition-all duration-500" style={{ height: '100%' }} />
                         <div className="absolute inset-0 bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                   ))}
                </div>
                 <div className="flex justify-between text-[8px] font-black text-gray-600 uppercase tracking-widest px-2">
                    <span>12:00</span><span>13:00</span><span>14:00</span><span>15:00</span><span>16:00</span><span>17:00</span>
                 </div>
             </div>

             <div className="glass-card p-10 space-y-6 flex flex-col justify-center">
                <h3 className="text-xl font-black tracking-tighter uppercase text-white">Interlink <span className="text-emerald-500">Integrity</span></h3>
                <div className="space-y-4">
                   {[
                     { name: 'SRM_ALPHA_01', type: 'Core Server', status: 'Operational', latency: '12ms' },
                     { name: 'FRONTEND_M1', type: 'Node Frame', status: 'Operational', latency: '4ms' },
                     { name: 'RIDER_HUB_01', type: 'Broadband', status: 'Slight Lag', latency: '120ms' },
                   ].map((node, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                         <div>
                            <p className="text-sm font-bold text-white tracking-wide">{node.name}</p>
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{node.type}</p>
                         </div>
                         <div className="text-right">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${
                               node.status === 'Slight Lag' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                            }`}>{node.status}</span>
                            <p className="text-[9px] text-gray-600 font-bold mt-1">{node.latency}</p>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </div>
        </>
      )}
    </div>
  );
}

