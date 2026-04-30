"use client";
import React, { useState, useEffect } from 'react';

const FALLBACK_IMAGES = [
  "/assets/placeholder.png",
  "/assets/placeholder_premium.png"
];

const getFallback = (alt: string) => {
  // Deterministic fallback based on alt text so it doesn't flicker on re-renders
  const index = Math.abs(alt.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % FALLBACK_IMAGES.length;
  return FALLBACK_IMAGES[index];
};

interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | { src: string } | undefined;
  fallback?: string;
  fill?: boolean;
  priority?: boolean;
}

export default function SafeImage({ src, alt, className, style, fill, priority, ...rest }: SafeImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setImgSrc(src);
    setIsLoaded(false);
  }, [src]);

  const containerStyle: React.CSSProperties = fill 
    ? { position: 'absolute', height: '100%', width: '100%', left: 0, top: 0, right: 0, bottom: 0, objectFit: 'cover' }
    : {};

  const opacityStyle = { 
    opacity: isLoaded ? 1 : 0, 
    transition: 'opacity 0.4s ease-in-out',
    filter: isLoaded ? 'blur(0px)' : 'blur(10px)'
  };

  const mergedStyle = { ...containerStyle, ...opacityStyle, ...style };

  let finalSrc = typeof imgSrc === 'string' ? imgSrc : (imgSrc as { src: string })?.src;
  
  const fallback = getFallback(alt || 'food');
  
  if (!finalSrc || 
      finalSrc === 'null' || 
      finalSrc === 'undefined' || 
      finalSrc === '/assets/placeholder.png' || 
      finalSrc === '/assets/placeholder_premium.png') {
    finalSrc = fallback;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={finalSrc}
      alt={alt || 'Image'}
      style={mergedStyle}
      onLoad={() => setIsLoaded(true)}
      onError={() => {
        if (imgSrc !== fallback) setImgSrc(fallback);
      }}
      className={className}
      loading={priority ? "eager" : "lazy"}
      {...rest}
    />
  );
}
