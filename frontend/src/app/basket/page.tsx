"use client";
import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';
import SafeImage from '@/components/SafeImage';
import Tilt from '@/components/Tilt';
import Magnetic from '@/components/Magnetic';

interface CartItem {
  id: string;
  name: string;
  price: number;
  image?: string;
  imageUrl?: string;
  restaurantName?: string;
  quantity: number;
  isCake?: boolean;
  customName?: string;
}

interface BasketItemProps {
  item: CartItem;
  updateQuantity: (id: string, q: number) => void;
  removeFromCart: (id: string) => void;
  updateCustomName: (id: string, name: string) => void;
}

function BasketItem({ item, updateQuantity, removeFromCart, updateCustomName }: BasketItemProps) {
  const [localName, setLocalName] = useState(item.customName || '');

  const handleNameChange = (val: string) => {
    setLocalName(val);
    updateCustomName(item.id, val);
  };

  return (
    <div key={item.id} className="flex flex-col bg-card-bg p-4 md:p-6 rounded-[28px] md:rounded-[35px] border border-white/5 transition-all hover:border-white/10 group premium-tilt">
      <div className="flex gap-4 md:gap-6 items-center">
        <div className="w-24 h-24 relative flex-shrink-0">
          <SafeImage 
            src={item.image || item.imageUrl} 
            alt={item.name} 
            fill
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
              value={localName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full stardust-search rounded-2xl px-5 py-4 text-sm font-black text-white placeholder:text-white/20 focus:outline-none transition-all"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-yellow opacity-40">✍️</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BasketPage() {
  const { cart, updateQuantity, removeFromCart, updateCustomName, totalPrice } = useCart();

  return (
    <main className="min-h-screen bg-[#0A0A0B] text-white p-4 md:p-8 relative overflow-x-hidden">
      {/* Cinematic Background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(201,168,76,0.05)_0%,transparent_50%)] pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-b from-black via-transparent to-black pointer-events-none opacity-40" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-12">
          <Magnetic>
            <Link href="/" className="w-12 h-12 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 hover:bg-white/10 transition-all">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          </Magnetic>
          <h1 className="text-xl font-black uppercase tracking-[0.3em] text-gold-shimmer">Strategic Vault</h1>
          <div className="w-12" />
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-32 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="w-full flex justify-center mb-10">
               <div className="w-40 h-40 bg-white/5 rounded-full flex items-center justify-center text-6xl shadow-2xl border border-white/5">🛒</div>
            </div>
            <p className="text-secondary-text font-black uppercase tracking-widest mb-12 opacity-40">Your strategic vault is empty</p>
            <Magnetic>
              <Link href="/" className="px-12 py-4 bg-primary-yellow text-black rounded-2xl font-black uppercase tracking-widest text-xs shadow-[0_15px_30px_-10px_rgba(201,168,76,0.3)]">Explore The Nexus</Link>
            </Magnetic>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
              {cart.map((item) => (
                <Tilt key={item.id} scale={1.01} className="mb-4">
                  <BasketItem 
                    item={item} 
                    updateQuantity={updateQuantity} 
                    removeFromCart={removeFromCart} 
                    updateCustomName={updateCustomName} 
                  />
                </Tilt>
              ))}
            </div>

            <div className="pt-12 space-y-5 animate-in fade-in duration-1000 delay-300">
               <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-white/30">
                 <span>Vault Subtotal</span>
                 <span>₹{totalPrice}</span>
               </div>
               <div className="h-[1px] bg-white/5" />
               <div className="flex justify-between items-center text-white text-2xl md:text-3xl font-black tracking-tighter">
                 <span className="text-gold-shimmer uppercase text-[10px] md:text-base tracking-widest">Grand Total</span>
                 <span className="text-primary-yellow">₹{totalPrice}</span>
               </div>
            </div>

            <Magnetic>
              <Link href="/checkout" className="w-full btn-yellow mt-12 flex justify-center py-6 text-[13px] font-black uppercase tracking-[0.2em] relative overflow-hidden group shadow-[0_20px_50px_rgba(201,168,76,0.25)]">
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12" />
                Proceed to Checkout
              </Link>
            </Magnetic>
          </div>
        )}
      </div>
    </main>
  );
}
