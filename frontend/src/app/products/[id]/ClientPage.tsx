"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import Image from 'next/image';
import SuccessOverlay from '@/components/SuccessOverlay';
import { MenuItem } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export default function ProductDetailClient({ productId }: { productId: string }) {
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCart();
  const [product, setProduct] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [overlay, setOverlay] = useState<{ isOpen: boolean; title: string; message: string; type?: 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const cleanId = productId.replace(/\/$/, "");
    fetch(`${API_URL}/api/users/products/${cleanId}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.name) {
          setProduct({ ...data, image: data.imageUrl || data.image });
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('[FETCH_PRODUCT_ERROR]', err);
        setLoading(false);
      });
  }, [productId]);

  if (loading) return <div className="p-20 text-white min-h-screen text-center animate-pulse">Loading Product...</div>;
  if (!product) return <div className="p-20 text-white min-h-screen text-center font-bold">Product not found.</div>;

  const handleAdd = () => {
    addToCart({
      id: product.id || product._id || "",
      name: product.name,
      price: product.price,
      quantity,
      image: product.image || product.imageUrl || "",
      restaurantId: product.restaurantId || 'unknown',
      restaurantName: product.restaurantName || 'Zenvy Kitchen'
    });
    
    setOverlay({
      isOpen: true,
      title: 'Added to Basket',
      message: `${quantity}x ${product.name} ready for checkout.`,
      type: 'success'
    });
  };

  return (
    <main className="min-h-screen bg-[#0A0A0B] text-white relative flex flex-col">
      {/* ── Immersive Full-Bleed Parallax Hero Image ── */}
      <div className="relative h-[480px] w-full shrink-0 overflow-hidden">
         <div 
           className="absolute inset-0 w-full h-full"
           style={{ transform: `translateY(${scrollY * 0.4}px) scale(1.05)` }}
         >
           <Image 
             src={product.image || product.imageUrl || "/assets/placeholder.png"} 
             alt={product.name}
             fill
             style={{ objectFit: 'cover' }}
             priority
           />
         </div>
         {/* Heavy Premium Gradient Masks */}
         <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B]/60 to-transparent" />
         <div className="absolute inset-0 bg-[#0A0A0B]/20" /> {/* Subtle overall darkening for contrast */}

         {/* Hero Top Nav */}
         <div className="absolute top-0 left-0 right-0 p-8 pt-12 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
           <Link href="/" onClick={(e) => { e.preventDefault(); window.history.back(); }} className="w-12 h-12 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 hover:bg-white/10 hover:scale-105 transition-all shadow-2xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
           </Link>
           <div className="bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-full flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[9px] uppercase font-black tracking-widest">Available Now</span>
           </div>
         </div>

         {/* Scroll Indicator */}
         <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 transition-opacity duration-500 ${scrollY > 50 ? 'opacity-0 pointer-events-none' : 'opacity-80'}`}>
            <div className="w-5 h-8 border border-white/30 rounded-full flex justify-center pt-2">
               <div className="w-1 h-1.5 bg-white/60 rounded-full animate-[bounce_1.5s_infinite]" />
            </div>
            <span className="text-[8px] uppercase tracking-[0.3em] font-bold text-white/50">Explore</span>
         </div>
      </div>

      {/* ── Product Details Content ── */}
      <div className="flex-1 -mt-32 relative z-10 px-8 pb-40">
         {/* Ambient Breathing Orb */}
         <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-primary-yellow/10 blur-[120px] rounded-full pointer-events-none animate-pulse mix-blend-screen" />

         <div className="mb-8 relative animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ animationFillMode: 'both', animationDelay: '100ms' }}>
            <span className="text-[10px] uppercase tracking-[0.3em] text-primary-yellow font-black block mb-3 drop-shadow-md">Zenvy Signature</span>
            <h1 className="text-4xl font-black text-white leading-[1.1] mb-4 drop-shadow-2xl">{product.name}</h1>
            <p className="text-[14px] text-zinc-300/80 leading-relaxed font-medium max-w-[95%]">{product.description}</p>
         </div>

         {/* ── Elite Attributes Grid ── */}
         <div className="grid grid-cols-3 gap-3 mb-10 relative animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ animationFillMode: 'both', animationDelay: '200ms' }}>
            <div className="bg-white/5 border border-white/5 rounded-3xl p-4 py-5 flex flex-col items-center justify-center text-center gap-2.5 hover:bg-white/10 hover:border-primary-yellow/30 transition-all duration-300 group">
               <svg className="w-6 h-6 text-primary-yellow group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
               <span className="text-[9px] uppercase tracking-widest font-black text-secondary-text leading-tight">Premium<br/>Quality</span>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-3xl p-4 py-5 flex flex-col items-center justify-center text-center gap-2.5 hover:bg-white/10 hover:border-primary-yellow/30 transition-all duration-300 group">
               <svg className="w-6 h-6 text-primary-yellow group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               <span className="text-[9px] uppercase tracking-widest font-black text-secondary-text leading-tight">Made<br/>Fresh</span>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-3xl p-4 py-5 flex flex-col items-center justify-center text-center gap-2.5 hover:bg-white/10 hover:border-primary-yellow/30 transition-all duration-300 group">
               <svg className="w-6 h-6 text-primary-yellow group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
               <span className="text-[9px] uppercase tracking-widest font-black text-secondary-text leading-tight">Elite<br/>Standard</span>
            </div>
         </div>

         <div className="gold-line mb-8 opacity-20 relative animate-in fade-in duration-1000" style={{ animationFillMode: 'both', animationDelay: '400ms' }} />

         <div className="flex justify-between items-center mb-4 relative animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ animationFillMode: 'both', animationDelay: '300ms' }}>
            <div>
               <p className="text-[10px] uppercase tracking-[0.3em] text-secondary-text mb-1.5 font-bold">Total Price</p>
               <div className="text-[34px] font-black text-primary-yellow tracking-tighter drop-shadow-[0_0_15px_rgba(201,168,76,0.2)]">
                 ₹{product.price * quantity}
               </div>
            </div>

            {/* Premium Quantity Selector */}
            <div className="flex items-center gap-5 bg-[#141416] border border-white/5 rounded-full px-2 py-2 shadow-inner">
               <button 
                 onClick={() => setQuantity(Math.max(1, quantity - 1))}
                 className="w-12 h-12 rounded-full bg-black text-white border border-white/5 flex items-center justify-center text-xl hover:bg-white/10 active:scale-95 transition-all shadow-md"
               >−</button>
               <span className="text-xl font-black w-5 text-center font-mono">
                 {quantity}
               </span>
               <button 
                 onClick={() => setQuantity(quantity + 1)}
                 className="w-12 h-12 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#8B7332] text-black border border-transparent shadow-[0_0_15px_rgba(201,168,76,0.3)] flex items-center justify-center text-xl hover:brightness-110 active:scale-95 transition-all"
               >+</button>
            </div>
         </div>
      </div>

      {/* ── Bottom Action Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 p-6 pt-12 pb-8 bg-gradient-to-t from-[#050507] via-[#050507]/95 to-transparent z-40 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500" style={{ animationFillMode: 'both' }}>
        <div className="flex gap-4">
           <button 
             onClick={handleAdd}
             className="flex-1 bg-gradient-to-r from-[#C9A84C] via-[#E8D18C] to-[#C9A84C] text-black h-[70px] rounded-[24px] flex items-center justify-center gap-3 shadow-[0_15px_30px_-10px_rgba(201,168,76,0.4)] transition-all active:scale-95 hover:brightness-110 group overflow-hidden relative"
           >
              {/* Shimmer effect inside button */}
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12" />
              
              <span className="font-black text-[13px] uppercase tracking-[0.1em] relative z-10">Add {quantity} To Cart</span>
              <span className="w-1.5 h-1.5 rounded-full bg-black/40 relative z-10" />
              <span className="font-black text-[15px] relative z-10">₹{product.price * quantity}</span>
           </button>
           
           <Link href="/basket" className="w-[70px] h-[70px] shrink-0 bg-[#1A1A1C] border border-white/10 flex items-center justify-center rounded-[24px] hover:bg-white/10 hover:border-[#C9A84C]/50 transition-all active:scale-95 shadow-xl group">
              <svg className="w-6 h-6 text-white group-hover:text-[#C9A84C] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
           </Link>
        </div>
      </div>

      <SuccessOverlay 
        isOpen={overlay.isOpen}
        title={overlay.title}
        message={overlay.message}
        type={overlay.type}
        onClose={() => setOverlay(prev => ({ ...prev, isOpen: false }))}
      />
    </main>
  );
}
