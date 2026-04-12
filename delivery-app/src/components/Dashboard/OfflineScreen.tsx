"use client";
import React from 'react';

export default function OfflineScreen() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <div className="relative w-32 h-32 flex items-center justify-center mb-8">
         <div className="absolute inset-0 border-4 border-slate-700/50 rounded-full border-dashed animate-[spin_10s_linear_infinite]" />
         <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center text-4xl grayscale filter saturate-0 opacity-50">
           🛵
         </div>
      </div>
      <h2 className="text-2xl font-black mb-2 tracking-tight text-white/50 uppercase">Rider Sentinel Offline</h2>
      <p className="text-gray-500 font-medium max-w-[200px]">Switch to ONLINE mode to initialize tactical order synchronization.</p>
    </div>
  );
}
