"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function ProfilePage() {
  const [userName, setUserName] = useState('Student');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.name) setUserName(parsed.name);
      }
    } catch { /* ignore */ }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/splash';
  };

  return (
    <main className="min-h-screen bg-background text-white p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <Link href="/" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-black uppercase tracking-widest">Profile</h1>
        <div className="w-10" />
      </div>

      {/* Profile Info / Elite Card */}
      <div className="elite-card rounded-[40px] p-8 mb-12 shadow-2xl relative">
        <div className="elite-hologram" />
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-12">
            <div className="w-16 h-16 rounded-full border border-[#C9A84C]/30 p-1 bg-black/40 backdrop-blur-md">
               <div className="w-full h-full bg-gradient-to-br from-[#1C1C1E] to-black rounded-full flex items-center justify-center text-3xl">🧑‍🎓</div>
            </div>
            <div className="text-right">
               <span className="elite-tag text-[10px]">ZENVY ELITE</span>
               <p className="text-[8px] text-secondary-text font-bold uppercase tracking-[0.3em] mt-1">Status: Active</p>
            </div>
          </div>
          
          <div className="mb-8">
            <h2 className="text-3xl font-black mb-1">{userName}</h2>
            <p className="text-[10px] text-secondary-text font-bold uppercase tracking-[0.4em]">SRM AP • Platinum Member</p>
          </div>

          <div className="flex justify-between items-end border-t border-white/5 pt-6">
             <div>
                <p className="text-[7px] text-secondary-text font-bold uppercase tracking-[0.3em] mb-1">Member Since</p>
                <p className="text-[10px] font-black tracking-widest text-[#C9A84C]">MAR 2024</p>
             </div>
             <div className="w-12 h-12 flex items-center justify-center opacity-30">
                <div className="w-8 h-8 rounded-full border-2 border-[#C9A84C] flex items-center justify-center">
                   <span className="text-[8px] font-black text-[#C9A84C]">Z</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Premium Actions */}
      <div className="space-y-4">
         <h3 className="text-[9px] font-black text-secondary-text uppercase tracking-[0.3em] pl-4 mb-4">Account Gourmet</h3>
         
         <Link href="/orders" className="glass-card p-6 rounded-[34px] border border-white/5 flex items-center justify-between group hover:border-[#C9A84C]/20 transition-all">
            <div className="flex items-center gap-5">
               <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">🥡</div>
               <div>
                  <span className="font-black text-sm block">Order History</span>
                  <span className="text-[9px] text-secondary-text font-bold uppercase tracking-widest">3 Active Orders</span>
               </div>
            </div>
            <span className="text-white/10 group-hover:text-[#C9A84C] transition-colors">→</span>
         </Link>

         <Link href="/rewards" className="glass-card p-6 rounded-[34px] border border-white/5 flex items-center justify-between group hover:border-[#C9A84C]/20 transition-all">
            <div className="flex items-center gap-5">
               <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">✨</div>
               <div>
                  <span className="font-black text-sm block">Zenvy Rewards</span>
                  <span className="text-[9px] text-secondary-text font-bold uppercase tracking-widest">2,450 Points</span>
               </div>
            </div>
            <span className="text-white/10 group-hover:text-[#C9A84C] transition-colors">→</span>
         </Link>

         <Link href="/tracking" className="glass-card p-6 rounded-[34px] border border-white/5 flex items-center justify-between group hover:border-[#C9A84C]/20 transition-all">
            <div className="flex items-center gap-5">
               <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">📍</div>
               <div>
                  <span className="font-black text-sm block">Live Tracking</span>
                  <span className="text-[9px] text-secondary-text font-bold uppercase tracking-widest">Real-time GPS</span>
               </div>
            </div>
            <span className="text-white/10 group-hover:text-[#C9A84C] transition-colors">→</span>
         </Link>
      </div>

      {/* Logout */}
      <div className="mt-16 flex flex-col items-center">
        <button 
          onClick={handleLogout}
          className="text-[9px] font-black uppercase tracking-[0.4em] text-red-500/40 hover:text-red-500 transition-all"
        >
           Terminate Session
        </button>
        <div className="mt-8 text-[8px] font-bold text-secondary-text uppercase tracking-[0.5em] opacity-30">
           Zenvy v2.4.9 — Build 8820
        </div>
      </div>
    </main>
  );
}
