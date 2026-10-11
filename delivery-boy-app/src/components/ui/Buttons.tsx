import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { color, radius, touch, type } from '../../theme/tokens';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type Variant = 'primary' | 'online' | 'danger' | 'cash';

const BG: Record<Variant, string> = {
  primary: color.primary,
  online: color.online,
  danger: color.danger,
  cash: color.cash,
};

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  size = 'xl',
  icon,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  size?: 'xl' | 'lg';
  icon?: IconName;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.primary,
        { minHeight: size === 'xl' ? touch.primary : 56, backgroundColor: disabled ? '#9CA3AF' : BG[variant] },
        pressed && !off && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color.textInverse} />
      ) : (
        <View style={styles.row}>
          {icon ? <MaterialCommunityIcons name={icon} size={24} color={color.textInverse} /> : null}
          <Text style={[type.button, styles.primaryText]} numberOfLines={2}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  title,
  onPress,
  icon,
  tone = 'default',
  disabled,
  loading,
  style,
  compact,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  tone?: 'default' | 'danger' | 'online';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  compact?: boolean;
  accessibilityLabel?: string;
}) {
  const fg = tone === 'danger' ? color.danger : tone === 'online' ? color.onlineDark : color.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondary,
        { minHeight: compact ? touch.minHit : touch.secondary, borderColor: tone === 'default' ? color.border : fg },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { backgroundColor: color.surfaceAlt },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <MaterialCommunityIcons name={icon} size={22} color={fg} /> : null}
          <Text style={[type.title3, { color: fg, fontSize: 16 }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  tint = color.text,
  bg = color.surfaceAlt,
  size = touch.icon,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  tint?: string;
  bg?: string;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={Math.max(0, (touch.minHit - size) / 2)}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        pressed && { opacity: 0.7 },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={Math.round(size * 0.5)} color={tint} />
    </Pressable>
  );
}

export function TextLink({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={12} style={{ minHeight: touch.minHit, justifyContent: 'center' }}>
      <Text style={[type.body, { color: color.info, fontWeight: '700' }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryText: { color: color.textInverse, textAlign: 'center' },
  secondary: {
    borderRadius: radius.lg,
    borderWidth: 2,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
