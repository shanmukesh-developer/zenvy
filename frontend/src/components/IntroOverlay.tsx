"use client";
import { useEffect, useState, useRef } from 'react';

export default function IntroOverlay({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 🎞️ Cinematic Stage Sequencing (High-End Pacing)
    const timers = [
      setTimeout(() => setStage(1), 400),   // Letterbox & HUD Init
      setTimeout(() => setStage(2), 2000),  // Logo Pre-glow & Ray
      setTimeout(() => setStage(3), 3200),  // Logo Crystallize
      setTimeout(() => setStage(4), 4500),  // Brand Reveal (ZENVY)
      setTimeout(() => setStage(5), 5800),  // Cinematic Fade-out
      setTimeout(() => {
        onComplete();
      }, 6500) 
    ];

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      const x = (clientX / innerWidth - 0.5) * 15;
      const y = (clientY / innerHeight - 0.5) * 15;
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
        width: '100vw',
        height: '100dvh',
        zIndex: 999999,
        backgroundColor: '#050507',
        overflow: 'hidden',
        perspective: '1000px'
      }}
      className={`transition-opacity duration-[1500ms] ${stage >= 5 ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* 🌑 Deep Space Backdrop */}
      <div className="absolute inset-0 bg-[#050507] overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] opacity-[0.03] bg-[radial-gradient(circle_at_center,#C9A84C_0%,transparent_70%)] blur-[100px]" />
      </div>

      {/* 🎬 Cinematic Letterbox */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: stage >= 1 ? '10vh' : '50dvh',
          backgroundColor: 'black',
          transition: 'height 1.8s cubic-bezier(0.19, 1, 0.22, 1)',
          zIndex: 50
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: stage >= 1 ? '10vh' : '50dvh',
          backgroundColor: 'black',
          transition: 'height 1.8s cubic-bezier(0.19, 1, 0.22, 1)',
          zIndex: 50
        }}
      />

      {/* 💎 SIGNATURE LOGO UNIT */}
      <div
        style={{
          position: 'absolute',
          top: '48%',
          left: '50%',
          transform: `translate(-50%, -50%) translate3d(${mousePos.x}px, ${mousePos.y}px, 0)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          transition: 'transform 0.4s ease-out'
        }}
        className="z-20"
      >
        <div
          className={`relative transition-all duration-[2500ms] cubic-bezier(0.19, 1, 0.22, 1) ${stage >= 2 ? 'scale-100 opacity-100' : 'scale-[1.1] opacity-0 blur-2xl'}`}
        >
          {/* Logo Glow */}
          <div className={`absolute inset-0 bg-[#C9A84C]/20 blur-[60px] rounded-full transition-opacity duration-1000 ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />

          <div className="w-28 h-28 md:w-36 md:h-36 relative flex items-center justify-center">
            {/* Rotating Outer Frame */}
            <div className="absolute inset-0 border border-[#C9A84C]/10 rotate-45 animate-[spin_20s_linear_infinite]" />
            <div className="absolute inset-0 border border-[#C9A84C]/20 rotate-12" />

            {/* Main Shield */}
            <div className="w-full h-full bg-[#141416]/80 backdrop-blur-xl flex items-center justify-center relative border border-[#C9A84C]/30 shadow-[0_0_50px_rgba(201,168,76,0.1)] group">
              {/* Gold Shimmer Sweep */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 w-[200%] h-full translate-x-[-100%] bg-gradient-to-r from-transparent via-[#C9A84C]/20 to-transparent skew-x-[-20deg] animate-[shimmer_3s_infinite]" />
              </div>

              <svg className="w-12 h-12 md:w-16 md:h-16 text-[#C9A84C]" viewBox="0 0 100 100" fill="none">
                <path
                  className={`transition-all duration-[2000ms] delay-500 ${stage >= 3 ? 'stroke-dashoffset-0' : 'stroke-dashoffset-[300]'}`}
                  style={{ strokeDasharray: 300, strokeDashoffset: stage >= 3 ? 0 : 300 }}
                  d="M25 25 L75 25 L25 75 L75 75"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Corners */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[#C9A84C]/50" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[#C9A84C]/50" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-[#C9A84C]/50" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[#C9A84C]/50" />
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <div className="overflow-hidden">
            <h1 className={`text-5xl md:text-7xl font-black transition-all duration-[2000ms] cubic-bezier(0.19, 1, 0.22, 1) ${stage >= 4 ? 'translate-y-0 opacity-100 tracking-[0.4em]' : 'translate-y-full opacity-0 tracking-[0.8em]'}`}>
              <span className="bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent uppercase">Zenvy</span>
            </h1>
          </div>
          <p className={`mt-5 text-[9px] md:text-[11px] uppercase tracking-[0.8em] font-medium transition-all duration-[2000ms] delay-700 ${stage >= 4 ? 'translate-y-0 opacity-40' : 'translate-y-5 opacity-0'}`}>
            THE LUXURY OF CONVENIENCE
          </p>
        </div>
      </div>

      {/* 🎞️ HUD & TECHNICAL OVERLAYS */}
      <div className={`absolute top-12 left-10 font-mono text-[8px] uppercase tracking-[0.3em] text-white/20 transition-opacity duration-1000 ${stage >= 1 ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span>REC : 4K RAW</span>
        </div>
        <div>ISO 800 | 24 FPS</div>
      </div>

      <div className={`absolute bottom-12 right-10 font-mono text-[8px] tracking-[0.4em] text-white/20 transition-opacity duration-1000 ${stage >= 1 ? 'opacity-100' : 'opacity-0'}`}>
        ZEN_SYS: v4.0.2 / LUX_CORE
      </div>

      <div className={`absolute top-1/2 left-6 -translate-y-1/2 space-y-4 opacity-[0.05] transition-opacity duration-1000 ${stage >= 1 ? 'opacity-5' : 'opacity-0'}`}>
        <div className="w-[1px] h-20 bg-white" />
        <div className="text-[10px] [writing-mode:vertical-lr] tracking-[0.5em] uppercase font-light">Odyssey</div>
        <div className="w-[1px] h-20 bg-white" />
      </div>

      {/* 🎬 Film Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.05] grain-anim" />

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%) skewX(-20deg); }
          50%, 100% { transform: translateX(200%) skewX(-20deg); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .cubic-bezier(0.19, 1, 0.22, 1) {
          transition-timing-function: cubic-bezier(0.19, 1, 0.22, 1);
        }
      `}</style>
    </div>
  );
}
