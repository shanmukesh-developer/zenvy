"use client";
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import RestaurantCard from '@/components/RestaurantCard';
import SafeImage from '@/components/SafeImage';
import Image from 'next/image';
import SearchOverlay from '@/components/SearchOverlay';
import IntroOverlay from '@/components/IntroOverlay';
import ZenvyPulse from '@/components/ZenvyPulse';
import BlockWarsLeaderboard from '@/components/BlockWarsLeaderboard';
import TemporalSlider from '@/components/TemporalSlider';
import ZenvyVault from '@/components/ZenvyVault';
import LiveOrderStatusBar from '@/components/LiveOrderStatusBar';
import RatingModal from '@/components/RatingModal';
import ZenvyModal from '@/components/ZenvyModal';
import socket from '@/utils/socket';
import ScrollProgressIndicator from '@/components/ScrollProgressIndicator';
import Magnetic from '@/components/Magnetic';
import { motion } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

import { Restaurant, User } from '@/types';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

interface RentalItem {
  id?: string;
  name?: string;
  price?: number;
  imageUrl?: string;
  tags?: string[];
  restaurantName?: string;
  category?: string;
  specs?: { engine?: string; topSpeed?: string; power?: string; fuel?: string };
  ownerName?: string;
  ownerPhone?: string;
}

interface Order {
  _id: string;
  id?: string;
  status: string;
  totalPrice?: number;
  items?: { name: string; quantity: number; image?: string }[];
  restaurant?: string;
  restaurantId?: string;
  deliverySlot?: string;
  cancelSecondsLeft?: number;
}

