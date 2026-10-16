// 4 PIN boxes + a big 3x4 keypad (one-handed, no system keyboard). From delivery-boy-app/src/ui/PinPad.tsx,
// re-themed for this app.
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../theme';

export function PinPad({
  value, onChange, disabled, shakeKey, length = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** change this number to shake the boxes (wrong PIN) */
  shakeKey?: number;
  length?: number;
}) {
  const shake = useRef(new Animated.Value(0)).current;
  // Latest value between renders: two quick taps in one frame must not drop a digit.
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    if (!shakeKey) return;
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeKey, shake]);

  const press = (k: string) => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => {});
    const cur = latest.current;
    let next = cur;
    if (k === 'clear') next = '';
    else if (k === 'del') next = cur.slice(0, -1);
    else if (cur.length < length) next = cur + k;
    if (next === cur) return;
    latest.current = next;
    onChange(next);
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];
  return (
    <View style={{ gap: space.md }}>
      <Animated.View
        style={[styles.boxes, { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-12, 12] }) }] }]}
        accessibilityLabel={`PIN, ${value.length} of ${length} digits entered`}
      >
        {Array.from({ length }).map((_, i) => (
          <View key={i} style={[styles.box, !!value[i] && styles.boxFilled, i === value.length && !disabled && styles.boxActive]}>
            <Text style={[font.h1, { color: color.text }]}>{value[i] ?? ''}</Text>
          </View>
        ))}
      </Animated.View>
      <View style={styles.pad}>
        {keys.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityLabel={k === 'del' ? 'Delete digit' : k === 'clear' ? 'Clear PIN' : `Digit ${k}`}
            disabled={disabled}
            onPress={() => press(k)}
            style={({ pressed }) => [styles.key, pressed && { backgroundColor: color.border }, disabled && { opacity: 0.4 }]}
          >
            {k === 'del' ? (
              <MaterialCommunityIcons name="backspace-outline" size={28} color={color.text} />
            ) : k === 'clear' ? (
              <Text style={[font.body, { color: color.textMuted, fontWeight: '800' }]}>CLEAR</Text>
            ) : (
              <Text style={[font.h1, { color: color.text }]}>{k}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: space.md },
  box: { width: 62, height: 70, borderRadius: radius.md, borderWidth: 2, borderColor: color.border, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  boxFilled: { backgroundColor: color.openTint, borderColor: color.open },
  boxActive: { borderColor: color.text, borderWidth: 3 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.sm },
  key: { width: '31.5%', height: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceAlt, borderRadius: radius.md },
});
