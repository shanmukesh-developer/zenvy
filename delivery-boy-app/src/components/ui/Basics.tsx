import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { color, elevation, radius, space, type } from '../../theme/tokens';
import { SecondaryButton } from './Buttons';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Card({ children, style, onPress, accessibilityLabel }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void; accessibilityLabel?: string }) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'online' | 'cash' | 'prepaid' | 'danger' | 'warning' | 'info' | 'brand';
  icon?: IconName;
}) {
  const map = {
    neutral: [color.surfaceAlt, color.textSecondary],
    online: [color.onlineTint, color.onlineDark],
    cash: [color.cashTint, color.cash],
    prepaid: [color.prepaidTint, color.prepaid],
    danger: [color.dangerTint, color.danger],
    warning: [color.warningTint, color.warning],
    info: [color.infoTint, color.info],
    brand: [color.brandTint, '#8A6D1F'],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={14} color={fg} /> : null}
      <Text style={[type.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Banner({
  tone,
  icon,
  text,
  actionLabel,
  onAction,
}: {
  tone: 'danger' | 'warning' | 'info' | 'online';
  icon: IconName;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const bg = { danger: color.danger, warning: color.warning, info: color.info, online: color.onlineDark }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: bg }]} accessibilityRole="alert">
      <MaterialCommunityIcons name={icon} size={20} color={color.textInverse} />
      <Text style={[type.bodySm, { color: color.textInverse, flex: 1, fontWeight: '700' }]}>{text}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10} style={styles.bannerAction}>
          <Text style={[type.label, { color: bg }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, title, body, children }: { icon: IconName; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} size={36} color={color.textSecondary} />
      </View>
      <Text style={[type.title3, { color: color.text, textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[type.body, { color: color.textMuted, textAlign: 'center' }]}>{body}</Text> : null}
      {children}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card style={{ gap: space.sm, borderColor: color.dangerTint, borderWidth: 1 }}>
      <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center' }}>
        <MaterialCommunityIcons name="alert-circle-outline" size={22} color={color.danger} />
        <Text style={[type.body, { color: color.text, flex: 1 }]}>{message}</Text>
      </View>
      <SecondaryButton title="Try again" icon="refresh" onPress={onRetry} compact />
    </Card>
  );
}

export function Skeleton({ height = 120, style }: { height?: number; style?: ViewStyle }) {
  return <View style={[{ height, borderRadius: radius.lg, backgroundColor: color.surfaceAlt }, style]} />;
}

export function Spinner() {
  return <ActivityIndicator color={color.text} size="large" />;
}

export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={[type.title3, { color: color.text }]}>{title}</Text>
      {right}
    </View>
  );
}

export function Row({ icon, label, value, onPress, warn, tint }: { icon: IconName; label: string; value?: string | null; onPress?: () => void; warn?: boolean; tint?: string }) {
  const content = (
    <View style={styles.row}>
      <MaterialCommunityIcons name={icon} size={24} color={warn ? color.warning : tint || color.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: tint || color.text, fontWeight: '700' }]}>{label}</Text>
        {value ? <Text style={[type.bodySm, { color: warn ? color.warning : color.textMuted }]}>{value}</Text> : null}
      </View>
      {onPress ? <MaterialCommunityIcons name="chevron-right" size={24} color={color.textMuted} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => pressed && { backgroundColor: color.surfaceAlt }}>
      {content}
    </Pressable>
  );
}

/** Green dot that pulses (the only looping animation: shows the rider is live). */
export function PulseDot({ size = 12, tint = color.textInverse }: { size?: number; tint?: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size * 2,
          height: size * 2,
          borderRadius: size,
          backgroundColor: tint,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] }) }],
        }}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: space.md,
    ...elevation.card,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  bannerAction: { backgroundColor: color.surface, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: color.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, minHeight: 56 },
});