export default function Home() {
  const [filter, setFilter] = useState<'all' | 'budget' | 'veg'>('all');
  const [liveRestaurants, setLiveRestaurants] = useState<Restaurant[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [greeting, setGreeting] = useState('');
  const [isAfter9, setIsAfter9] = useState(false);
  const [isAfter930, setIsAfter930] = useState(false);
  const [showIntro, setShowIntro] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isElite, setIsElite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRental, setSelectedRental] = useState<RentalItem | null>(null);
  const [showSpecs, setShowSpecs] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [cancelSecondsLeft, setCancelSecondsLeft] = useState(0);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const gymMode = false;
  
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    onConfirm?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const showModal = (
    title: string, 
    message: string, 
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    onConfirm?: () => void,
    confirmLabel?: string,
    cancelLabel?: string
  ) => {
    setModalConfig({ isOpen: true, title, message, type, onConfirm, confirmLabel, cancelLabel });
  };
  
  const getNextAvailableSlot = useCallback(() => {
    const campusSlots = [
      { id: '1:00 PM', hour: 13, min: 0 },
      { id: '5:00 PM', hour: 17, min: 0 },
      { id: '7:30 PM', hour: 19, min: 30 },
      { id: '8:50 PM', hour: 20, min: 50 },
      { id: '9:30 PM', hour: 21, min: 30 },
      { id: 'TESTING SLOT', hour: 23, min: 59 }
    ];
    const now = new Date();
    return campusSlots.find(slot => {
      const slotDate = new Date();
      slotDate.setHours(slot.hour, slot.min, 0, 0);
      return (slotDate.getTime() - now.getTime()) / (1000 * 60) >= 150;
    });
  }, []);

  const nextSlot = getNextAvailableSlot();

  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      setIsAfter9(false); // Override for testing
      setIsAfter930(false); // Override for testing

      // Countdown Timer Logic
      const next = getNextAvailableSlot();
      if (next) {
        const target = new Date();
        target.setHours(next.hour, next.min, 0, 0);
        const diff = target.getTime() - now.getTime();
        const m = Math.floor(diff / (1000 * 60));
        const s = Math.floor((diff / 1000) % 60);
        setTimeLeft(`${Math.floor(m / 60)}h ${m % 60}m ${s < 10 ? '0' : ''}${s}s`);
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 60000); // Check every minute

    // Check if user has seen the cinematic intro this session
    const hasSeenIntro = sessionStorage.getItem('zenvy_intro_seen');
    setShowIntro(!hasSeenIntro);

    setGreeting(getGreeting());
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.name) setUserName(parsed.name);
        setIsElite(parsed.isElite || false);
        setUser(parsed);
      }
    } catch { /* ignore */ }

    // Check backend mode and active orders
    const checkStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        await fetch(`${API_URL}/api/users/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (_err) {
        console.warn('[AUTH_CHECK] Background status check failed:', _err);
      }
    };

    checkStatus();
    
    // Asset Discovery Engine: Sync with Nexus Command Center
    const fetchLiveAssets = async () => {
      try {
        const res = await fetch(`${API_URL}/api/users/restaurants`);
        const data = await res.json();
        if (Array.isArray(data)) setLiveRestaurants(data);
      } catch (_err) {
        console.error('[ASSET_SYNC_ERROR]', _err);
      }
    };
    fetchLiveAssets();
    
    // Simulate finding an active order (for UX demo)
    const storedOrder = localStorage.getItem('last_order');
    if (storedOrder) {
      const parsed = JSON.parse(storedOrder);
      setActiveOrder(parsed);
      // Calculate remaining cancellation window (2 min = 120s)
      if (parsed.createdAt) {
        const elapsed = (Date.now() - new Date(parsed.createdAt).getTime()) / 1000;
        const remaining = Math.max(0, 120 - Math.round(elapsed));
        setCancelSecondsLeft(remaining);
      } else {
        setCancelSecondsLeft(120);
      }
    }

    // Simulate loading for UX polish
    const loader = setTimeout(() => setIsLoading(false), 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(loader);
    };
  }, [getNextAvailableSlot]);

  useEffect(() => {
    if (!user) return;
    const handleEliteUpdate = (data: { type: string; data: { userId: string; isElite: boolean } }) => {
      const userId = user?._id || user?.id;
      if (data.type === 'USER_ELITE_STATUS' && data.data.userId === userId) {
         setIsElite(data.data.isElite);
         const stored = localStorage.getItem('user');
         if (stored) {
           const parsed = JSON.parse(stored);
           parsed.isElite = data.data.isElite;
           localStorage.setItem('user', JSON.stringify(parsed));
         }
      }
    };
    socket.on('systemUpdate', handleEliteUpdate);
    return () => { socket.off('systemUpdate', handleEliteUpdate); };
  }, [user]);

  // Tick down cancellation countdown
  useEffect(() => {
    if (cancelSecondsLeft <= 0) return;
    const tick = setInterval(() => setCancelSecondsLeft(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(tick);
  }, [cancelSecondsLeft]);

  const cancelActiveOrder = async () => {
    if (cancelSecondsLeft <= 0) return;
    showModal(
      'Cancel Order?', 
      'Are you sure you want to cancel your current order? This action cannot be undone.',
      'warning',
      async () => {
        try {
          const token = localStorage.getItem('token');
          const orderId = activeOrder?._id || activeOrder?.id;
          if (orderId) {
            await fetch(`${API_URL}/api/orders/${orderId}/cancel`, {
              method: 'PUT',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
          }
        } catch (_err) {
          console.warn('[CANCEL_ORDER] Backend cancellation failed:', _err);
        }
        setActiveOrder(null);
        setCancelSecondsLeft(0);
        localStorage.removeItem('last_order');
      },
      'Yes, Cancel',
      'Keep Order'
    );
  };

  const handleRatingSubmit = async (rating: number, review: string) => {
    try {
      const token = localStorage.getItem('token');
      const orderId = activeOrder?._id || activeOrder?.id;
      if (!orderId) return;

      await fetch(`${API_URL}/api/orders/${orderId}/rate`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating, review })
      });

      // Update local wallet/points for UX
      if (user) {
        const updatedUser = { ...user, zenPoints: (user.zenPoints || 0) + 10 };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (_err) {
      console.error('[RATING_ERROR] Rating failed:', _err);
    }
  };

  const handleJoinElite = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login to join Zenvy Elite!');
        return;
      }

      const res = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ isElite: true })
      });
      const data = await res.json();
      if (res.ok) {
        setIsElite(true);
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
        showModal('Welcome to Elite! 💎', 'You have successfully joined Zenvy Elite. Enjoy unlimited free delivery on all orders.', 'success');
      }
    } catch (_err) {
      console.error('[ELITE_ERROR] Failed to join elite:', _err);
    }
  };

  // Lock body scroll when rental modal is open
  useEffect(() => {
    if (selectedRental) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedRental]);

  const handleIntroComplete = () => {
    sessionStorage.setItem('zenvy_intro_seen', 'true');
    setShowIntro(false);
  };

  // --- Smart Market Engine: Unified Tag-Based Catalog ---
  const allProducts = liveRestaurants.flatMap(res => 
    (res.menu || []).map(item => ({ 
      ...item, 
      restaurantName: res.name, 
      restaurantId: res._id || res.id,
      isVegetarian: item.isVegetarian || item.tags?.includes('veg') || item.tags?.includes('fruits')
    }))
  );

  // Grouped Collections Driven by Tags
  const groupedCollections = {
    fruits: allProducts.filter(p => !gymMode || p.tags?.includes('healthy')).filter(p => p.tags?.includes('fruits')),
    rentals: allProducts.filter(p => p.tags?.includes('rental')),
    sweets: allProducts.filter(() => !gymMode).filter(p => p.tags?.includes('sweets')),
    seasonal: allProducts.filter(p => p.tags?.includes('seasonal')),
    drinks: allProducts.filter(p => p.tags?.includes('drinks')),
    gym: allProducts.filter(p => p.tags?.includes('gym') || p.tags?.includes('high-protein')),
    laundry: allProducts.filter(p => p.tags?.includes('laundry') || p.tags?.includes('dry-wash')),
    pharmacy: allProducts.filter(p => p.tags?.includes('medicine') || p.tags?.includes('pharmacy')),
    stationary: allProducts.filter(p => p.tags?.includes('stationary') || p.tags?.includes('books') || p.tags?.includes('print')),
    all: allProducts.filter(p => !gymMode || p.tags?.includes('healthy') || p.tags?.includes('high-protein'))
  };

  const chefPicks = groupedCollections.all.slice(0, 8);

  const displayRestaurants = liveRestaurants.filter((res) => {
    if (gymMode && !res.tags?.includes('healthy') && !res.tags?.includes('gym')) {
       // Only show restaurants that have at least one healthy item if gym mode is on
       return (res.menu || []).some(item => item.tags?.includes('healthy') || item.tags?.includes('high-protein'));
    }
    const hasMenu = Array.isArray(res.menu) && res.menu.length > 0;
    if (filter === 'budget') return hasMenu && res.menu.some((item) => item.price < 150);
    if (filter === 'veg') return hasMenu && res.menu.some((item) => item.isVegetarian);
    return true;
  });

  if (showIntro === null) return <div className="min-h-screen bg-black" />;

  return (
    <>
    <ScrollProgressIndicator />
    <main className={`min-h-screen text-white pb-32 relative overflow-hidden transition-colors duration-1000 ${isAfter9 ? 'bg-[#050507]' : 'bg-background'}`}>
      {showIntro && <IntroOverlay onComplete={handleIntroComplete} />}
      
      {/* Container for main content - only visible when intro is DONE */}
      <div className={`transition-opacity duration-1000 ${showIntro ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {/* Ambient Background Orbs (Lunar Shift - Unified Gold) */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className={`absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[120px] transition-colors duration-1000 ${isAfter9 ? 'bg-[#C9A84C]/[0.06]' : 'bg-[#C9A84C]/[0.04]'}`} />
          <div className={`absolute top-1/3 -left-32 w-80 h-80 rounded-full blur-[100px] transition-colors duration-1000 ${isAfter9 ? 'bg-[#C9A84C]/[0.05]' : 'bg-[#C9A84C]/[0.03]'}`} />
        </div>

        {/* 🚨 Last Call Banner (9:00 PM - 9:30 PM) */}
        {isAfter9 && !isAfter930 && (
          <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white text-[10px] font-black uppercase tracking-[0.2em] py-3 px-6 text-center animate-pulse sticky top-0 z-[100] shadow-2xl">
            ⚠️ Last Call for Doorstep Delivery! Gates close at 21:30.
          </div>
        )}

        {/* 🚦 Gate-Drop Mode Indicator (After 9:30 PM) */}
        {isAfter930 && (
          <div className="bg-[#1A1A1C] border-b border-white/[0.05] text-[#C9A84C] text-[9px] font-black uppercase tracking-[0.3em] py-3 px-6 text-center sticky top-0 z-[100]">
            🌑 Night Mode: Hostel Gate-Drop Only
          </div>
        )}

        <div className="w-full relative z-10 px-6 pt-14 md:px-10 lg:px-14">
          <motion.header 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#8B7332] flex items-center justify-center shadow-lg shadow-[#C9A84C]/20">
                  <span className="text-[13px] font-black text-black">Z</span>
                </div>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-[0.3em] text-gold-gradient block leading-none">Zenvy</span>
                  <span className="text-[7px] font-bold uppercase tracking-[0.4em] text-secondary-text block mt-0.5">Campus Super-App</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 glass-card px-3 py-1.5 rounded-full border-emerald-500/20">
                  <span className="text-[10px] text-emerald-500 font-black">💎</span>
                  <span className="text-[10px] font-black shrink-0 text-white">{user?.zenPoints || 0}</span>
                </div>
                <Magnetic>
                  <button className="w-10 h-10 glass-card rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-secondary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </button>
                </Magnetic>
              </div>
            </div>
            <div className="flex justify-between items-end mb-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary-text">{greeting}{userName ? `, ${userName}` : ''}</p>
                  {isElite && (
                    <span className="bg-[#C9A84C]/10 text-[#C9A84C] text-[8px] font-black px-2 py-0.5 rounded-full border border-[#C9A84C]/20 tracking-tighter shadow-[0_0_10px_rgba(201,168,76,0.1)]">ELITE</span>
                  )}
                </div>
                {nextSlot && (
                  <div className="flex items-center gap-2 mb-1">
                    <div className="live-dot" />
                    <span className="text-[10px] font-black shrink-0 text-white/50">{timeLeft} until batch closes</span>
                  </div>
                )}
              </div>
              {nextSlot ? (
                <p className="text-[9px] font-black text-primary-yellow uppercase tracking-widest bg-primary-yellow/10 px-3 py-1.5 rounded-full">Next Batch: {nextSlot.id}</p>
              ) : (
                <p className="text-[8px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-3 py-1.5 rounded-full italic">Windows Closed Today</p>
              )}
            </div>
            <h1 className="discover-header">
              Discover <br /> What You <br /> <span className="bg-gradient-to-r from-[#C9A84C] via-[#E8D18C] to-[#8B7332] text-transparent bg-clip-text animate-text-shimmer" style={{WebkitTextFillColor: 'transparent'}}>Crave</span>
            </h1>

            {/* Campus Status Beacon */}
            <div className="mt-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 status-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              <span className="text-[8px] font-black text-secondary-text uppercase tracking-widest opacity-60">Nexus Network Online</span>
            </div>
          </motion.header>

          <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

           <motion.div 
            whileTap={{ scale: 0.98 }}
            className="relative mb-8" 
            onClick={() => setIsSearchOpen(true)}
           >
            <Magnetic>
              <div className="w-full stardust-search py-4 pl-14 pr-4 text-xs text-white font-black uppercase tracking-widest cursor-pointer rounded-2xl group">
                 <span className="opacity-40 group-hover:opacity-100 transition-opacity">Search Campus Nexus...</span>
              </div>
            </Magnetic>
          </motion.div>

          {/* 🌀 Magical Temporal Navigator */}
          <section className="mb-10 animate-slide-up">
             <TemporalSlider />
          </section>

          {/* 🔒 The Zenvy Vault (Daily FOMO Scarcity) */}
          <motion.section 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
             <ZenvyVault />
          </motion.section>

          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.01 }}
            className={`mb-10 group cursor-pointer overflow-hidden rounded-[34px] relative border shadow-2xl transition-all duration-500 elite-card ${isElite ? 'border-[#C9A84C]/40' : 'border-[#C9A84C]/20'}`}
            onClick={!isElite ? handleJoinElite : undefined}
          >
              <div className="elite-hologram" />
              <div className="absolute inset-0 bg-gradient-to-br from-[#C9A84C]/20 to-[#8B7332]/20 z-0" />
              <Image 
                src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop" 
                alt="Elite Promo" 
                width={400}
                height={150}
                className="relative z-10 object-cover w-full h-[140px] group-hover:scale-110 transition-transform duration-700 opacity-40 mix-blend-overlay"
              />
             <div className="absolute inset-0 z-20 p-6 flex flex-col justify-center">
                <span className="text-[8px] font-black text-primary-yellow uppercase tracking-[0.3em] mb-2">{isElite ? 'Elite Member' : 'Exclusive Offer'}</span>
                <h3 className="text-lg font-black text-white leading-tight mb-2">
                  {isElite ? <>Unlimited <br /> Free Delivery</> : <>Unlock Zero <br /> Delivery Fees</>}
                </h3>
                {isElite ? (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest" style={{ textShadow: '0 0 10px rgba(16,185,129,0.5)' }}>Premium Active</span>
                  </div>
                ) : (
                  <Magnetic>
                    <button className="w-fit bg-primary-yellow text-black text-[9px] font-black px-6 py-2.5 rounded-full uppercase tracking-tighter shadow-lg shadow-primary-yellow/20">Join Elite for ₹199 →</button>
                  </Magnetic>
                )}
             </div>
          </motion.section>

          <motion.div 
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeInOut" }}
            className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-12 origin-left"
          />

          {/* 🔄 Quick Re-order: Last Favorites */}
          {activeOrder && !isLoading && (
            <section className="mb-10 animate-fade-in">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary-text">Last Favorites</h2>
              </div>
              <div className="glass-card p-4 flex items-center justify-between border-white/[0.05]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#1A1A1C] flex items-center justify-center border border-white/5 overflow-hidden">
                     {activeOrder.items?.[0]?.image ? (
                       <Image src={activeOrder.items[0].image} alt="last" width={48} height={48} className="object-cover" />
                     ) : (
                       <svg className="w-5 h-5 text-primary-yellow" fill="currentColor" viewBox="0 0 24 24"><path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/></svg>
                     )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{activeOrder.items?.[0]?.name || 'Delicious Meal'}</h4>
                    <p className="text-[9px] font-bold text-secondary-text uppercase tracking-widest">Re-order from last time</p>
                  </div>
                </div>
                <Link 
                  href={`/restaurant/${activeOrder.restaurantId || 'shakti-canteen'}`}
                  className="bg-white/5 hover:bg-white/10 text-primary-yellow text-[9px] font-black px-4 py-2 rounded-full uppercase tracking-tighter border border-white/5 transition-colors"
                >
                  Quick Add +
                </Link>
              </div>
            </section>
          )}

          <section className="mb-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary-text">Chef&apos;s Picks</h2>
              <span className="text-[9px] font-bold text-secondary-text uppercase tracking-wider">Swipe →</span>
            </div>
            <motion.div 
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-100px" }}
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: { staggerChildren: 0.1 }
                }
              }}
              className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6"
            >
              {isLoading ? (
                [1,2,3].map(i => (
                  <div key={i} className="chef-card bg-[#141416] p-4">
                    <div className="aspect-[4/3] rounded-[30px] skeleton mb-4" />
                    <div className="h-4 w-3/4 skeleton mb-2" />
                    <div className="h-3 w-1/2 skeleton" />
                  </div>
                ))
              ) : (
                chefPicks.map((item) => (
                  <motion.div
                    key={item.id}
                    variants={{
                      hidden: { opacity: 0, x: 20 },
                      show: { opacity: 1, x: 0 }
                    }}
                  >
                    <Link href={`/products/${item.id}`}>
                      <div className="chef-card bg-[#141416] premium-tilt">
                        <div className="aspect-[4/3] relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-primary-yellow/30 transition-colors">
                          <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill style={{ objectFit: 'cover' }} />
                        </div>
                        <div className="mt-3">
                          <h3 className="font-bold text-[15px] text-white mb-1">{item.name}</h3>
                          <div className="flex items-start justify-between gap-2 min-w-0 overflow-hidden mt-1">
                            <p className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</p>
                            <span className="text-[10px] font-black shrink-0 text-primary-yellow">₹{item.price}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))
              )}
            </motion.div>
          </section>

          <motion.div 
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeInOut" }}
            className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-14 origin-left"
          />

          {/* ⚔️ Zenvy Block Wars: Leaderboard */}
          <section className="mb-10 animate-slide-up" style={{ animationDelay: '0.3s' }}>
             <BlockWarsLeaderboard userBlock={user?.hostelBlock || null} />
          </section>

                   {/* 🍎 Fresh Harvest: Fruits */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-5">
               <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#34D399]">Fresh Harvest (Fruits)</h2>
               <span className="text-[9px] font-bold text-secondary-text uppercase tracking-wider">Swipe →</span>
            </div>
            <motion.div 
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-50px" }}
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: { staggerChildren: 0.08 }
                }
              }}
              className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6"
            >
              {groupedCollections.fruits.map((item) => (
                <motion.div
                  key={item.id}
                  variants={{
                    hidden: { opacity: 0, scale: 0.9 },
                    show: { opacity: 1, scale: 1 }
                  }}
                >
                  <Link href={`/products/${item.id}`} className="relative shrink-0 w-[240px] block group active:scale-95 transition-transform">
                     <div className="aspect-[4/3] relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-[#34D399]/30 transition-colors">
                        <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill style={{ objectFit: 'cover' }} />
                     </div>
                     <div className="mt-3">
                        <h3 className="text-xs font-black text-white">{item.name}</h3>
                        <div className="flex justify-between items-start mt-1 gap-2 min-w-0 overflow-hidden">
                            <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</span>
                           <span className="text-[10px] font-black shrink-0 text-[#34D399]">₹{item.price}</span>
                        </div>
                     </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* 🚗 Campus Fleet: Rentals */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-5">
               <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-yellow">Campus Fleet (Rentals)</h2>
               <span className="text-[9px] font-bold text-secondary-text uppercase tracking-wider">Swipe →</span>
            </div>
            <motion.div 
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-50px" }}
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: { staggerChildren: 0.1 }
                }
              }}
              className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6"
            >
              {groupedCollections.rentals.map((item) => (
                <motion.div
                  key={item.id}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    show: { opacity: 1, y: 0 }
                  }}
                >
                  <button type="button" onClick={() => { setSelectedRental(item as RentalItem); setShowSpecs(false); }} className="relative shrink-0 w-[240px] cursor-pointer group active:scale-95 transition-transform text-left">
                     <div className="aspect-[4/3] relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-primary-yellow/30 transition-colors">
                        <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill style={{ objectFit: 'cover' }} />
                     </div>
                     <div className="mt-3">
                        <h3 className="text-xs font-black text-white">{item.name}</h3>
                        <div className="flex justify-between items-start mt-1 gap-2 min-w-0 overflow-hidden">
                            <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</span>
                           <span className="text-[10px] font-black shrink-0 text-primary-yellow">₹{item.price}</span>
                        </div>
                     </div>
                  </button>
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* 👔 Premium Care: Dry Wash & Laundry */}
          <section className="mb-14">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-[9px] font-black text-[#38BDF8] uppercase tracking-[0.4em] mb-2">Campus Services</h2>
                <p className="text-xl font-black text-white">PREMIUM DRY WASH</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
              {groupedCollections.laundry.length > 0 ? (
                groupedCollections.laundry.map((item) => (
                  <Link href={`/products/${item.id}`} key={item.id} className="relative shrink-0 w-[240px] group active:scale-95 transition-transform premium-tilt premium-card-hover rounded-[30px] animate-float">
                     <div className="aspect-[4/3] relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-[#38BDF8]/30 transition-colors">
                         <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill style={{ objectFit: 'cover' }} />
                     </div>
                     <div className="mt-3">
                        <h3 className="text-xs font-black text-white">{item.name}</h3>
                        <div className="flex justify-between items-start mt-1 gap-2 min-w-0 overflow-hidden">
                          <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</span>
                           <span className="text-[10px] font-black shrink-0 text-[#38BDF8]">₹{item.price}</span>
                        </div>
                     </div>
                  </Link>
                ))
              ) : (
                <div className="w-full flex flex-col items-center justify-center py-10 px-6 border border-white/5 rounded-[30px] bg-white/[0.02]">
                   <span className="text-4xl mb-4 opacity-50">🧺</span>
                   <p className="text-xs font-black text-secondary-text uppercase tracking-widest">No Active Laundry Services Today</p>
                </div>
              )}
            </div>
          </section>

          {/* 💊 Essential Pharmacy */}
          <section className="mb-14">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-[9px] font-black text-red-400 uppercase tracking-[0.4em] mb-2">Health & Wellness</h2>
                <p className="text-xl font-black text-white">CAMPUS PHARMACY</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
              {groupedCollections.pharmacy.length > 0 ? (
                groupedCollections.pharmacy.map((item) => (
                  <Link href={`/products/${item.id}`} key={item.id} className="relative shrink-0 w-[240px] group active:scale-95 transition-transform premium-card-hover rounded-[30px] animate-float">
                     <div className="aspect-[4/3] relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-red-500/30 transition-colors">
                         <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill style={{ objectFit: 'cover' }} />
                     </div>
                     <div className="mt-3">
                        <h3 className="text-xs font-black text-white">{item.name}</h3>
                        <div className="flex justify-between items-start mt-1 gap-2 min-w-0 overflow-hidden">
                          <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</span>
                           <span className="text-[10px] font-black shrink-0 text-red-400">₹{item.price}</span>
                        </div>
                     </div>
                  </Link>
                ))
              ) : (
                <div className="w-full flex flex-col items-center justify-center py-10 px-6 border border-white/5 rounded-[30px] bg-white/[0.02]">
                   <span className="text-4xl mb-4 opacity-50">💊</span>
                   <p className="text-xs font-black text-secondary-text uppercase tracking-widest">No Active Pharmacy Carts</p>
                </div>
              )}
            </div>
          </section>

          {/* 📚 Stationary & Printing */}
          <section className="mb-14">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-[9px] font-black text-violet-400 uppercase tracking-[0.4em] mb-2">Academic Essentials</h2>
                <p className="text-xl font-black text-white">STATIONARY HUB</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
              {groupedCollections.stationary.length > 0 ? (
                groupedCollections.stationary.map((item) => (
                  <Link href={`/products/${item.id}`} key={item.id} className="relative shrink-0 w-[240px] group active:scale-95 transition-transform premium-card-hover rounded-[30px] animate-float">
                     <div className="aspect-[4/3] relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-violet-500/30 transition-colors">
                         <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill style={{ objectFit: 'cover' }} />
                     </div>
                     <div className="mt-3">
                        <h3 className="text-xs font-black text-white">{item.name}</h3>
                        <div className="flex justify-between items-start mt-1 gap-2 min-w-0 overflow-hidden">
                          <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</span>
                           <span className="text-[10px] font-black shrink-0 text-violet-400">₹{item.price}</span>
                        </div>
                     </div>
                  </Link>
                ))
              ) : (
                <div className="w-full flex flex-col items-center justify-center py-10 px-6 border border-white/5 rounded-[30px] bg-white/[0.02]">
                   <span className="text-4xl mb-4 opacity-50">📚</span>
                   <p className="text-xs font-black text-secondary-text uppercase tracking-widest">No Active Stationary Shops</p>
                </div>
              )}
            </div>
          </section>

          {/* ❄️ Season Specials */}
          <section className="mb-10">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-[9px] font-black text-cyan-400 uppercase tracking-[0.4em] mb-2">Omni-Category</h2>
                <p className="text-xl font-black text-white">SEASON SPECIALS</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
              {groupedCollections.seasonal.map((item) => (
                <Link href={`/products/${item.id}`} key={item.id} className="relative shrink-0 w-[240px] group active:scale-95 transition-transform">
                   <div className="aspect-[4/3] relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-cyan-500/30 transition-colors">
                       <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill style={{ objectFit: 'cover' }} />
                   </div>
                   <div className="mt-3">
                      <h3 className="text-xs font-black text-white">{item.name}</h3>
                      <div className="flex justify-between items-start mt-1 gap-2 min-w-0 overflow-hidden">
                          <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</span>
                         <span className="text-[10px] font-black shrink-0 text-cyan-400">₹{item.price}</span>
                      </div>
                   </div>
                </Link>
              ))}
            </div>
          </section>

          {/* 🥐 Sweets & Bakery */}
          <section className="mb-14">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-[9px] font-black text-rose-400 uppercase tracking-[0.4em] mb-2">Gourmet Sweets</h2>
                <p className="text-xl font-black text-white">ARTISANAL TREATS</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
              {groupedCollections.sweets.map((item) => (
                <Link href={`/products/${item.id}`} key={item.id} className="relative shrink-0 w-[240px] group active:scale-95 transition-transform">
                   <div className="aspect-[4/3] relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-rose-500/30 transition-colors">
                       <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill style={{ objectFit: 'cover' }} />
                   </div>
                   <div className="mt-3">
                      <h3 className="text-xs font-black text-white">{item.name}</h3>
                      <div className="flex justify-between items-start mt-1 gap-2 min-w-0 overflow-hidden">
                          <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</span>
                         <span className="text-[10px] font-black shrink-0 text-rose-400">₹{item.price}</span>
                      </div>
                   </div>
                </Link>
              ))}
            </div>
          </section>

          {/* 🍹 Refreshing Drinks */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-5">
               <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A5B4FC]">Refreshing Drinks</h2>
               <span className="text-[9px] font-bold text-secondary-text uppercase tracking-wider">Swipe →</span>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
              {groupedCollections.drinks.map((item) => (
                <Link href={`/products/${item.id}`} key={item.id} className="relative shrink-0 w-[240px] group active:scale-95 transition-transform">
                   <div className="aspect-[4/3] relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-[#A5B4FC]/30 transition-colors">
                      <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill style={{ objectFit: 'cover' }} />
                   </div>
                   <div className="mt-3">
                      <h3 className="text-xs font-black text-white">{item.name}</h3>
                      <div className="flex justify-between items-start mt-1 gap-2 min-w-0 overflow-hidden">
                          <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</span>
                         <span className="text-[10px] font-black shrink-0 text-[#A5B4FC]">₹{item.price}</span>
                      </div>
                   </div>
                </Link>
              ))}
            </div>
          </section>

          {/* 🏋️ Elite Performance: Gym Rats */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-5">
               <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C9A84C]">Elite Performance (Gym Essentials)</h2>
               <span className="text-[9px] font-bold text-secondary-text uppercase tracking-wider">Swipe →</span>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
              {groupedCollections.gym.map((item) => (
                <Link href={`/products/${item.id}`} key={item.id} className="relative shrink-0 w-[240px] group active:scale-95 transition-transform">
                   <div className="aspect-[4/3] relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-[#C9A84C]/30 transition-colors">
                      <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill style={{ objectFit: 'cover' }} />
                   </div>
                   <div className="mt-3">
                      <h3 className="text-xs font-black text-white">{item.name}</h3>
                      <div className="flex justify-between items-start mt-1 gap-2 min-w-0 overflow-hidden">
                          <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</span>
                         <span className="text-[10px] font-black shrink-0 text-[#C9A84C]">₹{item.price}</span>
                      </div>
                   </div>
                </Link>
              ))}
            </div>
          </section>

          <motion.div 
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeInOut" }}
            className="h-px bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent my-14 origin-left"
          />

          {/* All Restaurants List */}
          <div className="flex gap-3 mb-8 overflow-x-auto scrollbar-hide py-2">
              {['all', 'budget', 'veg'].map((type) => (
                <button 
                  key={type}
                  onClick={() => setFilter(type as 'all' | 'budget' | 'veg')}
                  className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap shadow-lg ${
                    filter === type 
                      ? 'bg-primary-yellow text-black scale-105 shadow-primary-yellow/20' 
                      : 'glass-card text-secondary-text hover:bg-white/5'
                  }`}
                >
                  {type === 'all' ? 'All Restaurants' : type === 'budget' ? 'Under ₹150' : 'Veg Only'}
                </button>
             ))}
          </div>

          <section className="pb-20">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary-text mb-6">Discover Nearby</h2>
            <motion.div 
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: { staggerChildren: 0.1 }
                }
              }}
              className="space-y-4"
            >
              {displayRestaurants.map((res, index) => (
                <motion.div
                  key={res._id || res.id}
                  variants={{
                    hidden: { opacity: 0, y: 30 },
                    show: { opacity: 1, y: 0 }
                  }}
                >
                  <Link href={`/restaurants/${res._id || res.id}`}>
                    <RestaurantCard name={res.name} rating={res.rating || "4.5"} time={res.time || "25-30 min"} imageUrl={res.imageUrl || "/assets/placeholder.png"} imagePosition={index % 2 === 0 ? 'left' : 'right'} />
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </section>
        </div>

        <footer className="fixed bottom-0 left-0 right-0 h-24 bg-[#0A0A0B]/90 backdrop-blur-2xl border-t border-white/[0.03] flex items-center justify-around px-6 z-[60]">
          <Link href="/" className="flex flex-col items-center gap-1.5 nav-icon-active">
            <div className="tab-pill">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">Home</span>
          </Link>
          <Link href="/orders" className="flex flex-col items-center gap-1.5 opacity-40">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
             <span className="text-[9px] font-bold">Orders</span>
          </Link>
          <Link href="/basket" className="flex flex-col items-center gap-1.5 opacity-40">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
             <span className="text-[9px] font-bold">Basket</span>
          </Link>
          <Link href="/profile" className="flex flex-col items-center gap-1.5 opacity-40">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
             <span className="text-[9px] font-bold">Profile</span>
          </Link>
        </footer>

        {/* 🛵 Live Order Status Bar */}
        {activeOrder && (
          <LiveOrderStatusBar
            orderId={activeOrder._id || activeOrder.id || 'SRM_DEV_ORDER_1'}
            initialStatus={activeOrder.status || 'Pending'}
            cancelSecondsLeft={cancelSecondsLeft}
            onCancel={cancelActiveOrder}
            onDelivered={() => setIsRatingModalOpen(true)}
          />
        )}

        <RatingModal
          isOpen={isRatingModalOpen}
          onClose={() => setIsRatingModalOpen(false)}
          onSubmit={handleRatingSubmit}
        />

        <ZenvyModal 
          {...modalConfig} 
          onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))} 
        />

        {/* 🌀 Magical Social Pulse */}
        <ZenvyPulse userBlock={user?.hostelBlock || null} />
      </div>
    </main>

    {/* 🚗 Rental Booking Modal */}
    {selectedRental && typeof document !== 'undefined' && createPortal(
      <>
        {/* Backdrop */}
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 99998 }}
          onClick={() => setSelectedRental(null)}
        />
        {/* Card */}
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 99999, pointerEvents: 'none' }}>
          <div style={{ width: '100%', maxWidth: '380px', maxHeight: '88vh', overflowY: 'auto', background: '#141416', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '28px', padding: '20px', pointerEvents: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#C9A84C', display: 'block', marginBottom: '4px' }}>{selectedRental?.tags?.includes('car') ? 'Car' : selectedRental?.tags?.includes('bike') ? 'Bike' : 'Rental'} Rental</span>
                <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'white', margin: 0 }}>{selectedRental?.name}</h3>
              </div>
              <button
                onClick={() => setSelectedRental(null)}
                style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '8px' }}
              >✕</button>
            </div>

            {/* Image */}
            <div style={{ width: '100%', aspectRatio: '16/9', position: 'relative', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
              <Image src={selectedRental?.imageUrl || "/assets/placeholder.png"} alt={selectedRental?.name || "Rental"} fill style={{ objectFit: 'cover' }} />
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 700, color: '#6B6B6B', display: 'block', marginBottom: '4px' }}>Type</span>
                <span style={{ fontSize: '14px', fontWeight: 900, color: 'white' }}>{selectedRental?.category || 'Special'}</span>
              </div>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 700, color: '#6B6B6B', display: 'block', marginBottom: '4px' }}>Rate</span>
                <span style={{ fontSize: '14px', fontWeight: 900, color: '#C9A84C' }}>₹{selectedRental?.price}</span>
              </div>
            </div>

            {/* Owner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px', marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #C9A84C, #8B5E1A)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'black', fontWeight: 900, fontSize: '14px', flexShrink: 0 }}>
                {selectedRental?.restaurantName?.charAt(0) || 'O'}
              </div>
              <div>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 700, color: '#6B6B6B', display: 'block' }}>Vendor</span>
                <p style={{ fontSize: '14px', fontWeight: 900, color: 'white', margin: '2px 0 0' }}>{selectedRental?.restaurantName || 'Zenvy Partner'}</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                <Link
                  href={`/products/${selectedRental?.id}`}
                  style={{ width: '100%', background: '#C9A84C', color: 'black', fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '14px 4px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', textDecoration: 'none' }}
                >
                  View Details & Book
                </Link>
              </div>

              {showSpecs && selectedRental?.specs && (
                <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '12px', padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><span style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6B6B6B', fontWeight: 700, display: 'block' }}>Engine</span><span style={{ fontSize: '12px', fontWeight: 900, color: 'white' }}>{selectedRental.specs.engine}</span></div>
                  <div><span style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6B6B6B', fontWeight: 700, display: 'block' }}>Top Speed</span><span style={{ fontSize: '12px', fontWeight: 900, color: 'white' }}>{selectedRental.specs.topSpeed}</span></div>
                  <div><span style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6B6B6B', fontWeight: 700, display: 'block' }}>Max Power</span><span style={{ fontSize: '12px', fontWeight: 900, color: '#C9A84C' }}>{selectedRental.specs.power}</span></div>
                  <div><span style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6B6B6B', fontWeight: 700, display: 'block' }}>Fuel</span><span style={{ fontSize: '12px', fontWeight: 900, color: '#34D399' }}>{selectedRental.specs.fuel}</span></div>
                </div>
              )}

              <button
                onClick={() => setShowSpecs(!showSpecs)}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.15em', color: '#9CA3AF', cursor: 'pointer' }}
              >
                {showSpecs ? 'Hide Specs' : 'View Full Specs'}
              </button>
            </div>
          </div>
        </div>
      </>,
      document.body
    )}
    </>
  );
}

