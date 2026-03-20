"use client";
import { useEffect, useState } from 'react';

export default function IntroOverlay({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // 🎞️ "Golden Embers & Glass" Cinematic Pacing (Continuous floating rich space)
    const timers = [
      setTimeout(() => setStage(1), 300),   // Stage 1: Darkness -> Ambient core ignition
      setTimeout(() => setStage(2), 1500),  // Stage 2: 🕯️ Searing Center Glow Flare (Slow rise)
      setTimeout(() => setStage(3), 3000),  // Stage 3: Noble 3D Glass Crest & Typography crystalize
      setTimeout(() => setStage(4), 4800),  // Stage 4: Continuous Aperture forward scale Drive
      setTimeout(() => onComplete(), 6000) 
    ];

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  // 🎇 Dynamic Particle Mesh mapping for hyper-realistic drifting gold ashes 
  const embers = [
    { left: '15%', top: '80%', size: '3px', delay: '0s', duration: '12s' },
    { left: '25%', top: '70%', size: '1.5px', delay: '2s', duration: '15s' },
    { left: '40%', top: '90%', size: '2px', delay: '1s', duration: '10s' },
    { left: '60%', top: '75%', size: '2.5px', delay: '3s', duration: '14s' },
    { left: '80%', top: '85%', size: '1px', delay: '0.5s', duration: '18s' },
    { left: '30%', top: '60%', size: '3px', delay: '4s', duration: '11s' },
    { left: '70%', top: '65%', size: '2px', delay: '1.5s', duration: '13s' },
    { left: '50%', top: '85%', size: '4px', delay: '2.5s', duration: '9s', blur: '2px' },
    { left: '10%', top: '50%', size: '1.5px', delay: '5s', duration: '16s' },
    { left: '90%', top: '55%', size: '2px', delay: '3.5s', duration: '12s' }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100dvh',
        zIndex: 999999,
        backgroundColor: '#020202', // Midnight Obsidian
        overflow: 'hidden',
        perspective: '1500px'
      }}
      className={`transition-all duration-[1200ms] ${stage >= 4 ? 'opacity-0 scale-[1.05] blur-md' : 'opacity-100 scale-100'}`}
    >
      {/* 🔮 Deep Cinematic Atmospheric Drift (Floating golden embers) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        
        {/* Core Amber Nebula Backglow (Swelles continuous) */}
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[160%] bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.14)_0%,transparent_50%)] blur-[120px] transition-all duration-[2000ms] ${stage >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`} 
        />

        {/* 🌀 Dynamic Spark Embers drift (Simulates absolute depth & luxury) */}
        {stage >= 1 && embers.map((ember, i) => (
          <div 
            key={i}
            style={{
              position: 'absolute',
              left: ember.left,
              top: ember.top,
              width: ember.size,
              height: ember.size,
              backgroundColor: '#D4AF37',
              borderRadius: '50%',
              opacity: 0,
              filter: ember.blur ? `blur(${ember.blur})` : 'drop-shadow(0 0 5px rgba(212,175,55,0.8))',
              animation: `float-up ${ember.duration} infinite linear`,
              animationDelay: ember.delay
            }}
          />
        ))}

        {/* 🕯️ Soft Searing center flare backsweep */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div 
            className={`w-[500px] h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/80 to-transparent blur-[3px] scale-x-0 transition-transform duration-[2000ms] ease-out-expo ${stage >= 2 ? 'scale-x-100' : 'scale-x-0'}`} 
          />
        </div>
      </div>

      {/* 🎬 Premium Movie Bar Trim letterboxes */}
      <div className={`absolute top-0 left-0 w-full bg-black z-50 transition-all duration-[1500ms] cubic-bezier(0.19, 1, 0.22, 1) ${stage >= 1 ? 'h-[6vh]' : 'h-[50dvh]'}`} />
      <div className={`absolute bottom-0 left-0 w-full bg-black z-50 transition-all duration-[1500ms] cubic-bezier(0.19, 1, 0.22, 1) ${stage >= 1 ? 'h-[6vh]' : 'h-[50dvh]'}`} />

      {/* 👑 ELITE SIGNATURE CENTER CARS (The 3D Glass Monogram) */}
      <div
        style={{
          position: 'absolute',
          top: '45%',
          left: '50%',
          transform: `translate(-50%, -50%)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          zIndex: 40
        }}
        className={`transition-all duration-[2000ms] ease-out-expo ${stage >= 2 ? 'scale-100 opacity-100' : 'scale-[1.15] opacity-0 blur-md'}`}
      >
        <div className="relative flex items-center justify-center p-8">
          {/* Back Core Ambient Glow Burst */}
          <div className={`absolute inset-0 bg-[#C9A84C]/15 blur-[50px] rounded-full transition-opacity duration-1500 ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />

          <div className="w-24 h-24 md:w-28 md:h-28 relative flex items-center justify-center">
            {/* Elegant outer slow decelerating halo frames */}
            <div className={`absolute inset-[-15px] border border-[#C9A84C]/15 rounded-full animate-[spin_45s_linear_infinite] transition-opacity ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />
            
            {/* Main Center Bounding Box (Translucent Glass plate texture) */}
            <div className="w-[85%] h-[85%] bg-[#050505]/75 backdrop-blur-2xl flex items-center justify-center relative border border-[#C9A84C]/40 shadow-[0_0_80px_rgba(201,168,76,0.18)] overflow-hidden rounded-[8px]">
              
              {/* Luxury light sweep laser inside the crest reticle */}
              <div className="absolute inset-0 overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-30deg] animate-[sweep-flare_3.5s_infinite_linear] transition-opacity ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />
              </div>

              {/* Precise Vector Signature draws IN on stage 3 */}
              <svg className="w-9 h-9 md:w-10 md:h-10 text-[#D4AF37]" viewBox="0 0 100 100" fill="none">
                <path
                  className={`transition-all duration-[2000ms] delay-400 ${stage >= 3 ? 'stroke-dashoffset-0' : 'stroke-dashoffset-[300]'}`}
                  style={{ strokeDasharray: 300, strokeDashoffset: stage >= 3 ? 0 : 300 }}
                  d="M25 25 L75 25 L25 75 L75 75"
                  stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* 👑 ELEVATED 3D VOLUME CINEMATIC TYPOGRAPHY */}
        <div className="mt-12 text-center">
          <div className="overflow-hidden">
            <h1 
               style={{ fontFamily: "'Playfair Display', serif" }}
               className={`text-6xl md:text-7xl font-light italic transition-all duration-[2500ms] cubic-bezier(0.1, 1, 0.1, 1) ${stage >= 3 ? 'translate-y-0 opacity-100 tracking-[0.3em] scale-100' : 'translate-y-full opacity-0 tracking-[0.05em] scale-110'}`}
            >
              <span 
                style={{ filter: 'drop-shadow(0px 3px 6px rgba(0,0,0,0.85)) drop-shadow(0px 0px 40px rgba(212,175,55,0.3))' }}
                className="bg-gradient-to-b from-[#FFFDF9] via-[#D4AF37] to-[#825B10] bg-clip-text text-transparent"
              >
                  Zenvy
              </span>
            </h1>
          </div>
          
          <p className={`mt-5 text-[10px] md:text-[11px] font-bold uppercase tracking-[0.6em] opacity-0 transition-opacity duration-[1500ms] delay-600 ${stage >= 3 ? 'opacity-45' : 'opacity-0'}`} style={{ color: '#EBE3CE' }}>
             The Luxury of Convenience
          </p>
        </div>
      </div>

      <style jsx>{`
        .ease-out-expo {
          transition-timing-function: cubic-bezier(0.19, 1, 0.22, 1);
        }
        @keyframes float-up {
          0% { transform: translateY(100vh) scale(0.8); opacity: 0; }
          20% { opacity: 0.8; }
          80% { opacity: 0.8; }
          100% { transform: translateY(-100px) scale(1.1); opacity: 0; }
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
