"use client";
/* eslint-disable @next/next/no-img-element */
import type { ImgHTMLAttributes, ReactNode } from 'react';

/** Inline (base64) images above this many characters are not drawn as small thumbnails. */
const MAX_INLINE_THUMB_CHARS = 200_000; // ~150 KB image

export const isHeavyDataUri = (src?: string | null) =>
  !!src && src.startsWith('data:') && src.length > MAX_INLINE_THUMB_CHARS;

/**
 * <img> for lists: lazy-loaded and decoded off the main thread. With `thumb`, a large base64
 * image (a full photo stored inline) is replaced by `fallback`, since decoding megabytes for a
 * 20-60px avatar costs far more than it shows.
 */
export default function ListImage({ src, thumb = false, fallback = null, alt = '', ...rest }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
  thumb?: boolean;
  fallback?: ReactNode;
}) {
  if (!src || (thumb && isHeavyDataUri(src))) return <>{fallback}</>;
  return <img src={src} alt={alt} loading="lazy" decoding="async" {...rest} />;
}
