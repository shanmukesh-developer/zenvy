"use client";
import { useEffect, useState, useRef } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

export default function VFXParticles() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Generate random particles
    const newParticles = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // percentage across screen width
      y: Math.random() * 100, // randomized starting y
      size: Math.random() * 2 + 1, // 1px to 3px
      duration: Math.random() * 20 + 10, // 10s to 30s float time
      delay: Math.random() * -20, // pre-warm animations
      opacity: Math.random() * 0.4 + 0.1, // subtle glow
    }));
    setParticles(newParticles);

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: (e.clientX / window.innerWidth) * 100, y: (e.clientY / window.innerHeight) * 100 });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  if (particles.length === 0) return null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {particles.map((p) => {
        // Calculate interactive offset
        const dx = mousePos.x - p.x;
        const dy = mousePos.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const repelForce = Math.max(0, 15 - dist) * 0.2; // Repel if closer than 15%
        const offsetX = dist > 0 ? (dx / dist) * -repelForce : 0;
        const offsetY = dist > 0 ? (dy / dist) * -repelForce : 0;

        return (
          <div
            key={p.id}
            className="absolute rounded-full bg-[#C9A84C]/40 transition-transform duration-700 ease-out"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              transform: `translate(${offsetX}vw, ${offsetY}vh)`,
              boxShadow: `0 0 ${p.size * 4}px ${p.size}px rgba(201,168,76,0.3)`,
              animation: `float-slow ${p.duration}s linear infinite`,
              animationDelay: `${p.delay}s`
            }}
          />
        );
      })}
    </div>
  );
}
