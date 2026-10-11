import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { color, radius, space, type } from '../../theme/tokens';

export function Toast({ toast, bottom }: { toast: { id: number; text: string; kind: 'info' | 'success' | 'error' } | null; bottom: number }) {
  const [shown, setShown] = useState(toast);
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!toast) return;
    setShown(toast);
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setShown(null));
    }, Math.min(6000, 2500 + toast.text.length * 30));
    return () => clearTimeout(t);
  }, [toast, opacity]);
  if (!shown) return null;
  const bg = shown.kind === 'error' ? color.danger : shown.kind === 'success' ? color.onlineDark : color.primary;
  const icon = shown.kind === 'error' ? 'alert-circle' : shown.kind === 'success' ? 'check-circle' : 'information';
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { backgroundColor: bg, bottom, opacity }]} accessibilityLiveRegion="polite">
      <MaterialCommunityIcons name={icon} size={22} color={color.textInverse} />
      <Text style={[type.body, { color: color.textInverse, flex: 1, fontWeight: '700' }]}>{shown.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.lg,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
