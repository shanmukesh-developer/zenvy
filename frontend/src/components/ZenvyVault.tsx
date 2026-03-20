"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface VaultItem {
  _id: string;
  name: string;
  price: number;
  originalPrice: number;
  remainingCount: number;
  imageUrl: string;
}

export default function ZenvyVault() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [isVaultActive, setIsVaultActive] = useState(true);

  useEffect(() => {
    fetchVaultItems();
  }, []);

  const fetchVaultItems = async () => {
    try {
      const res = await fetch(`${API_URL}/api/vault`);
      const data = await res.json();
      if (res.ok) setItems(data);
    } catch (err) {
      console.error('[VAULT_FETCH_ERROR]', err);
    }
  };

  useEffect(() => {
    // Timer calculation for FOMO
    const endTime = new Date();
    endTime.setHours(23, 59, 59, 999);

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = endTime.getTime() - now;

      if (distance < 0) {
        setIsVaultActive(false);
        setCountdown("CLOSED");
        clearInterval(timer);
        return;
      }

      const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((distance % (1000 * 60)) / 1000);
      setCountdown(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (items.length === 0 && !isOpen) return null;

  return (
    <div className={`relative rounded-3xl overflow-hidden transition-all duration-700 ${isOpen ? 'bg-[#1A1A1C]' : 'bg-transparent'}`}>
      <div 
         className={`absolute inset-0 bg-gradient-to-b from-[#C9A84C]/20 to-transparent transition-opacity duration-1000 pointer-events-none ${isOpen ? 'opacity-100' : 'opacity-0'}`} />

      <div 
        onClick={() => isVaultActive && setIsOpen(!isOpen)}
        className={`glass-card p-5 flex items-center justify-between cursor-pointer border ${isOpen ? 'border-[#C9A84C]/50 rounded-b-none shadow-[0_10px_40px_rgba(201,168,76,0.15)]' : 'border-[#C9A84C]/20 hover:border-[#C9A84C]/40'} transition-all`}
      >
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 rounded-full bg-black border border-[#C9A84C]/30 flex items-center justify-center relative shadow-[0_0_15px_rgba(201,168,76,0.3)]">
              <span className="text-xl">✨</span>
              {isVaultActive && !isOpen && (
                <div className="absolute inset-0 rounded-full border border-[#C9A84C] animate-ping opacity-50" />
              )}
           </div>
           <div>
              <h3 className="text-sm font-black text-primary-gold uppercase tracking-widest leading-tight">The Zenvy Vault</h3>
              <p className="text-[9px] font-bold text-secondary-text uppercase tracking-widest mt-0.5">{items.length} Secret Drops Active</p>
           </div>
        </div>

        <div className="text-right flex flex-col items-end">
           {isVaultActive ? (
             <>
               <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/30 px-3 py-1 rounded-full mb-1">
                 <span className="text-[10px] font-black text-[#C9A84C] font-mono tracking-wider">{countdown}</span>
               </div>
               <span className="text-[7px] font-black uppercase text-secondary-text tracking-[0.2em]">Until Sealed</span>
             </>
           ) : (
             <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Locked</span>
           )}
        </div>
      </div>

      <div className={`transition-all duration-700 overflow-hidden ${isOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
         <div className="p-6 border-x border-b border-[#C9A84C]/20 rounded-b-3xl bg-black/40 backdrop-blur-md relative">
            <p className="text-[10px] font-medium text-secondary-text tracking-wider leading-relaxed mb-6 italic text-center px-4">
              "Ultra-premium campus selects. Limited quantities. Once they're gone, they're gone."
            </p>

            <div className="space-y-4">
               {items.map((item) => (
                 <div key={item._id} className="bg-black/80 rounded-2xl p-3 flex gap-4 border border-white/5 relative overflow-hidden group hover:border-[#C9A84C]/30 transition-colors">
                    <div className="w-24 h-24 rounded-xl relative overflow-hidden shrink-0">
                       <Image src={item.imageUrl} alt={item.name} fill className="object-cover group-hover:scale-110 transition-transform duration-700" />
                       <div className="absolute top-1 right-1 bg-black/80 px-2 py-0.5 rounded text-[7px] font-black text-white uppercase border border-white/10">Only {item.remainingCount} Left</div>
                    </div>
                    <div className="flex flex-col justify-center flex-1 pr-2">
                       <h4 className="text-sm font-black text-white leading-tight mb-1">{item.name}</h4>
                       <div className="flex items-center gap-2 mb-3">
                         <span className="text-lg font-black text-primary-gold">₹{item.price}</span>
                         <span className="text-[10px] font-bold text-secondary-text line-through">₹{item.originalPrice}</span>
                       </div>
                       <Link href={`/products/${item._id}`} className="w-full">
                         <button className="w-full bg-[#C9A84C] text-black text-[9px] font-black uppercase tracking-widest py-2.5 rounded-xl hover:bg-white hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-all">
                           Claim Now
                         </button>
                       </Link>
                    </div>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}
