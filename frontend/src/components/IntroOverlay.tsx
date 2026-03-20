"use client";
import { useEffect, useState, useRef } from 'react';

export default function IntroOverlay({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 🎞️ Ultra-Luxury Cinematic Pacing (Continuous Scale & Glide)
    const timers = [
      setTimeout(() => setStage(1), 300),   // Stage 1: Absolute darkness breaks slow-roll letterbox
      setTimeout(() => setStage(2), 1600),  // Stage 2: Central Gold Dust ignition, nebulas blossom
      setTimeout(() => setStage(3), 2800),  // Stage 3: Dynamic laser-thin boundaries crystalline lock
      setTimeout(() => setStage(4), 4200),  // Stage 4: "Zenvy" Typography glimmer with Lens Flare Glide
      setTimeout(() => setStage(5), 5800),  // Stage 5: Atmospheric zoom-out & lift transition
      setTimeout(() => {
        onComplete();
      }, 6500) 
    ];

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      const x = (clientX / innerWidth - 0.5) * 20; // Softened smooth parallax
      const y = (clientY / innerHeight - 0.5) * 20;
      setMousePos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [onComplete]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100dvh',
        zIndex: 999999,
        backgroundColor: '#030304', // Darker Obsidian Black
        overflow: 'hidden',
        perspective: '1200px'
      }}
      className={`transition-all duration-[1500ms] ${stage >= 5 ? 'opacity-0 scale-105 blur-sm' : 'opacity-100 scale-100'}`}
    >
      {/* 🔮 Deep Cinematic Ambient Lighting & Micro Dust Particles */}
      <div className="absolute inset-0 bg-[#030304] overflow-hidden">
        {/* Core Soft Ambient Nebula */}
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[160%] opacity-[0.05] bg-[radial-gradient(circle_at_center,#C9A84C_0%,transparent_60%)] blur-[120px] transition-opacity duration-[2000ms] ${stage >= 2 ? 'opacity-[0.08]' : 'opacity-0'}`} 
        />
        
        {/* Secondary Halo Ring Expansion */}
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#C9A84C]/20 transition-all duration-[2500ms] cubic-bezier(0.19, 1, 0.22, 1) ${stage >= 2 ? 'w-[400px] h-[400px] opacity-100 blur-[2px]' : 'w-0 h-0 opacity-0 blur-none'}`} 
        />
        
        {/* tertiary floating Dust / Bokeh (Pure Floating CSS) */}
        <div className={`absolute inset-0 transition-opacity duration-[1500ms] delay-500 ${stage >= 2 ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute top-[20%] left-[30%] w-1.5 h-1.5 rounded-full bg-[#C9A84C]/30 blur-[1px] animate-[float-slow_15s_infinite_linear]" />
          <div className="absolute top-[60%] left-[80%] w-1 h-1 rounded-full bg-[#C9A84C]/40 animate-[float-fast_12s_infinite_linear]" />
          <div className="absolute top-[75%] left-[15%] w-2 h-2 rounded-full bg-[#C9A84C]/20 blur-[2px] animate-[float-slow_20s_infinite_linear]" />
          <div className="absolute top-[30%] left-[70%] w-1 h-1 rounded-full bg-[#C9A84C]/50 blur-[0px] animate-[float-fast_10s_infinite_linear]" />
        </div>
      </div>

      {/* 🎬 Premium Smooth Letterbox (Soft Bars for grand reveal) */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, width: '100%',
          height: stage >= 1 ? '7vh' : '50dvh', // Slightly thinner, more grand
          backgroundColor: 'black',
          transition: 'height 1.8s cubic-bezier(0.19, 1, 0.22, 1)',
          zIndex: 50
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0, left: 0, width: '100%',
          height: stage >= 1 ? '7vh' : '50dvh',
          backgroundColor: 'black',
          transition: 'height 1.8s cubic-bezier(0.19, 1, 0.22, 1)',
          zIndex: 50
        }}
      />

      {/* 💎 SIGNATURE LUXURY CREST */}
      <div
        style={{
          position: 'absolute',
          top: '45%',
          left: '50%',
          transform: `translate(-50%, -50%) translate3d(${mousePos.x}px, ${mousePos.y}px, 0)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          transition: 'transform 0.6s ease-out'
        }}
        className="z-20"
      >
        <div
          className={`relative transition-all duration-[2500ms] cubic-bezier(0.19, 1, 0.22, 1) ${stage >= 2 ? 'scale-100 opacity-100' : 'scale-[1.15] opacity-0 blur-md'}`}
        >
          {/* Back Core Ambient Glow Burst */}
          <div className={`absolute inset-0 bg-[#C9A84C]/15 blur-[40px] rounded-full transition-opacity duration-1500 ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />

          <div className="w-24 h-24 md:w-32 md:h-32 relative flex items-center justify-center">
            {/* Elegant Double Orbiting Ring (Swiss craft feel) */}
            <div className={`absolute inset-0 border border-[#C9A84C]/10 rounded-full rotate-45 animate-spin-extremely-slow transition-opacity ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />
            <div className={`absolute inset-[3px] border border-[#C9A84C]/5 rounded-full -rotate-12 animate-spin-extremely-slow-reverse transition-opacity ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />

            {/* Main Bounding Box */}
            <div className="w-[85%] h-[85%] bg-black/40 backdrop-blur-3xl flex items-center justify-center relative border border-[#C9A84C]/25 shadow-[0_0_80px_rgba(201,168,76,0.08)] group overflow-hidden">
              
              {/* Luxury Light sweep glimmer on card */}
              <div className="absolute inset-0 overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-[#C9A84C]/10 to-transparent skew-x-[-30deg] animate-[sweep-flare_3.5s_infinite_linear] transition-opacity ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />
              </div>

              {/* Precise Vector Signature */}
              <svg className="w-10 h-10 md:w-12 md:h-12 text-[#C9A84C]" viewBox="0 0 100 100" fill="none">
                <path
                  className={`transition-all duration-[2000ms] delay-700 ${stage >= 3 ? 'stroke-dashoffset-0' : 'stroke-dashoffset-[300]'}`}
                  style={{ strokeDasharray: 300, strokeDashoffset: stage >= 3 ? 0 : 300 }}
                  d="M25 25 L75 25 L25 75 L75 75"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Fine Swiss Corners */}
              <div className="absolute top-[2px] left-[2px] w-1 h-1 border-t border-l border-[#C9A84C]/60" />
              <div className="absolute top-[2px] right-[2px] w-1 h-1 border-t border-r border-[#C9A84C]/60" />
              <div className="absolute bottom-[2px] left-[2px] w-1 h-1 border-b border-l border-[#C9A84C]/60" />
              <div className="absolute bottom-[2px] right-[2px] w-1 h-1 border-b border-r border-[#C9A84C]/60" />
            </div>
          </div>
        </div>

        {/* 👑 NOBLE BRAND TYPOGRAPHY */}
        <div className="mt-14 text-center">
          <div className="overflow-hidden">
            {/* Main Title - Extreme letter tracking expansion grace */}
            <h1 
               style={{ fontFamily: "'Playfair Display', serif" }}
               className={`text-6xl md:text-7xl font-light italic transition-all duration-[2500ms] cubic-bezier(0.19, 1, 0.22, 1) ${stage >= 4 ? 'translate-y-0 opacity-100 tracking-[0.2em] scale-100' : 'translate-y-full opacity-0 tracking-[0.05em] scale-110'}`}
            >
              <span className="bg-gradient-to-b from-[#F9F7F0] via-[#F3EFE0] to-[#C9A84C]/50 bg-clip-text text-transparent">
                  Zenvy
              </span>
            </h1>
          </div>
          
          <p className={`mt-6 text-[10px] md:text-[11px] font-bold uppercase tracking-[0.6em] transition-all duration-[2000ms] delay-700 ${stage >= 4 ? 'translate-y-0 opacity-40' : 'translate-y-4 opacity-0'}`} style={{ color: '#EBE3CE' }}>
             The Apex of Convenience
          </p>
        </div>
      </div>

      {/* 🎞️ High-End Film Border Gauge overlays (Minimal Grace) */}
      <div className={`absolute top-10 left-10 text-[7px] font-mono tracking-[0.4em] opacity-[0.25] text-[#C9A84C] transition-opacity duration-1000 ${stage >= 1 ? 'opacity-25' : 'opacity-0'}`}>
         CORE // SYS : ACTIVE
      </div>
      <div className={`absolute bottom-10 right-10 text-[7px] font-mono tracking-[0.4em] opacity-[0.25] text-[#C9A84C] transition-opacity duration-1000 ${stage >= 1 ? 'opacity-25' : 'opacity-0'}`}>
         EST 2026 // PREMIUM
      </div>

      <style jsx>{`
        @keyframes float-slow {
          0% { transform: translateY(0px) translateX(0px); opacity: 0; }
          40% { opacity: 1; }
          80% { opacity: 0.5; }
          100% { transform: translateY(-100px) translateX(20px); opacity: 0; }
        }
        @keyframes sweep-flare {
          0% { transform: translateX(-100%) skewX(-30deg); }
          30% { transform: translateX(200%) skewX(-30deg); }
          100% { transform: translateX(200%) skewX(-30deg); }
        }
        .animate-spin-extremely-slow {
          animation: spin 35s linear infinite;
        }
        .animate-spin-extremely-slow-reverse {
          animation: spin 45s linear infinite reverse;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
