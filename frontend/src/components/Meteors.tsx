"use client";
import { useEffect, useState } from 'react';

interface MeteorData {
  id: number;
  x: number;
  y: number;
  delay: number;
  duration: number;
}

export default function Meteors({ number = 10 }: { number?: number }) {
  const [meteors, setMeteors] = useState<MeteorData[]>([]);

  useEffect(() => {
    const newMeteors = Array.from({ length: number }).map((_, i) => ({
      id: i,
      x: Math.random() * 150 - 50, // start anywhere horizontally 
      y: Math.random() * -50, // start above screen
      delay: Math.random() * 8, // random stagger up to 8s
      duration: Math.random() * 2 + 3, // fast shooting star (3 to 5s)
    }));
    setMeteors(newMeteors);
  }, [number]);

  if (meteors.length === 0) return null;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {meteors.map((m) => (
        <span
          key={m.id}
          className="absolute h-0.5 w-0.5 rounded-[9999px] bg-slate-200 shadow-[0_0_0_1px_#ffffff10] rotate-[215deg] animate-meteor"
          style={{
            top: `${m.y}vh`,
            left: `${m.x}vw`,
            animationDelay: `${m.delay}s`,
            animationDuration: `${m.duration}s`,
          }}
        >
          {/* Meteor Tail */}
          <div className="absolute top-1/2 -z-10 h-px w-[100px] -translate-y-[50%] bg-gradient-to-r from-[#C9A84C] to-transparent" />
        </span>
      ))}
    </div>
  );
}
