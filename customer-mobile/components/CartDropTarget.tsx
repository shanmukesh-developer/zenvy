/**
 * A landing spot for the add-to-cart photo (components/CartDropFx, owner 27 Nov 2026: "the animation should go into
 * the View basket bar"). Wrap a basket bar or basket button in <CartDropTarget>: while its screen is focused it
 * registers with utils/cartFx; the flying photo lands in its centre and it gives a short squash-and-bounce.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, type StyleProp, type View, type ViewStyle } from 'react-native';
import { useIsFocused } from 'expo-router';
import { registerDropTarget } from '../utils/cartFx';

export default function CartDropTarget({ priority = 1, style, children }: { priority?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const ref = useRef<View>(null);
  const bounce = useRef(new Animated.Value(0)).current;
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    return registerDropTarget({
      priority,
      measure: () => new Promise((resolve) => {
        const node: any = ref.current;
        if (!node || typeof node.measureInWindow !== 'function') { resolve(null); return; }
        node.measureInWindow((x: number, y: number, w: number, h: number) => {
          const { width, height } = Dimensions.get('window');
          const cx = x + w / 2;
          const cy = y + h / 2;
          resolve(w > 0 && h > 0 && cx >= 0 && cx <= width && cy >= 0 && cy <= height ? { x: cx, y: cy } : null);
        });
      }),
      land: () => {
        bounce.setValue(0);
        Animated.sequence([
          Animated.timing(bounce, { toValue: 1, duration: 110, useNativeDriver: true }),
          Animated.spring(bounce, { toValue: 0, friction: 4, tension: 180, useNativeDriver: true }),
        ]).start();
      },
    });
  }, [focused, priority, bounce]);
  const scaleX = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const scaleY = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] });
  return (
    <Animated.View ref={ref as any} collapsable={false} style={[style, { transform: [{ scaleX }, { scaleY }] }]}>
      {children}
    </Animated.View>
  );
}

/**
 * Hook form for a bar that cannot be wrapped (absolutely positioned, or a fixed layout): put the returned ref on the
 * bar itself. The photo still lands in its centre with the yellow ripple; there is no squash on the bar.
 */
export function useCartDropTargetRef(priority = 2) {
  const ref = useRef<any>(null);
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    return registerDropTarget({
      priority,
      measure: () => new Promise((resolve) => {
        const node: any = ref.current;
        if (!node || typeof node.measureInWindow !== 'function') { resolve(null); return; }
        node.measureInWindow((x: number, y: number, w: number, h: number) => {
          const { width, height } = Dimensions.get('window');
          const cx = x + w / 2;
          const cy = y + h / 2;
          resolve(w > 0 && h > 0 && cx >= 0 && cx <= width && cy >= 0 && cy <= height ? { x: cx, y: cy } : null);
        });
      }),
      land: () => {},
    });
  }, [focused, priority]);
  return ref;
}
