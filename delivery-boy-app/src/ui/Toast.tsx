import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { C, R, S, T } from '../theme';

export type ToastKind = 'info' | 'success' | 'error';
export interface ToastMsg {
  id: number;
  text: string;
  kind: ToastKind;
}

export function Toast({ toast, bottom }: { toast: ToastMsg | null; bottom: number }) {
  const [shown, setShown] = useState<ToastMsg | null>(toast);
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
  const bg = shown.kind === 'error' ? C.red : shown.kind === 'success' ? C.greenDark : C.ink;
  const icon = shown.kind === 'error' ? 'alert-circle' : shown.kind === 'success' ? 'check-circle' : 'information';
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { backgroundColor: bg, bottom, opacity }]} accessibilityLiveRegion="polite">
      <MaterialCommunityIcons name={icon} size={22} color={C.white} />
      <Text style={[T.body, { color: C.white, flex: 1, fontWeight: '700' }]}>{shown.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: S.lg,
    right: S.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    padding: S.lg,
    borderRadius: R.lg,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
