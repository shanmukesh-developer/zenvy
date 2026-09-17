import React, { useState, useEffect, useRef } from 'react';
import { Image, ImageProps, ImageSourcePropType, View, Animated, StyleSheet } from 'react-native';

const LUXURY_FALLBACKS: Record<string, string> = {
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=600&q=75',
  rider: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=75',
  food: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=85',
  biryani: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=85',
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=85',
  pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=85',
  grocery: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=85',
  fruits: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=800&q=85',
  electronics: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&q=85',
  stationery: 'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=800&q=85',
  laundry: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=800&q=85',
  rides: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&q=85',
};

const DEFAULT_FALLBACK_URI = LUXURY_FALLBACKS.food;

function optimizeUri(uriString?: string | null): string {
  if (!uriString || typeof uriString !== 'string') return '';
  if (uriString.startsWith('data:')) return uriString;
  if (uriString.includes('images.unsplash.com')) {
    const base = uriString.split('?')[0];
    return `${base}?auto=format&fit=crop&w=600&q=75`;
  }
  return uriString;
}

function getSmartFallback(uriString?: string | null): string {
  if (!uriString) return DEFAULT_FALLBACK_URI;
  if (uriString.startsWith('data:image')) return LUXURY_FALLBACKS.avatar;
  const lower = uriString.toLowerCase();
  if (lower.includes('avatar') || lower.includes('profile') || lower.includes('user')) {
    return LUXURY_FALLBACKS.avatar;
  }
  if (lower.includes('rider') || lower.includes('driver') || lower.includes('captain')) {
    return LUXURY_FALLBACKS.rider;
  }
  for (const [key, fallback] of Object.entries(LUXURY_FALLBACKS)) {
    if (lower.includes(key)) return optimizeUri(fallback);
  }
  return DEFAULT_FALLBACK_URI;
}

interface SafeImageProps extends Omit<ImageProps, 'source'> {
  source?: ImageSourcePropType | { uri?: string | null } | null;
  fallbackUri?: string;
  fadeInDuration?: number;
}

export default function SafeImage({
  source,
  fallbackUri,
  style,
  onError,
  fadeInDuration = 280,
  ...props
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const rawUri = typeof source === 'object' && source && 'uri' in source ? (source.uri || '') : '';
  const isBase64OrLocal = typeof source === 'number' || rawUri.startsWith('data:');
  const resolvedFallback = fallbackUri || getSmartFallback(rawUri);

  const [imgSource, setImgSource] = useState<ImageSourcePropType>(() => {
    if (typeof source === 'number') return source;
    if (rawUri) return { uri: optimizeUri(rawUri) };
    return { uri: resolvedFallback };
  });

  const uriKey = typeof source === 'number' 
    ? String(source) 
    : (rawUri.startsWith('data:') ? `base64_${rawUri.slice(0, 40)}_${rawUri.length}` : rawUri);

  useEffect(() => {
    setHasError(false);

    if (!source) {
      setImgSource({ uri: resolvedFallback });
      setIsLoaded(true);
      fadeAnim.setValue(1);
      return;
    }

    if (typeof source === 'number') {
      setImgSource(source);
      setIsLoaded(true);
      fadeAnim.setValue(1);
    } else if (typeof source === 'object' && 'uri' in source) {
      if (!source.uri || typeof source.uri !== 'string' || source.uri.trim() === '') {
        setImgSource({ uri: resolvedFallback });
        setIsLoaded(true);
        fadeAnim.setValue(1);
      } else {
        const optimized = optimizeUri(source.uri);
        setImgSource({ uri: optimized });
        setIsLoaded(true);
        fadeAnim.setValue(1);
      }
    } else {
      setImgSource({ uri: resolvedFallback });
      setIsLoaded(true);
      fadeAnim.setValue(1);
    }
  }, [uriKey, resolvedFallback]);

  const handleLoad = () => {
    setIsLoaded(true);
    fadeAnim.setValue(1);
  };

  const handleError = (e: any) => {
    if (!hasError) {
      setHasError(true);
      setImgSource({ uri: resolvedFallback });
      setIsLoaded(true);
      fadeAnim.setValue(1);
    }
    if (onError) {
      onError(e);
    }
  };

  return (
    <View style={[style, styles.container, { overflow: 'hidden' }]}>
      <Animated.Image
        {...props}
        source={imgSource}
        style={[style, StyleSheet.absoluteFill, { opacity: fadeAnim }]}
        onLoad={handleLoad}
        onError={handleError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
  },
});
