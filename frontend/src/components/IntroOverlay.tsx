"use client";
import { useEffect, useState, useRef } from 'react';

export default function IntroOverlay({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 🎞️ Minimalist "Couture Blueprint" Setup (Zero noise, absolute focus)
    const timers = [
      setTimeout(() => setStage(1), 300),   // Stage 1: Absolute coordinate lines materialize (X & Y axis)
      setTimeout(() => setStage(2), 1500),  // Stage 2: Central solar Eclipse core expands outwards
      setTimeout(() => setStage(3), 2800),  // Stage 3: Monogram vectors crystallise with sharp glow
      setTimeout(() => setStage(4), 4000),  // Stage 4: Typography reveal (tracking expand)
      setTimeout(() => setStage(5), 5200),  // Stage 5: Atmospheric zoom and cinematic lift
      setTimeout(() => {
        onComplete();
      }, 6000) 
    ];

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      const x = (clientX / innerWidth - 0.5) * 12;
      const y = (clientY / innerHeight - 0.5) * 12;
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
        backgroundColor: '#020202', // Absolute Onyx Black (Pure)
        overflow: 'hidden',
        perspective: '1500px'
      }}
      className={`transition-all duration-[1200ms] ${stage >= 5 ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}
    >
      {/* 📐 Coordinate Drafting Frame (Extremely classy CAD drafting lines) */}
      <div className="absolute inset-0 pointer-events-none">
        {/* X-Axis Axis Drawing */}
        <div 
          style={{ transform: stage >= 1 ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'center' }}
          className="absolute top-1/2 left-0 w-full h-[0.5px] bg-gradient-to-r from-transparent via-[#C9A84C]/60 to-transparent transition-transform duration-[1800ms] ease-out-expo" 
        />
        {/* Y-Axis Axis Drawing */}
        <div 
          style={{ transform: stage >= 1 ? 'scaleY(1)' : 'scaleY(0)', transformOrigin: 'center' }}
          className="absolute top-0 left-1/2 w-[0.5px] h-full bg-gradient-to-b from-transparent via-[#C9A84C]/60 to-transparent transition-transform duration-[1800ms] ease-out-expo" 
        />
      </div>

      {/* 🔮 Deep Cinematic Corona / Eclipse Atmosphere (Minimal & Pure) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Soft Spot Back Core (Vignetted center) */}
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] opacity-[0.03] bg-[radial-gradient(circle_at_center,#C9A84C_0%,transparent_50%)] blur-[100px] transition-opacity duration-[2000ms] ${stage >= 2 ? 'opacity-[0.06]' : 'opacity-0'}`} 
        />
        
        {/* Continuous Expansion Thin Halo Outline (Ripples continuous) */}
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#C9A84C]/30 transition-all duration-[2500ms] ease-out-expo ${stage >= 2 ? 'w-[260px] h-[260px] opacity-100 blur-[0.5px]' : 'w-0 h-0 opacity-0'}`} 
        />
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#C9A84C]/10 transition-all duration-[2200ms] delay-300 ease-out-expo ${stage >= 2 ? 'w-[200px] h-[200px] opacity-100' : 'w-0 h-0 opacity-0'}`} 
        />
      </div>

      {/* 🎬 Premium Smooth Letterbox sweep (Slightly narrower bars) */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, width: '100%',
          height: stage >= 1 ? '6vh' : '50dvh',
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

      {/* 👑 ULTRA MINIMALIST CREST Reveal */}
      <div
        style={{
          position: 'absolute',
          top: '44%',
          left: '50%',
          transform: `translate(-50%, -50%) translate3d(${mousePos.x}px, ${mousePos.y}px, 0)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          transition: 'transform 0.8s ease-out-expo'
        }}
        className="z-20"
      >
        <div
          className={`relative opacity-100 transition-all duration-[2000ms] ease-out-expo ${stage >= 2 ? 'scale-100' : 'scale-[1.15] opacity-0 blur-md'}`}
        >
          {/* Ambient center Halo backdrop (Very faint warm solar corona back glow) */}
          <div className={`absolute inset-0 bg-[#C9A84C]/10 blur-[30px] rounded-full transition-opacity duration-1500 ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />

          <div className="w-24 h-24 md:w-28 md:h-28 relative flex items-center justify-center">
            
            {/* Elegant Vector Monogram Crest with overlapping vectors */}
            <div className="w-[75%] h-[75%] bg-[#020202]/50 backdrop-blur-2xl flex items-center justify-center relative border border-[#C9A84C]/30 shadow-[0_0_60px_rgba(201,168,76,0.04)] group overflow-hidden rounded-[2px]">
              
              {/* Micro Shimmer Glimmer leak (Slow continuous wipe inside the core) */}
              <div className="absolute inset-0 overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-[#C9A84C]/15 to-transparent skew-x-[-35deg] animate-[sweep-flare_4s_infinite_linear] transition-opacity ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />
              </div>

              {/* Precise CAD Signature inside the reticle */}
              <svg className="w-8 h-8 md:w-10 md:h-10 text-[#C9A84C]" viewBox="0 0 100 100" fill="none">
                <path
                  className={`transition-all duration-[2200ms] delay-500 ${stage >= 3 ? 'stroke-dashoffset-0' : 'stroke-dashoffset-[300]'}`}
                  style={{ strokeDasharray: 300, strokeDashoffset: stage >= 3 ? 0 : 300 }}
                  d="M30 30 L70 30 L30 70 L70 70" // Slightly smaller precise frame ratio
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Precise CAD Blueprint Inner Target Micro-Corners */}
              <div className="absolute top-[2px] left-[2px] w-[2px] h-[2px] border-t border-l border-[#C9A84C]/70" />
              <div className="absolute top-[2px] right-[2px] w-[2px] h-[2px] border-t border-r border-[#C9A84C]/70" />
              <div className="absolute bottom-[2px] left-[2px] w-[2px] h-[2px] border-b border-l border-[#C9A84C]/70" />
              <div className="absolute bottom-[2px] right-[2px] w-[2px] h-[2px] border-b border-r border-[#C9A84C]/70" />
            </div>
          </div>
        </div>

        {/* 👑 ELEVATED MINIMALIST BRANDING SPARK REVEAL */}
        <div className="mt-16 text-center">
          <div className="overflow-hidden">
            {/* Smooth letter-spacing continuous expand reveal inside standard block framing */}
            <h1 
               style={{ 
                  fontFamily: "'Playfair Display', serif",
                  letterSpacing: stage >= 4 ? '0.45em' : '0.15em', // Slow continual letter separation expansion
                  transition: 'letter-spacing 3.5s cubic-bezier(0.19, 1, 0.22, 1), transform 2.5s cubic-bezier(0.19, 1, 0.22, 1), opacity 2.5s cubic-bezier(0.19, 1, 0.22, 1)',
                  marginRight: stage >= 4 ? '-0.45em' : '-0.15em' // Corrects visual offset of letter-spacing in text center
               }}
               className={`text-6xl md:text-7xl font-light italic ${stage >= 4 ? 'translate-y-0 opacity-100 scale-100 blur-none' : 'translate-y-8 opacity-100 scale-95 blur-md'}`}
            >
              <span className="bg-gradient-to-b from-[#FFFDF9] via-[#FDF9F0] to-[#D4AF37]/40 bg-clip-text text-transparent">
                  Zenvy
              </span>
            </h1>
          </div>
          
          <p 
            style={{ 
                letterSpacing: stage >= 4 ? '0.65em' : '0.4em', 
                transition: 'letter-spacing 3.5s cubic-bezier(0.19, 1, 0.22, 1), opacity 2.5s',
                marginRight: stage >= 4 ? '-0.65em' : '-0.4em'
            }}
            className={`mt-7 text-[9px] md:text-[10px] font-medium uppercase tracking-[0.4em] transition-all duration-[2000ms] delay-600 ${stage >= 4 ? 'translate-y-0 opacity-50' : 'translate-y-3 opacity-0'}`} 
            style={{ color: '#EBE3CE' }}
          >
             THE APEX OF CONVENIENCE
          </p>
        </div>
      </div>

      <style jsx>{`
        .ease-out-expo {
          transition-timing-function: cubic-bezier(0.19, 1, 0.22, 1);
        }
        @keyframes sweep-flare {
          0% { transform: translateX(-100%) skewX(-35deg); opacity: 0; }
          40% { opacity: 1; }
          60% { opacity: 1; }
          80% { transform: translateX(200%) skewX(-35deg); opacity: 0; }
          100% { transform: translateX(200%) skewX(-35deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
