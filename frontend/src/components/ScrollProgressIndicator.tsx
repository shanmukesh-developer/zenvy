"use client";
import { motion, useScroll, useSpring } from "framer-motion";

export default function ScrollProgressIndicator() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#8B7332] via-[#C9A84C] to-[#E8D48B] z-[1000] origin-left"
      style={{ 
        scaleX,
        boxShadow: "0 0 10px rgba(201, 168, 76, 0.5), 0 0 20px rgba(201, 168, 76, 0.2)"
      }}
    />
  );
}
