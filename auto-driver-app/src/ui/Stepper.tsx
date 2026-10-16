// Big − / + number picker (no keyboard needed) and a yes / no switch row.
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, font, radius, space, touch } from '../theme';

export function Stepper({ label, value, min, max, step = 1, onChange, format, hint, error }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
  format?: (v: number) => string; hint?: string; error?: string | null;
}) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  return (
    <View style={{ gap: space.xxs }}>
      <Text style={[font.label, { color: color.textSecondary }]}>{label.toUpperCase()}</Text>
      <View style={[styles.row, error ? { borderColor: color.alert } : null]}>
        <Pressable onPress={dec} disabled={value <= min} accessibilityRole="button" accessibilityLabel={`Less ${label}`}
          style={({ pressed }) => [styles.btn, value <= min && { opacity: 0.35 }, pressed && { opacity: 0.7 }]}>
          <Ionicons name="remove" size={30} color={color.text} />
        </Pressable>
        <Text style={[font.h1, { color: color.text, flex: 1, textAlign: 'center' }]} accessibilityLiveRegion="polite">{format ? format(value) : value}</Text>
        <Pressable onPress={inc} disabled={value >= max} accessibilityRole="button" accessibilityLabel={`More ${label}`}
          style={({ pressed }) => [styles.btn, value >= max && { opacity: 0.35 }, pressed && { opacity: 0.7 }]}>
          <Ionicons name="add" size={30} color={color.text} />
        </Pressable>
      </View>
      {error ? <Text style={[font.small, { color: color.alertDark, fontWeight: '700' }]}>{error}</Text> : hint ? <Text style={[font.small, { color: color.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

export function SwitchRow({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={[font.h3, { color: color.text }]}>{label}</Text>
        {sub ? <Text style={[font.small, { color: color.textSecondary }]}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: color.open, false: color.border }} thumbColor={color.surface} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 2, borderColor: color.border, backgroundColor: color.surface, padding: space.xxs },
  btn: { width: touch.primary, height: touch.primary - 8, borderRadius: radius.md, backgroundColor: color.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch.primary, backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, paddingVertical: space.xs },
});
