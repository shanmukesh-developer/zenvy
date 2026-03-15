"use client";
import Link from 'next/link';
import RestaurantCard from '@/components/RestaurantCard';
import { useCart } from '@/context/CartContext';
import { restaurants } from '@/data/restaurants';

export default function Home() {
  const { totalItems } = useCart();

  return (
    <main className="min-h-screen bg-background text-white p-8 pt-16 pb-32 relative">
      <div className="max-w-[400px] mx-auto">
        <header className="mb-10">
          <h1 className="discover-header">
            SRM Campus <br /> Bites Delivered
          </h1>
          <p className="recipe-count mt-2">
            Trending <span className="underline decoration-white/20 underline-offset-8 font-serif">near your hostel</span>
          </p>
        </header>

        {/* Search Bar - Matching Image */}
        <div className="relative mb-12">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-secondary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input 
            type="text" 
            placeholder="Search restaurants or dishes..."
            className="w-full bg-[#1C1C1E] border-none rounded-full py-4 pl-14 pr-4 text-sm focus:ring-0 placeholder:text-secondary-text font-medium"
          />
        </div>

        {/* Alternating Zigzag Recipe List */}
        <div className="space-y-4">
          {restaurants.map((res, index) => (
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

        {/* Floating Plus Buttons from Image */}
        <div className="fixed bottom-36 right-10 floating-plus">
           +
        </div>
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 floating-plus z-50">
           +
        </div>
      </div>

      {/* Modern Bottom Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 h-24 bg-[#111111]/95 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-6 z-[60]">
        <Link href="/" className="flex flex-col items-center gap-1 opacity-50">
           <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
           <span className="text-[10px] font-bold">Home</span>
        </Link>
        <Link href="/" className="flex flex-col items-center gap-1 nav-icon-active">
           <div className="tab-pill">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" /></svg>
           </div>
           <span className="text-[10px] font-bold uppercase tracking-wider">Discover</span>
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
        <Link href="/profile" className="flex flex-col items-center gap-1 opacity-50">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
           <span className="text-[10px] font-bold">Profile</span>
        </Link>
      </footer>
    </main>
  );
}
