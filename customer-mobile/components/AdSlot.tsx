import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export type AdPlacement = 'rail' | 'interstitial' | 'spotlight' | 'pdp_footer';

export interface AdCreative {
  id: string;
  placement: AdPlacement;
  title: string;
  subtitle: string;
  brand: string;
  imageUrl: string;
  targetUrl?: string;
  ctaText?: string;
}

// ── Dummy Ad Creative Resolver (Production-ready placeholder) ─────────────────
export const fetchAdCreative = async (placement: AdPlacement): Promise<AdCreative | null> => {
  // Simulate quick async network delay
  await new Promise((r) => setTimeout(r, 120));

  const ADS: Record<AdPlacement, AdCreative> = {
    spotlight: {
      id: 'ad-spotlight-campus-roasters',
      placement: 'spotlight',
      title: 'Campus Roasters',
      subtitle: 'Fuel for your late-night study sessions',
      brand: 'Campus Roasters',
      imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=500&q=80',
      targetUrl: 'https://zenvy.com/promos/roasters',
      ctaText: 'EXPLORE →',
    },
    interstitial: {
      id: 'ad-interstitial-study-kit',
      placement: 'interstitial',
      title: 'Premium Study Kit',
      subtitle: 'Everything you need for Finals week. Notebooks, highlighters & sticky notes.',
      brand: 'Stationery Pro',
      imageUrl: 'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=800&q=80',
      targetUrl: 'https://zenvy.com/category/stationary',
      ctaText: 'Shop Now',
    },
    rail: {
      id: 'ad-rail-monster-energy',
      placement: 'rail',
      title: 'Monster Energy Drink',
      subtitle: 'Unleash the Beast',
      brand: 'Monster Energy',
      imageUrl: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=500&q=80',
      targetUrl: 'https://zenvy.com/category/drinks',
      ctaText: '+ ADD',
    },
    pdp_footer: {
      id: 'ad-pdp-peanut-butter',
      placement: 'pdp_footer',
      title: 'Organic Peanut Butter',
      subtitle: 'The perfect pairing for whole wheat bread.',
      brand: 'NuttyDelight',
      imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&q=80',
      targetUrl: 'https://zenvy.com/products/peanut-butter',
      ctaText: 'Shop Now',
    },
  };

  return ADS[placement] || null;
};

// ── Ad Analytics Tracker ──────────────────────────────────────────────────────
export const trackAdEvent = (adId: string, eventType: 'impression' | 'click') => {
  if (__DEV__) {
    console.log(`[AD_ANALYTICS] ${eventType.toUpperCase()} logged for adId: ${adId}`);
  }
};

interface AdSlotProps {
  placement: AdPlacement;
  containerStyle?: any;
}

