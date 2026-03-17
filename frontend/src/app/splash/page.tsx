"use client";
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function SplashPage() {
  const router = useRouter();
  const [stage, setStage] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Cinematic Stage Sequencing
    const timers = [
      setTimeout(() => setStage(1), 800),   // Widescreen & Countdown Start
      setTimeout(() => setStage(2), 3500),  // Light Ray & Logo Materialize
      setTimeout(() => setStage(3), 5000),  // Full Logo & Glints
      setTimeout(() => setStage(4), 6500),  // Brand Reveal
      setTimeout(() => setStage(5), 8500),  // Liquid Expand Start
      setTimeout(() => {
        router.push('/login');
      }, 9700) 
    ];

    // Countdown logic
    const countdownInterval = setInterval(() => {
      setCountdown(prev => (prev > 1 ? prev - 1 : 1));
    }, 900);

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      const x = (clientX / innerWidth - 0.5) * 30;
      const y = (clientY / innerHeight - 0.5) * 30;
      setMousePos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(countdownInterval);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [router]);

  return (
    <main 
      ref={containerRef}
      className={`relative min-h-screen bg-black overflow-hidden flex flex-col items-center justify-center transition-all duration-1000 ${stage >= 1 ? 'cinematic-active' : ''}`}
    >
      {/* 🎬 Cinematic Widescreen Bars */}
      <div className="cinematic-bars cinematic-bar-top" />
      <div className="cinematic-bars cinematic-bar-bottom" />

      {/* 🎞️ Film VFX Layers */}
      <div className={`film-grain transition-opacity duration-2000 ${stage >= 1 ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`film-scratches transition-opacity duration-1000 ${stage >= 1 ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`film-burn transition-opacity duration-[3000ms] ${stage === 2 ? 'opacity-100' : 'opacity-0'}`} />
      <div className="lens-dirt opacity-20" />
      <div className={`vfx-shimmer-ray transition-opacity duration-2000 ${stage >= 2 ? 'opacity-100' : 'opacity-0'}`} />
      
      {/* 🌊 Liquid Transition Overlay */}
      <div className={`liquid-expand ${stage >= 5 ? 'active' : ''}`} />

      {/* 🎥 Technical HUD Elements (Top) */}
      <div className={`absolute top-12 left-12 font-mono text-[8px] tracking-[0.5em] text-white/20 transition-all duration-1000 ${stage >= 1 ? 'opacity-100' : 'opacity-0'}`}>
        ZENVY_ULTIMATE // VFX_CORE_v12.4
      </div>
      <div className={`absolute top-12 right-12 font-mono text-[8px] tracking-[0.5em] text-white/20 transition-all duration-1000 ${stage >= 1 ? 'opacity-100' : 'opacity-0'}`}>
        FPS: 60 // 8K_HDR_MASTER
      </div>

      {/* 🔢 Cinematic Countdown */}
      {stage === 1 && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="text-center">
            <div className="text-[120px] font-black text-white/5 tracking-tighter animate-pulse">
              {countdown}
            </div>
            <div className="mt-4 text-[10px] uppercase tracking-[2em] font-light text-white/20">
              Initializing Experience
            </div>
          </div>
        </div>
      )}

      {/* 💎 The Main Visual: Interactive Brand Mark */}
      <div 
        className={`relative z-20 transition-all duration-[3000ms] ease-out-expo ${stage >= 2 ? 'scale-100 opacity-100' : 'scale-150 opacity-0 blur-3xl'}`}
        style={{ transform: `translate3d(${mousePos.x}px, ${mousePos.y}px, 0)` }}
      >
        <div className="relative group">
          {/* Ambient Glows */}
          <div className={`absolute inset-0 bg-[#C9A84C] blur-[100px] transition-opacity duration-[3000ms] ${stage >= 3 ? 'opacity-20' : 'opacity-0'}`} />
          
          <div className="w-48 h-48 relative">
             {/* Complex Geometric Borders */}
             <div className={`absolute inset-0 border-[4px] border-[#C9A84C]/20 rotate-45 scale-110 transition-transform duration-[5000ms] ${stage >= 2 ? 'rotate-[360deg]' : 'rotate-45'}`} />
             <div className={`absolute inset-0 border-[1px] border-[#C9A84C]/10 -rotate-12 scale-150 transition-transform duration-[6000ms] ${stage >= 2 ? 'rotate-[180deg]' : '-rotate-12'}`} />
             
             {/* The Core Mark */}
             <div className="w-full h-full bg-gradient-to-br from-[#1A1A1C] to-black flex items-center justify-center relative shadow-[0_0_100px_rgba(201,168,76,0.2)] overflow-hidden border border-[#C9A84C]/20">
                {/* Animated "Z" with SVG stroke shimmer */}
                <svg className="w-24 h-24 text-gold-gradient" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                   <path 
                     d="M20 20 H80 L20 80 H80" 
                     stroke="currentColor" 
                     strokeWidth="12" 
                     strokeLinecap="round" 
                     strokeLinejoin="round"
                     className="logo-shimmer-stroke"
                   />
                </svg>
                
                {/* Moving Reflections */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-30 animate-pulse" />
                <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/10 to-transparent -rotate-45 translate-x-[-100%] animate-[ray-sweep_4s_infinite]" />
             </div>

             {/* Corner Glints */}
             {stage >= 3 && (
               <>
                 <div className="gold-glint top-2 left-2" style={{ animationDelay: '0s' }} />
                 <div className="gold-glint top-2 right-2" style={{ animationDelay: '1.2s' }} />
                 <div className="gold-glint bottom-2 left-2" style={{ animationDelay: '0.6s' }} />
                 <div className="gold-glint bottom-2 right-2" style={{ animationDelay: '2s' }} />
               </>
             )}
          </div>
        </div>
      </div>

      {/* 🏷️ Cinematic Title & Tagline */}
      <div className="mt-28 text-center z-10">
        <h1 
          className={`text-6xl md:text-8xl font-black transition-all duration-[2500ms] ${stage >= 4 ? 'translate-y-0 opacity-100 tracking-[0.4em]' : 'translate-y-32 opacity-0 tracking-[1.5em]'}`}
        >
          <span className="text-reveal-cinematic uppercase">Zenvy</span>
        </h1>
        <p 
          className={`mt-8 text-[12px] md:text-sm font-bold uppercase tracking-[1em] text-white/40 transition-all duration-[2500ms] delay-1000 ${stage >= 4 ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
        >
          An Odyssey of Taste
        </p>
      </div>

      {/* 📊 Technical HUD Elements (Bottom) */}
      <div className={`absolute bottom-12 left-12 font-mono text-[8px] tracking-[0.8em] text-white/20 transition-opacity duration-1000 ${stage >= 1 ? 'opacity-100' : 'opacity-0'}`}>
        TIMECODE: 00:00:{stage + 12}:{(stage * 4).toString().padStart(2, '0')} <br />
        STATUS: MASTER_PLAYBACK_ACTIVE
      </div>

      <div className={`absolute bottom-12 right-12 font-mono text-[8px] tracking-[0.8em] text-white/20 transition-opacity duration-1000 ${stage >= 1 ? 'opacity-100' : 'opacity-0'}`}>
        COLOR_SPACE: DCI_P3_GOLDING <br />
        ASPECT: 2.39:1_CINEMASCOPE
      </div>

      {/* Liquid Transition Overlay */}
      <div className={`fixed inset-0 bg-[#C9A84C] z-[200] transition-opacity duration-[2000ms] pointer-events-none ${stage >= 5 ? 'opacity-10' : 'opacity-0'}`} />
    </main>
  );
}
