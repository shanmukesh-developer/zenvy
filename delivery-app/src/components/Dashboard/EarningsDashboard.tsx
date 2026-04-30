"use client";
import React from 'react';
import { motion } from 'framer-motion';

interface EarningsDashboardProps {
  onClose: () => void;
  stats: {
    earnings: number;
    orders: number;
    zenPoints: number;
    streak: number;
  };
}

export default function EarningsDashboard({ onClose, stats }: EarningsDashboardProps) {
  // Temporary mock data for weekly graph
  const weeklyData = [
    { day: 'Mon', value: 320 },
    { day: 'Tue', value: 450 },
    { day: 'Wed', value: 0 },
    { day: 'Thu', value: 890 },
    { day: 'Fri', value: 1200 },
    { day: 'Sat', value: 1500 },
    { day: 'Sun', value: stats.earnings },
  ];
  
  const maxVal = Math.max(...weeklyData.map(d => d.value));

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0B]/95 backdrop-blur-3xl flex flex-col pt-safe">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tighter">Payouts & Earnings</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Financial Telemetry</p>
        </div>
        <button 
          onClick={onClose}
          className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-colors"
        >
          <span className="text-xl leading-none">×</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Today's Summary Hero */}
        <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-900/10 border border-emerald-500/20 rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-[60px] rounded-full" />
          
          <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest mb-2">Today&apos;s Commission</p>
          <div className="flex items-end gap-3">
            <h1 className="text-5xl font-black text-white tracking-tighter">₹{stats.earnings}</h1>
            <span className="text-sm font-bold text-emerald-500 mb-2">+12% vs yesterday</span>
          </div>
          
          <div className="flex gap-6 mt-8">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Tasks</p>
              <p className="text-xl font-black text-white">{stats.orders}</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Streak</p>
              <p className="text-xl font-black text-white">{stats.streak} Days</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <p className="text-[10px] text-[#C9A84C] uppercase tracking-widest font-bold">ZenPoints</p>
              <p className="text-xl font-black text-[#C9A84C]">{stats.zenPoints}</p>
            </div>
          </div>
        </div>

        {/* Weekly Chart */}
        <div className="bg-surface border border-white/5 rounded-3xl p-6">
           <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6">Weekly Performance</h3>
           <div className="h-40 flex items-end justify-between gap-2">
             {weeklyData.map((day, idx) => {
               const heightPct = maxVal > 0 ? (day.value / maxVal) * 100 : 0;
               return (
                 <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                   <div className="w-full relative flex-1 flex items-end justify-center">
                      <div className="absolute opacity-0 group-hover:opacity-100 -top-6 text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded transition-opacity">
                        ₹{day.value}
                      </div>
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPct}%` }}
                        transition={{ duration: 1, delay: idx * 0.1, ease: "easeOut" }}
                        className={`w-full max-w-[24px] rounded-t-md transition-all ${idx === 6 ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-white/10 group-hover:bg-white/20'}`} 
                      />
                   </div>
                   <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{day.day}</span>
                 </div>
               );
             })}
           </div>
        </div>

        {/* Action Button */}
        <button className="w-full py-5 rounded-[22px] bg-white text-black font-bold text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-slate-200 transition-colors">
          Withdraw to Bank
        </button>
      </div>
    </div>
  );
}
