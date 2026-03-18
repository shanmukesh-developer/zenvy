"use client";
import { useEffect, useState, useRef } from 'react';

export default function IntroOverlay({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Cinematic Stage Sequencing (Optimized for speed/smoothness)
    const timers = [
      setTimeout(() => setStage(1), 300),   // Widescreen & Countdown
      setTimeout(() => setStage(2), 2200),  // Light Ray & Logo
      setTimeout(() => setStage(3), 3500),  // Full Logo
      setTimeout(() => setStage(4), 4800),  // Brand Reveal
      setTimeout(() => setStage(5), 6200),  // Liquid Expand
      setTimeout(() => {
        onComplete();
      }, 7000) 
    ];

    const countdownInterval = setInterval(() => {
      setCountdown(prev => (prev > 1 ? prev - 1 : 1));
    }, 600);

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      const x = (clientX / innerWidth - 0.5) * 20;
      const y = (clientY / innerHeight - 0.5) * 20;
      setMousePos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(countdownInterval);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [onComplete]);

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 z-[1000] bg-black overflow-hidden flex flex-col items-center justify-center transition-opacity duration-1000 ${stage >= 5 ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* 🎬 Cinematic Widescreen Bars */}
      <div className={`cinematic-bars cinematic-bar-top ${stage >= 1 ? 'translate-y-0' : '-translate-y-full'}`} style={{ transform: stage >= 1 ? 'translateY(0)' : 'translateY(-100%)' }} />
      <div className={`cinematic-bars cinematic-bar-bottom ${stage >= 1 ? 'translate-y-0' : 'translate-y-full'}`} style={{ transform: stage >= 1 ? 'translateY(0)' : 'translateY(100%)' }} />

      {/* 🎞️ Film VFX Layers (Lightweight) */}
      <div className={`film-grain opacity-[0.03] transition-opacity duration-1000 ${stage >= 1 ? 'opacity-[0.03]' : 'opacity-0'}`} />
      <div className={`film-scratches opacity-[0.01] transition-opacity duration-1000 ${stage >= 1 ? 'opacity-[0.01]' : 'opacity-0'}`} />
      <div className="lens-dirt opacity-[0.01]" />

      {/* 🌊 Liquid Transition Overlay */}
      <div className={`liquid-expand ${stage >= 5 ? 'active' : ''}`} />

      {/* 🔢 Countdown */}
      {stage === 1 && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="text-[100px] font-black text-white/[0.03] tracking-tighter animate-pulse">
            {countdown}
          </div>
        </div>
      )}

      {/* 💎 Interactive Brand Mark */}
      <div 
        className={`relative z-20 transition-all duration-[2000ms] ease-out-expo ${stage >= 2 ? 'scale-100 opacity-100' : 'scale-110 opacity-0 blur-xl'}`}
        style={{ transform: `translate3d(${mousePos.x}px, ${mousePos.y}px, 0)` }}
      >
        <div className="w-40 h-40 relative">
           <div className={`absolute inset-0 border border-[#C9A84C]/10 rotate-45 scale-110 transition-transform duration-[4000ms] ${stage >= 2 ? 'rotate-[360deg]' : 'rotate-45'}`} />
           
           <div className="w-full h-full bg-gradient-to-br from-[#1A1A1C] to-black flex items-center justify-center relative border border-[#C9A84C]/20 shadow-[0_0_60px_rgba(201,168,76,0.1)]">
              <svg className="w-16 h-16 text-[#C9A84C]" viewBox="0 0 100 100" fill="none">
                 <path d="M25 25 H75 L25 75 H75" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" className="logo-shimmer-stroke" />
              </svg>
              <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.05] to-transparent animate-pulse" />
           </div>

           {stage >= 3 && (
             <div className="absolute inset-0">
               <div className="gold-glint top-0 left-0" />
               <div className="gold-glint bottom-0 right-0" />
             </div>
           )}
        </div>
      </div>

      {/* 🏷️ Title & Tagline */}
      <div className="mt-20 text-center z-10">
        <h1 className={`text-5xl font-black transition-all duration-[1500ms] ${stage >= 4 ? 'translate-y-0 opacity-100 tracking-[0.3em]' : 'translate-y-10 opacity-0 tracking-[0.8em]'}`}>
          <span className="text-reveal-cinematic uppercase">Zenvy</span>
        </h1>
        <p className={`mt-4 text-[10px] uppercase tracking-[0.6em] text-white/30 transition-all duration-[1500ms] delay-500 ${stage >= 4 ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}>
          An Odyssey of Taste
        </p>
      </div>

      {/* 📊 HUD */}
      <div className={`absolute bottom-8 left-8 font-mono text-[6px] tracking-[0.5em] text-white/10 transition-opacity duration-1000 ${stage >= 1 ? 'opacity-100' : 'opacity-0'}`}>
        00:00:{stage + 12}:{(stage * 4).toString().padStart(2, '0')} // LUX_SYS
      </div>
    </div>
  );
}
