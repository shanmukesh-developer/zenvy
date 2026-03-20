"use client";
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import io from 'socket.io-client';

import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

const RESTAURANT_COORD = { lat: 16.4645, lng: 80.5050 };
const HOME_COORD = { lat: 16.4632, lng: 80.5064 };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

interface OrderInfo {
  _id: string;
  status: string;
  totalPrice: number;
  items?: { name: string; quantity: number }[];
}

function MapDirections({ origin, destination }: { origin: {lat: number, lng: number}, destination: {lat: number, lng: number} }) {
  const map = useMap();
  const routesLibrary = useMapsLibrary('routes');
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    if (!routesLibrary || !map) return;
    setDirectionsService(new routesLibrary.DirectionsService());
    setDirectionsRenderer(new routesLibrary.DirectionsRenderer({ 
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#3b82f6',
        strokeWeight: 5,
        strokeOpacity: 0.8
      }
    }));
  }, [routesLibrary, map]);

  useEffect(() => {
    if (!directionsService || !directionsRenderer) return;

    directionsService.route({
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
    }).then((response) => {
      directionsRenderer.setDirections(response);
    }).catch((err) => console.error("Directions route failed: ", err));
  }, [directionsService, directionsRenderer, origin, destination]);

  return null;
}

function TrackingContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  const [status, setStatus] = useState(1); 
  const [location, setLocation] = useState(RESTAURANT_COORD); // Default start
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const [isElite, setIsElite] = useState(false);
  const [captainSpeed, setCaptainSpeed] = useState(12.4);

  useEffect(() => {
    // Check elite status from local storage
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setIsElite(parsed.isElite || false);
      }
    } catch { /* ignore */ }

    // Random speed flicker for "Live" feel
    const speedInterval = setInterval(() => {
       setCaptainSpeed(prev => {
         const noise = Math.random() * 2 - 1;
         const newSpeed = Math.max(8, Math.min(25, prev + noise));
         return parseFloat(newSpeed.toFixed(1));
       });
    }, 3000);

    if (!orderId) return () => clearInterval(speedInterval);

    const socket = io(SOCKET_URL);
    
    socket.emit('joinOrder', orderId);

    socket.on('statusUpdated', (newStatus: string) => {
      if (newStatus === 'Accepted') setStatus(1);
      if (newStatus === 'PickedUp') setStatus(2);
      if (newStatus === 'Delivered') setStatus(3);
    });

    socket.on('locationUpdated', (coords: { lat: number, lng: number }) => {
      setLocation(coords);
    });

    // Fetch initial order info
    const fetchOrder = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/orders/${orderId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setOrderInfo(data);
        if (data.status === 'Accepted') setStatus(1);
        if (data.status === 'PickedUp') setStatus(2);
        if (data.status === 'Delivered') setStatus(3);
      } catch (err) {
        console.error('Error fetching order:', err);
      }
    };

    fetchOrder();

    return () => {
      socket.disconnect();
      clearInterval(speedInterval);
    };
  }, [orderId]);

  const steps = [
    { label: 'Order Accepted', time: 'Just now', desc: 'The restaurant is preparing your meal.' },
    { label: 'Out for Delivery', time: 'Soon', desc: 'Rider is on the way to your Hostel Block.' },
    { label: 'Arrived', time: 'Estimated 5m', desc: 'Pick up your food at the designated spot.' }
  ];

  const mapId = "4f8f4a1f5a5a5a5a"; // Placeholder Map ID for styling

  return (
    <main className="min-h-screen bg-background text-white p-8 animate-page">
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

      {/* Real Google Map */}
      <div className="bg-card-bg w-full aspect-video rounded-[40px] border border-white/5 mb-12 overflow-hidden relative shadow-2xl">
         <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
            <Map
              defaultCenter={HOME_COORD}
              center={location}
              defaultZoom={15}
              gestureHandling={'greedy'}
              disableDefaultUI={true}
              mapId={mapId}
              style={{ width: '100%', height: '100%' }}
            >
              <MapDirections origin={RESTAURANT_COORD} destination={HOME_COORD} />

              <AdvancedMarker position={RESTAURANT_COORD}>
                 <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm shadow-[0_0_15px_rgba(59,130,246,0.5)] border-2 border-black">🏪</div>
              </AdvancedMarker>

              <AdvancedMarker position={HOME_COORD}>
                 <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-sm shadow-[0_0_15px_rgba(16,185,129,0.5)] border-2 border-black">🏠</div>
              </AdvancedMarker>

              <AdvancedMarker position={location} zIndex={50}>
                <div className="relative">
                   <div className="w-12 h-12 bg-primary-yellow rounded-full flex items-center justify-center text-xl shadow-[0_0_20px_rgba(247,211,49,0.5)] border-2 border-black">
                      🛵
                   </div>
                   <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-[8px] font-black uppercase whitespace-nowrap border border-white/10">
                      Rider is Here
                   </div>
                </div>
              </AdvancedMarker>
            </Map>
         </APIProvider>
         
         {/* Simple coordinate display for "Live" feel */}
         <div className="absolute top-6 right-6 font-mono text-[8px] opacity-30 bg-black/50 p-2 rounded-xl backdrop-blur-md">
           LAT: {location.lat.toFixed(4)} <br />
           LNG: {location.lng.toFixed(4)}
         </div>
      </div>

      {/* Live Sync Status & Telemetry */}
      <div className="flex gap-4 mb-8">
        <div className="flex-[2] glass-card p-6 border-[#C9A84C]/20 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
              <span className="text-[40px] font-black italic">ELITE</span>
           </div>
           
           <div className="flex items-center gap-5 relative z-10">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                 <Image 
                   src="/assets/zenvy_delivery_captain_avatar_1773840269845.png" 
                   alt="Captain" 
                   width={64} 
                   height={64} 
                   className="object-cover"
                 />
              </div>
              <div className="flex-1">
                 <div className="flex justify-between items-start">
                    <div>
                       <div className="flex items-center gap-1.5 mb-1">
                         <p className="text-[8px] font-black uppercase tracking-[0.3em] text-primary-yellow">Delivery Captain</p>
                         <span className="bg-emerald-500/10 text-emerald-500 text-[6px] font-black px-1.5 py-0.5 rounded border border-emerald-500/20">VERIFIED</span>
                       </div>
                       <h3 className="text-sm font-black text-white">Captain Aryan • 4.9⭐</h3>
                       <p className="text-[7px] font-bold text-secondary-text uppercase tracking-widest mt-0.5 whitespace-nowrap">SRM Eco-Cycle #72</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[8px] font-black text-secondary-text uppercase mb-1">Live Speed</p>
                       <p className="text-xs font-black text-white italic">{captainSpeed} km/h</p>
                    </div>
                 </div>
                 <div className="w-full h-1 bg-white/5 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-primary-yellow w-3/4 animate-pulse relative">
                       <div className="absolute inset-0 bg-white/20 animate-shimmer" />
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <div className="flex-1 glass-card p-6 border-white/[0.05] flex flex-col justify-center items-center">
           {isElite ? (
             <>
               <p className="text-[8px] font-black uppercase tracking-[0.3em] text-primary-yellow mb-2 text-center">Elite Package</p>
               <div className="flex items-center gap-2">
                  <span className="text-xl">✨</span>
                  <span className="text-sm font-black text-[#C9A84C]">PRIORITY</span>
               </div>
               <p className="text-[6px] font-black text-white uppercase mt-2 text-center">VIP Handling <br /> Activated</p>
             </>
           ) : (
             <>
               <p className="text-[8px] font-black uppercase tracking-[0.3em] text-secondary-text mb-2 text-center">Hostel Power-Up</p>
               <div className="flex items-center gap-2">
                  <span className="text-xl">🔥</span>
                  <span className="text-sm font-black text-primary-yellow">4/5</span>
               </div>
               <p className="text-[6px] font-black text-secondary-text uppercase mt-2 text-center">1 more to unlock <br /> <span className="text-white">FREE DESSERT</span></p>
             </>
           )}
        </div>
      </div>

      {/* Status Timeline */}
      <div className="space-y-10 pl-6 relative">
        {steps.map((step, idx) => {
          const isActive = status >= idx + 1;
          const isCurrent = status === idx + 1;
          
          return (
            <div key={idx} className={`relative flex gap-10 transition-all duration-700 ${!isActive ? 'opacity-20 translate-x-4' : 'opacity-100 translate-x-0'}`}>
               {idx !== steps.length - 1 && (
                 <div className={`timeline-line ${isActive && status > idx + 1 ? 'active' : ''}`} />
               )}
               
               <div className={`timeline-dot shrink-0 mt-1.5 ${isActive ? 'active' : ''}`}>
                  {isCurrent && <div className="absolute inset-[-4px] rounded-full border border-primary-gold/30 animate-ping" />}
               </div>
 
               <div className="pb-4">
                  <div className="flex flex-col mb-1">
                     <span className={`text-[9px] font-black uppercase tracking-[0.3em] mb-1 ${isCurrent ? 'text-primary-gold' : 'text-secondary-text'}`}>
                        {isCurrent ? 'Current Status' : isActive ? 'Completed' : 'Upcoming'}
                     </span>
                     <h3 className="font-black text-sm uppercase tracking-widest">{step.label}</h3>
                  </div>
                  <p className="text-[11px] text-secondary-text leading-relaxed font-medium">
                     {step.desc}
                  </p>
                  {isCurrent && (
                     <div className="mt-4 px-3 py-1.5 bg-primary-gold/10 border border-primary-gold/20 rounded-full inline-flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-primary-gold animate-pulse" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-primary-gold">{step.time}</span>
                     </div>
                  )}
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
                   {orderInfo?.items?.length || 1} Item{(orderInfo?.items?.length || 1) > 1 ? 's' : ''} • ₹{orderInfo.totalPrice}
                 </p>
              </div>
           </div>
           <Link href="/help" className="text-[10px] font-black uppercase tracking-widest text-primary-yellow">Support</Link>
        </div>
      )}
    </main>
  );
}

export default function TrackingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background text-white p-8 flex items-center justify-center font-black animate-pulse">Loading Tracker...</div>}>
      <TrackingContent />
    </Suspense>
  );
}
