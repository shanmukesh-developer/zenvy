// SafeImage.tsx – reliable image component with graceful fallback
"use client";
import React, { useState, useEffect } from "react";

// Deterministic placeholder images
const FALLBACK_IMAGES = [
  "/assets/placeholder.png",
  "/assets/placeholder_premium.png",
];

// Choose a placeholder based on alt text (stable across renders)
const getFallback = (alt: string) => {
  const index = Math.abs(
    alt.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  ) % FALLBACK_IMAGES.length;
  return FALLBACK_IMAGES[index];
};

interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | { src: string } | undefined;
  fallback?: string;
  fill?: boolean; // when true, image fills its container absolutely
  priority?: boolean; // eager loading if true
  alt?: string;
}

export default function SafeImage({
  src,
  alt = "Image",
  className,
  style,
  fill = false,
  priority = false,
  fallback,
  ...rest
}: SafeImageProps) {
  const deterministicFallback = fallback ?? getFallback(alt);
  const initialSrc = typeof src === "string" ? src : (src as any)?.src;
  const [imgSrc, setImgSrc] = useState<string>(initialSrc ?? deterministicFallback);

  // Update when src prop changes
  useEffect(() => {
    const newSrc = typeof src === "string" ? src : (src as any)?.src;
    setImgSrc(newSrc ?? deterministicFallback);
  }, [src, deterministicFallback]);

  // Styles for fill mode (absolute covering)
  const containerStyle: React.CSSProperties = fill
    ? {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }
    : {};

  const mergedStyle: React.CSSProperties = { ...containerStyle, ...style };

  const handleError = () => {
    // Switch to fallback if the original source fails
    if (imgSrc !== deterministicFallback) {
      setImgSrc(deterministicFallback);
    }
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      style={mergedStyle}
      loading={priority ? "eager" : "lazy"}
      onError={handleError}
      {...rest}
    />
  );
}
