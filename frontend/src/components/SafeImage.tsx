"use client";
import React, { useState, useEffect } from 'react';

const FALLBACK_IMAGE = "/assets/placeholder_premium.png"; 

interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | { src: string } | undefined;
  fill?: boolean;
  priority?: boolean;
}

export default function SafeImage({ src, alt, className, style, fill, priority, ...rest }: SafeImageProps) {
  const [imgSrc, setImgSrc] = useState(src);

  useEffect(() => {
    setImgSrc(src);
  }, [src]);

  const containerStyle: React.CSSProperties = fill 
    ? { position: 'absolute', height: '100%', width: '100%', left: 0, top: 0, right: 0, bottom: 0, objectFit: 'cover' }
    : {};

  const mergedStyle = { ...containerStyle, ...style };

  let finalSrc = typeof imgSrc === 'string' ? imgSrc : (imgSrc as { src: string })?.src;
  if (!finalSrc || finalSrc === 'null' || finalSrc === 'undefined') {
    finalSrc = FALLBACK_IMAGE;
  }
  const resolvedSrc = finalSrc;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt={alt || 'Image'}
      style={mergedStyle}
      onError={() => {
        if (imgSrc !== FALLBACK_IMAGE) setImgSrc(FALLBACK_IMAGE);
      }}
      className={className}
      loading={priority ? "eager" : "lazy"}
      {...rest}
    />
  );
}
