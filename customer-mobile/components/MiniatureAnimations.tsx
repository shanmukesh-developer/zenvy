import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import SafeImage from './SafeImage';

// ── 1. REALISTIC VIP GOLD MEDALLION (ZENVY VIP PASS) ──────────────────────
export const MiniatureScooterRider = ({ size = 105 }: { size?: number }) => {
  const levitateAnim = useRef(new Animated.Value(0)).current;
  const pulseAura = useRef(new Animated.Value(1)).current;
  const sheenAnim = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(levitateAnim, {
          toValue: -7,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(levitateAnim, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAura, {
          toValue: 1.15,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAura, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(sheenAnim, {
          toValue: 1.5,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.delay(1800),
        Animated.timing(sheenAnim, {
          toValue: -1,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const plateSize = size * 0.84;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* 24K Gold Ambient Glow Ring */}
      <Animated.View
        style={[
          styles.goldAuraGlow,
          {
            width: size * 0.94,
            height: size * 0.94,
            borderRadius: (size * 0.94) / 2,
            transform: [{ scale: pulseAura }],
          },
        ]}
      />

      {/* Floating Realistic Medallion */}
      <Animated.View
        style={[
          styles.podFloatingWrapper,
          {
            width: plateSize,
            height: plateSize,
            transform: [{ translateY: levitateAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.realisticGlassPod,
            styles.goldPodBorder,
            {
              width: plateSize,
              height: plateSize,
              borderRadius: plateSize / 2,
            },
          ]}
        >
          {/* Photorealistic Royal Gold Crown Backdrop */}
          <SafeImage
            source={{
              uri: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=400&q=90&auto=format&fit=crop',
            }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />

          {/* Obsidian Glass Gradient Scrim */}
          <LinearGradient
            colors={['rgba(23, 18, 12, 0.4)', 'rgba(15, 11, 7, 0.88)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Specular Diagonal Sheen Sweep */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.podSheenSweep,
              {
                transform: [
                  {
                    translateX: sheenAnim.interpolate({
                      inputRange: [-1, 1.5],
                      outputRange: [-plateSize, plateSize * 1.5],
                    }),
                  },
                  { rotate: '30deg' },
                ],
              },
            ]}
          />

          {/* Center 3D Crown Crest Graphic */}
          <View style={styles.centerIconContainer}>
            <Text style={{ fontSize: 26, textShadowColor: '#F59E0B', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 }}>
              👑
            </Text>
          </View>
        </View>

        {/* Sleek Metallic 0 FEE Capsule */}
        <View style={styles.floatingBadgeContainer}>
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.sleekCapsulePill, { borderColor: 'rgba(254, 240, 138, 0.65)' }]}
          >
            <Text numberOfLines={1} style={[styles.sleekCapsuleText, { color: '#000000' }]}>★ 0 FEE VIP</Text>
          </LinearGradient>
        </View>
      </Animated.View>
    </View>
  );
};

// ── 2. REALISTIC HYDERABADI DUM BIRYANI (STEAMING HANDI) ──────────────────
export const MiniatureBiryaniFeast = ({ size = 105 }: { size?: number }) => {
  const potFloat = useRef(new Animated.Value(0)).current;
  const pulseAura = useRef(new Animated.Value(1)).current;
  const steam1Y = useRef(new Animated.Value(0)).current;
  const steam1Op = useRef(new Animated.Value(0.9)).current;
  const steam2Y = useRef(new Animated.Value(0)).current;
  const steam2Op = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    // Gentle Float
    Animated.loop(
      Animated.sequence([
        Animated.timing(potFloat, {
          toValue: -6,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(potFloat, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Saffron Aura Pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAura, {
          toValue: 1.14,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAura, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Steam Wisps
    Animated.loop(
      Animated.parallel([
        Animated.timing(steam1Y, {
          toValue: -15,
          duration: 1300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(steam1Op, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(steam1Op, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ]),
      ])
    ).start();

    setTimeout(() => {
      Animated.loop(
        Animated.parallel([
          Animated.timing(steam2Y, {
            toValue: -16,
            duration: 1500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(steam2Op, { toValue: 0.9, duration: 400, useNativeDriver: true }),
            Animated.timing(steam2Op, { toValue: 0, duration: 1100, useNativeDriver: true }),
          ]),
        ])
      ).start();
    }, 400);
  }, []);

  const plateSize = size * 0.84;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Warm Golden Embers Aura Glow */}
      <Animated.View
        style={[
          styles.biryaniAuraGlow,
          {
            width: size * 0.94,
            height: size * 0.94,
            borderRadius: (size * 0.94) / 2,
            transform: [{ scale: pulseAura }],
          },
        ]}
      />

      {/* Floating Realistic Biryani Aperture Pod */}
      <Animated.View
        style={[
          styles.podFloatingWrapper,
          {
            width: plateSize,
            height: plateSize,
            transform: [{ translateY: potFloat }],
          },
        ]}
      >
        <View
          style={[
            styles.realisticGlassPod,
            styles.biryaniPodBorder,
            {
              width: plateSize,
              height: plateSize,
              borderRadius: plateSize / 2,
            },
          ]}
        >
          {/* Photorealistic Authentic Royal Dum Biryani Dish */}
          <SafeImage
            source={{
              uri: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&q=95&auto=format&fit=crop',
            }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />

          {/* Amber & Charcoal Vignette */}
          <LinearGradient
            colors={['rgba(20, 12, 6, 0.1)', 'rgba(12, 8, 4, 0.75)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Animated Realistic Hot Steam Wisps */}
          <Animated.View
            style={[
              styles.steamWispLeft,
              { transform: [{ translateY: steam1Y }], opacity: steam1Op },
            ]}
          >
            <Text style={{ fontSize: 13, color: '#FFF2A3', opacity: 0.9 }}>♨️</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.steamWispRight,
              { transform: [{ translateY: steam2Y }], opacity: steam2Op },
            ]}
          >
            <Text style={{ fontSize: 12, color: '#FFFFFF', opacity: 0.85 }}>♨️</Text>
          </Animated.View>

          {/* Top Floating Spice Spark */}
          <View style={styles.topFlameSpark}>
            <Text style={{ fontSize: 11 }}>🔥</Text>
          </View>
        </View>

        {/* High-Class 4.9 Rated Capsule */}
        <View style={styles.floatingBadgeContainer}>
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.sleekCapsulePill, { borderColor: 'rgba(254, 243, 199, 0.65)' }]}
          >
            <Text numberOfLines={1} style={[styles.sleekCapsuleText, { color: '#000000' }]}>★ 4.9 BIRYANI</Text>
          </LinearGradient>
        </View>
      </Animated.View>
    </View>
  );
};

// ── 3. REALISTIC KFC CRISPY CHICKEN BUCKET ─────────────────────────────────
export const MiniatureKfcBucket = ({ size = 105 }: { size?: number }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAura = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -7,
          duration: 950,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 950,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAura, { toValue: 1.15, duration: 1300, useNativeDriver: true }),
        Animated.timing(pulseAura, { toValue: 1, duration: 1300, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const plateSize = size * 0.84;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.kfcAuraGlow,
          {
            width: size * 0.94,
            height: size * 0.94,
            borderRadius: (size * 0.94) / 2,
            transform: [{ scale: pulseAura }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.podFloatingWrapper,
          {
            width: plateSize,
            height: plateSize,
            transform: [{ translateY: floatAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.realisticGlassPod,
            styles.kfcPodBorder,
            {
              width: plateSize,
              height: plateSize,
              borderRadius: plateSize / 2,
            },
          ]}
        >
          <SafeImage
            source={{
              uri: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=500&q=95&auto=format&fit=crop',
            }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />

          <LinearGradient
            colors={['rgba(20, 5, 5, 0.1)', 'rgba(20, 5, 5, 0.78)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.topFlameSpark}>
            <Text style={{ fontSize: 12 }}>⚡</Text>
          </View>
        </View>

        <View style={styles.floatingBadgeContainer}>
          <LinearGradient
            colors={['#EF4444', '#B91C1C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.sleekCapsulePill, { borderColor: 'rgba(254, 202, 202, 0.55)' }]}
          >
            <Text numberOfLines={1} style={[styles.sleekCapsuleText, { color: '#FFFFFF' }]}>🍗 CRISPY BUCKET</Text>
          </LinearGradient>
        </View>
      </Animated.View>
    </View>
  );
};

// ── 4. REALISTIC MEGA BASKET (APARTMENT BULK BASKET) ───────────────────────
export const MiniatureMegaBasket = ({ size = 105 }: { size?: number }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 1050,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1050,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const plateSize = size * 0.84;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.basketAuraGlow, { width: size * 0.94, height: size * 0.94, borderRadius: (size * 0.94) / 2 }]} />
      <Animated.View
        style={[
          styles.podFloatingWrapper,
          {
            width: plateSize,
            height: plateSize,
            transform: [{ translateY: floatAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.realisticGlassPod,
            styles.basketPodBorder,
            {
              width: plateSize,
              height: plateSize,
              borderRadius: plateSize / 2,
            },
          ]}
        >
          <SafeImage
            source={{
              uri: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&q=95&auto=format&fit=crop',
            }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />

          <LinearGradient
            colors={['rgba(25, 12, 5, 0.1)', 'rgba(25, 12, 5, 0.78)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.topFlameSpark}>
            <Text style={{ fontSize: 11 }}>🛒</Text>
          </View>
        </View>

        <View style={styles.floatingBadgeContainer}>
          <LinearGradient
            colors={['#F97316', '#EA580C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.sleekCapsulePill, { borderColor: 'rgba(254, 215, 170, 0.65)' }]}
          >
            <Text numberOfLines={1} style={[styles.sleekCapsuleText, { color: '#FFFFFF' }]}>⚡ 1-CART MULTI</Text>
          </LinearGradient>
        </View>
      </Animated.View>
    </View>
  );
};

// ── 5. REALISTIC AFTER DARK (3 AM LATE NIGHT DINER) ────────────────────────
export const MiniatureAfterDark = ({ size = 105 }: { size?: number }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -7,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const plateSize = size * 0.84;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.afterdarkAuraGlow, { width: size * 0.94, height: size * 0.94, borderRadius: (size * 0.94) / 2 }]} />
      <Animated.View
        style={[
          styles.podFloatingWrapper,
          {
            width: plateSize,
            height: plateSize,
            transform: [{ translateY: floatAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.realisticGlassPod,
            styles.afterdarkPodBorder,
            {
              width: plateSize,
              height: plateSize,
              borderRadius: plateSize / 2,
            },
          ]}
        >
          <SafeImage
            source={{
              uri: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&q=95&auto=format&fit=crop',
            }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />

          <LinearGradient
            colors={['rgba(15, 6, 25, 0.1)', 'rgba(15, 6, 25, 0.82)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.topFlameSpark}>
            <Text style={{ fontSize: 11, color: '#C084FC' }}>🌙</Text>
          </View>
        </View>

        <View style={styles.floatingBadgeContainer}>
          <LinearGradient
            colors={['#A855F7', '#7E22CE']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.sleekCapsulePill, { borderColor: 'rgba(233, 213, 255, 0.6)' }]}
          >
            <Text numberOfLines={1} style={[styles.sleekCapsuleText, { color: '#FFFFFF' }]}>🌙 OPEN TILL 3AM</Text>
          </LinearGradient>
        </View>
      </Animated.View>
    </View>
  );
};

// ── 6. REALISTIC SRM CAMPUS BUDDY ─────────────────────────────────────────
export const MiniatureCampusSync = ({ size = 105 }: { size?: number }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const plateSize = size * 0.84;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.campusAuraGlow, { width: size * 0.94, height: size * 0.94, borderRadius: (size * 0.94) / 2 }]} />
      <Animated.View
        style={[
          styles.podFloatingWrapper,
          {
            width: plateSize,
            height: plateSize,
            transform: [{ translateY: floatAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.realisticGlassPod,
            styles.campusPodBorder,
            {
              width: plateSize,
              height: plateSize,
              borderRadius: plateSize / 2,
            },
          ]}
        >
          <SafeImage
            source={{
              uri: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=500&q=95&auto=format&fit=crop',
            }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />

          <LinearGradient
            colors={['rgba(7, 19, 41, 0.1)', 'rgba(7, 19, 41, 0.8)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.topFlameSpark}>
            <Text style={{ fontSize: 11 }}>🎓</Text>
          </View>
        </View>

        <View style={styles.floatingBadgeContainer}>
          <LinearGradient
            colors={['#3B82F6', '#1D4ED8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.sleekCapsulePill, { borderColor: 'rgba(191, 219, 254, 0.6)' }]}
          >
            <Text numberOfLines={1} style={[styles.sleekCapsuleText, { color: '#FFFFFF' }]}>🎓 SRM BUDDY</Text>
          </LinearGradient>
        </View>
      </Animated.View>
    </View>
  );
};

// ── 7. REALISTIC ZENVY CO-RIDE (BIKE POOL) ────────────────────────────────
export const MiniatureCoRide = ({ size = 105 }: { size?: number }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const plateSize = size * 0.84;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.rideAuraGlow, { width: size * 0.94, height: size * 0.94, borderRadius: (size * 0.94) / 2 }]} />
      <Animated.View
        style={[
          styles.podFloatingWrapper,
          {
            width: plateSize,
            height: plateSize,
            transform: [{ translateY: floatAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.realisticGlassPod,
            styles.ridePodBorder,
            {
              width: plateSize,
              height: plateSize,
              borderRadius: plateSize / 2,
            },
          ]}
        >
          <SafeImage
            source={{
              uri: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&q=95&auto=format&fit=crop',
            }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />

          <LinearGradient
            colors={['rgba(8, 22, 28, 0.1)', 'rgba(8, 22, 28, 0.8)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.topFlameSpark}>
            <Text style={{ fontSize: 11 }}>🚲</Text>
          </View>
        </View>

        <View style={styles.floatingBadgeContainer}>
          <LinearGradient
            colors={['#06B6D4', '#0891B2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.sleekCapsulePill, { borderColor: 'rgba(165, 243, 252, 0.65)' }]}
          >
            <Text numberOfLines={1} style={[styles.sleekCapsuleText, { color: '#000000' }]}>🚲 SPLIT RIDE</Text>
          </LinearGradient>
        </View>
      </Animated.View>
    </View>
  );
};

// ── 8. REALISTIC VERIFIED CAMPUS STAYS (PG & HOSTELS) ─────────────────────
export const MiniatureCampusStays = ({ size = 105 }: { size?: number }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const plateSize = size * 0.84;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.staysAuraGlow, { width: size * 0.94, height: size * 0.94, borderRadius: (size * 0.94) / 2 }]} />
      <Animated.View
        style={[
          styles.podFloatingWrapper,
          {
            width: plateSize,
            height: plateSize,
            transform: [{ translateY: floatAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.realisticGlassPod,
            styles.staysPodBorder,
            {
              width: plateSize,
              height: plateSize,
              borderRadius: plateSize / 2,
            },
          ]}
        >
          <SafeImage
            source={{
              uri: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=500&q=95&auto=format&fit=crop',
            }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />

          <LinearGradient
            colors={['rgba(6, 26, 20, 0.1)', 'rgba(6, 26, 20, 0.82)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.topFlameSpark}>
            <Text style={{ fontSize: 11 }}>🏠</Text>
          </View>
        </View>

        <View style={styles.floatingBadgeContainer}>
          <LinearGradient
            colors={['#10B981', '#047857']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.sleekCapsulePill, { borderColor: 'rgba(167, 243, 208, 0.65)' }]}
          >
            <Text numberOfLines={1} style={[styles.sleekCapsuleText, { color: '#FFFFFF' }]}>🏠 VERIFIED PG</Text>
          </LinearGradient>
        </View>
      </Animated.View>
    </View>
  );
};

// ── 9. REALISTIC ZERO-WAIT EXPRESS CANTEEN ─────────────────────────────────
export const MiniatureExpressPickup = ({ size = 105 }: { size?: number }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -7,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const plateSize = size * 0.84;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.expressAuraGlow, { width: size * 0.94, height: size * 0.94, borderRadius: (size * 0.94) / 2 }]} />
      <Animated.View
        style={[
          styles.podFloatingWrapper,
          {
            width: plateSize,
            height: plateSize,
            transform: [{ translateY: floatAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.realisticGlassPod,
            styles.expressPodBorder,
            {
              width: plateSize,
              height: plateSize,
              borderRadius: plateSize / 2,
            },
          ]}
        >
          <SafeImage
            source={{
              uri: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&q=95&auto=format&fit=crop',
            }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />

          <LinearGradient
            colors={['rgba(24, 20, 10, 0.1)', 'rgba(24, 20, 10, 0.82)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.topFlameSpark}>
            <Text style={{ fontSize: 11 }}>⚡</Text>
          </View>
        </View>

        <View style={styles.floatingBadgeContainer}>
          <LinearGradient
            colors={['#FBBF24', '#D97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.sleekCapsulePill, { borderColor: 'rgba(254, 240, 138, 0.65)' }]}
          >
            <Text numberOfLines={1} style={[styles.sleekCapsuleText, { color: '#000000' }]}>⚡ 10-MIN PICKUP</Text>
          </LinearGradient>
        </View>
      </Animated.View>
    </View>
  );
};

// ── 10. REALISTIC BLINKING MASCOT / CASH ───────────────────────────────────
export const MiniatureBlinkingMascot = ({ size = 105, cashAmount = '₹50' }: { size?: number; cashAmount?: string }) => {
  const plateSize = size * 0.84;
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View
        style={[
          styles.podFloatingWrapper,
          { width: plateSize, height: plateSize },
        ]}
      >
        <View
          style={[
            styles.realisticGlassPod,
            styles.kfcPodBorder,
            { width: plateSize, height: plateSize, borderRadius: plateSize / 2 },
          ]}
        >
          <SafeImage
            source={{
              uri: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=500&q=90&auto=format&fit=crop',
            }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(255, 46, 116, 0.2)', 'rgba(15, 7, 10, 0.82)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={styles.floatingBadgeContainer}>
          <LinearGradient
            colors={['#EC4899', '#BE185D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.sleekCapsulePill, { borderColor: 'rgba(251, 207, 232, 0.6)' }]}
          >
            <Text numberOfLines={1} style={[styles.sleekCapsuleText, { color: '#FFFFFF' }]}>🎁 {cashAmount} BONUS</Text>
          </LinearGradient>
        </View>
      </View>
    </View>
  );
};

// ── 11. WELCOME TRACKER ───────────────────────────────────────────────────
export const MiniatureWelcomeTracker = () => {
  return (
    <View style={{ padding: 8, alignItems: 'center' }}>
      <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>🎁 ₹100 Welcome Benefits</Text>
    </View>
  );
};

// ── LUXURY STYLES ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Outer Floating Container (Holds both circle pod and overlapping badge)
  podFloatingWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Realistic Aperture Lens Pod
  realisticGlassPod: {
    overflow: 'hidden',
    borderWidth: 2.2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F0F14',
    elevation: 10,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.65,
    shadowRadius: 14,
  },

  // Floating Overlapping Badge Container (Never clipped by circle!)
  floatingBadgeContainer: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    zIndex: 30,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.65,
    shadowRadius: 5,
  },

  // Pod Border Themes
  goldPodBorder: {
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
  },
  biryaniPodBorder: {
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
  },
  kfcPodBorder: {
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  basketPodBorder: {
    borderColor: '#EA580C',
    shadowColor: '#EA580C',
  },
  afterdarkPodBorder: {
    borderColor: '#A855F7',
    shadowColor: '#A855F7',
  },
  campusPodBorder: {
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
  },
  ridePodBorder: {
    borderColor: '#06B6D4',
    shadowColor: '#06B6D4',
  },
  staysPodBorder: {
    borderColor: '#10B981',
    shadowColor: '#10B981',
  },
  expressPodBorder: {
    borderColor: '#EAB308',
    shadowColor: '#EAB308',
  },

  // Glowing Outer Auras
  goldAuraGlow: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
  },
  biryaniAuraGlow: {
    position: 'absolute',
    borderWidth: 2.2,
    borderColor: 'rgba(245, 158, 11, 0.65)',
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 22,
  },
  kfcAuraGlow: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.55)',
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
  },
  basketAuraGlow: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(234, 88, 12, 0.55)',
    backgroundColor: 'rgba(234, 88, 12, 0.18)',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
  },
  afterdarkAuraGlow: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(168, 85, 247, 0.55)',
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
    shadowColor: '#9333EA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
  },
  campusAuraGlow: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.55)',
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
  },
  rideAuraGlow: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.55)',
    backgroundColor: 'rgba(6, 182, 212, 0.18)',
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
  },
  staysAuraGlow: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.55)',
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
  },
  expressAuraGlow: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(234, 179, 8, 0.55)',
    backgroundColor: 'rgba(234, 179, 8, 0.18)',
    shadowColor: '#EAB308',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
  },

  // Sleek Frosted Glass Capsule Pill
  sleekCapsulePill: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
    maxWidth: 96,
  },
  sleekCapsuleText: {
    fontSize: 7.2,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    includeFontPadding: false,
  },

  centerIconContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sheen Light Sweep Bar
  podSheenSweep: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    zIndex: 15,
  },

  // Steam Whisps
  steamWispLeft: {
    position: 'absolute',
    top: 6,
    left: 20,
    zIndex: 15,
  },
  steamWispRight: {
    position: 'absolute',
    top: 4,
    right: 20,
    zIndex: 15,
  },

  topFlameSpark: {
    position: 'absolute',
    top: 4,
    right: 8,
    zIndex: 15,
  },
});
