"use client";
import { useCart } from '@/context/CartContext';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import SuccessOverlay from '@/components/SuccessOverlay';

export default function CheckoutPage() {
  const { cart, totalPrice, clearCart } = useCart();
  const [deliveryMethod, setDeliveryMethod] = useState<'room' | 'gate'>('room');
  const allSlots = [
    { id: '1:00 PM', hour: 13, min: 0 },
    { id: '5:00 PM', hour: 17, min: 0 },
    { id: '7:30 PM', hour: 19, min: 30 },
    { id: '8:50 PM', hour: 20, min: 50 },
    { id: '9:30 PM', hour: 21, min: 30 }
  ];

  const [selectedSlot, setSelectedSlot] = useState<string>('');

  const isSlotAvailable = (slot: typeof allSlots[0]) => {
    const now = new Date();
    const slotDate = new Date();
    slotDate.setHours(slot.hour, slot.min, 0, 0);
    const diff = (slotDate.getTime() - now.getTime()) / (1000 * 60);
    return diff >= 60; // 1 hour = 60 mins
  };

  const availableSlots = allSlots.filter(isSlotAvailable);

  // Read isElite from localStorage (not hardcoded)
  const [isElite, setIsElite] = useState(false);

  // Set default slot and read user elite status on mount
  useEffect(() => {
    if (availableSlots.length > 0 && !selectedSlot) {
      setSelectedSlot(availableSlots[0].id);
    }
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setIsElite(parsed.isElite || false);
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [overlay, setOverlay] = useState<{ isOpen: boolean; title: string; message: string; type?: 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const deliveryFee = isElite ? 0 : (deliveryMethod === 'gate' ? 20 : 30);
  const batchDiscount = 0;
  const gateDiscount = deliveryMethod === 'gate' ? Math.round(0.3 * deliveryFee) : 0;
  
  const finalTotal = totalPrice + deliveryFee - batchDiscount - gateDiscount;

  const handlePlaceOrder = async () => {
    setIsProcessing(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setOverlay({
          isOpen: true,
          title: 'Authentication Required',
          message: 'Please login to complete your order.',
          type: 'error'
        });
        setTimeout(() => window.location.href = '/login', 2000);
        return;
      }

      const orderData = {
        restaurantId: cart[0]?.restaurantId || '65f1a2b3c4d5e6f7a8b9c0d1',
        items: cart.map(item => ({
          menuItemId: item.id,
          name: item.name,
          quantity: item.quantity,
          priceAtOrder: item.price
        })),
        totalPrice: totalPrice,
        deliveryFee: deliveryFee,
        deliverySlot: selectedSlot,
        hostelGateDelivery: deliveryMethod === 'gate'
      };

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const data = await response.json();
        setOverlay({
          isOpen: true,
          title: 'Order Placed!',
          message: 'Your gourmet meal is being prepared with care.',
          type: 'success'
        });
        clearCart();
        setTimeout(() => window.location.href = `/tracking?id=${data._id}`, 2500);
      } else {
        const err = await response.json();
        setOverlay({
          isOpen: true,
          title: 'Order Failed',
          message: err.message || 'Something went wrong. Please try again.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setOverlay({
        isOpen: true,
        title: 'Connection Issue',
        message: 'Could not connect to Zenvy servers. Please check your network.',
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-white p-8">
      <div className="flex items-center gap-4 mb-10">
        <Link href="/basket" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-black uppercase tracking-widest">Checkout</h1>
      </div>

      <div className="space-y-10">
        {/* Delivery Options */}
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

        {/* 🎓 Campus Batch Policy: Windowed Delivery Only */}
        <div>
          <h2 className="text-secondary-text font-black text-xs uppercase tracking-widest mb-2">Delivery Scheduling</h2>
          <p className="text-[10px] text-primary-yellow font-bold uppercase tracking-widest mb-6 italic">⚠️ Policy: Must order 1 hour before slot</p>
          
          <div className="space-y-3">
             {allSlots.map(slot => {
               const available = isSlotAvailable(slot);
               return (
                 <button 
                   key={slot.id}
                   disabled={!available}
                   onClick={() => setSelectedSlot(slot.id)}
                   className={`w-full p-5 rounded-[25px] border flex justify-between items-center transition-all ${
                     selectedSlot === slot.id 
                       ? 'border-primary-yellow bg-primary-yellow/10' 
                       : !available 
                         ? 'border-white/5 bg-white/[0.02] opacity-30 grayscale cursor-not-allowed' 
                         : 'border-white/10 bg-card-bg hover:border-white/20'
                   }`}
                 >
                    <div className="flex flex-col items-start">
                      <span className={`text-sm font-black ${selectedSlot === slot.id ? 'text-primary-yellow' : 'text-white'}`}>{slot.id} Delivery Batch</span>
                      {!available && <span className="text-[9px] uppercase tracking-tighter text-red-500 font-bold mt-1">Order window closed</span>}
                    </div>
                    {available && <div className={`w-4 h-4 rounded-full border-2 ${selectedSlot === slot.id ? 'border-primary-yellow bg-primary-yellow' : 'border-white/20'}`} />}
                 </button>
               );
             })}

             {availableSlots.length === 0 && (
               <div className="p-8 rounded-[30px] border border-red-500/20 bg-red-500/5 text-center">
                  <p className="text-red-400 font-bold text-sm">All delivery windows for today are closed.</p>
                  <p className="text-[10px] text-red-400/60 mt-1 uppercase tracking-widest font-black">Next available: Tomorrow 1:00 PM</p>
               </div>
             )}
          </div>
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
          disabled={isProcessing}
          className="w-full btn-yellow py-6 h-auto text-lg uppercase tracking-widest shadow-[0_20px_40px_rgba(247,211,49,0.3)] disabled:opacity-30"
        >
          {isProcessing ? 'Processing...' : 'Pay & Confirm'}
        </button>
      </div>
      
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

