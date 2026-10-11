// Small shared building blocks: buttons, chips, cards, sheets, empty states, skeletons.
import React from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, elevation, radius, space, touch, type } from '../theme/tokens';

type Variant = 'accept' | 'reject' | 'rejectOutline' | 'primary' | 'secondary' | 'ghost' | 'inverse';

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  accept: { bg: color.open, fg: color.textInverse },
  reject: { bg: color.alert, fg: color.textInverse },
  rejectOutline: { bg: color.surface, fg: color.alert, border: color.alert },
  primary: { bg: color.primary, fg: color.textInverse },
  secondary: { bg: color.surfaceAlt, fg: color.text, border: color.border },
  ghost: { bg: 'transparent', fg: color.text },
  inverse: { bg: color.surface, fg: color.alertDark },
};

export function Button({
  label, onPress, variant = 'primary', size = 'primary', loading, disabled, icon, style, accessibilityLabel, textColor,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  textColor?: string;
}) {
  const base = VARIANTS[variant];
  const v = textColor ? { ...base, fg: textColor } : base;
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        styles.btn,
        { minHeight: size === 'primary' ? touch.primary : touch.secondary, backgroundColor: v.bg },
        v.border ? { borderWidth: 2, borderColor: v.border } : null,
        off && !loading ? { opacity: 0.45 } : null,
        pressed && !off ? { opacity: 0.85 } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon ? <Ionicons name={icon} size={22} color={v.fg} /> : null}
          <Text style={[type.button, { color: v.fg }, size === 'secondary' && { fontSize: 16 }]} numberOfLines={1}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon, onPress, label, tint = color.text, bg = color.surfaceAlt, size = touch.icon,
}: {
  icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string; tint?: string; bg?: string; size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={22} color={tint} />
    </Pressable>
  );
}

export function Badge({ text, fg, bg, border, icon }: { text: string; fg: string; bg: string; border?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }, border ? { borderWidth: 1, borderColor: border } : null]}>
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      <Text style={[type.label, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function EmptyState({ icon, title, body, action }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; body?: string; action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={48} color={color.textMuted} />
      <Text style={[type.title3, { color: color.text, textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[type.body, { color: color.textSecondary, textAlign: 'center' }]}>{body}</Text> : null}
      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" size="secondary" style={{ alignSelf: 'stretch', marginTop: space.xs }} /> : null}
    </View>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <View style={[styles.card, { gap: space.sm }]} accessibilityLabel="Loading">
      <View style={[styles.skel, { width: '40%', height: 22 }]} />
      {Array.from({ length: lines }).map((_, i) => (
        <View key={i} style={[styles.skel, { width: `${85 - i * 15}%` }]} />
      ))}
      <View style={[styles.skel, { height: 52, marginTop: space.xs }]} />
    </View>
  );
}

/** Bottom sheet on a dimmed backdrop. */
export function Sheet({ visible, onClose, title, children, footer }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <Text style={[type.title2, { color: color.text, flex: 1 }]}>{title}</Text>
            <IconButton icon="close" label="Close" onPress={onClose} />
          </View>
          {children}
          {footer ? <View style={{ marginTop: space.md }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Large radio row for reason / option pickers. */
export function RadioRow({ label, selected, onPress, sub }: { label: string; selected: boolean; onPress: () => void; sub?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.radio, selected && { borderColor: color.text, backgroundColor: color.surfaceAlt }]}
    >
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={24} color={selected ? color.text : color.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: color.text, fontWeight: '700' }]}>{label}</Text>
        {sub ? <Text style={[type.bodySm, { color: color.textMuted }]}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  btn: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.md, borderWidth: 1, borderColor: color.border, ...elevation.card },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.xl },
  skel: { height: 16, borderRadius: radius.sm, backgroundColor: color.surfaceAlt },
  backdrop: { flex: 1, backgroundColor: 'rgba(11,13,18,0.55)' },
  sheet: { backgroundColor: color.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.md, paddingTop: space.xs, maxHeight: '90%' },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: color.border, marginBottom: space.xs },
  sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
  radio: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 2, borderColor: color.border, marginBottom: space.xs },
});
