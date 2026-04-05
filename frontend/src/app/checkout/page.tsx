"use client";
import { useCart } from '@/context/CartContext';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import SuccessOverlay from '@/components/SuccessOverlay';
import CheckoutProcessingModal from '@/components/CheckoutProcessingModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export default function CheckoutPage() {
  const { cart, totalPrice, clearCart } = useCart();

  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [deliveryType, setDeliveryType] = useState<'asap' | 'scheduled'>('asap');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isElite, setIsElite] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setIsElite(parsed.isElite || false);
        setDeliveryAddress(parsed.defaultAddress || '');
      }
    } catch { /* ignore */ }
  }, []);

  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [overlay, setOverlay] = useState<{ isOpen: boolean; title: string; message: string; type?: 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const baseDeliveryFee = isElite ? 0 : 35;
  const finalTotal = totalPrice + baseDeliveryFee;

  const handlePlaceOrder = async () => {
    if (!deliveryAddress.trim()) {
      setOverlay({ isOpen: true, title: 'Address Required', message: 'Please enter your delivery address.', type: 'error' });
      return;
    }
    setCheckoutStatus('processing');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setCheckoutStatus('error');
        setOverlay({ isOpen: true, title: 'Login Required', message: 'Please login to complete your order.', type: 'error' });
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
        totalPrice,
        deliveryFee: baseDeliveryFee,
        deliverySlot: deliveryType === 'asap' ? 'ASAP' : scheduledTime,
        deliveryAddress: `${deliveryAddress}${landmark ? ', ' + landmark : ''}`,
        hostelGateDelivery: false
      };

      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const data = await response.json();
        setCheckoutStatus('success');
        clearCart();
        setTimeout(() => window.location.href = `/tracking?id=${data._id}`, 2000);
      } else {
        const err = await response.json();
        setCheckoutStatus('error');
        setOverlay({ isOpen: true, title: 'Order Failed', message: err.message || 'Please try again.', type: 'error' });
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setCheckoutStatus('error');
      setOverlay({ isOpen: true, title: 'Connection Issue', message: 'Could not connect to Zenvy servers.', type: 'error' });
    }
  };

  return (
    <main className="min-h-screen bg-background text-white p-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/basket" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-black uppercase tracking-widest">Checkout</h1>
      </div>

      <div className="space-y-8">

        {/* Delivery Address */}
        <div>
          <h2 className="text-secondary-text font-black text-xs uppercase tracking-widest mb-4">Delivery Address</h2>
          <div className="space-y-3">
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-lg">📍</span>
              <input
                type="text"
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                placeholder="Street, area, locality..."
                className="w-full pl-12 pr-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-600 outline-none focus:border-primary-yellow/40 transition-all text-sm"
              />
            </div>
            <input
              type="text"
              value={landmark}
              onChange={e => setLandmark(e.target.value)}
              placeholder="Landmark (optional)"
              className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-600 outline-none focus:border-primary-yellow/40 transition-all text-sm"
            />
          </div>
        </div>

        {/* Delivery Time */}
        <div>
          <h2 className="text-secondary-text font-black text-xs uppercase tracking-widest mb-4">Delivery Time</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setDeliveryType('asap')}
              className={`p-5 rounded-[24px] border flex flex-col gap-1 transition-all ${deliveryType === 'asap' ? 'border-primary-yellow bg-primary-yellow/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
            >
              <span className="text-2xl">⚡</span>
              <span className="text-sm font-black">ASAP</span>
              <span className="text-[10px] text-secondary-text font-bold">30–50 mins</span>
            </button>
            <button
              onClick={() => setDeliveryType('scheduled')}
              className={`p-5 rounded-[24px] border flex flex-col gap-1 transition-all ${deliveryType === 'scheduled' ? 'border-primary-yellow bg-primary-yellow/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
            >
              <span className="text-2xl">🗓️</span>
              <span className="text-sm font-black">Schedule</span>
              <span className="text-[10px] text-secondary-text font-bold">Pick a time</span>
            </button>
          </div>
          {deliveryType === 'scheduled' && (
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={e => setScheduledTime(e.target.value)}
              min={new Date(Date.now() + 30 * 60000).toISOString().slice(0, 16)}
              className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-primary-yellow/40 transition-all text-sm"
            />
          )}
        </div>

        {/* Pricing Summary */}
        <div className="bg-card-bg p-7 rounded-[36px] border border-white/5 space-y-4">
          <div className="flex justify-between text-sm font-bold text-secondary-text">
            <span>Items Subtotal</span>
            <span>₹{totalPrice}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-secondary-text">
            <span>Delivery Fee</span>
            {isElite ? (
              <span className="text-primary-yellow font-black">FREE (Elite)</span>
            ) : (
              <span>₹{baseDeliveryFee}</span>
            )}
          </div>
          <div className="border-t border-white/5 pt-4 flex justify-between items-center">
            <span className="text-xl font-black">To Pay</span>
            <span className="text-2xl font-black text-primary-yellow">₹{finalTotal}</span>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handlePlaceOrder}
          disabled={checkoutStatus === 'processing' || checkoutStatus === 'success'}
          className="w-full btn-yellow py-6 h-auto text-lg uppercase tracking-[0.2em] font-black shadow-[0_20px_60px_rgba(201,168,76,0.3)] disabled:opacity-30 transition-all premium-tilt animate-text-shimmer"
        >
          {checkoutStatus === 'processing' ? 'Processing Order...' : 'Confirm & Pay  →'}
        </button>
      </div>

      <SuccessOverlay
        isOpen={overlay.isOpen}
        onClose={() => setOverlay(prev => ({ ...prev, isOpen: false }))}
        title={overlay.title}
        message={overlay.message}
        type={overlay.type}
      />
      <CheckoutProcessingModal
        isOpen={checkoutStatus !== 'idle'}
        status={checkoutStatus as 'processing' | 'success' | 'error'}
      />
    </main>
  );
}
