// Zenvy Rider UI kit: big, high-contrast, double-tap safe.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, HIT, R, S, T, shadow } from '../theme';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
export type Tone = 'green' | 'grey' | 'red' | 'amber' | 'blue' | 'cash' | 'gold';

export const TONE: Record<Tone, { fg: string; bg: string }> = {
  green: { fg: C.greenDark, bg: C.greenTint },
  grey: { fg: C.grey, bg: C.greyTint },
  red: { fg: C.red, bg: C.redTint },
  amber: { fg: C.amber, bg: C.amberTint },
  blue: { fg: C.blue, bg: C.blueTint },
  cash: { fg: C.cash, bg: C.cashTint },
  gold: { fg: '#7A5B12', bg: C.goldTint },
};

/** Runs onPress once at a time: a second tap while a returned promise is pending is ignored. */
function useGuardedPress(onPress: () => unknown) {
  const lock = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = async () => {
    if (lock.current) return;
    lock.current = true;
    try {
      const r = onPress() as any;
      if (r && typeof r.then === 'function') {
        if (mounted.current) setBusy(true);
        await r;
      }
    } catch {
      // callers show their own errors
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { run, busy };
}

type BtnVariant = 'dark' | 'green' | 'red' | 'cash' | 'outline' | 'soft';

const BTN_BG: Record<BtnVariant, string> = {
  dark: C.ink,
  green: C.green,
  red: C.red,
  cash: C.cash,
  outline: C.card,
  soft: C.cardAlt,
};

export function Btn({
  title,
  onPress,
  icon,
  variant = 'dark',
  size = 'big',
  loading,
  disabled,
  style,
  textColor,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => unknown;
  icon?: IconName;
  variant?: BtnVariant;
  size?: 'big' | 'mid' | 'small';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  textColor?: string;
  accessibilityLabel?: string;
}) {
  const { run, busy } = useGuardedPress(onPress);
  const isBusy = !!loading || busy;
  const off = !!disabled || isBusy;
  const light = variant === 'outline' || variant === 'soft';
  const fg = textColor ?? (light ? C.ink : C.white);
  const minHeight = size === 'big' ? HIT.big : size === 'mid' ? HIT.mid : 44;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: off, busy: isBusy }}
      disabled={off}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        run();
      }}
      style={({ pressed }) => [
        styles.btn,
        {
          minHeight,
          backgroundColor: disabled ? C.disabled : BTN_BG[variant],
          borderWidth: variant === 'outline' ? 2 : 0,
          borderColor: C.line,
          paddingHorizontal: size === 'small' ? S.md : S.lg,
        },
        pressed && !off && { opacity: 0.82 },
        style as any,
      ]}
    >
      {isBusy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon ? <MaterialCommunityIcons name={icon} size={size === 'small' ? 20 : 24} color={disabled ? C.white : fg} /> : null}
          <Text
            style={[size === 'small' ? T.body : T.button, { color: disabled ? C.white : fg, fontWeight: '800', textAlign: 'center', flexShrink: 1 }]}
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function IconBtn({
  icon,
  onPress,
  label,
  color = C.ink,
  bg = C.card,
  size = HIT.icon,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  bg?: string;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        pressed && { opacity: 0.7 },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={Math.round(size * 0.54)} color={color} />
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.card, style as any]}>{children}</View>;
}

export function Label({ children, color = C.muted }: { children: React.ReactNode; color?: string }) {
  return <Text style={[T.label, { color }]}>{children}</Text>;
}

export function Row({
  icon,
  label,
  value,
  onPress,
  tint = C.ink,
  warn,
  right,
}: {
  icon: IconName;
  label: string;
  value?: string | null;
  onPress?: () => void;
  tint?: string;
  warn?: boolean;
  right?: React.ReactNode;
}) {
  const body = (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: warn ? C.amberTint : C.cardAlt }]}>
        <MaterialCommunityIcons name={icon} size={22} color={warn ? C.amber : tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[T.body, { color: tint, fontWeight: '700' }]}>{label}</Text>
        {value ? <Text style={[T.small, { color: warn ? C.amber : C.muted }]}>{value}</Text> : null}
      </View>
      {right ?? (onPress ? <MaterialCommunityIcons name="chevron-right" size={26} color={C.muted} /> : null)}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {body}
    </Pressable>
  );
}

export function Badge({ label, tone = 'grey', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const t = TONE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={16} color={t.fg} /> : null}
      <Text style={[T.small, { color: t.fg, fontWeight: '800' }]}>{label}</Text>
    </View>
  );
}

export function Banner({
  text,
  tone = 'amber',
  icon = 'information',
  action,
}: {
  text: string;
  tone?: Tone;
  icon?: IconName;
  action?: { label: string; onPress: () => unknown };
}) {
  const t = TONE[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }]} accessibilityRole="alert">
      <MaterialCommunityIcons name={icon} size={22} color={t.fg} />
      <Text style={[T.body, { color: t.fg, flex: 1, fontWeight: '700' }]}>{text}</Text>
      {action ? <Btn title={action.label} onPress={action.onPress} size="small" variant="outline" textColor={t.fg} /> : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => unknown; icon?: IconName };
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} size={40} color={C.ink2} />
      </View>
      <Text style={[T.h3, { color: C.ink, textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[T.body, { color: C.muted, textAlign: 'center' }]}>{body}</Text> : null}
      {action ? <Btn title={action.label} icon={action.icon} onPress={action.onPress} size="mid" variant="outline" style={{ alignSelf: 'stretch' }} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => unknown }) {
  return (
    <Card style={{ alignItems: 'center', gap: S.md }}>
      <MaterialCommunityIcons name="wifi-alert" size={36} color={C.amber} />
      <Text style={[T.body, { color: C.ink2, textAlign: 'center' }]}>{message}</Text>
      <Btn title="Try again" icon="refresh" onPress={onRetry} size="mid" variant="outline" style={{ alignSelf: 'stretch' }} />
    </Card>
  );
}

export function Skeleton({ height = 80, style }: { height?: number; style?: ViewStyle }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ height, borderRadius: R.lg, backgroundColor: C.line, opacity: pulse }, style]} />;
}

export function Spinner() {
  return <ActivityIndicator size="large" color={C.ink} />;
}

export function ScreenHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      {onBack ? <IconBtn icon="arrow-left" onPress={onBack} label="Back" /> : null}
      <Text style={[T.h1, { color: C.ink, flex: 1 }]} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <View style={styles.seg} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={[styles.segBtn, on && { backgroundColor: C.ink }]}
          >
            <Text style={[T.body, { color: on ? C.white : C.ink2, fontWeight: '800' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: R.lg, alignItems: 'center', justifyContent: 'center', paddingVertical: S.sm },
  btnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm },
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: S.lg, ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.md, minHeight: 60, paddingVertical: S.sm },
  rowIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill, alignSelf: 'flex-start' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.md, borderRadius: R.md },
  empty: { alignItems: 'center', gap: S.sm, paddingVertical: S.xl, paddingHorizontal: S.lg },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center', marginBottom: S.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.sm },
  seg: { flexDirection: 'row', backgroundColor: C.cardAlt, borderRadius: R.lg, padding: 4, gap: 4 },
  segBtn: { flex: 1, minHeight: 48, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
});
