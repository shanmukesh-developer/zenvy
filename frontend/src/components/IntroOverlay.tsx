"use client";
import { useEffect, useState } from 'react';

export default function IntroOverlay({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // 🎞️ "Pure Filmic Title Card" pacing (HBO / Netflix style)
    const timers = [
      setTimeout(() => setStage(1), 500),   // Stage 1: Absolute Darkness -> Soft Vignettes open
      setTimeout(() => setStage(2), 2000),  // Stage 2: 🕯️ Searing Light Leak behind fog burn text
      setTimeout(() => setStage(3), 3500),  // Stage 3: Font crystallises inside expanding letter-spacing
      setTimeout(() => setStage(4), 5200),  // Stage 4: Zoom merges continuous & cinematic lift
      setTimeout(() => onComplete(), 6000) 
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
        backgroundColor: '#030304', // Rich Obsidian Deep space
        overflow: 'hidden',
        perspective: '1800px'
      }}
      className={`transition-all duration-[1200ms] ${stage >= 4 ? 'opacity-0 scale-[1.05] blur-md' : 'opacity-100 scale-100'}`}
    >
      {/* 🔮 Deep Cinematic Atmospheric Drift (Slow slow nebula) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        
        {/* Core Amber Nebula (Vignetted, swelles continuous) */}
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[160%] opacity-[0.05] bg-[radial-gradient(circle_at_center,rgba(201,168,76,0.15)_0%,transparent_50%)] blur-[140px] animate-[fog-drift_15s_infinite_linear] transition-opacity duration-[2000ms] ${stage >= 1 ? 'opacity-[0.08]' : 'opacity-0'}`} 
        />
        
        {/* 🕯️ Searing Ambient Lens Flare Leak (Sweeps continuous left-to-right behind text) */}
        <div className="absolute inset-x-0 top-1/2 pointer-events-none">
          <div 
            style={{ transform: 'translateY(-50%) rotate(-12deg)' }}
            className={`absolute top-0 left-0 w-[300%] h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37]/80 to-transparent blur-[4px] opacity-0 transition-opacity duration-[1500ms] ${stage >= 2 ? 'opacity-100 animate-[flare-sweep_5.5s_cubic-bezier(0.19,1,0.22,1)_forwards]' : 'opacity-0'}`} 
          />
        </div>
      </div>

      {/* 🎬 Premium Smooth Letterbox sweep (Sutble narrow bars) */}
      <div className={`absolute top-0 left-0 w-full bg-black z-50 transition-all duration-[1500ms] cubic-bezier(0.19, 1, 0.22, 1) ${stage >= 1 ? 'h-[7vh]' : 'h-[50dvh]'}`} />
      <div className={`absolute bottom-0 left-0 w-full bg-black z-50 transition-all duration-[1500ms] cubic-bezier(0.19, 1, 0.22, 1) ${stage >= 1 ? 'h-[7vh]' : 'h-[50dvh]'}`} />

      {/* 👑 NOBLE MOVIE-TITLE TYPOGRAPHY (The Fog Burn In) */}
      <div
        style={{
          position: 'absolute',
          top: '44%',
          left: '50%',
          transform: `translate(-50%, -50%)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          zIndex: 40
        }}
      >
        <div className="overflow-hidden">
          {/* Main Title - Extreme blur to crisp reveal combined with expanding tracking */}
          <h1 
             style={{ 
                fontFamily: "'Playfair Display', serif",
                letterSpacing: stage >= 3 ? '0.4em' : '0.15em', // Slow continual letter separation expansion
                transition: 'letter-spacing 3.5s cubic-bezier(0.19, 1, 0.22, 1), transform 2.5s cubic-bezier(0.19, 1, 0.22, 1), filter 2.5s ease-out, opacity 2.5s ease-out',
                marginRight: stage >= 3 ? '-0.4em' : '-0.15em',
                filter: stage >= 3 ? 'blur(0px)' : 'blur(25px)',
                opacity: stage >= 2 ? 1 : 0
             }}
             className={`text-6xl md:text-8xl font-light italic scale-100`}
          >
            <span 
              style={{ filter: 'drop-shadow(0px 4px 8px rgba(0,0,0,0.8))' }}
              className="bg-gradient-to-b from-[#FFFDF9] via-[#FDF9F1] to-[#D4AF37]/50 bg-clip-text text-transparent"
            >
                Zenvy
            </span>
          </h1>
        </div>
        
        <p 
          style={{ 
              letterSpacing: stage >= 3 ? '0.65em' : '0.4em', 
              transition: 'letter-spacing 3.5s cubic-bezier(0.19, 1, 0.22, 1), opacity 2s',
              marginRight: stage >= 3 ? '-0.65em' : '-0.4em'
          }}
          className={`mt-7 text-[10px] md:text-[11px] font-medium uppercase tracking-[0.4em] transition-all duration-[2000ms] delay-700 ${stage >= 3 ? 'translate-y-0 opacity-40' : 'translate-y-3 opacity-0'}`} 
          style={{ color: '#EBE3CE' }}
        >
           THE APEX OF CONVENIENCE
        </p>
      </div>

      <style jsx>{`
        @keyframes flare-sweep {
          0% { transform: translateY(-50%) rotate(-12deg) translateX(-100%); opacity: 0; }
          40% { opacity: 0.8; }
          80% { opacity: 0.8; }
          100% { transform: translateY(-50%) rotate(-12deg) translateX(100%); opacity: 0; }
        }
        @keyframes fog-drift {
          0% { transform: translate(-10%, -10%) rotate(0deg); }
          50% { transform: translate(10%, 10%) rotate(180deg); }
          100% { transform: translate(-10%, -10%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
