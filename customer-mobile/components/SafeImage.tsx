import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StyleProp, ImageStyle, ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image, ImageProps } from 'expo-image';

// Stand-in photos for food / product / place images only. People (a user's avatar, a rider) never get
// a stock photo of a stranger: they fall back to a neutral person icon (or the caller's `fallback`).
const LUXURY_FALLBACKS: Record<string, string> = {
  food: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=70',
  biryani: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=70',
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=70',
  pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=70',
  grocery: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=70',
  fruits: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400&q=70',
  electronics: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=400&q=70',
  stationery: 'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=400&q=70',
  laundry: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=400&q=70',
  rides: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=400&q=70',
};

const DEFAULT_FALLBACK_URI = LUXURY_FALLBACKS.food;

/**
 * Ask image CDNs for a phone-sized rendition (a raw Unsplash/Pexels URL is a multi-MB original).
 * Other hosts are returned unchanged.
 */
export function optimizeImageUri(uriString?: string | null, width = 400): string {
  if (!uriString || typeof uriString !== 'string') return '';
  if (uriString.startsWith('data:')) return uriString;
  const w = Math.max(64, Math.round(width));
  if (uriString.includes('images.unsplash.com')) {
    const base = uriString.split('?')[0];
    return `${base}?auto=format&fit=crop&w=${w}&q=70`;
  }
  if (uriString.includes('images.pexels.com')) {
    const base = uriString.split('?')[0];
    return `${base}?auto=compress&cs=tinysrgb&w=${w}`;
  }
  return uriString;
}

/** Stock fallback photo for a URI, or null when the image is of a person (no stock face is shown). */
function getSmartFallback(uriString?: string | null): string | null {
  if (!uriString) return DEFAULT_FALLBACK_URI;
  // Inline data images are user uploads (usually a profile photo).
  if (uriString.startsWith('data:image')) return null;
  const lower = uriString.toLowerCase();
  if (lower.includes('avatar') || lower.includes('profile') || lower.includes('user')) return null;
  if (lower.includes('rider') || lower.includes('driver') || lower.includes('captain')) return null;
  for (const [key, fallback] of Object.entries(LUXURY_FALLBACKS)) {
    if (lower.includes(key)) return fallback;
  }
  return DEFAULT_FALLBACK_URI;
}

interface SafeImageProps extends Omit<ImageProps, 'source' | 'style' | 'onError'> {
  source?: ImageSourcePropType | { uri?: string | null } | null;
  style?: StyleProp<ImageStyle>;
  fallbackUri?: string;
  /** Shown instead of any fallback photo when the image is missing or fails (e.g. initials for an avatar). */
  fallback?: React.ReactNode;
  /** Fade-in on load, ms. */
  fadeInDuration?: number;
  /** Width requested from Unsplash/Pexels (default 400; use ~800 for full-width heroes). */
  maxWidth?: number;
  onError?: (e: any) => void;
}

/**
 * Image with a fallback, backed by expo-image: memory + disk cache (no re-download when a list
 * re-renders or a screen re-opens), downsampled CDN URLs and a cheap native fade-in.
 */
export default function SafeImage({
  source,
  fallbackUri,
  fallback,
  style,
  onError,
  fadeInDuration = 200,
  maxWidth = 400,
  ...props
}: SafeImageProps) {
  const rawUri = typeof source === 'object' && source && 'uri' in source ? (source.uri || '') : '';
  const resolvedFallback = fallbackUri || getSmartFallback(rawUri);
  const [hasError, setHasError] = useState(false);

  useEffect(() => { setHasError(false); }, [rawUri]);

  const failed = typeof source !== 'number' && (hasError || !rawUri.trim());
  // A person's photo that is missing / broken: the caller's placeholder, or a neutral person icon.
  if (failed && (fallback !== undefined || !resolvedFallback)) {
    const flat: any = StyleSheet.flatten(style as any) || {};
    const iconSize = typeof flat.width === 'number' ? Math.max(12, Math.round(flat.width * 0.5)) : 20;
    return (
      <View style={[style as any, styles.container, styles.placeholder]}>
        {fallback !== undefined ? fallback : <Ionicons name="person" size={iconSize} color="rgba(128, 128, 128, 0.65)" />}
      </View>
    );
  }

  let imgSource: any;
  if (typeof source === 'number') imgSource = source;
  else if (failed) imgSource = { uri: resolvedFallback };
  else imgSource = { uri: optimizeImageUri(rawUri, maxWidth) };

  return (
    <View style={[style as any, styles.container]}>
      <Image
        cachePolicy="memory-disk"
        contentFit="cover"
        transition={fadeInDuration}
        recyclingKey={typeof imgSource === 'number' ? String(imgSource) : imgSource.uri}
        {...props}
        source={imgSource}
        style={[style as any, StyleSheet.absoluteFill]}
        onError={(e) => {
          if (!hasError) setHasError(true);
          onError?.(e);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    overflow: 'hidden',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

type CachedImageProps = Omit<ImageProps, 'source' | 'style'> & {
  source?: ImageSourcePropType | { uri?: string | null } | null;
  style?: StyleProp<ImageStyle>;
  /** Width requested from Unsplash/Pexels (default 400). */
  maxWidth?: number;
};

/**
 * Drop-in for react-native's <Image> in lists: expo-image with memory + disk cache and
 * downsampled CDN URLs. Honors resizeMode given as a prop or inside style.
 */
export function CachedImage({ source, style, maxWidth = 400, resizeMode, contentFit, ...props }: CachedImageProps) {
  const flat: any = StyleSheet.flatten(style) || {};
  const mode = resizeMode || flat.resizeMode;
  const fit = contentFit || (mode === 'contain' ? 'contain' : mode === 'stretch' ? 'fill' : mode === 'center' ? 'none' : 'cover');
  let src: any = source;
  if (source && typeof source === 'object' && !Array.isArray(source) && 'uri' in source) {
    src = { uri: optimizeImageUri(source.uri || '', maxWidth) || undefined };
  }
  return <Image cachePolicy="memory-disk" transition={150} {...props} contentFit={fit} source={src} style={style as any} />;
}
