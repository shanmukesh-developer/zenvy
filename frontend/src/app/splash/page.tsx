import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function SplashPage() {
  const router = useRouter();
  const [stage, setStage] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Stage sequencing
    const timers = [
      setTimeout(() => setStage(1), 500),   // Flare & Bokeh
      setTimeout(() => setStage(2), 1500),  // Logo Reveal
      setTimeout(() => setStage(3), 2500),  // Text Reveal
      setTimeout(() => {
        window.location.href = '/login';
      }, 5500)
    ];

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      const x = (clientX / innerWidth - 0.5) * 40;
      const y = (clientY / innerHeight - 0.5) * 40;
      setMousePos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <main 
      ref={containerRef}
      className="relative min-h-screen bg-black overflow-hidden flex flex-col items-center justify-center"
    >
      {/* Cinematic Background Layer */}
      <div className="vfx-bokeh opacity-40" />
      <div className="vfx-flare opacity-20" />
      <div className="gold-dust opacity-30" />

      {/* Interactive Logo Layer */}
      <div 
        className={`relative z-20 transition-all duration-1000 ease-out-expo ${stage >= 2 ? 'scale-100 opacity-100' : 'scale-150 opacity-0'}`}
        style={{ transform: `translate3d(${mousePos.x}px, ${mousePos.y}px, 0)` }}
      >
        {/* The Zenvy Jewelry Brand Mark */}
        <div className="relative">
          {/* Ambient Outer Glow */}
          <div className="absolute inset-0 bg-[#C9A84C] blur-[60px] opacity-20 animate-pulse" />
          
          <div className="w-32 h-32 relative">
             <div className="absolute inset-0 border-[3px] border-[#C9A84C]/40 rotate-45 scale-110" />
             <div className="absolute inset-0 border-[1px] border-[#C9A84C]/20 -rotate-12 scale-125" />
             
             <div className="w-full h-full bg-gradient-to-br from-[#C9A84C] via-[#F7D331] to-[#8B7332] flex items-center justify-center relative shadow-[0_0_50px_rgba(201,168,76,0.4)]">
                <span className="text-6xl font-black text-black select-none tracking-tighter">Z</span>
                
                {/* Internal Reflections */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent" />
             </div>
          </div>
        </div>
      </div>

      {/* Cinematic Text Reveal */}
      <div className="mt-16 text-center z-10">
        <h1 
          className={`text-4xl md:text-6xl font-black transition-all duration-1000 ${stage >= 3 ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
        >
          <span className="text-reveal-cinematic tracking-[0.2em] uppercase">Zenvy</span>
        </h1>
        <p 
          className={`mt-4 text-[10px] md:text-sm font-bold uppercase tracking-[0.6em] text-white/40 transition-all duration-1000 delay-300 ${stage >= 3 ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}
        >
          Beyond Fine Dining
        </p>
      </div>

      {/* Bottom Cinematic Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[#C9A84C]/5 to-transparent pointer-events-none" />
      
      {/* Decorative build info */}
      <div className={`absolute bottom-8 left-8 text-[8px] font-mono text-white/10 transition-opacity duration-1000 ${stage >= 1 ? 'opacity-100' : 'opacity-0'}`}>
        ZENVY_ULTIMATE_CORE // VFX_V4.9
      </div>
    </main>
  );
}
