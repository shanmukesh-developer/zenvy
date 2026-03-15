"use client";
import Navbar from '@/components/Navbar';
import SpinWheel from '@/components/SpinWheel';

export default function RewardsPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      
      <div className="pt-40 pb-32 px-10 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          
          {/* Left: Streak Stats - Refined */}
          <div className="space-y-12 animate-reveal">
            <div>
              <span className="text-primary font-bold tracking-[0.3em] text-xs uppercase mb-6 block">Loyalty Redefined</span>
              <h1 className="text-6xl font-black serif text-secondary leading-[1.1]">Elite <br />Status <span className="italic font-normal text-primary">Gallery</span></h1>
            </div>
            
            <div className="p-10 border border-black/[0.05] rounded-[40px] space-y-8 bg-[#fafafa]">
              <div className="flex justify-between items-end">
                <div>
                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mb-2 block">Active Distinction</span>
                    <span className="text-5xl font-black serif text-secondary">7 Day <span className="text-primary">🔥</span></span>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
                    <p className="text-xs font-black text-primary uppercase">GOLD TIER</p>
                </div>
              </div>
              
              <div className="h-1.5 w-full bg-black/[0.05] rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full w-[70%] transition-all duration-1000" />
              </div>
              
              <p className="text-gray-500 text-sm italic leading-relaxed">
                Maintain your distinction for 3 more cycles to unlock the **Chef's Complimentary Menu** for the entire semester.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="p-8 border border-black/[0.05] rounded-3xl group hover:border-primary transition-all duration-500">
                <span className="block text-3xl font-bold serif text-secondary mb-1">24</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-tight">Exceptional <br />Dining Experiences</span>
              </div>
              <div className="p-8 border border-black/[0.05] rounded-3xl group hover:border-primary transition-all duration-500">
                <span className="block text-3xl font-bold serif text-secondary mb-1">₹1,240</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-tight">Cumulative <br />Privilege Savings</span>
              </div>
            </div>
          </div>

          {/* Right: Spin Wheel - Subtly adapted */}
          <div className="flex justify-center animate-reveal" style={{ animationDelay: '0.2s' }}>
            <div className="relative">
                {/* Decorative Frame for the wheel */}
                <div className="absolute inset-x-[-40px] inset-y-[-40px] border border-black/[0.03] rounded-full -z-10" />
                <SpinWheel />
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
