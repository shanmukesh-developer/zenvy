"use client";
import { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

// Zero setState re-renders — uses MotionValue directly for spring animation
export default function Magnetic({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 150, damping: 15, mass: 0.1 });
  const y = useSpring(rawY, { stiffness: 150, damping: 15, mass: 0.1 });

  if (isTouch) {
    // On touch devices just render children — no magnetic needed
    return <>{children}</>;
  }

  const handleMouse = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current!.getBoundingClientRect();
    rawX.set((clientX - (left + width / 2)) * 0.35);
    rawY.set((clientY - (top + height / 2)) * 0.35);
  };

  const reset = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <motion.div
      style={{ position: "relative", x, y }}
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
    >
      {children}
    </motion.div>
  );
}

