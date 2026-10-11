import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { color, radius, type } from '../../theme/tokens';

/** Visual offer timer. The server has no reject/expiry: when it ends the card is just hidden locally. */
export function CountdownBar({ seconds, onExpire, paused }: { seconds: number; onExpire: () => void; paused?: boolean }) {
  const progress = useRef(new Animated.Value(1)).current;
  const [left, setLeft] = useState(seconds);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    if (paused) return;
    progress.setValue(1);
    setLeft(seconds);
    const anim = Animated.timing(progress, { toValue: 0, duration: seconds * 1000, useNativeDriver: false });
    anim.start();
    const started = Date.now();
    const id = setInterval(() => {
      const remaining = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        expireRef.current();
      }
    }, 250);
    return () => {
      anim.stop();
      clearInterval(id);
    };
  }, [seconds, paused, progress]);

  return (
    <View style={{ gap: 4 }}>
      <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: color.surfaceAlt, overflow: 'hidden' }}>
        <Animated.View
          style={{
            height: 8,
            borderRadius: radius.pill,
            backgroundColor: left <= 10 ? color.danger : color.online,
            width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }}
        />
      </View>
      <Text style={[type.label, { color: left <= 10 ? color.danger : color.textMuted }]}>{paused ? 'Paused' : `${left}s to decide`}</Text>
    </View>
  );
}
