"use client";
import { useCart } from '@/context/CartContext';
import { useState } from 'react';
import Link from 'next/link';

export default function CheckoutPage() {
  const { cart, totalPrice, clearCart } = useCart();
  const [deliveryMethod, setDeliveryMethod] = useState<'room' | 'gate'>('room');
  const [useBatch, setUseBatch] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const deliveryFee = deliveryMethod === 'gate' ? 20 : 30;
  const batchDiscount = useBatch ? 20 : 0;
  const gateDiscount = deliveryMethod === 'gate' ? Math.round(0.3 * deliveryFee) : 0;
  
  const finalTotal = totalPrice + deliveryFee - batchDiscount - gateDiscount;

  const handlePlaceOrder = async () => {
    setIsProcessing(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login first!');
        window.location.href = '/login';
        return;
      }

      const orderData = {
        restaurantId: cart[0]?.restaurantId || '65f1a2b3c4d5e6f7a8b9c0d1', // Fallback to a valid-looking ObjectId for testing or handle better
        items: cart.map(item => ({
          menuItemId: item.id,
          name: item.name,
          quantity: item.quantity,
          priceAtOrder: item.price
        })),
        totalPrice: totalPrice,
        deliveryFee: deliveryFee,
        deliverySlot: useBatch ? '7:30 PM' : 'IMMEDIATE',
        hostelGateDelivery: deliveryMethod === 'gate'
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://hostelbites-backend-exs6.onrender.com'}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const data = await response.json();
        alert('Order Placed Successfully! 🚀');
        clearCart();
        window.location.href = `/tracking?id=${data._id}`;
      } else {
        const err = await response.json();
        alert(`Failed to place order: ${err.message}`);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Network Error. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Curfew Check
  const isCurfewActive = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return (hours * 100 + minutes) > 2130;
  };

  const curfewActive = isCurfewActive();

  return (
    <main className="min-h-screen bg-background text-white p-8">
      {curfewActive && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mb-8 flex items-center gap-3 animate-pulse">
           <span className="text-xl">⚠️</span>
           <div className="text-[10px] font-black uppercase tracking-widest text-red-500">
             SRM Curfew Active: Delivery closed until tomorrow.
           </div>
        </div>
      )}
      <div className="flex items-center gap-4 mb-10">
        <Link href="/basket" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-black uppercase tracking-widest">Checkout</h1>
      </div>

      <div className="space-y-10">
        {/* Delivery Options [SRM Specific] */}
        <div>
          <h2 className="text-secondary-text font-black text-xs uppercase tracking-widest mb-4">Delivery Method</h2>
          <div className="grid grid-cols-2 gap-4">
             <button 
               onClick={() => setDeliveryMethod('room')}
               className={`p-6 rounded-[30px] border transition-all ${deliveryMethod === 'room' ? 'border-primary-yellow bg-primary-yellow/10' : 'border-white/5 bg-card-bg'}`}
             >
                <div className="text-2xl mb-2">📦</div>
                <div className="text-sm font-black">Room Drop</div>
                <div className="text-[10px] opacity-50">Standard Delivery</div>
             </button>
             <button 
               onClick={() => setDeliveryMethod('gate')}
               className={`p-6 rounded-[30px] border transition-all ${deliveryMethod === 'gate' ? 'border-primary-yellow bg-primary-yellow/10' : 'border-white/5 bg-card-bg'}`}
             >
                <div className="text-2xl mb-2">🚧</div>
                <div className="text-sm font-black">Gate Pickup</div>
                <div className="text-[10px] text-primary-yellow font-bold">Save 30% Fee</div>
             </button>
          </div>
        </div>

        {/* Batch Delivery Toggle [Cost Cutting] */}
        <div className={`p-6 rounded-[40px] border-2 transition-all ${useBatch ? 'border-primary-yellow bg-primary-yellow/5' : 'border-white/5 bg-card-bg'}`}>
           <div className="flex justify-between items-center">
              <div>
                 <h3 className="font-black text-sm">Batch Delivery Slot</h3>
                 <p className="text-[11px] text-secondary-text mt-1">Wait for next batch (7:30 PM) to save more.</p>
              </div>
              <button 
                onClick={() => setUseBatch(!useBatch)}
                className={`w-14 h-8 rounded-full transition-colors relative ${useBatch ? 'bg-primary-yellow' : 'bg-white/10'}`}
              >
                 <div className={`absolute top-1 w-6 h-6 rounded-full bg-black transition-all ${useBatch ? 'left-7' : 'left-1'}`} />
              </button>
           </div>
           {useBatch && (
             <div className="mt-4 text-primary-yellow font-black text-xs">
                ✨ ₹20 BATCH SAVINGS APPLIED
             </div>
           )}
        </div>

        {/* Pricing Summary */}
        <div className="bg-card-bg p-8 rounded-[40px] border border-white/5 space-y-4">
           <div className="flex justify-between text-sm font-bold text-secondary-text">
             <span>Items Subtotal</span>
             <span>₹{totalPrice}</span>
           </div>
           <div className="flex justify-between text-sm font-bold text-secondary-text">
             <span>Delivery Fee</span>
             <span>₹{deliveryFee}</span>
           </div>
           {(batchDiscount > 0 || gateDiscount > 0) && (
             <div className="flex justify-between text-sm font-black text-primary-yellow">
               <span>Total Discounts</span>
               <span>−₹{batchDiscount + gateDiscount}</span>
             </div>
           )}
           <div className="border-t border-white/5 pt-4 flex justify-between items-center">
             <span className="text-xl font-black">To Pay</span>
             <span className="text-2xl font-black text-primary-yellow">₹{finalTotal}</span>
           </div>
        </div>

        <button 
          onClick={handlePlaceOrder}
          disabled={isProcessing || curfewActive}
          className="w-full btn-yellow py-6 h-auto text-lg uppercase tracking-widest shadow-[0_20px_40px_rgba(247,211,49,0.3)] disabled:opacity-30"
        >
          {isProcessing ? 'Processing...' : curfewActive ? 'Curfew Active' : 'Pay & Confirm'}
        </button>
      </div>
    </main>
  );
}
