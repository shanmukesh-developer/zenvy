"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import RestaurantCard from '@/components/RestaurantCard';
import { useCart } from '@/context/CartContext';
import { restaurants } from '@/data/restaurants';
import Image from 'next/image';
import SearchOverlay from '@/components/SearchOverlay';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function Home() {
  const router = useRouter(); // Need to import this
  const { totalItems } = useCart();
  const [filter, setFilter] = useState<'all' | 'budget' | 'veg'>('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    // Check if user has seen the cinematic intro this session
    const hasSeenIntro = sessionStorage.getItem('zenvy_intro_seen');
    if (!hasSeenIntro) {
      sessionStorage.setItem('zenvy_intro_seen', 'true');
      router.push('/splash');
    }

    setGreeting(getGreeting());
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.name) setUserName(parsed.name);
      }
    } catch { /* ignore */ }
  }, [router]);

  // Chef's Picks: top rated items across restaurants
  const chefPicks = restaurants.flatMap(res =>
    res.menu.filter(item => parseFloat(item.rating || '0') >= 4.5 || item.price >= 200)
      .slice(0, 2)
      .map(item => ({ ...item, restaurantName: res.name, restaurantId: res.id }))
  ).slice(0, 5);

  // If not enough high-rated items, just pick the first 4 items
  const displayPicks = chefPicks.length >= 3 ? chefPicks : restaurants.flatMap(res =>
    res.menu.slice(0, 1).map(item => ({ ...item, restaurantName: res.name, restaurantId: res.id }))
  ).slice(0, 4);

  const displayRestaurants = restaurants.filter((res) => {
    if (filter === 'budget') return res.menu.some(item => item.price < 150);
    if (filter === 'veg') return res.menu.some(item => !item.name.toLowerCase().includes('chicken') && !item.name.toLowerCase().includes('mutton'));
    return true;
  });

  return (
    <main className="min-h-screen bg-background text-white pb-32 relative overflow-hidden">
      {showIntro && <IntroOverlay onComplete={handleIntroComplete} />}
      {/* Ambient Background Orbs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#C9A84C]/[0.04] rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -left-32 w-80 h-80 bg-[#C9A84C]/[0.03] rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-0 w-64 h-64 bg-[#8B7332]/[0.04] rounded-full blur-[100px]" />
      </div>

      <div className="max-w-[430px] mx-auto relative z-10 px-6 pt-14">
        {/* ── Header: Brand + Greeting ── */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#8B7332] flex items-center justify-center shadow-lg shadow-[#C9A84C]/20">
                <span className="text-[13px] font-black text-black">Z</span>
              </div>
              <div>
                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-gold-gradient block leading-none">Zenvy</span>
                <span className="text-[7px] font-bold uppercase tracking-[0.4em] text-secondary-text block mt-0.5">Food Delivery</span>
              </div>
            </div>
            {/* Notification Bell Placeholder */}
            <button className="w-10 h-10 glass-card rounded-full flex items-center justify-center hover:border-[#C9A84C]/20 transition-all">
              <svg className="w-4 h-4 text-secondary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
          </div>

          {/* Personalized Greeting */}
          <div className="mb-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary-text">{greeting}{userName ? `, ${userName}` : ''}</p>
          </div>

          <h1 className="discover-header">
            Discover <br /> What You <br /> <span className="text-gold-gradient" style={{WebkitTextFillColor: 'transparent'}}>Crave</span>
          </h1>
        </header>

        {/* ── Search Bar ── */}
        <div className="relative mb-8" onClick={() => setIsSearchOpen(true)}>
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-primary-yellow opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="w-full glass-card py-4 pl-14 pr-4 text-sm text-secondary-text font-medium cursor-pointer hover:border-[#C9A84C]/15 transition-all duration-300">
            Search dishes, restaurants...
          </div>
        </div>

        <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

        {/* ── Chef's Picks Carousel ── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="text-lg">👨‍🍳</span>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em]">Chef&apos;s Picks</h2>
            </div>
            <span className="text-[9px] font-bold text-secondary-text uppercase tracking-wider">Swipe →</span>
          </div>

          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
            {displayPicks.map((item, i) => (
              <Link href={`/products/${item.id}`} key={item.id}>
                <div className="chef-card bg-[#141416]" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="w-[260px] h-[160px] relative">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      style={{ objectFit: 'cover' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141416] via-transparent to-transparent" />
                  </div>
                  <div className="p-5 pt-0 relative -mt-4">
                    <h3 className="font-bold text-[15px] text-white mb-1">{item.name}</h3>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-secondary-text font-bold">{item.restaurantName}</p>
                      <span className="text-[13px] font-black text-gold-gradient">₹{item.price}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <div className="gold-line mb-8" />

        {/* ── Filters ── */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
           <button 
             onClick={() => setFilter('all')}
             className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${filter === 'all' ? 'bg-primary-yellow text-black shadow-lg shadow-primary-yellow/20' : 'glass-card text-secondary-text hover:text-white'}`}
           >
             All
           </button>
           <button 
             onClick={() => setFilter('budget')}
             className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${filter === 'budget' ? 'bg-primary-yellow text-black shadow-lg shadow-primary-yellow/20' : 'glass-card text-secondary-text hover:text-white'}`}
           >
             Under ₹150
           </button>
           <button 
             onClick={() => setFilter('veg')}
             className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${filter === 'veg' ? 'bg-primary-yellow text-black shadow-lg shadow-primary-yellow/20' : 'glass-card text-secondary-text hover:text-white'}`}
           >
             Veg Only
           </button>
        </div>

        {/* ── Restaurants Section ── */}
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary-text mb-6">Restaurants</h2>
          <div className="space-y-2">
            {displayRestaurants.map((res, index) => (
              <Link href={`/restaurants/${res.id}`} key={res.id}>
                <RestaurantCard 
                  name={res.name}
                  rating={res.rating}
                  time={res.time}
                  imageUrl={res.imageUrl}
                  imagePosition={index % 2 === 0 ? 'left' : 'right'}
                />
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* ── Premium Bottom Navigation ── */}
      <footer className="fixed bottom-0 left-0 right-0 h-24 bg-[#0A0A0B]/90 backdrop-blur-2xl border-t border-white/[0.03] flex items-center justify-around px-6 z-[60]">
        <Link href="/" className="flex flex-col items-center gap-1.5 nav-icon-active">
           <div className="tab-pill">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
           </div>
           <span className="text-[9px] font-black uppercase tracking-widest">Home</span>
        </Link>
        <Link href="/orders" className="flex flex-col items-center gap-1.5 opacity-40 hover:opacity-80 transition-all duration-300 relative">
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
           <span className="text-[9px] font-bold">Orders</span>
           {/* Live Order Dot */}
           <div className="live-dot absolute -top-0.5 -right-1" />
        </Link>
        <Link href="/basket" className="flex flex-col items-center gap-1.5 relative opacity-40 hover:opacity-80 transition-all duration-300">
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
           <span className="text-[9px] font-bold">Basket</span>
           {totalItems > 0 && (
             <span className="absolute -top-1 -right-2 bg-primary-yellow text-black text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-lg shadow-primary-yellow/30">
               {totalItems}
             </span>
           )}
        </Link>
        <Link href="/profile" className="flex flex-col items-center gap-1.5 opacity-40 hover:opacity-80 transition-all duration-300">
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
           <span className="text-[9px] font-bold">Profile</span>
        </Link>
      </footer>
    </main>
  );
}
