"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function SplashPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'logo' | 'text' | 'exit'>('logo');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('text'), 800);
    const t2 = setTimeout(() => setPhase('exit'), 2200);
    const t3 = setTimeout(() => router.push('/login'), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [router]);

  return (
    <main className="min-h-screen bg-[#0A0A0B] flex items-center justify-center relative overflow-hidden">
      {/* Ambient Gold Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${4 + Math.random() * 6}px`,
              height: `${4 + Math.random() * 6}px`,
              left: `${15 + Math.random() * 70}%`,
              top: `${20 + Math.random() * 60}%`,
              background: `radial-gradient(circle, rgba(201,168,76,${0.3 + Math.random() * 0.4}) 0%, transparent 70%)`,
              animation: `particle-float ${3 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Gold Radial Glow Behind Logo */}
      <div className={`absolute w-80 h-80 rounded-full transition-all duration-1000 ${phase === 'logo' || phase === 'text' ? 'opacity-100 scale-100' : 'opacity-0 scale-150'}`}
        style={{ background: 'radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)' }}
      />

      {/* Logo + Text Container */}
      <div className={`flex flex-col items-center relative z-10 transition-all duration-700 ${phase === 'exit' ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
        {/* Animated Logo Icon */}
        <div className={`transition-all duration-700 ease-out ${phase === 'logo' ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}>
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#C9A84C] to-[#8B7332] flex items-center justify-center shadow-2xl shadow-[#C9A84C]/30 mb-8"
            style={{ animation: phase === 'text' ? 'logo-breathe 2s ease-in-out infinite' : 'none' }}>
            <span className="text-4xl font-black text-black">Z</span>
          </div>
        </div>

        {/* Brand Name */}
        <div className={`text-center transition-all duration-700 delay-300 ${phase === 'text' || phase === 'exit' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h1 className="text-3xl font-black uppercase tracking-[0.4em] text-gold-gradient mb-2">Zenvy</h1>
          <p className="text-[9px] font-bold uppercase tracking-[0.5em] text-secondary-text">Premium Food Delivery</p>
        </div>

        {/* Gold Line */}
        <div className={`gold-line w-16 mt-8 transition-all duration-700 delay-500 ${phase === 'text' ? 'opacity-100' : 'opacity-0'}`} />
      </div>

      <style jsx>{`
        @keyframes particle-float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-20px) scale(1.5); opacity: 0.8; }
        }
        @keyframes logo-breathe {
          0%, 100% { box-shadow: 0 25px 50px rgba(201,168,76,0.3); }
          50% { box-shadow: 0 25px 60px rgba(201,168,76,0.5); }
        }
      `}</style>
    </main>
  );
}
