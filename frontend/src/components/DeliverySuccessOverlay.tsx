"use client";
import { useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onComplete: () => void;
}

export default function DeliverySuccessOverlay({ isOpen, onComplete }: Props) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => onComplete(), 3500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center p-6 bg-[#0a0a0b] animate-in fade-in duration-700 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(201,168,76,0.2)_0%,transparent_70%)] animate-pulse" />
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay" />
      
      <div className="relative z-10 flex flex-col items-center text-center animate-in slide-in-from-bottom-10 duration-1000">
        <div className="w-32 h-32 bg-[#C9A84C] rounded-full flex items-center justify-center text-6xl mb-8 shadow-[0_0_80px_rgba(201,168,76,0.6)] animate-bounce border-4 border-black">
          🎉
        </div>
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#C9A84C] via-[#F7D331] to-[#8B7332] uppercase tracking-[0.2em] mb-4">
          Delivered!
        </h1>
        <p className="text-white/60 text-sm font-bold uppercase tracking-widest max-w-[250px] leading-relaxed">
          Your Zenvy captain has completed the mission. Enjoy your meal!
        </p>
      </div>
    </div>
  );
}
