"use client";
import { useEffect, useRef } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

// Pure CSS-driven particles — zero mousemove re-renders, silky smooth
export default function VFXParticles() {
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);

  if (particlesRef.current.length === 0) {
    particlesRef.current = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 20 + 10,
      delay: Math.random() * -20,
      opacity: Math.random() * 0.4 + 0.1,
    }));
  }

  // Cursor interaction via CSS custom property — NO setState, NO re-render
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId: number;
    const handleMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        el.style.setProperty('--mx', `${(e.clientX / window.innerWidth) * 100}`);
        el.style.setProperty('--my', `${(e.clientY / window.innerHeight) * 100}`);
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {particlesRef.current.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-[#C9A84C]/40"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 4}px ${p.size}px rgba(201,168,76,0.3)`,
            animation: `float-slow ${p.duration}s linear infinite`,
            animationDelay: `${p.delay}s`,
            willChange: 'transform',
          }}
        />
      ))}
    </div>
  );
}
