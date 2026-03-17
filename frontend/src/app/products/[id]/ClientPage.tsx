"use client";
import { restaurants } from '@/data/restaurants';
import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import Image from 'next/image';
import SuccessOverlay from '@/components/SuccessOverlay';

export default function ProductDetailClient({ productId }: { productId: string }) {
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCart();
  const [overlay, setOverlay] = useState<{ isOpen: boolean; title: string; message: string; type?: 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
  });

  // Find product across all restaurants
  const product = restaurants
    .flatMap(r => r.menu)
    .find(p => p.id === productId);

  if (!product) return <div className="p-8 text-white">Product not found.</div>;

  const handleAdd = () => {
    // Find restaurant for this product
    const restaurant = restaurants.find(r => r.menu.some(p => p.id === productId));
    
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity,
      image: product.image,
      restaurantId: restaurant?.id || 'unknown'
    });
    
    setOverlay({
      isOpen: true,
      title: 'Added to Basket',
      message: `${product.name} has been added.`,
      type: 'success'
    });
  };

  return (
    <main className="min-h-screen bg-background text-white relative overflow-hidden flex flex-col">
      <div className="wave-bg dark-wave opacity-40" />

      {/* Header */}
      <Link href="/" className="absolute top-10 left-8 w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10 z-20">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
        </svg>
      </Link>

      {/* Main Product View */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-10">
        <div className="relative w-full max-w-[320px] aspect-square mb-12 animate-float">
          <div className="absolute inset-0 bg-primary-yellow/20 blur-[100px] rounded-full" />
          <Image 
            src={product.image} 
            alt={product.name}
            fill
            style={{ objectFit: 'contain' }}
            className="relative z-10 drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
          />
        </div>

        <h1 className="text-[32px] font-black text-center leading-tight mb-4">
          {product.name}
        </h1>
        <p className="text-secondary-text text-center text-sm mb-10 max-w-[80%]">
          {product.description}
        </p>

        {/* Quantity Selector Pill */}
        <div className="flex flex-col items-center gap-6">
           <div className="qty-pill">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="qty-btn"
              >−</button>
              <span className="text-[28px] font-black w-10 text-center">
                {quantity.toString().padStart(2, '0')}
              </span>
              <button 
                onClick={() => setQuantity(quantity + 1)}
                className="qty-btn"
              >+</button>
           </div>
           
           <div className="price-box">
             ₹{product.price}.00
           </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="relative z-20 p-10 pt-4 flex gap-4 items-center">
        <button 
          onClick={handleAdd}
          className="flex-1 bg-white/5 hover:bg-white/10 transition-colors border border-white/10 h-[72px] rounded-[36px] flex items-center justify-center font-black text-[15px] uppercase tracking-widest"
        >
           Add To Cart
        </button>
        
        <Link href="/basket" className="w-[72px] h-[72px] bg-black border border-white/10 flex items-center justify-center rounded-[24px] shadow-2xl">
           <svg className="w-7 h-7 text-primary-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
           </svg>
        </Link>
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
