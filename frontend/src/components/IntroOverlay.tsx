"use client";
import { useEffect, useState } from 'react';

export default function IntroOverlay({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // 🎞️ "Vanga / Animal Style" Cinematic Pacing (Staggered Impact Drops)
    const timers = [
      setTimeout(() => setStage(1), 300),   // Stage 1: Intense darkness, center particle charging
      setTimeout(() => setStage(2), 1000),  // Stage 2: 💥 IMPACT DROP (Gunshots/Slam trigger)
      setTimeout(() => setStage(3), 2500),  // Stage 3: All letters lock in place with shockwave
      setTimeout(() => setStage(4), 4000),  // Stage 4: Searing heat sweep on text frame
      setTimeout(() => setStage(5), 5200),  // Stage 5: Rapid spatial drive forward
      setTimeout(() => onComplete(), 6200) 
    ];

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const letters = ["Z", "E", "N", "V", "Y"];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100dvh',
        zIndex: 999999,
        backgroundColor: '#010101', // Absolute Void Black
        overflow: 'hidden',
        perspective: '1500px'
      }}
      className={`transition-all ${stage >= 5 ? 'animate-[hyper-drive_1.2s_cubic-bezier(0.1,1,0.1,1)_forwards]' : 'opacity-100'}`}
    >
      {/* 💥 Cinematic Flash / Heat Impact Burst (Triggers on Stage 2) */}
      <div 
        className={`absolute inset-0 bg-red-600/30 mix-blend-screen pointer-events-none transition-opacity duration-300 ${stage === 2 ? 'opacity-100 animate-[flash-impact_0.5s_ease-out_forwards]' : 'opacity-0'}`} 
      />
      <div 
        className={`absolute inset-0 bg-[#C9A84C]/40 mix-blend-screen pointer-events-none transition-opacity duration-300 ${stage === 2 ? 'opacity-100 animate-[flash-impact_0.3s_ease-out_0.2s_forwards]' : 'opacity-0'}`} 
      />

      {/* 🔮 Deep Atmospheric Shimmer (Simulates drift smoke) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Core Corona Backglow */}
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[160%] bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.04)_0%,rgba(196,155,59,0.04)_40%,transparent_60%)] blur-[140px] transition-all duration-[2000ms] ${stage >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`} 
        />
        
        {/* Shockwave Spatial distortion wrapper */}
        <div 
          className={`absolute top-1/2 left-1/2 rounded-full border-2 border-red-600/60 backdrop-blur-[4px] mix-blend-screen transition-all ${stage >= 2 ? 'animate-[warp-ripple_3s_cubic-bezier(0.1,1,0.1,1)_forwards]' : 'w-0 h-0 opacity-0'}`} 
        />
        <div 
          className={`absolute top-1/2 left-1/2 rounded-full border border-[#D4AF37]/50 backdrop-blur-[2px] mix-blend-screen transition-all ${stage >= 2 ? 'animate-[warp-ripple_3s_cubic-bezier(0.15,1,0.1,1)_0.15s_forwards]' : 'w-0 h-0 opacity-0'}`} 
        />
      </div>

      {/* 🎬 Premium Movie Bar trim letterboxes */}
      <div className={`absolute top-0 left-0 w-full bg-black z-50 transition-all duration-[1500ms] cubic-bezier(0.19, 1, 0.22, 1) ${stage >= 1 ? 'h-[7vh]' : 'h-[50dvh]'}`} />
      <div className={`absolute bottom-0 left-0 w-full bg-black z-50 transition-all duration-[1500ms] cubic-bezier(0.19, 1, 0.22, 1) ${stage >= 1 ? 'h-[7vh]' : 'h-[50dvh]'}`} />

      {/* 👑 NOBLE "ANIMAL STYLE" BOLD TYPOGRAPHY REVEAL */}
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
        <div className="flex gap-4 md:gap-7 items-center justify-center">
          {letters.map((char, index) => (
            <span 
              key={index}
              style={{ 
                fontFamily: "'Playfair Display', serif",
                animationDelay: `${0.8 + index * 0.16}s`, // Highly Staggered intervals
                filter: 'drop-shadow(0px 6px 12px rgba(0,0,0,0.9)) drop-shadow(0px 0px 40px rgba(212,175,55,0.25))'
              }}
              className={`text-6xl md:text-8xl font-black italic tracking-widest bg-gradient-to-b from-[#FFFDF9] via-[#D4AF37] to-[#825B10] bg-clip-text text-transparent opacity-0 ${stage >= 2 ? 'animate-[drop-in_0.8s_cubic-bezier(0.1,1,0.1,1)_forwards]' : 'opacity-0'}`}
            >
              {char}
            </span>
          ))}
        </div>

        <p 
          style={{ 
              letterSpacing: stage >= 3 ? '0.7em' : '0.4em', 
              transition: 'letter-spacing 3.5s cubic-bezier(0.19, 1, 0.22, 1), opacity 3s',
              marginRight: stage >= 3 ? '-0.7em' : '-0.4em'
          }}
          className={`mt-8 text-[11px] md:text-[12px] font-black uppercase tracking-[0.4em] transition-all duration-[2000ms] delay-[1800ms] ${stage >= 3 ? 'translate-y-0 opacity-60 scale-100' : 'translate-y-4 opacity-0 scale-95'}`} 
          style={{ color: '#EBE3CE' }}
        >
           THE APEX OF CONVENIENCE
        </p>
      </div>

      {/* 🕯️ Searing Laser Sweep behind text (Triggers on letters settlement) */}
      <div className="absolute inset-x-0 top-1/2 pointer-events-none">
        <div 
          style={{ transform: 'translateY(-50%) rotate(-12deg)' }}
          className={`absolute top-0 left-0 w-[400%] h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent blur-[4px] opacity-0 transition-opacity duration-[1500ms] ${stage >= 3 ? 'opacity-100 animate-[sweep-flare_4.5s_cubic-bezier(0.19,1,0.22,1)_0.5s_forwards]' : 'opacity-0'}`} 
        />
         <div 
          style={{ transform: 'translateY(-50%) rotate(-12deg)' }}
          className={`absolute top-0 left-0 w-[400%] h-[1px] bg-gradient-to-r from-transparent via-white to-transparent mix-blend-screen opacity-0 transition-opacity duration-[1500ms] ${stage >= 3 ? 'opacity-100 animate-[sweep-flare_4.5s_cubic-bezier(0.19,1,0.22,1)_0.5s_forwards]' : 'opacity-0'}`} 
        />
      </div>

      <style jsx>{`
        @keyframes flash-impact {
          0% { opacity: 0; }
          20% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes warp-ripple {
          0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
          15% { opacity: 1; border-width: 4px; filter: blur(0px); }
          100% { transform: translate(-50%, -50%) scale(22) rotate(3deg); opacity: 0; border-width: 0.5px; filter: blur(30px); }
        }
        @keyframes drop-in {
          0% { transform: translateY(-120px) scale(1.3); filter: blur(15px); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translateY(0) scale(1); filter: blur(0px); opacity: 1; }
        }
        @keyframes sweep-flare {
          0% { transform: translateY(-50%) rotate(-12deg) translateX(-100%); opacity: 0; }
          30% { opacity: 0.8; }
          70% { opacity: 0.8; }
          100% { transform: translateY(-50%) rotate(-12deg) translateX(100%); opacity: 0; }
        }
        @keyframes hyper-drive {
          0% { transform: scale(1); filter: blur(0px); opacity: 1; }
          40% { filter: blur(8px); }
          100% { transform: scale(12); filter: blur(40px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
