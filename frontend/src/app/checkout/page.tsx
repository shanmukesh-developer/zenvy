"use client";
import { useCart } from '@/context/CartContext';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SafeImage from '@/components/SafeImage';
import CheckoutProcessingModal from '@/components/CheckoutProcessingModal';
import MapLocationPicker from '@/components/MapLocationPicker';

import ZenvyModal from '@/components/ZenvyModal';
import Tilt from '@/components/Tilt';
import Magnetic from '@/components/Magnetic';
import { showToast } from '@/components/ToastProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';

export default function CheckoutPage() {
  const { cart, totalPrice, clearCart } = useCart();
  const router = useRouter();

  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [deliveryType, setDeliveryType] = useState<'asap' | 'scheduled'>('asap');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [upiUTR, setUpiUTR] = useState('');
  const [upiScreenshot, setUpiScreenshot] = useState<string | null>(null);
  const [isElite, setIsElite] = useState(false);
  const distance = 0;
  const [deliveryFee, setDeliveryFee] = useState(30);
  const [surge, setSurge] = useState({ isSurge: false, multiplier: 1 });
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isQrZoomed, setIsQrZoomed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'UPI' | 'Card' | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const [zenPoints, setZenPoints] = useState(0);
  const [coupons, setCoupons] = useState<{ id: string; code: string; type: string }[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<{ id: string; code: string; type: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    const fetchSurge = async () => {
      try {
        const res = await fetch(`${API_URL}/api/orders/surge-status`);
        if (res.ok) {
          const data = await res.json();
          setSurge(data);
        }
      } catch (_err) { console.error('Surge fetch failed', _err); }
    };
    fetchSurge();
    const interval = setInterval(fetchSurge, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    const initLocation = async () => {
      let currentAddress = '';

      // 1. Try local storage first for immediate UI
      try {
        const stored = localStorage.getItem('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          setIsElite(parsed.isElite || false);
          if (parsed.address) {
            setDeliveryAddress(parsed.address);
            currentAddress = parsed.address;
          }
          if (parsed.zenPoints) {
            setZenPoints(parsed.zenPoints);
          }
        }
      } catch { /* ignore */ }

      // 2. Fetch LATEST profile from server to ensure synchronization
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const res = await fetch(`${API_URL}/api/users/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const profile = await res.json();
            if (profile.address) {
              setDeliveryAddress(profile.address);
              currentAddress = profile.address;
              // Sync local storage
              const stored = localStorage.getItem('user');
              if (stored) {
                const parsed = JSON.parse(stored);
                localStorage.setItem('user', JSON.stringify({ ...parsed, ...profile }));
              }
            }
          } else if (res.status === 401) {
            localStorage.removeItem('token');
            router.push('/login');
          }
        }
      } catch (_err) { console.error('Profile sync failed', _err); }

      // 3. ONLY auto-geolocate if we STILL don't have an address from profile
      if (!currentAddress && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {
              headers: { 'Accept-Language': 'en' }
            });
            const data = await res.json();
            if (data.display_name) {
              setDeliveryAddress(data.display_name);
            }
          } catch (_e) { console.error('Auto-location error:', _e); }
        }, (err) => {
          console.warn('Geolocation access denied or failed.', err);
        });
      }
    };
    initLocation();

    // Fetch User Coupons
    const fetchCoupons = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch(`${API_URL}/api/rewards/coupons`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setCoupons(data);
        }
      } catch (err) { console.error('Coupons fetch failed', err); }
    };
    fetchCoupons();
  }, [router]);

  // Flat ₹30 delivery fee for all orders. Elite/ZenPoints users get free delivery.
  useEffect(() => {
    setDeliveryFee(isElite || zenPoints >= 200 ? 0 : 30);
  }, [isElite, zenPoints]);

  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const currentCouponDiscount = selectedCoupon?.type === 'FREEDEL' ? deliveryFee : 0;
  const finalTotal = Math.max(0, totalPrice + deliveryFee - currentCouponDiscount);

  const handlePlaceOrder = async () => {
    if (checkoutStatus !== 'idle') return;
    if (!deliveryAddress.trim()) {
      setModalConfig({ isOpen: true, title: 'Address Required', message: 'Please enter your delivery address.', type: 'error' });
      return;
    }

    if (!paymentMethod) {
      setModalConfig({ isOpen: true, title: 'Payment Required', message: 'Please select a payment method.', type: 'error' });
      return;
    }

    if (paymentMethod === 'UPI' && (!upiUTR || !upiScreenshot)) {
      setModalConfig({ isOpen: true, title: 'Payment Details Required', message: 'Please enter your UTR number and upload a transaction screenshot.', type: 'error' });
      return;
    }

    setCheckoutStatus('processing');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setCheckoutStatus('error');
        setModalConfig({ isOpen: true, title: 'Login Required', message: 'Please login to complete your order.', type: 'error' });
        setTimeout(() => router.push('/login'), 2000);
        return;
      }

      const orderData = {
        restaurantId: cart[0]?.restaurantId,
        items: cart.map(item => ({
          menuItemId: item.id,
          name: item.name,
          quantity: item.quantity,
          priceAtOrder: item.price
        })),
        totalPrice,
        deliveryFee,
        distance,
        paymentMethod,
        upiUTR: paymentMethod === 'UPI' ? upiUTR : undefined,
        upiScreenshot: paymentMethod === 'UPI' ? upiScreenshot : undefined,
        deliverySlot: deliveryType === 'asap' ? 'ASAP' : scheduledTime,
        deliveryAddress: `${deliveryAddress}${landmark ? ', ' + landmark : ''}`,
        hostelGateDelivery: false,
        couponCode: selectedCoupon?.code
      };

      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const data = await response.json();
        setCheckoutStatus('success');
        showToast('Strategic Mission Initiated!', 'success', '🚀');
        clearCart();
        setTimeout(() => router.push(`/tracking?id=${data._id}`), 2000);
      } else {
        const err = await response.json();
        setCheckoutStatus('error');
        setErrorMsg(err.message || 'Payment Rejected by Node');

        // Handle Stale Session / Account Missing
        if (response.status === 401 && (err.message?.includes('Account not found') || err.message?.includes('token failed'))) {
           localStorage.removeItem('token');
           localStorage.removeItem('user');
           setModalConfig({ 
             isOpen: true, 
             title: 'Session Expired', 
             message: 'Your account session is no longer valid. Please re-register.', 
             type: 'error',
             onConfirm: () => router.push('/login')
           });
           return;
        }

        setModalConfig({ isOpen: true, title: 'Order Failed', message: err.message || 'Please try again.', type: 'error' });
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setCheckoutStatus('error');
      setModalConfig({ isOpen: true, title: 'Connection Issue', message: 'Could not connect to Zenvy servers.', type: 'error' });
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <main className="min-h-screen bg-background text-white p-6 pb-20" />;
  }

  // Empty cart guard — redirect back if cart is empty
  // Bypass guard if checkout was successful so success modal doesn't get unmounted!
  if (cart.length === 0 && checkoutStatus !== 'success') {
    return (
      <main className="min-h-screen bg-background text-white flex flex-col items-center justify-center gap-6 p-8">
        <div className="w-24 h-24 glass-card rounded-full flex items-center justify-center text-4xl">🛒</div>
        <h1 className="text-2xl font-black uppercase tracking-widest">Your Basket is Empty</h1>
        <p className="text-secondary-text text-sm text-center">Add some items before checking out.</p>
        <button onClick={() => router.push('/')} className="btn-yellow px-8">Browse Restaurants</button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0A0A0B] text-white p-4 md:p-6 pb-20 relative overflow-x-hidden">
      {/* Cinematic Background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(201,168,76,0.05)_0%,transparent_50%)] pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-b from-black via-transparent to-black pointer-events-none opacity-40" />
      {/* Copy Toast */}
      {copyToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in zoom-in duration-200">
          <div className="bg-[#C9A84C] text-black text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-full shadow-2xl flex items-center gap-2">
            <span>✓</span> UPI ID Copied!
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-10 relative z-10">
        <Magnetic>
          <button onClick={() => router.back()} className="w-12 h-12 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 hover:bg-white/10 transition-all">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </Magnetic>
        <h1 className="text-xl font-black uppercase tracking-[0.3em] text-gold-shimmer">Strategic Checkout</h1>
      </div>

      <div className="space-y-8">

        {/* Delivery Address */}
        <div>
          <h2 className="text-secondary-text font-black text-xs uppercase tracking-widest mb-4">Delivery Address</h2>
          <div className="space-y-3">
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-lg">📍</span>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  placeholder="Street, area, locality..."
                  className="w-full pl-12 pr-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-600 outline-none focus:border-primary-yellow/40 transition-all text-sm shadow-inner"
                />
              </div>
              <button
                onClick={() => setIsMapOpen(true)}
                className="h-[52px] px-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl flex items-center gap-3 transition-all group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <SafeImage src="/assets/gmaps_icon.png" alt="Maps" className="w-6 h-6 object-contain group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline-block">Live Map</span>
              </button>
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

        {/* Reward Coupons & Zen Points */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
           <div className="flex items-center justify-between mb-4">
              <h2 className="text-secondary-text font-black text-xs uppercase tracking-widest ">Gourmet Rewards</h2>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-full">
                 <span className="text-[10px] font-black text-primary-yellow">{zenPoints} ZEN</span>
              </div>
           </div>
           
           {coupons.length > 0 ? (
             <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
               {coupons.map(cpn => (
                 <button
                   key={cpn.id}
                   onClick={() => setSelectedCoupon(selectedCoupon?.id === cpn.id ? null : cpn)}
                   className={`shrink-0 p-4 rounded-[28px] border flex flex-col gap-1 transition-all min-w-[145px] text-left relative overflow-hidden ${selectedCoupon?.id === cpn.id ? 'border-primary-yellow bg-primary-yellow/10 ring-1 ring-primary-yellow/50' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
                 >
                   <div className="flex items-center justify-between mb-1">
                     <span className="text-lg">{cpn.type === 'FREEDEL' ? '🚚' : '🏷️'}</span>
                     {selectedCoupon?.id === cpn.id && <span className="text-primary-yellow text-[10px] font-black">ACTIVE</span>}
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-widest text-white truncate">{cpn.code}</span>
                   <span className="text-[8px] font-bold text-secondary-text uppercase">{cpn.type === 'FREEDEL' ? 'Free Delivery' : 'Discount'}</span>
                 </button>
               ))}
             </div>
           ) : (
             <div className="p-6 bg-white/[0.02] border border-dashed border-white/10 rounded-[32px] flex flex-col items-center justify-center text-center">
                <span className="text-2xl mb-2 opacity-20">🎡</span>
                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">No coupons available yet.<br/>Win unique codes at the Lucky Spin!</p>
             </div>
           )}
        </div>

        {/* Payment Method */}
        <div>
          <h2 className="text-secondary-text font-black text-xs uppercase tracking-widest mb-4">Payment Method</h2>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setPaymentMethod('COD')}
              className={`p-4 rounded-[24px] border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'COD' ? 'border-primary-yellow bg-primary-yellow/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
            >
              <span className="text-xl">💵</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Cash</span>
            </button>
            <button
              onClick={() => setPaymentMethod('UPI')}
              className={`p-4 rounded-[24px] border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'UPI' ? 'border-primary-yellow bg-primary-yellow/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
            >
              <span className="text-xl">📲</span>
              <span className="text-[10px] font-black uppercase tracking-widest">UPI</span>
            </button>
            <button
              onClick={() => setPaymentMethod('Card')}
              className={`p-4 rounded-[24px] border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'Card' ? 'border-primary-yellow bg-primary-yellow/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
            >
              <span className="text-xl">💳</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Card</span>
            </button>
          </div>
          {/* Card payment info */}
          {paymentMethod === 'Card' && (
            <div className="mt-4 p-5 bg-white/[0.03] border border-white/10 rounded-[24px] flex items-center gap-4 animate-in fade-in duration-300">
              <span className="text-2xl">💳</span>
              <div>
                <p className="text-sm font-black text-white">Card on Delivery</p>
                <p className="text-[10px] text-secondary-text font-bold mt-0.5">Our rider carries a POS machine. Pay by card when your order arrives.</p>
              </div>
            </div>
          )}

          {/* UPI Verification Section */}
          {paymentMethod === 'UPI' && (
            <div className="mt-6 p-6 bg-white/[0.03] border border-white/10 rounded-[32px] space-y-8 animate-in fade-in zoom-in duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black uppercase tracking-widest text-sm text-primary-yellow">Instant UPI Gateway</h3>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">Select your app to pay instantly</p>
                </div>
                <div className="w-10 h-10 bg-primary-yellow/10 rounded-xl flex items-center justify-center text-xl">💳</div>
              </div>

              {/* App Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <a
                  href={`upi://pay?pa=kesavakesava764@ybl&pn=ZenvyNexus&am=${finalTotal.toFixed(2)}&cu=INR`}
                  className="flex flex-col items-center gap-3 p-5 bg-[#5f259f]/10 border border-[#5f259f]/30 rounded-3xl hover:bg-[#5f259f]/20 transition-all group active:scale-95"
                >
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform overflow-hidden">
                    <SafeImage src="/assets/phonepe_logo.png" alt="PhonePe" className="w-full h-full object-contain scale-110" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#a882e0]">PhonePe</span>
                </a>

                <a
                  href={`upi://pay?pa=kesavakesava764@ybl&pn=ZenvyNexus&am=${finalTotal.toFixed(2)}&cu=INR`}
                  className="flex flex-col items-center gap-3 p-5 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all group active:scale-95"
                >
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform overflow-hidden">
                    <SafeImage 
                      src="/assets/gpay_logo.png" 
                      alt="GPay" 
                      className="w-full h-full object-contain scale-110" 
                    />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Google Pay</span>
                </a>
              </div>

              <div className="flex flex-col items-center gap-4">
                <div 
                  onClick={() => setIsQrZoomed(true)}
                  className="bg-white p-3 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] group relative cursor-zoom-in active:scale-95 transition-all"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src="/assets/upi_qr.png" 
                    alt="UPI QR Code" 
                    className="w-40 h-40 object-contain rounded-2xl"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=kesavakesava764@ybl&pn=ZenvyNexus&am=" + finalTotal;
                    }}
                  />
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText('kesavakesava764@ybl');
                      setCopyToast(true);
                      setTimeout(() => setCopyToast(false), 2000);
                    }}
                    className="absolute -bottom-2 translate-y-1/2 left-1/2 -translate-x-1/2 px-4 py-2 bg-[#C9A84C] text-black text-[10px] font-black uppercase tracking-widest rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-2xl active:scale-90"
                  >
                    Copy ID
                  </button>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-[10px] font-black text-[#C9A84C] uppercase tracking-widest cursor-pointer hover:underline" onClick={() => {
                   navigator.clipboard.writeText('kesavakesava764@ybl');
                   setCopyToast(true);
                   setTimeout(() => setCopyToast(false), 2000);
                }}>ID: kesavakesava764@ybl</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">(Tap to Copy ID if buttons don&apos;t open app)</p>
                </div>

                {/* Simulation Button for Testing */}
                <button
                  type="button"
                  onClick={() => {
                    setUpiUTR('SIM-' + Math.random().toString(36).substring(7).toUpperCase());
                    setUpiScreenshot('https://picsum.photos/seed/payment/400/800');
                    showToast('Payment Simulated!', 'success', '💎');
                  }}
                  className="mt-2 px-6 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-[0.2em] rounded-full hover:bg-emerald-500/20 transition-all active:scale-95"
                >
                  ⚡ Simulate Success (Dev Mode)
                </button>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-center">Post-Payment Verification</p>
                <input
                  type="text"
                  value={upiUTR}
                  onChange={(e) => setUpiUTR(e.target.value)}
                  placeholder="Paste 12-digit UTR Number"
                  className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-600 outline-none focus:border-primary-yellow/40 transition-all text-sm font-bold text-center"
                />

                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsUploading(true);
                    const formData = new FormData();
                    formData.append('image', file);
                    try {
                      const res = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: formData });
                      const data = await res.json();
                      setUpiScreenshot(data.imageUrl);
                    } catch (err) { console.error('Upload failed', err); }
                    finally { setIsUploading(false); }
                  }}
                  className="hidden"
                  id="upi-upload"
                />
                <label 
                  htmlFor="upi-upload"
                  className="flex items-center justify-center w-full p-4 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/5 transition-all gap-3 bg-white/[0.02]"
                >
                  {upiScreenshot ? (
                    <>
                       <span className="text-emerald-400 font-black text-xs uppercase tracking-widest">✓ Receipt Attached</span>
                    </>
                  ) : isUploading ? (
                    <div className="animate-spin w-4 h-4 border-2 border-primary-yellow border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <span className="text-xl">📸</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-secondary-text">Upload Screenshot</span>
                    </>
                  )}
                </label>
              </div>
            </div>
          )}
        </div>


        {/* Surge Warning */}
        {surge.isSurge && !isElite && (
          <div className="bg-primary-yellow/10 border border-primary-yellow/30 p-5 rounded-[24px] flex items-center gap-4 animate-pulse">
            <span className="text-2xl">📈</span>
            <div>
              <p className="text-sm font-black text-primary-yellow">Surge Pricing Active</p>
              <p className="text-[10px] text-primary-yellow/80 font-bold">High demand in your area. Fees adjusted by {Math.round((surge.multiplier - 1) * 100)}%.</p>
            </div>
          </div>
        )}

        {/* Pricing Summary with Tilt */}
        <Tilt scale={1.01}>
          <div className="bg-white/[0.02] backdrop-blur-3xl p-5 md:p-8 rounded-[32px] md:rounded-[48px] border border-white/10 space-y-4 md:space-y-5 shadow-2xl">
            <div className="flex justify-between text-xs font-black uppercase tracking-widest text-white/30">
              <span>Mission Assets Subtotal</span>
              <span>₹{totalPrice}</span>
            </div>
            <div className="flex justify-between text-xs font-black uppercase tracking-widest text-white/30">
              <span>Logistics Fee</span>
              {isElite || zenPoints >= 200 ? (
                <span className="text-primary-yellow">FREE BYPASS</span>
              ) : (
                <span>₹{deliveryFee}</span>
              )}
            </div>
            <div className="border-t border-white/5 pt-5 md:pt-6 flex justify-between items-center">
              <span className="text-sm md:text-base font-black uppercase tracking-[0.3em] text-gold-shimmer">Grand Total</span>
              <span className="text-2xl md:text-3xl font-black text-white tracking-tighter">₹{finalTotal}</span>
            </div>
          </div>
        </Tilt>

        {/* CTA with Magnetic */}
        <div className="pt-4">
          <Magnetic>
            <button
              onClick={handlePlaceOrder}
              disabled={checkoutStatus === 'processing' || checkoutStatus === 'success'}
              className="w-full h-20 bg-primary-yellow text-black text-sm uppercase tracking-[0.3em] font-black rounded-full shadow-[0_20px_60px_rgba(201,168,76,0.3)] disabled:opacity-30 transition-all relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-shimmer skew-x-12" />
              {checkoutStatus === 'processing' ? 'Processing Uplink...' : 'Confirm Order & Pay  →'}
            </button>
          </Magnetic>
        </div>
      </div>

      <ZenvyModal
        {...modalConfig}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
      />
      <CheckoutProcessingModal
        isOpen={checkoutStatus !== 'idle'}
        status={checkoutStatus as 'processing' | 'success' | 'error'}
        errorMessage={errorMsg}
      />

      <MapLocationPicker
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onConfirm={(address) => {
          setDeliveryAddress(address);
        }}
      />

      {/* QR Zoom Overlay */}
      {isQrZoomed && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-8 animate-in fade-in duration-300"
          onClick={() => setIsQrZoomed(false)}
        >
          <div className="relative max-w-sm w-full bg-white p-6 rounded-[40px] shadow-[0_0_80px_rgba(255,255,255,0.1)] scale-in-center overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary-yellow animate-shimmer" />
            <button className="absolute -top-12 right-0 text-white font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
              Tap anywhere to close ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/assets/upi_qr.png" 
              alt="UPI QR Code" 
              className="w-full h-auto object-contain rounded-3xl"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=upi://pay?pa=kesavakesava764@ybl&pn=ZenvyNexus&am=" + finalTotal;
              }}
            />
            <div className="mt-6 text-center">
              <p className="text-black font-black text-xs uppercase tracking-widest leading-loose">
                Scan to Pay ₹{finalTotal}<br/>
                <span className="text-gray-400">kesavakesava764@ybl</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
