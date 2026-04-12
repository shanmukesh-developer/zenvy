"use client";
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface LiveStatsBarProps {
  todayEarnings: number;
  todayOrders: number;
  zenPoints: number;
  streak: number;
  dailyGoal?: number;
}

export default function LiveStatsBar({ todayEarnings, todayOrders, zenPoints, streak, dailyGoal = 500 }: LiveStatsBarProps) {
  const [animated, setAnimated] = useState(false);
  const progress = Math.min((todayEarnings / dailyGoal) * 100, 100);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="metric-card !p-6 relative overflow-hidden group">
      {/* Stats Summary Grid */}
      <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-8">
        <div>
            <p className="hud-title text-slate-500 mb-1">Today's Earnings</p>
            <p className="text-2xl font-bold text-white tracking-tight">₹{todayEarnings}</p>
        </div>
        <div>
            <p className="hud-title text-slate-500 mb-1">Completed</p>
            <p className="text-2xl font-bold text-white tracking-tight">{todayOrders}</p>
        </div>
        <div>
            <p className="hud-title text-slate-500 mb-1">Network Points</p>
            <p className="text-2xl font-bold text-white tracking-tight">{zenPoints}</p>
        </div>
        <div>
            <p className="hud-title text-slate-500 mb-1">Daily Streak</p>
            <p className="text-2xl font-bold text-emerald-500 tracking-tight">{streak > 0 ? `+${streak}` : '0'}</p>
        </div>
      </div>

      {/* Target Progress Section */}
      <div className="pt-6 border-t border-white/5">
        <div className="flex justify-between items-center mb-3">
           <div>
             <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest mr-2">Daily Goal</span>
             <span className="text-[10px] font-bold text-blue-500">{Math.round(progress)}% reached</span>
           </div>
           <span className="text-[10px] font-bold text-slate-400 tabular-nums">Goal: ₹{dailyGoal}</span>
        </div>
        
        <div className="relative h-1.5 w-full bg-white/[0.03] rounded-full overflow-hidden">
           <motion.div 
             initial={{ width: 0 }}
             animate={{ width: animated ? `${progress}%` : 0 }}
             transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
             className="absolute inset-y-0 left-0 bg-blue-600 rounded-full"
           />
        </div>
      </div>
    </div>
  );
}
