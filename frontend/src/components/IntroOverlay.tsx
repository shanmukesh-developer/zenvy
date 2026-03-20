"use client";
import { useEffect, useState } from 'react';

export default function IntroOverlay({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // 🎞️ "Hyper-Drive / Spatial Warp" Cinematic Pacing (Continuous forward flight)
    const timers = [
      setTimeout(() => setStage(1), 300),   // Stage 1: Darkness -> Central Star spark
      setTimeout(() => setStage(2), 1200),  // Stage 2: 💥 BACKDROP SPATIAL WARP (Expanding lens ripple)
      setTimeout(() => setStage(3), 2600),  // Stage 3: Noble 3D Chrome Crest materialises in center
      setTimeout(() => setStage(4), 4200),  // Stage 4: 🚀 HYPER-DRIVE DRIVE THROUGH (Fly into camera)
      setTimeout(() => onComplete(), 5400) 
    ];

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100dvh',
        zIndex: 999999,
        backgroundColor: '#010101', // Pure Back Matrix Slate
        overflow: 'hidden',
        perspective: '1500px'
      }}
      className={`transition-all ${stage >= 4 ? 'animate-[hyper-drive_1.4s_cubic-bezier(0.1,1,0.1,1)_forwards]' : 'opacity-100'}`}
    >
      {/* 🔮 Deep Cinematic Backdrop (Warp Horizon Glows) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        
        {/* Core Intense Amber Sun (Glows behind center reticle) */}
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(circle_at_center,rgba(201,168,76,0.2)_0%,transparent_50%)] blur-[120px] transition-all duration-[2000ms] ${stage >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`} 
        />

        {/* 🌀 The "Spatial Warp" expanding shockwave with blur dilation */}
        <div 
          className={`absolute top-1/2 left-1/2 rounded-full border border-white/30 backdrop-blur-[6px] mix-blend-screen transition-all ${stage >= 2 ? 'animate-[warp-ripple_3s_cubic-bezier(0.1,1,0.1,1)_forwards]' : 'w-0 h-0 opacity-0'}`} 
        />
        <div 
          className={`absolute top-1/2 left-1/2 rounded-full border border-[#D4AF37]/50 backdrop-blur-[4px] mix-blend-screen transition-all ${stage >= 2 ? 'animate-[warp-ripple_3s_cubic-bezier(0.15,1,0.1,1)_0.2s_forwards]' : 'w-0 h-0 opacity-0'}`} 
        />
      </div>

      {/* 🎬 Letterbox Cinematic Trim Bars */}
      <div className={`absolute top-0 left-0 w-full bg-black z-50 transition-all duration-[1200ms] cubic-bezier(0.19, 1, 0.22, 1) ${stage >= 1 ? 'h-[6vh]' : 'h-[50dvh]'}`} />
      <div className={`absolute bottom-0 left-0 w-full bg-black z-50 transition-all duration-[1200ms] cubic-bezier(0.19, 1, 0.22, 1) ${stage >= 1 ? 'h-[6vh]' : 'h-[50dvh]'}`} />

      {/* 💎 SIGNATURE CINEMATIC EMBLEM */}
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
          zIndex: 40
        }}
        className={`transition-all duration-[2000ms] ease-out-expo ${stage >= 2 ? 'scale-100 opacity-100' : 'scale-[1.2] opacity-0 blur-md'}`}
      >
        <div className="relative flex items-center justify-center p-8">
          {/* Intense center solar core behind crest */}
          <div className={`absolute inset-0 bg-[#C9A84C]/25 blur-[40px] rounded-full transition-opacity duration-1500 ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />

          {/* Precision Noble 3D Chrome Core Crest wrapper */}
          <div className="w-28 h-28 md:w-32 md:h-32 relative flex items-center justify-center">
            
            {/* Elegant outer slow decelerating halo frames */}
            <div className={`absolute inset-[-15px] border border-[#C9A84C]/20 rounded-full animate-[spin_40s_linear_infinite] transition-opacity ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />
            <div className={`absolute inset-[-5px] border border-white/10 rounded-full -rotate-45 animate-[spin_50s_linear_infinite_reverse] transition-opacity ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />

            {/* Main Center Bounding Box (Sleek Chrome reflection feel) */}
            <div className="w-[85%] h-[85%] bg-[#020202]/85 flex items-center justify-center relative border border-[#C9A84C]/45 shadow-[0_0_80px_rgba(201,168,76,0.15)] overflow-hidden rounded-[8px]">
              
              {/* Searing light sweep laser inside the box reticle */}
              <div className="absolute inset-0 overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-35deg] animate-[sweep-flare_3.5s_infinite_linear] transition-opacity ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />
              </div>

              {/* Precise Vector Signature draws IN on stage 3 */}
              <svg className="w-10 h-10 md:w-11 md:h-11 text-[#D4AF37]" viewBox="0 0 100 100" fill="none">
                <path
                  className={`transition-all duration-[2000ms] delay-400 ${stage >= 3 ? 'stroke-dashoffset-0' : 'stroke-dashoffset-[300]'}`}
                  style={{ strokeDasharray: 300, strokeDashoffset: stage >= 3 ? 0 : 300 }}
                  d="M25 25 L75 25 L25 75 L75 75"
                  stroke="currentColor"
                  strokeWidth="4.5" // Slightly thicker for "Mass" appeal
                  strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>

              {/* Swiss Craft precise framing corners */}
              <div className="absolute top-[3px] left-[3px] w-1.5 h-1.5 border-t border-l border-[#C9A84C]/90" />
              <div className="absolute top-[3px] right-[3px] w-1.5 h-1.5 border-t border-r border-[#C9A84C]/90" />
              <div className="absolute bottom-[3px] left-[3px] w-1.5 h-1.5 border-b border-l border-[#C9A84C]/90" />
              <div className="absolute bottom-[3px] right-[3px] w-1.5 h-1.5 border-b border-r border-[#C9A84C]/90" />
            </div>
          </div>
        </div>

        {/* 👑 NOBLE MOVIE-TITLE GRADIENT SHADOW TYPOGRAPHY */}
        <div className="mt-14 text-center">
          <div className="overflow-hidden">
            <h1 
               style={{ fontFamily: "'Playfair Display', serif" }}
               className={`text-6xl md:text-8xl font-black italic transition-all duration-[2200ms] cubic-bezier(0.1, 1, 0.1, 1) ${stage >= 3 ? 'translate-y-0 opacity-100 tracking-[0.2em] scale-100' : 'translate-y-full opacity-0 tracking-[0.05em] scale-110'}`}
            >
              {/* Chrome Gradient with bold shadow extrusions forming depth volume */}
              <span 
                style={{ filter: 'drop-shadow(0px 3px 6px rgba(0,0,0,0.85)) drop-shadow(0px 0px 40px rgba(212,175,55,0.3))' }}
                className="bg-gradient-to-b from-[#FFFDF9] via-[#D4AF37] to-[#8A641A] bg-clip-text text-transparent"
              >
                  Zenvy
              </span>
            </h1>
          </div>
          
          <p className={`mt-5 text-[11px] md:text-[12px] font-black uppercase tracking-[0.6em] opacity-0 transition-opacity duration-[1500ms] delay-600 ${stage >= 3 ? 'opacity-60' : 'opacity-0'}`} style={{ color: '#EBE3CE' }}>
             The Apex of Convenience
          </p>
        </div>
      </div>

      <style jsx>{`
        .ease-out-expo {
          transition-timing-function: cubic-bezier(0.19, 1, 0.22, 1);
        }
        @keyframes warp-ripple {
          0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
          15% { opacity: 1; border-width: 4px; }
          100% { transform: translate(-50%, -50%) scale(25) rotate(5deg); opacity: 0; border-width: 0.5px; }
        }
        @keyframes sweep-flare {
          0% { transform: translateX(-100%) skewX(-35deg); }
          40% { transform: translateX(200%) skewX(-35deg); }
          100% { transform: translateX(200%) skewX(-35deg); }
        }
        @keyframes hyper-drive {
          0% { transform: scale(1); filter: blur(0px); opacity: 1; }
          40% { filter: blur(4px); }
          100% { transform: scale(10); filter: blur(60px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
