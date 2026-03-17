"use client";
import Link from 'next/link';

export default function RewardsPage() {
  return (
    <main className="min-h-screen bg-background text-white p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <Link href="/profile" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-black uppercase tracking-widest">Rewards</h1>
        <div className="w-10" />
      </div>

      {/* Streak Card */}
      <div className="bg-card-bg p-8 rounded-[40px] border border-white/5 mb-8">
        <div className="flex justify-between items-end mb-6">
          <div>
            <p className="text-[10px] font-black text-secondary-text uppercase tracking-widest mb-2">Current Streak</p>
            <h2 className="text-5xl font-black">
              <span className="text-primary-yellow">🔥</span> 0 Days
            </h2>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-secondary-text uppercase tracking-widest mb-1">Tier</p>
            <p className="text-xs font-black text-primary-yellow uppercase">STARTER</p>
          </div>
        </div>
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-primary-yellow rounded-full w-[0%] transition-all duration-1000" />
        </div>
        <p className="text-secondary-text text-xs mt-4">
          Order daily to build your streak and unlock exclusive rewards!
        </p>
      </div>

      {/* Reward Tiers */}
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary-text mb-6">Unlock Rewards</h3>
      <div className="space-y-4">
        <div className="bg-card-bg p-6 rounded-[30px] border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-xl border border-white/10">🥉</div>
          <div className="flex-1">
            <h4 className="text-sm font-black">3 Day Streak</h4>
            <p className="text-[10px] text-secondary-text">Free delivery on next order</p>
          </div>
          <span className="text-[10px] font-black text-secondary-text uppercase">Locked</span>
        </div>
        <div className="bg-card-bg p-6 rounded-[30px] border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-xl border border-white/10">🥈</div>
          <div className="flex-1">
            <h4 className="text-sm font-black">7 Day Streak</h4>
            <p className="text-[10px] text-secondary-text">₹50 off your next order</p>
          </div>
          <span className="text-[10px] font-black text-secondary-text uppercase">Locked</span>
        </div>
        <div className="bg-card-bg p-6 rounded-[30px] border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-xl border border-white/10">🥇</div>
          <div className="flex-1">
            <h4 className="text-sm font-black">14 Day Streak</h4>
            <p className="text-[10px] text-secondary-text">Free meal from any restaurant</p>
          </div>
          <span className="text-[10px] font-black text-secondary-text uppercase">Locked</span>
        </div>
      </div>
    </main>
  );
}
