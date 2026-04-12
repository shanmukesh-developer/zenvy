"use client";
import React from 'react';
import { motion } from 'framer-motion';

interface RiderNavbarProps {
  driverName: string;
  driverPhoto?: string;
  isOnline: boolean;
  toggleOnline: () => void;
  onLogout: () => void;
  onOpenProfile: () => void;
  currentEarnings?: number;
}

export default function RiderNavbar({ 
  driverName, 
  driverPhoto, 
  isOnline, 
  toggleOnline, 
  onLogout, 
  onOpenProfile,
  currentEarnings = 0
}: RiderNavbarProps) {
  return (
    <nav className="flex justify-between items-center mb-8 px-1">
      {/* Identity Segment */}
      <button 
        onClick={onOpenProfile}
        className="flex items-center gap-3.5 group"
      >
        <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10 group-hover:border-blue-500/50 transition-all shadow-sm">
          {driverPhoto ? (
            <img src={driverPhoto} alt={driverName} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <div className="w-full h-full bg-surface-dark flex items-center justify-center text-xl">👤</div>
          )}
        </div>
        <div className="text-left">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-0.5">Verified Profile</p>
          <p className="text-[15px] font-bold text-white tracking-tight">{driverName}</p>
        </div>
      </button>

      {/* Persistence Segment */}
      <div className="flex items-center gap-3 bg-surface border border-white/5 p-1.5 rounded-2xl shadow-lg">
        <button 
          onClick={toggleOnline}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl transition-all duration-300 font-bold text-[10px] uppercase tracking-widest ${
            isOnline 
            ? 'bg-blue-600 text-white shadow-lg' 
            : 'bg-white/[0.03] text-slate-500 hover:text-slate-300'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-white blur-[1px]' : 'bg-slate-700'}`} />
          {isOnline ? 'Online' : 'Offline'}
        </button>

        <button 
          onClick={onLogout}
          className="p-2.5 text-slate-600 hover:text-red-500 transition-colors"
          title="Sign Out"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
