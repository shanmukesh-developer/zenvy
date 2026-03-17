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

      {/* Profile Info */}
      <div className="flex flex-col items-center mb-12">
        <div className="w-24 h-24 rounded-full border-2 border-primary-yellow p-1 mb-4">
           <div className="w-full h-full bg-card-bg rounded-full flex items-center justify-center text-4xl">🧑‍🎓</div>
        </div>
        <h2 className="text-2xl font-black">{userName}</h2>
        <p className="text-secondary-text text-sm font-bold uppercase tracking-widest mt-1">SRM University AP</p>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
         <Link href="/orders" className="bg-card-bg p-6 rounded-[30px] border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <span className="text-xl">📦</span>
               <span className="font-bold text-sm">My Orders</span>
            </div>
            <span className="text-white/20">→</span>
         </Link>
         <Link href="/rewards" className="bg-card-bg p-6 rounded-[30px] border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <span className="text-xl">🏆</span>
               <span className="font-bold text-sm">Rewards & Streak</span>
            </div>
            <span className="text-white/20">→</span>
         </Link>
         <Link href="/tracking" className="bg-card-bg p-6 rounded-[30px] border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <span className="text-xl">📍</span>
               <span className="font-bold text-sm">Track Order</span>
            </div>
            <span className="text-white/20">→</span>
         </Link>
      </div>

      {/* Logout */}
      <button 
        onClick={handleLogout}
        className="mt-12 block w-full text-center text-xs font-black uppercase tracking-[0.3em] text-red-500/50 hover:text-red-500 transition-colors"
      >
         Logout Account
      </button>
    </main>
  );
}
