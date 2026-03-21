"use client";
import { useState, useEffect } from 'react';
import Image, { ImageProps } from 'next/image';

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop"; 

export default function SafeImage(props: ImageProps) {
  const [imgSrc, setImgSrc] = useState(props.src);

  useEffect(() => {
    setImgSrc(props.src);
  }, [props.src]);

  return (
    <Image
      {...props}
      src={imgSrc || FALLBACK_IMAGE}
      onError={() => setImgSrc(FALLBACK_IMAGE)}
    />
  );
}
