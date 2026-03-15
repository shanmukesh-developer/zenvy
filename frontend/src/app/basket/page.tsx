"use client";
import { useCart } from '@/context/CartContext';
import Link from 'next/link';

export default function BasketPage() {
  const { cart, updateQuantity, removeFromCart, totalPrice } = useCart();

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
            <div key={item.id} className="flex gap-4 items-center bg-card-bg p-4 rounded-[30px] border border-white/5">
              <img src={item.image} className="w-20 h-20 rounded-full object-cover border-2 border-primary-yellow" alt={item.name} />
              <div className="flex-1">
                <h3 className="font-bold text-sm mb-1">{item.name}</h3>
                <p className="text-primary-yellow font-black">₹{item.price}</p>
                <div className="flex items-center gap-4 mt-2">
                  <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center font-bold">-</button>
                  <span className="font-black text-sm">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center font-bold">+</button>
                </div>
              </div>
              <button onClick={() => removeFromCart(item.id)} className="p-2 opacity-30 hover:opacity-100">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
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

          <Link href="/checkout" className="w-full btn-yellow mt-10 flex justify-center py-6 text-lg uppercase tracking-widest">
            Proceed to Checkout
          </Link>
        </div>
      )}
    </main>
  );
}
