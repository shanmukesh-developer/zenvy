"use client";
import Link from 'next/link';

export default function ProfilePage() {
  const stats = [
    { label: 'Orders', value: '12' },
    { label: 'Points', value: '450' },
    { label: 'Streak', value: '5 🔥' }
  ];

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
        <h2 className="text-2xl font-black">SRM Stud</h2>
        <p className="text-secondary-text text-sm font-bold uppercase tracking-widest mt-1">Hostel Block C, Room 402</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-12">
         {stats.map((stat) => (
           <div key={stat.label} className="bg-card-bg rounded-[30px] p-4 border border-white/5 text-center">
              <div className="text-primary-yellow font-black text-lg">{stat.value}</div>
              <div className="text-[10px] font-bold text-secondary-text uppercase tracking-widest">{stat.label}</div>
           </div>
         ))}
      </div>

      {/* Actions */}
      <div className="space-y-4">
         <div className="bg-card-bg p-6 rounded-[30px] border border-white/5 flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-4">
               <span className="text-xl">💳</span>
               <span className="font-bold text-sm">Payment Methods</span>
            </div>
            <span className="text-white/20">→</span>
         </div>
         <div className="bg-card-bg p-6 rounded-[30px] border border-white/5 flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-4">
               <span className="text-xl">📍</span>
               <span className="font-bold text-sm">Manage Addresses</span>
            </div>
            <span className="text-white/20">→</span>
         </div>
         <div className="bg-card-bg p-6 rounded-[30px] border border-white/5 flex items-center justify-between cursor-pointer opacity-50">
            <div className="flex items-center gap-4">
               <span className="text-xl">⚙️</span>
               <span className="font-bold text-sm">Settings</span>
            </div>
            <span className="text-white/20">→</span>
         </div>
      </div>

      {/* Logout */}
      <Link href="/splash" className="mt-12 block text-center text-xs font-black uppercase tracking-[0.3em] text-red-500/50 hover:text-red-500 transition-colors">
         Logout Account
      </Link>
    </main>
  );
}
