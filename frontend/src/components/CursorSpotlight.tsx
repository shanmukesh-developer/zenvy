"use client";
import { useEffect, useRef } from 'react';

// Uses direct DOM mutation via ref — zero React re-renders on mouse move
export default function CursorSpotlight() {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;

    let rafId: number;
    const handleMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        el.style.background = `radial-gradient(600px circle at ${e.clientX}px ${e.clientY}px, rgba(201,168,76,0.06), transparent 40%)`;
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={divRef}
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
