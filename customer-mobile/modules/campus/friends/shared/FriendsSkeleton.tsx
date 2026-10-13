import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, AccessibilityInfo, Easing, StyleSheet, DimensionValue } from 'react-native';
import { FriendsColors, FS, FR } from '../friendsTheme';

/** Pulsing block for dark surfaces (still when the user prefers reduced motion). */
export const SkeletonBlock: React.FC<{ width: DimensionValue; height: number; radius?: number }> = ({ width, height, radius = 8 }) => {
  const opacity = useRef(new Animated.Value(0.5)).current;
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(!!v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, opacity]);

  return <Animated.View style={{ width, height, borderRadius: radius, backgroundColor: FriendsColors.cardHi, opacity: reduce ? 0.8 : opacity }} />;
};

/** Loading placeholder for Friends lists (posts, threads, tasks, people). */
export const FriendsSkeleton: React.FC<{ rows?: number; variant?: 'post' | 'row' }> = ({ rows = 4, variant = 'post' }) => (
  <View style={{ padding: FS.lg, gap: FS.md }} accessibilityLabel="Loading" accessibilityRole="progressbar">
    {Array.from({ length: rows }).map((_, i) => (
      <View key={i} style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: FS.md }}>
          <SkeletonBlock width={40} height={40} radius={20} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBlock width="45%" height={12} />
            <SkeletonBlock width="25%" height={10} />
          </View>
        </View>
        {variant === 'post' ? (
          <View style={{ gap: 8, marginTop: FS.md }}>
            <SkeletonBlock width="95%" height={12} />
            <SkeletonBlock width="80%" height={12} />
            <SkeletonBlock width="55%" height={12} />
          </View>
        ) : null}
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: FriendsColors.card,
    borderRadius: FR.card,
    borderWidth: 1,
    borderColor: FriendsColors.line,
    padding: FS.lg,
  },
});
