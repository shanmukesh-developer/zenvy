"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function TrackingPage() {
  const [status, setStatus] = useState(1); // 1: Preparing, 2: Out for delivery, 3: Arrived

  useEffect(() => {
    const timer = setInterval(() => {
      setStatus((prev) => (prev < 3 ? prev + 1 : 1));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const steps = [
    { label: 'Order Received', time: '12:40 PM', desc: 'Saffron Hub is preparing your meal.' },
    { label: 'Out for Delivery', time: '1:05 PM', desc: 'Rider is on the way to your Hostel Gate.' },
    { label: 'Arrived', time: '1:15 PM', desc: 'Pick up your food at the main gate.' }
  ];

  return (
    <main className="min-h-screen bg-background text-white p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <Link href="/" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-black uppercase tracking-widest">Live Tracking</h1>
        <div className="w-10" />
      </div>

      {/* Map Placeholder / Visual */}
      <div className="bg-card-bg w-full aspect-video rounded-[40px] border border-white/5 mb-12 overflow-hidden relative">
         <div className="absolute inset-0 bg-[#111] opacity-50" />
         <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
               <div className="w-20 h-20 bg-primary-yellow/20 rounded-full animate-ping absolute -inset-0" />
               <div className="w-20 h-20 bg-primary-yellow rounded-full flex items-center justify-center text-black font-black z-10 relative">
                  🛵
               </div>
            </div>
         </div>
      </div>

      {/* Status Timeline */}
      <div className="space-y-12 pl-4">
        {steps.map((step, idx) => {
          const isActive = status >= idx + 1;
          const isPending = status < idx + 1;
          
          return (
            <div key={idx} className={`relative flex gap-8 ${isPending ? 'opacity-30' : 'opacity-100'}`}>
               {/* Vertical Line */}
               {idx !== steps.length - 1 && (
                 <div className={`absolute top-10 left-3 w-[2px] h-12 bg-white/10 ${isActive ? 'bg-primary-yellow/50' : ''}`} />
               )}
               
               {/* Circle */}
               <div className={`w-6 h-6 rounded-full shrink-0 mt-2 z-10 flex items-center justify-center border-4 ${isActive ? 'bg-primary-yellow border-black shadow-[0_0_15px_rgba(247,211,49,0.5)]' : 'bg-black border-white/10'}`}>
                  {isActive && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
               </div>

               <div>
                  <div className="flex justify-between items-center mb-1">
                     <h3 className="font-black text-sm uppercase tracking-widest">{step.label}</h3>
                     <span className="text-[10px] font-bold text-secondary-text">{step.time}</span>
                  </div>
                  <p className="text-xs text-secondary-text leading-relaxed">
                     {step.desc}
                  </p>
               </div>
            </div>
          );
        })}
      </div>

      {/* Static Order Summary at bottom */}
      <div className="mt-20 p-8 bg-card-bg rounded-[40px] border border-white/5 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
               📦
            </div>
            <div>
               <h4 className="text-sm font-black">ORDER #HB912</h4>
               <p className="text-[10px] font-bold text-secondary-text">1 Item • ₹249.00</p>
            </div>
         </div>
         <Link href="/help" className="text-[10px] font-black uppercase tracking-widest text-primary-yellow">Support</Link>
      </div>
    </main>
  );
}
