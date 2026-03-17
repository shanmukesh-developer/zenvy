"use client";
import { useState } from 'react';
import Link from 'next/link';
import RestaurantCard from '@/components/RestaurantCard';
import { useCart } from '@/context/CartContext';
import { restaurants } from '@/data/restaurants';
import Image from 'next/image';
import SearchOverlay from '@/components/SearchOverlay';

export default function Home() {
  const { totalItems } = useCart();
  const [filter, setFilter] = useState<'all' | 'budget' | 'veg'>('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchQuery = ''; // Handled by overlay now



  // Flatten all menu items for search
  const allProducts = restaurants.flatMap(res => 
    res.menu.map(item => ({ ...item, restaurantName: res.name, restaurantId: res.id }))
  );

  const filteredItems = allProducts.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBudget = filter === 'budget' ? item.price < 150 : true;
    const matchesVeg = filter === 'veg' ? !item.name.toLowerCase().includes('chicken') && !item.name.toLowerCase().includes('mutton') : true;
    
    if (filter === 'all') return matchesSearch;
    if (filter === 'budget') return matchesSearch && matchesBudget;
    if (filter === 'veg') return matchesSearch && matchesVeg;
    return matchesSearch;
  });

  const displayRestaurants = restaurants.filter((res) => {
    const nameMatch = res.name.toLowerCase().includes(searchQuery.toLowerCase());
    const menuMatch = res.menu.some((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return searchQuery === '' || nameMatch || menuMatch;
  });

  return (
    <main className="min-h-screen bg-background text-white p-8 pt-16 pb-32 relative">
      <div className="max-w-[400px] mx-auto">
        <header className="mb-10">
          <h1 className="discover-header">
            Zenvy <br /> Food Delivery
          </h1>

          <p className="recipe-count mt-2">
            Trending <span className="underline decoration-white/20 underline-offset-8 font-serif">near you</span>
          </p>
        </header>

        {/* Search Bar - Triggering Overlay */}
        <div className="relative mb-12" onClick={() => setIsSearchOpen(true)}>
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-secondary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="w-full bg-[#1C1C1E] border-none rounded-full py-4 pl-14 pr-4 text-sm text-secondary-text font-medium cursor-pointer">
            Search for Biryani, Burgers...
          </div>
        </div>

        <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

        {/* Smart Filters */}
        <div className="flex gap-3 mb-10 overflow-x-auto pb-2 scrollbar-hide">
           <button 
             onClick={() => setFilter('all')}
             className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-primary-yellow text-black shadow-lg shadow-primary-yellow/20' : 'bg-white/5 border border-white/10'}`}
           >
             All
           </button>
           <button 
             onClick={() => setFilter('budget')}
             className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'budget' ? 'bg-primary-yellow text-black shadow-lg shadow-primary-yellow/20' : 'bg-white/5 border border-white/10'}`}
           >
             Budget ({"<"}₹150)
           </button>
           <button 
             onClick={() => setFilter('veg')}
             className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'veg' ? 'bg-primary-yellow text-black shadow-lg shadow-primary-yellow/20' : 'bg-white/5 border border-white/10'}`}
           >
             Veg Only
           </button>
        </div>

        {/* Alternating Zigzag Recipe List */}
        <div className="space-y-4">
          {searchQuery !== '' && filteredItems.length > 0 ? (
            <div className="mb-4">
               <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary-text mb-6">Search Results</h2>
               <div className="space-y-3">
                  {filteredItems.slice(0, 10).map(item => (
                    <Link href={`/products/${item.id}`} key={item.id} className="block bg-white/5 border border-white/5 p-4 rounded-[24px] hover:bg-white/10 transition-all">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 relative flex-shrink-0">
                            <Image 
                              src={item.image} 
                              alt={item.name} 
                              fill
                              style={{ objectFit: 'cover' }}
                              className="rounded-xl" 
                            />
                          </div>
                          <div className="flex-1">
                             <div className="flex justify-between items-start">
                                <h4 className="text-sm font-black">{item.name}</h4>
                                <span className="text-xs font-black text-primary-yellow">₹{item.price}</span>
                             </div>
                             <p className="text-[10px] text-secondary-text font-bold uppercase tracking-tighter">{item.restaurantName}</p>
                          </div>
                       </div>
                    </Link>
                  ))}
               </div>
            </div>
          ) : (
            displayRestaurants.map((res, index) => (
              <Link href={`/restaurants/${res.id}`} key={res.id}>
                <RestaurantCard 
                  name={res.name}
                  rating={res.rating}
                  time={res.time}
                  imageUrl={res.imageUrl}
                  imagePosition={index % 2 === 0 ? 'left' : 'right'}
                />
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Modern Bottom Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 h-24 bg-[#111111]/95 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-6 z-[60]">
        <Link href="/" className="flex flex-col items-center gap-1 nav-icon-active">
           <div className="tab-pill">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
           </div>
           <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
        </Link>
        <Link href="/orders" className="flex flex-col items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
           <span className="text-[10px] font-bold">Orders</span>
        </Link>
        <Link href="/basket" className="flex flex-col items-center gap-1 relative opacity-50 hover:opacity-100 transition-opacity">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
           <span className="text-[10px] font-bold">Basket</span>
           {totalItems > 0 && (
             <span className="absolute -top-1 -right-1 bg-primary-yellow text-black text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
               {totalItems}
             </span>
           )}
        </Link>
        <Link href="/profile" className="flex flex-col items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
           <span className="text-[10px] font-bold">Profile</span>
        </Link>
      </footer>
    </main>
  );
}
