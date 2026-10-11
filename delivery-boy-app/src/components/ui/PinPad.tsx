import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { color, radius, space, type } from '../../theme/tokens';

/** 4 PIN boxes + a big 3x4 keypad (works one-handed, no keyboard popping up). */
export function PinPad({
  value,
  onChange,
  disabled,
  shakeKey,
  length = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** change this number to shake the boxes (wrong PIN) */
  shakeKey?: number;
  length?: number;
}) {
  const shake = useRef(new Animated.Value(0)).current;
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
    if (k === 'del') onChange(value.slice(0, -1));
    else if (value.length < length) onChange(value + k);
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return (
    <View style={{ gap: space.md }}>
      <Animated.View
        style={[styles.boxes, { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) }] }]}
        accessibilityLabel={`PIN, ${value.length} of ${length} digits entered`}
      >
        {Array.from({ length }).map((_, i) => (
          <View key={i} style={[styles.box, i === value.length && !disabled && styles.boxActive]}>
            <Text style={[type.title1, { color: color.text }]}>{value[i] ?? ''}</Text>
          </View>
        ))}
      </Animated.View>
      <View style={styles.pad}>
        {keys.map((k, i) =>
          k === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={k === 'del' ? 'Delete digit' : `Digit ${k}`}
              disabled={disabled}
              onPress={() => press(k)}
              style={({ pressed }) => [styles.key, styles.keyBtn, pressed && { backgroundColor: color.border }, disabled && { opacity: 0.4 }]}
            >
              {k === 'del' ? (
                <MaterialCommunityIcons name="backspace-outline" size={26} color={color.text} />
              ) : (
                <Text style={[type.title1, { color: color.text }]}>{k}</Text>
              )}
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  box: {
    width: 60,
    height: 68,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: color.text },
  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.xs },
  key: { width: '31.5%', height: 58, alignItems: 'center', justifyContent: 'center' },
  keyBtn: { backgroundColor: color.surfaceAlt, borderRadius: radius.md },
});
