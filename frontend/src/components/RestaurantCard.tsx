"use client";

import Image from 'next/image';

interface RestaurantCardProps {
  name: string;
  rating: string;
  time: string;
  imageUrl: string;
  imagePosition: 'left' | 'right';
}

const RestaurantCard = ({ name, rating, time, imageUrl, imagePosition }: RestaurantCardProps) => {
  return (
    <div className={`capsule-card mb-10 ${imagePosition === 'right' ? 'flex-row-reverse text-right pl-6' : 'pr-6'}`}>
      {/* Image Circle */}
      <div className={`food-circle shadow-xl transition-all duration-500 ${imagePosition === 'left' ? '-ml-6' : '-mr-6'} relative z-20`}>
        <Image 
          src={imageUrl} 
          alt="" // Use empty alt to prevent "double text" look on broken images
          fill
          style={{ objectFit: 'cover' }}
        />
      </div>
      
      {/* Content Area */}
      <div className={`flex-1 flex flex-col justify-center px-6 ${imagePosition === 'right' ? 'mr-2' : 'ml-2'} relative z-10 overflow-hidden`}>
        <h3 className="font-black text-[15px] leading-tight mb-2 text-white truncate">{name}</h3>
        
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
    </div>
  );
};

export default RestaurantCard;
