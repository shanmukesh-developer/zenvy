"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import Image from 'next/image';
import SuccessOverlay from '@/components/SuccessOverlay';
import { Restaurant, MenuItem } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function RestaurantMenuClient({ restaurantId }: { restaurantId: string }) {
  // Legacy Redirect Map
  const legacyIdMap: Record<string, string> = {
    'sweet-shop': 'boutique-sweets-elite',
    'zenvy-bakery': 'boutique-bakery-elite',
    'summer-specials': 'boutique-summer-elite',
    'fruit-shop': 'boutique-fruits-elite'
  };

  const effectiveId = (legacyIdMap[restaurantId] || restaurantId).replace(/\/$/, "");
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const { totalItems, addToCart } = useCart();
  const [scrollY, setScrollY] = useState(0);
  const [overlay, setOverlay] = useState<{ isOpen: boolean; title: string; message: string; type?: 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
  });
  const [addedId, setAddedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/users/restaurants/${effectiveId}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.name) setRestaurant(data);
        setLoading(false);
      })
      .catch(_err => {
        console.error('[FETCH_ERROR]', _err);
        setLoading(false);
      });
  }, [effectiveId]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const handleScroll = () => setScrollY(el.scrollTop);
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading) return <div className="p-8 text-white min-h-screen text-center animate-pulse pt-20">Loading Menu...</div>;
  if (!restaurant) return <div className="p-8 text-white min-h-screen pt-20 text-center font-bold">Restaurant not found.</div>;

  const filteredMenu = activeCategory === 'All' 
    ? (restaurant.menu || [])
    : (restaurant.menu || []).filter((item) => item.category === activeCategory);

  const handleAddToCart = (item: MenuItem) => {
    addToCart({
      id: item.id || item._id || "",
      name: item.name,
      price: item.price,
      image: item.image || item.imageUrl || "",
      restaurantId: restaurant._id,
      restaurantName: restaurant.name,
    });
    setAddedId(item.id || item._id || null);
    setOverlay({
      isOpen: true,
      title: 'Added to Basket',
      message: `${item.name} is waiting for you!`,
      type: 'success'
    });
    setTimeout(() => setAddedId(null), 800);
  };

  return (
    <main ref={mainRef} className="min-h-screen bg-background text-white overflow-y-auto relative">
      {/* ── Parallax Hero Image ── */}
      <div className="relative h-[320px] overflow-hidden">
        <div
          className="absolute inset-0 scale-110"
          style={{ transform: `translateY(${scrollY * 0.4}px) scale(1.1)` }}
        >
          <Image
            src={restaurant.imageUrl || "/assets/placeholder.png"} 
            alt={restaurant.name}
            fill
            style={{ objectFit: 'cover' }}
            priority
          />
        </div>
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0B]/60 to-transparent h-24" />

        {/* Back button */}
        <Link href="/" className="absolute top-12 left-6 w-10 h-10 glass-card rounded-full flex items-center justify-center z-20">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        {/* Restaurant Info Overlay */}
        <div className="absolute bottom-8 left-6 right-6 z-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-primary-yellow text-black text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wider">Top Rated</span>
            <span className="text-xs font-bold text-white/80">⭐ {restaurant.rating}</span>
          </div>
          <h1 className="text-3xl font-black mb-1">{restaurant.name}</h1>
          <p className="text-secondary-text text-[11px] font-medium">{restaurant.description}</p>
          <div className="flex gap-4 mt-3">
            <div className="text-[9px] font-black uppercase tracking-widest text-secondary-text flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              {restaurant.time}
            </div>
            <div className="text-[9px] font-black uppercase tracking-widest text-secondary-text">Min ₹99</div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-6 pb-32 -mt-2 relative z-10">
        <div className="gold-line mb-8" />

        {/* Category Pills */}
        <div className="flex gap-3 overflow-x-auto scrollbar-hide mb-10 pb-2 -mx-6 px-6">
          {['All', ...(restaurant.categories || [])].map((cat: string) => (
            <button 
              key={cat} 
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 shadow-xl ${activeCategory === cat ? 'bg-primary-yellow text-black shadow-primary-yellow/20 scale-105' : 'glass-card text-secondary-text hover:text-white'}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Menu Items */}
        <div className="space-y-4">
          {filteredMenu.map((item) => (
            <Link href={`/products/${item.id}`} key={item.id} className="flex gap-4 items-center glass-card p-4 rounded-[28px] hover:border-[#C9A84C]/15 transition-all duration-300 group cursor-pointer active:scale-[0.98]">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#C9A84C]/20 bg-black flex-shrink-0 relative group-hover:scale-105 transition-transform duration-300">
                 <Image 
                   src={item.image || item.imageUrl || "/assets/placeholder.png"} 
                   alt={item.name} 
                   fill
                   style={{ objectFit: 'cover' }}
                 />
              </div>
              <div className="flex-1">
                 <h3 className="font-bold text-sm mb-1 text-white/95 group-hover:text-primary-yellow transition-colors">{item.name}</h3>
                 <p className="text-[10px] text-secondary-text line-clamp-1 mb-2">{item.description || `Fresh from ${restaurant.name}`}</p>
                 <div className="flex justify-between items-center">
                    <span className="font-black text-gold-gradient text-sm shadow-sm opacity-90 group-hover:opacity-100">₹{item.price}</span>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddToCart(item); }}
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 z-10 ${
                        addedId === item.id
                          ? 'bg-primary-yellow text-black animate-gold-pulse scale-110'
                          : 'bg-white/5 border border-white/10 text-white hover:border-[#C9A84C]/30 hover:bg-[#C9A84C]/10'
                      }`}
                    >
                      {addedId === item.id ? '✓' : '+'}
                    </button>
                 </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Floating Cart */}
      {totalItems > 0 && (
        <Link href="/basket" className="fixed bottom-8 right-6 left-6 h-16 bg-primary-yellow text-black rounded-full flex items-center justify-between px-8 z-50 shadow-2xl shadow-[#C9A84C]/30">
           <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-black text-white text-[11px] font-black flex items-center justify-center">{totalItems}</span>
              <span className="font-black uppercase tracking-widest text-[11px]">View Basket</span>
           </div>
           <span className="font-black text-sm">Proceed →</span>
        </Link>
      )}

      <SuccessOverlay 
        isOpen={overlay.isOpen}
        onClose={() => setOverlay(prev => ({ ...prev, isOpen: false }))}
        title={overlay.title}
        message={overlay.message}
        type={overlay.type}
      />
    </main>
  );
}
