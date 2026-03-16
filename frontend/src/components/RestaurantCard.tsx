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
    <div className={`capsule-card mb-12 ${imagePosition === 'right' ? 'flex-row-reverse text-right pl-6' : 'pr-6'}`}>
      {/* Image Circle */}
      <div className={`food-circle transition-transform duration-500 group-hover:scale-105 ${imagePosition === 'left' ? '-ml-6' : '-mr-6'} relative`}>
        <Image 
          src={imageUrl} 
          alt={name} 
          fill
          style={{ objectFit: 'cover' }}
        />
      </div>
      
      {/* Content Area */}
      <div className={`flex-1 px-5 ${imagePosition === 'right' ? 'mr-4' : 'ml-4'}`}>
        <h3 className="font-bold text-[15px] leading-[1.2] mb-1.5">{name}</h3>
        
        <div className={`flex items-center gap-1.5 ${imagePosition === 'right' ? 'justify-end' : ''}`}>
           <div className="flex text-primary-yellow text-[10px]">
             {[...Array(5)].map((_, i) => (
                <span key={i} className={i < Math.floor(parseFloat(rating)) ? 'text-primary-yellow' : 'text-secondary-text'}>★</span>
             ))}
           </div>
           <div className="flex items-center gap-1 text-secondary-text text-[11px] font-medium">
             <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
             {time}
           </div>
        </div>
      </div>
    </div>
  );
};

export default RestaurantCard;
