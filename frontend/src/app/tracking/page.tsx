"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import io from 'socket.io-client';

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  const [status, setStatus] = useState(1); 
  const [location, setLocation] = useState({ lat: 0, lng: 0 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [orderInfo, setOrderInfo] = useState<any>(null);

  useEffect(() => {
    if (!orderId) return;

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000');
    
    socket.emit('joinOrder', orderId);

    socket.on('statusUpdated', (newStatus: string) => {
      if (newStatus === 'Accepted') setStatus(1);
      if (newStatus === 'Picked Up') setStatus(2);
      if (newStatus === 'Delivered') setStatus(3);
    });

    socket.on('locationUpdated', (coords: { lat: number, lng: number }) => {
      setLocation(coords);
    });

    // Fetch initial order info
    const fetchOrder = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/orders/${orderId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setOrderInfo(data);
        if (data.status === 'Accepted') setStatus(1);
        if (data.status === 'Picked Up') setStatus(2);
        if (data.status === 'Delivered') setStatus(3);
      } catch (err) {
        console.error('Error fetching order:', err);
      }
    };

    fetchOrder();

    return () => {
      socket.disconnect();
    };
  }, [orderId]);

  const steps = [
    { label: 'Order Accepted', time: 'Just now', desc: 'The restaurant is preparing your meal.' },
    { label: 'Out for Delivery', time: 'Soon', desc: 'Rider is on the way to your Hostel Block.' },
    { label: 'Arrived', time: 'Estimated 5m', desc: 'Pick up your food at the designated spot.' }
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

      {/* Map Visualizer */}
      <div className="bg-card-bg w-full aspect-video rounded-[40px] border border-white/5 mb-12 overflow-hidden relative">
         <div className="absolute inset-0 bg-[#0d0d0d]" />
         <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
               <div className="w-24 h-24 bg-primary-yellow/10 rounded-full animate-pulse absolute -inset-2" />
               <div className="w-20 h-20 bg-primary-yellow rounded-full flex flex-col items-center justify-center text-black z-10 relative">
                  <span className="text-2xl">🛵</span>
                  <span className="text-[8px] font-black uppercase tracking-tighter">On The Way</span>
               </div>
            </div>
         </div>
         {/* Simple coordinate display for "Live" feel */}
         <div className="absolute bottom-6 left-6 font-mono text-[8px] opacity-30">
           LAT: {location.lat.toFixed(4) || '16.5062'} <br />
           LNG: {location.lng.toFixed(4) || '80.6480'}
         </div>
      </div>

      {/* Status Timeline */}
      <div className="space-y-12 pl-4">
        {steps.map((step, idx) => {
          const isActive = status >= idx + 1;
          const isCurrent = status === idx + 1;
          
          return (
            <div key={idx} className={`relative flex gap-8 ${!isActive ? 'opacity-30' : 'opacity-100'}`}>
               {idx !== steps.length - 1 && (
                 <div className={`absolute top-10 left-3 w-[2px] h-12 bg-white/10 ${isActive && status > idx + 1 ? 'bg-primary-yellow/50' : ''}`} />
               )}
               
               <div className={`w-6 h-6 rounded-full shrink-0 mt-2 z-10 flex items-center justify-center border-4 ${isActive ? 'bg-primary-yellow border-black shadow-[0_0_15px_rgba(247,211,49,0.5)]' : 'bg-black border-white/10'}`}>
                  {isCurrent && <div className="w-1.5 h-1.5 bg-black rounded-full animate-ping" />}
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

      {/* Dynamic Order Summary */}
      {orderInfo && (
        <div className="mt-20 p-8 bg-card-bg rounded-[40px] border border-white/5 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                 🍱
              </div>
              <div>
                 <h4 className="text-sm font-black uppercase">ORDER #{orderId?.slice(-5)}</h4>
                 <p className="text-[10px] font-bold text-secondary-text">
                   {orderInfo.items.length} Item{orderInfo.items.length > 1 ? 's' : ''} • ₹{orderInfo.totalPrice}
                 </p>
              </div>
           </div>
           <Link href="/help" className="text-[10px] font-black uppercase tracking-widest text-primary-yellow">Support</Link>
        </div>
      )}
    </main>
  );
}
