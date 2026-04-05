"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=400&auto=format&fit=crop";

interface RestaurantCardProps {
  name: string;
  rating: string;
  time: string;
  imageUrl: string;
  imagePosition: 'left' | 'right';
}

const RestaurantCard = ({ name, rating, time, imageUrl, imagePosition }: RestaurantCardProps) => {
  const [imgSrc, setImgSrc] = useState(imageUrl);

  useEffect(() => {
    setImgSrc(imageUrl || FALLBACK_IMAGE);
  }, [imageUrl]);

  // 3D Tilt Logic
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div 
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`capsule-card mb-10 ${imagePosition === 'right' ? 'flex-row-reverse text-right pl-6' : 'pr-6'}`}
    >
      {/* Image Circle */}
      <motion.div 
        style={{ translateZ: 50 }}
        className={`food-circle shadow-xl transition-all duration-500 ${imagePosition === 'left' ? '-ml-6' : '-mr-6'} relative z-20`}
      >
        <Image 
          src={imgSrc || FALLBACK_IMAGE} 
          alt="" 
          fill
          style={{ objectFit: 'cover' }}
          onError={() => setImgSrc(FALLBACK_IMAGE)}
        />
      </motion.div>
      
      {/* Content Area */}
      <div 
        className={`flex-1 flex flex-col justify-center px-6 ${imagePosition === 'right' ? 'mr-2' : 'ml-2'} relative z-10 overflow-hidden`}
        style={{ transform: "translateZ(30px)" }}
      >
        <h3 className="font-black text-[15px] leading-tight mb-2 text-white line-clamp-2">{name}</h3>
        
        <div className={`flex items-center gap-3 ${imagePosition === 'right' ? 'justify-end' : 'justify-start'}`}>
           <div className="flex text-[9px] gap-0.5">
             {[...Array(5)].map((_, i) => (
                <span key={i} className={i < Math.floor(parseFloat(rating)) ? 'text-primary-yellow' : 'text-white/10'}>★</span>
             ))}
           </div>
           <span className="text-[10px] text-white/20 font-black">•</span>
           <div className="flex items-center gap-1.5 text-secondary-text text-[9px] font-black uppercase tracking-widest">
             <svg className="w-3.5 h-3.5 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
              {time} Batch
           </div>
        </div>
      </div>
    </motion.div>
  );
};

export default RestaurantCard;
