"use client";
import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion';

interface SwipeToAcceptProps {
  onAccept: () => void;
  label?: string;
  isCyberpunk?: boolean;
}

export default function SwipeToAccept({ onAccept, label = 'SWIPE TO ACCEPT', isCyberpunk = true }: SwipeToAcceptProps) {
  const [isAccepted, setIsAccepted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const controls = useAnimation();
  const x = useMotionValue(0);
  
  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
  }, []);

  const handleDragEnd = async (e: any, info: any) => {
    if (isAccepted) return;
    const threshold = containerWidth * 0.6;
    if (info.offset.x > threshold) {
      setIsAccepted(true);
      await controls.start({ x: containerWidth - 56 });
      onAccept();
    } else {
      controls.start({ x: 0 });
    }
  };

  const bg = useTransform(
    x,
    [0, containerWidth - 56],
    ['rgba(255, 255, 255, 0.05)', 'rgba(16, 185, 129, 0.2)']
  );

  const textOpacity = useTransform(x, [0, containerWidth * 0.4], [1, 0]);

  return (
    <motion.div 
      ref={containerRef}
      style={{ background: bg }}
      className={`relative h-14 rounded-2xl overflow-hidden flex items-center justify-center border ${isCyberpunk ? 'border-emerald-500/30' : 'border-white/10'}`}
    >
      <motion.span 
        style={{ opacity: textOpacity }}
        className={`absolute z-0 text-[10px] font-black uppercase tracking-[0.2em] pointer-events-none ${isCyberpunk ? 'text-emerald-400' : 'text-slate-400'}`}
      >
        {isAccepted ? 'ACCEPTED' : label}
      </motion.span>
      
      <motion.div
        drag={isAccepted ? false : "x"}
        dragConstraints={{ left: 0, right: Math.max(0, containerWidth - 56) }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
        className={`absolute left-1 z-10 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing ${isCyberpunk ? 'bg-emerald-500 text-black shadow-emerald-500/30' : 'bg-white text-black'}`}
      >
        <span className="text-lg font-black">{isAccepted ? '✓' : '→'}</span>
      </motion.div>
    </motion.div>
  );
}
