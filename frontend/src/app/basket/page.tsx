"use client";
import { useCart } from '@/context/CartContext';
import Link from 'next/link';
import Image from 'next/image';

export default function BasketPage() {
  const { cart, updateQuantity, removeFromCart, updateCustomName, totalPrice } = useCart();

  return (
    <main className="min-h-screen bg-background text-white p-8">
      <div className="flex items-center justify-between mb-10">
        <Link href="/" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-black uppercase tracking-widest">My Basket</h1>
        <div className="w-10" />
      </div>

      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center pt-20">
          <div className="w-full flex justify-center mb-8">
             <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center text-5xl">🛒</div>
          </div>
          <p className="text-secondary-text font-bold mb-10">Your basket is empty, bro.</p>
          <Link href="/" className="btn-yellow">EXPLORE FOOD</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {cart.map((item) => (
            <div key={item.id} className="flex flex-col bg-card-bg p-6 rounded-[35px] border border-white/5 transition-all hover:border-white/10 group premium-tilt">
              <div className="flex gap-6 items-center">
                <div className="w-24 h-24 relative flex-shrink-0">
                  <Image 
                    src={item.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400"} 
                    alt={item.name} 
                    fill
                    style={{ objectFit: 'cover' }}
                    className="rounded-full border-2 border-primary-yellow shadow-2xl" 
                  />
                  {item.isCake && (
                    <div className="absolute -top-2 -right-2 bg-primary-yellow text-black text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">Personalizable</div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-black text-base text-white group-hover:text-primary-yellow transition-colors">{item.name}</h3>
                  <p className="text-secondary-text text-xs mt-1 mb-3">from {item.restaurantName || "Zenvy Elite"}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-primary-yellow font-black text-lg">₹{item.price}</p>
                    <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center font-bold text-secondary-text hover:text-white">-</button>
                      <span className="font-black text-sm w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center font-bold text-secondary-text hover:text-white">+</button>
                    </div>
                  </div>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="p-2 opacity-20 hover:opacity-100 hover:text-red-500 transition-all">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
              </div>

              {item.isCake && (
                <div className="mt-6 pt-6 border-t border-white/5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary-yellow/60 block mb-3">Name/Message on Cake</label>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="e.g. Happy Birthday Shanmukh"
                      value={item.customName || ''}
                      onChange={(e) => updateCustomName(item.id, e.target.value)}
                      className="w-full stardust-search rounded-2xl px-5 py-4 text-sm font-black text-white placeholder:text-white/20 focus:outline-none transition-all"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-yellow opacity-40">✍️</div>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="pt-10 space-y-4">
             <div className="flex justify-between items-center text-secondary-text font-bold">
               <span>Subtotal</span>
               <span>₹{totalPrice}</span>
             </div>
             <div className="flex justify-between items-center text-white text-xl font-black">
               <span>Total</span>
               <span>₹{totalPrice}</span>
             </div>
          </div>

          <Link href="/checkout" className="w-full btn-yellow mt-10 flex justify-center py-6 text-lg uppercase tracking-widest animate-text-shimmer shadow-[0_20px_40px_rgba(201,168,76,0.2)]">
            Proceed to Checkout
          </Link>
        </div>
      )}
    </main>
  );
}
