"use client";
import { restaurants } from '@/data/restaurants';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';

export default function RestaurantMenuClient({ restaurantId }: { restaurantId: string }) {
  const restaurant = restaurants.find(r => r.id === restaurantId);
  const { totalItems } = useCart();

  if (!restaurant) return <div className="p-8 text-white">Restaurant not found, bro.</div>;

  return (
    <main className="min-h-screen bg-background text-white p-6 pb-32">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-black">{restaurant.name}</h1>
      </div>

      {/* Restaurant Info Card */}
      <div className="bg-card-bg rounded-[40px] p-8 border border-white/5 mb-10 overflow-hidden relative">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-primary-yellow text-black text-[10px] font-black px-2 py-0.5 rounded-full">TOP RATED</span>
            <span className="text-xs font-bold text-secondary-text">⭐ {restaurant.rating}</span>
          </div>
          <p className="text-secondary-text text-sm mb-6 leading-relaxed">{restaurant.description}</p>
          <div className="flex gap-4">
             <div className="text-[10px] font-black uppercase tracking-widest text-secondary-text">Delivery: {restaurant.time}</div>
             <div className="text-[10px] font-black uppercase tracking-widest text-secondary-text">Min Order: ₹99</div>
          </div>
        </div>
        <img src={restaurant.imageUrl} alt="" className="absolute -right-10 -bottom-10 w-48 h-48 opacity-20 grayscale brightness-150 rotate-12" />
      </div>

      {/* Category Scroll */}
      <div className="flex gap-4 overflow-x-auto no-scrollbar mb-10">
        {restaurant.categories.map((cat, idx) => (
          <button key={cat} className={`px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap border transition-all ${idx === 0 ? 'bg-primary-yellow text-black border-primary-yellow' : 'bg-transparent text-secondary-text border-white/10'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Items */}
      <div className="space-y-6">
        {restaurant.menu.map((item) => (
          <Link href={`/products/${item.id}`} key={item.id} className="flex gap-4 items-center bg-card-bg p-4 rounded-[30px] border border-white/5">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10 bg-black flex-shrink-0">
               <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
               <h3 className="font-bold text-sm mb-1">{item.name}</h3>
               <p className="text-[10px] text-secondary-text line-clamp-1 mb-2">Authentic {restaurant.name} specialty.</p>
               <div className="flex justify-between items-center">
                  <span className="font-black text-primary-yellow text-sm">₹{item.price}</span>
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs">+</div>
               </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Floating Cart Button */}
      {totalItems > 0 && (
        <Link href="/basket" className="fixed bottom-28 right-8 left-8 h-20 bg-primary-yellow text-black rounded-full flex items-center justify-between px-8 z-50 shadow-2xl animate-bounce-subtle">
           <div className="flex items-center gap-4">
              <span className="w-8 h-8 rounded-full bg-black text-white text-[12px] font-black flex items-center justify-center">{totalItems}</span>
              <span className="font-black uppercase tracking-widest text-sm">View Basket</span>
           </div>
           <span className="font-black">Proceed →</span>
        </Link>
      )}
    </main>
  );
}
