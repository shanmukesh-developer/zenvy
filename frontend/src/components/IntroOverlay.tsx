"use client";
import { useEffect, useState, useRef } from 'react';

export default function IntroOverlay({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 🎞️ "Epic Movie Title" Pacing for MAXIMUM IMPACT (Mass + Class)
    const timers = [
      setTimeout(() => setStage(1), 500),   // Stage 1: Absolute Darkness -> central energy point Spark
      setTimeout(() => setStage(2), 1200),  // Stage 2: 💥 NOVA BLAST (Shockwave expands fast)
      setTimeout(() => setStage(3), 2500),  // Stage 3: The Crest emerges inside a gold corona sun
      setTimeout(() => setStage(4), 4000),  // Stage 4: Typography with High-End Lens Flare Flare Sweep
      setTimeout(() => setStage(5), 5800),  // Stage 5: Cinematic expansion Fade-out
      setTimeout(() => {
        onComplete();
      }, 6500) 
    ];

    return () => timers.forEach(clearTimeout);
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
        backgroundColor: '#020202', // Absolute Vacuum Black
        overflow: 'hidden',
        perspective: '1200px'
      }}
      className={`transition-all duration-[1500ms] ${stage >= 5 ? 'opacity-0 scale-105 blur-sm' : 'opacity-100 scale-100'}`}
    >
      {/* 💥 ATMOSPHERIC FLASH / LEAK IMPACT (Triggers on Stage 2) */}
      <div 
        className={`absolute inset-0 bg-[#C9A84C]/25 mix-blend-screen pointer-events-none transition-opacity duration-300 ${stage === 2 ? 'opacity-100 animate-[flash-impact_0.4s_ease-out_forwards]' : 'opacity-0'}`} 
      />

      {/* 🔮 Deep Cinematic Backdrop (Nebula and Horizon Dust) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        
        {/* Core Gold Sun Backglow (Swelles on Stage 3) */}
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[160%] opacity-[0.04] bg-[radial-gradient(circle_at_center,#C9A84C_0%,transparent_50%)] blur-[120px] transition-all duration-[2000ms] ${stage >= 3 ? 'opacity-[0.08] scale-100' : 'opacity-0 scale-90'}`} 
        />

        {/* 🌀 The Expansion Nova Shockwave (Explodes outward continuous on Impact) */}
        <div 
          className={`absolute top-1/2 left-1/2 rounded-full border border-[#C9A84C]/40 mix-blend-screen transition-all ${stage >= 2 ? 'animate-[nova-wave_2.5s_cubic-bezier(0.1,1,0.1,1)_forwards]' : 'w-0 h-0 opacity-0'}`} 
        />
        <div 
          className={`absolute top-1/2 left-1/2 rounded-full border border-white/20 mix-blend-screen transition-all ${stage >= 2 ? 'animate-[nova-wave_2.5s_cubic-bezier(0.15,1,0.1,1)_0.2s_forwards]' : 'w-0 h-0 opacity-0'}`} 
        />
      </div>

      {/* 🎬 Premium Smooth Letterbox sweep (Movie Aspect Ratio) */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, width: '100%',
          height: stage >= 1 ? '6vh' : '50dvh', // Keeps beautiful narrow cinemabar structure
          backgroundColor: 'black',
          transition: 'height 1.8s cubic-bezier(0.19, 1, 0.22, 1)',
          zIndex: 50
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0, left: 0, width: '100%',
          height: stage >= 1 ? '6vh' : '50dvh',
          backgroundColor: 'black',
          transition: 'height 1.8s cubic-bezier(0.19, 1, 0.22, 1)',
          zIndex: 50
        }}
      />

      {/* 💎 SIGNATURE MOVIE-TITLE CREST */}
      <div
        style={{
          position: 'absolute',
          top: '46%',
          left: '50%',
          transform: `translate(-50%, -50%)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
        }}
        className="z-20"
      >
        <div
          className={`relative opacity-100 transition-all duration-[1800ms] ease-out-expo ${stage >= 2 ? 'scale-100' : 'scale-[1.2] opacity-0 blur-md'}`}
        >
          {/* Back Core Ambient Glow Burst */}
          <div className={`absolute inset-0 bg-[#C9A84C]/15 blur-[50px] rounded-full transition-opacity duration-1500 ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />

          <div className="w-24 h-24 md:w-28 md:h-28 relative flex items-center justify-center">
            {/* Elegant Double Orbiting Ring (Decreases on Stage 3 for precision core lock) */}
            <div className={`absolute inset-[-10px] border border-[#C9A84C]/20 rounded-full rotate-45 animate-[spin_45s_linear_infinite] transition-opacity ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />
            <div className={`absolute inset-[-5px] border border-[#C9A84C]/10 rounded-full -rotate-12 animate-[spin_55s_linear_infinite_reverse] transition-opacity ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />

            {/* Main Center Bounding Box (Sleek and highly reflective) */}
            <div className="w-[85%] h-[85%] bg-[#020202]/70 backdrop-blur-3xl flex items-center justify-center relative border border-[#C9A84C]/40 shadow-[0_0_80px_rgba(201,168,76,0.1)] group overflow-hidden rounded-[4px]">
              
              {/* Luxury Light sweep glimmer inside the crest */}
              <div className="absolute inset-0 overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-[#C9A84C]/25 to-transparent skew-x-[-30deg] animate-[sweep-flare_3s_infinite_linear] transition-opacity ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />
              </div>

              {/* Precise Vector Signature draws IN on stage 3 */}
              <svg className="w-9 h-9 md:w-10 md:h-10 text-[#D4AF37]" viewBox="0 0 100 100" fill="none">
                <path
                  className={`transition-all duration-[2000ms] delay-400 ${stage >= 3 ? 'stroke-dashoffset-0' : 'stroke-dashoffset-[300]'}`}
                  style={{ strokeDasharray: 300, strokeDashoffset: stage >= 3 ? 0 : 300 }}
                  d="M25 25 L75 25 L25 75 L75 75"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Swiss Craft corners */}
              <div className="absolute top-[3px] left-[3px] w-1.5 h-1.5 border-t border-l border-[#C9A84C]/80" />
              <div className="absolute top-[3px] right-[3px] w-1.5 h-1.5 border-t border-r border-[#C9A84C]/80" />
              <div className="absolute bottom-[3px] left-[3px] w-1.5 h-1.5 border-b border-l border-[#C9A84C]/80" />
              <div className="absolute bottom-[3px] right-[3px] w-1.5 h-1.5 border-b border-r border-[#C9A84C]/80" />
            </div>
          </div>
        </div>

        {/* 👑 ELEVATED "3D METALLIC" MOVIE TITLE TYPOGRAPHY */}
        <div className="mt-16 text-center">
          <div className="overflow-hidden">
            <h1 
               style={{ fontFamily: "'Playfair Display', serif" }}
               className={`text-6xl md:text-7xl font-bold italic transition-all duration-[2500ms] cubic-bezier(0.1, 1, 0.1, 1) ${stage >= 4 ? 'translate-y-0 opacity-100 tracking-[0.3em] scale-100' : 'translate-y-full opacity-0 tracking-[0.1em] scale-110'}`}
            >
              {/* Gold Gradient text with subtle shadow extrusion representing metal volume */}
              <span 
                style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.8)) drop-shadow(0px 0px 30px rgba(201,168,76,0.3))' }}
                className="bg-gradient-to-b from-[#FFFDF9] via-[#D4AF37] to-[#8B6508] bg-clip-text text-transparent"
              >
                  Zenvy
              </span>
            </h1>
          </div>
          
          <p className={`mt-6 text-[11px] md:text-[12px] font-black uppercase tracking-[0.5em] transition-all duration-[2000ms] delay-600 ${stage >= 4 ? 'translate-y-0 opacity-60' : 'translate-y-4 opacity-0'}`} style={{ color: '#EBE3CE' }}>
             The Apex of Convenience
          </p>
        </div>
      </div>

      <style jsx>{`
        .ease-out-expo {
          transition-timing-function: cubic-bezier(0.19, 1, 0.22, 1);
        }
        @keyframes flash-impact {
          0% { opacity: 0; }
          40% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes nova-wave {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          10% { opacity: 1; border-width: 2px; }
          40% { opacity: 0.6; }
          100% { transform: translate(-50%, -50%) scale(25); opacity: 0; border-width: 0.5px; }
        }
        @keyframes sweep-flare {
          0% { transform: translateX(-100%) skewX(-30deg); }
          40% { transform: translateX(200%) skewX(-30deg); }
          100% { transform: translateX(200%) skewX(-30deg); }
        }
      `}</style>
    </div>
  );
}
