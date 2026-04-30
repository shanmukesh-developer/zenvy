"use client";
import React from 'react';
import { motion } from 'framer-motion';

export default function OfflineScreen() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      {/* Animated Scooter */}
      <div className="relative w-36 h-36 flex items-center justify-center mb-10">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 12, ease: 'linear', repeat: Infinity }}
          className="absolute inset-0 border-4 border-slate-800 rounded-full border-dashed"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 20, ease: 'linear', repeat: Infinity }}
          className="absolute inset-[12px] border-2 border-slate-700/40 rounded-full border-dotted"
        />
        <div className="w-24 h-24 bg-[#111115] rounded-full flex items-center justify-center text-4xl shadow-inner border border-white/5">
          🛵
        </div>
      </div>

      <h2 className="text-2xl font-black tracking-tight text-white/40 uppercase mb-3">
        Rider Offline
      </h2>
      <p className="text-slate-600 text-sm font-medium max-w-[220px] leading-relaxed mb-8">
        Toggle <span className="text-blue-500 font-bold">Online</span> above to start receiving delivery orders.
      </p>

      {/* Status pills */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/5">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">No Active Tasks</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">₹30 / Delivery</span>
        </div>
      </div>
    </motion.div>
  );
}
