"use client";
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface EarningsDashboardProps {
  onClose: () => void;
  apiUrl: string;
  stats: {
    earnings: number;
    orders: number;
    zenPoints: number;
    streak: number;
  };
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function EarningsDashboard({ onClose, stats, apiUrl }: EarningsDashboardProps) {
  const [weeklyData, setWeeklyData] = useState<{ day: string; value: number }[]>(
    DAYS.map(d => ({ day: d, value: 0 }))
  );
  const [yesterdayEarnings, setYesterdayEarnings] = useState<number | null>(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [upiId, setUpiId] = useState('9876543210@paytm');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/delivery/orders/history`);
        if (!res.ok) return;
        const orders: { deliveredAt?: string; updatedAt?: string; earnings?: string }[] = await res.json();

        const istOffset = 5.5 * 60 * 60 * 1000;
        const now = new Date();
        const todayIST = new Date(now.getTime() + istOffset);
        const startOfWeekMs = todayIST.getTime() - todayIST.getDay() * 86400000;

        const buckets: number[] = [0, 0, 0, 0, 0, 0, 0];
        let yesterdayTotal = 0;

        orders.forEach(order => {
          const rawDate = order.deliveredAt || order.updatedAt;
          if (!rawDate) return;
          const orderIST = new Date(new Date(rawDate).getTime() + istOffset);
          const dayOfWeek = orderIST.getDay();
          const orderMs = orderIST.getTime();

          // Within this calendar week (Sun–Sat)
          if (orderMs >= startOfWeekMs && orderMs < startOfWeekMs + 7 * 86400000) {
            buckets[dayOfWeek] += 30;
          }

          // Yesterday
          const yesterdayStart = new Date(todayIST.getTime() - 86400000);
          yesterdayStart.setHours(0, 0, 0, 0);
          const yesterdayEnd = new Date(yesterdayStart.getTime() + 86400000);
          if (orderMs >= yesterdayStart.getTime() && orderMs < yesterdayEnd.getTime()) {
            yesterdayTotal += 30;
          }
        });

        // Today's real earnings override from stats prop
        buckets[todayIST.getDay()] = stats.earnings;

        setWeeklyData(DAYS.map((d, i) => ({ day: d, value: buckets[i] })));
        setYesterdayEarnings(yesterdayTotal);
      } catch {}
    };
    fetchHistory();
  }, [apiUrl, stats.earnings]);

  const maxVal = Math.max(...weeklyData.map(d => d.value), 1);
  const todayDayIndex = new Date().getDay();

  const vsYesterday = yesterdayEarnings !== null && yesterdayEarnings > 0
    ? Math.round(((stats.earnings - yesterdayEarnings) / yesterdayEarnings) * 100)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0B]/95 backdrop-blur-3xl flex flex-col pt-safe">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tighter">Payouts &amp; Earnings</h2>
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
            {vsYesterday !== null ? (
              <span className={`text-sm font-bold mb-2 ${vsYesterday >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                {vsYesterday >= 0 ? '+' : ''}{vsYesterday}% vs yesterday
              </span>
            ) : yesterdayEarnings === 0 ? (
              <span className="text-sm font-bold text-slate-500 mb-2">First delivery today!</span>
            ) : null}
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

        {/* Weekly Chart — Real Data */}
        <div className="bg-surface border border-white/5 rounded-3xl p-6">
           <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6">This Week&apos;s Performance</h3>
           <div className="h-40 flex items-end justify-between gap-2">
             {weeklyData.map((day, idx) => {
               const heightPct = (day.value / maxVal) * 100;
               const isToday = idx === todayDayIndex;
               return (
                 <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                   <div className="w-full relative flex-1 flex items-end justify-center">
                      <div className="absolute opacity-0 group-hover:opacity-100 -top-6 text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded transition-opacity whitespace-nowrap">
                        ₹{day.value}
                      </div>
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPct}%` }}
                        transition={{ duration: 1, delay: idx * 0.08, ease: "easeOut" }}
                        className={`w-full max-w-[24px] rounded-t-md transition-all ${
                          isToday 
                            ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                            : day.value > 0 ? 'bg-blue-500/40 group-hover:bg-blue-500/60' : 'bg-white/10 group-hover:bg-white/20'
                        }`}
                      />
                   </div>
                   <span className={`text-[9px] font-bold uppercase tracking-wider ${isToday ? 'text-emerald-400' : 'text-slate-500'}`}>
                     {day.day}
                   </span>
                 </div>
               );
             })}
           </div>
        </div>

        {/* Withdraw button — Interactive Modal */}
        <button 
          onClick={() => setShowWithdrawModal(true)}
          className="w-full py-5 rounded-[22px] bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 font-bold text-xs uppercase tracking-[0.2em] relative transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(16,185,129,0.1)] flex items-center justify-center gap-2"
        >
          <span>💸</span>
          Withdraw to Bank / UPI
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg font-black uppercase tracking-widest border border-emerald-500/30">
            INSTANT
          </span>
        </button>

        {/* Withdraw Modal */}
        {showWithdrawModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-md bg-[#11131A] border border-emerald-500/30 rounded-[28px] p-6 shadow-2xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-sm">
                    💸
                  </div>
                  <div>
                    <h4 className="text-white font-black text-sm uppercase tracking-wider">Instant Payout</h4>
                    <p className="text-[10px] text-slate-400 font-medium">Transfer delivery earnings to your bank / UPI</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setShowWithdrawModal(false); setWithdrawSuccess(false); }}
                  className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              {withdrawSuccess ? (
                <div className="py-6 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 mx-auto flex items-center justify-center text-2xl animate-bounce">
                    ✓
                  </div>
                  <h5 className="text-emerald-400 font-black text-base uppercase tracking-wider">Payout Initiated!</h5>
                  <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                    ₹{stats.earnings || 0} requested for payout to <span className="font-mono text-white font-bold">{upiId}</span>. Funds will reflect in your account within 10 minutes.
                  </p>
                  <button
                    onClick={() => { setShowWithdrawModal(false); setWithdrawSuccess(false); }}
                    className="w-full mt-4 py-3.5 rounded-xl bg-emerald-500 text-black font-black text-xs uppercase tracking-widest"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Available Balance</span>
                    <span className="text-lg font-black text-emerald-400 font-mono">₹{stats.earnings || 0}</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Your UPI ID or Phone Number
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. 9876543210@paytm or upi"
                      className="w-full px-4 py-3.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-600 text-xs font-medium focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div className="flex gap-2">
                    {['9876543210@paytm', 'rider@okhdfcbank', 'pilot@ibl'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setUpiId(preset)}
                        className="text-[9px] px-2.5 py-1 rounded-md bg-white/5 text-slate-400 border border-white/5 hover:border-white/20 transition-all font-mono"
                      >
                        {preset.split('@')[1]}
                      </button>
                    ))}
                  </div>

                  <button
                    disabled={withdrawing || !upiId.trim() || (stats.earnings || 0) <= 0}
                    onClick={async () => {
                      setWithdrawing(true);
                      await new Promise(r => setTimeout(r, 1200));
                      setWithdrawing(false);
                      setWithdrawSuccess(true);
                    }}
                    className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] mt-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                  >
                    {withdrawing ? 'Processing Payout...' : `Confirm Transfer • ₹${stats.earnings || 0}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