export default function AdSlot({ placement, containerStyle }: AdSlotProps) {
  const [ad, setAd] = useState<AdCreative | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasImpressionTracked, setHasImpressionTracked] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchAdCreative(placement)
      .then((data) => {
        if (mounted) {
          setAd(data);
          setLoading(false);
          if (data && !hasImpressionTracked) {
            trackAdEvent(data.id, 'impression');
            setHasImpressionTracked(true);
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setAd(null);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [placement]);

  const handleClick = () => {
    if (!ad) return;
    trackAdEvent(ad.id, 'click');
    if (ad.targetUrl) {
      Linking.openURL(ad.targetUrl).catch(() => {});
    }
  };

  // Zero-height collapse when loading or empty ad
  if (loading) {
    return (
      <View style={[styles.skeleton, placement === 'interstitial' && styles.interstitialSkeleton, containerStyle]}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  if (!ad) {
    return null; // Collapses completely to zero height
  }

  if (placement === 'spotlight') {
    return (
      <TouchableOpacity
        style={[styles.spotlightCard, containerStyle]}
        activeOpacity={0.88}
        onPress={handleClick}
      >
        <Image source={{ uri: ad.imageUrl }} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(20, 19, 31, 0.95)', 'rgba(20, 19, 31, 0.4)']}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.adTagPill}>
          <Text style={styles.adTagText}>Ad</Text>
        </View>
        <View style={styles.spotlightContent}>
          <Text style={styles.spotlightTitle}>{ad.title}</Text>
          <Text style={styles.spotlightSub} numberOfLines={1}>
            {ad.subtitle}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (placement === 'interstitial') {
    return (
      <TouchableOpacity
        style={[styles.interstitialCard, containerStyle]}
        activeOpacity={0.9}
        onPress={handleClick}
      >
        <Image source={{ uri: ad.imageUrl }} style={styles.interstitialImg} />
        <LinearGradient
          colors={['transparent', 'rgba(20, 19, 31, 0.85)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.sponsoredBadge}>
          <Text style={styles.sponsoredBadgeText}>SPONSORED</Text>
        </View>
        <View style={styles.interstitialInfo}>
          <Text style={styles.interstitialTitle}>{ad.title}</Text>
          <Text style={styles.interstitialDesc}>{ad.subtitle}</Text>
          <View style={styles.interstitialCtaBtn}>
            <Text style={styles.interstitialCtaText}>{ad.ctaText || 'Shop Now'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (placement === 'pdp_footer') {
    return (
      <View style={[styles.pdpFooterBox, containerStyle]}>
        <View style={styles.pdpHeaderRow}>
          <Text style={styles.pdpAdLabel}>Sponsored</Text>
        </View>
        <TouchableOpacity style={styles.pdpInnerCard} activeOpacity={0.88} onPress={handleClick}>
          <Image source={{ uri: ad.imageUrl }} style={styles.pdpThumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pdpTitle}>{ad.title}</Text>
            <Text style={styles.pdpSub} numberOfLines={2}>
              {ad.subtitle}
            </Text>
            <Text style={styles.pdpBrandText}>{ad.brand}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // Rail default fallback
  return (
    <TouchableOpacity style={[styles.railCard, containerStyle]} activeOpacity={0.85} onPress={handleClick}>
      <Image source={{ uri: ad.imageUrl }} style={styles.railImg} />
      <View style={styles.adTagPill}>
        <Text style={styles.adTagText}>Ad</Text>
      </View>

      <Text style={styles.railTitle} numberOfLines={1}>
        {ad.title}
      </Text>
      <Text style={styles.railSub} numberOfLines={1}>
        {ad.subtitle}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  interstitialSkeleton: {
    height: 120,
  },
  spotlightCard: {
    width: 140,
    height: 80,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    position: 'relative',
    marginRight: 10,
    ...SHADOWS.cardElevated,
  },
  adTagPill: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 5,
  },
  adTagText: {
    fontSize: 8,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
  },
  spotlightContent: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
  },
  spotlightTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFF',
  },
  spotlightSub: {
    fontSize: 8,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  interstitialCard: {
    width: '100%',
    height: 160,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    position: 'relative',
    marginVertical: 14,
    ...SHADOWS.cardElevated,
  },
  interstitialImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    resizeMode: 'cover',
  },
  sponsoredBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  sponsoredBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  interstitialInfo: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
  },
  interstitialTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
  },
  interstitialDesc: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    marginBottom: 8,
  },
  interstitialCtaBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
  },
  interstitialCtaText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  pdpFooterBox: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(108, 43, 217, 0.15)',
    backgroundColor: COLORS.primarySoft,
    padding: 12,
    marginVertical: 16,
  },
  pdpHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pdpAdLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pdpInnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pdpThumb: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    backgroundColor: '#FFF',
  },
  pdpTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.ink,
  },
  pdpSub: {
    fontSize: 10,
    color: COLORS.inkMuted,
    marginTop: 2,
  },
  pdpBrandText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 4,
  },
  railCard: {
    width: 120,
    borderRadius: RADIUS.lg,
    backgroundColor: '#FFF',
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginRight: 10,
  },
  railImg: {
    width: '100%',
    height: 80,
    borderRadius: RADIUS.md,
    marginBottom: 6,
  },
  railTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.ink,
  },
  railSub: {
    fontSize: 9,
    color: COLORS.inkMuted,
  },
});
