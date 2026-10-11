// Menu row with a big In stock / Out of stock switch, plus the stock and price sheets.
import React, { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError, errorMessage } from '../services/apiClient';
import { clockIST, nextISTTime, rupees } from '../services/orderModel';
import { color, radius, space, touch, type } from '../theme/tokens';
import { Badge, Button, RadioRow, Sheet } from './ui';
import type { MenuItem } from '../types';
import type { StockChange } from '../state/StoreProvider';

function VegMark({ veg }: { veg: boolean | null }) {
  if (veg === null) return <View style={{ width: 18 }} />;
  const c = veg ? color.veg : color.nonVeg;
  return (
    <View style={[styles.veg, { borderColor: c }]} accessibilityLabel={veg ? 'Vegetarian' : 'Non-vegetarian'}>
      <View style={[styles.vegDot, { backgroundColor: c }]} />
    </View>
  );
}

function MenuItemRowBase({ item, pending, onToggle, onEditPrice }: {
  item: MenuItem; pending: boolean; onToggle: (item: MenuItem) => void; onEditPrice: (item: MenuItem) => void;
}) {
  const on = item.isAvailable;
  return (
    <View style={[styles.row, !on && { backgroundColor: color.surfaceAlt }]}>
      <VegMark veg={item.isVegetarian} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.body, { color: on ? color.text : color.textMuted, fontWeight: '700' }]} numberOfLines={2}>{item.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' }}>
          <Pressable
            onPress={() => onEditPrice(item)}
            accessibilityRole="button"
            accessibilityLabel={`Price ${rupees(item.price)}. Tap to edit`}
            hitSlop={8}
            style={styles.price}
          >
            <Text style={[type.body, { color: color.text, fontWeight: '800' }]}>{rupees(item.price)}</Text>
            <Text style={[type.label, { color: color.info }]}>EDIT</Text>
          </Pressable>
          {!on ? <Badge text="Out of stock" fg={color.alertDark} bg={color.alertTint} /> : null}
          {!on && item.outOfStockUntil ? <Text style={[type.bodySm, { color: color.textMuted }]}>Back at {clockIST(item.outOfStockUntil)}</Text> : null}
        </View>
      </View>
      <Pressable
        onPress={() => onToggle(item)}
        disabled={pending}
        accessibilityRole="switch"
        accessibilityState={{ checked: on, busy: pending }}
        accessibilityLabel={`${item.name}: ${on ? 'In stock' : 'Out of stock'}`}
        style={[styles.switch, { backgroundColor: on ? color.open : color.closed }]}
      >
        {pending ? <ActivityIndicator color={color.textInverse} /> : (
          <View style={{ flexDirection: on ? 'row' : 'row-reverse', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
            <Text style={[type.label, { color: color.textInverse, fontSize: 11, flex: 1, textAlign: 'center' }]}>{on ? 'IN STOCK' : 'OUT'}</Text>
            <View style={styles.knob} />
          </View>
        )}
      </Pressable>
    </View>
  );
}
export const MenuItemRow = memo(MenuItemRowBase);

/** "Until tomorrow <opening time>" from operatingHours.start (IST), default 9 AM. */
export function StockSheet({ item, opensAt, onClose, onPick }: {
  item: MenuItem | null; opensAt?: string | null; onClose: () => void; onPick: (change: StockChange) => void;
}) {
  const [choice, setChoice] = useState<'2h' | 'tomorrow' | 'manual'>('2h');
  useEffect(() => { setChoice('2h'); }, [item?.id]);
  const open = opensAt && /^\d{1,2}:\d{2}$/.test(opensAt) ? opensAt : '09:00';
  const tomorrowAt = nextISTTime(open);
  const apply = () => {
    if (choice === 'manual') onPick({ isAvailable: false });
    else if (choice === '2h') onPick({ outOfStockUntil: new Date(Date.now() + 2 * 3600 * 1000).toISOString() });
    else if (tomorrowAt) onPick({ outOfStockUntil: new Date(tomorrowAt).toISOString() });
  };
  return (
    <Sheet visible={!!item} onClose={onClose} title={item ? `Mark "${item.name}" out of stock` : ''}>
      <RadioRow label="For 2 hours" sub={`Back on at ${clockIST(Date.now() + 2 * 3600 * 1000)}`} selected={choice === '2h'} onPress={() => setChoice('2h')} />
      {tomorrowAt ? (
        <RadioRow label={`Until next opening (${clockIST(tomorrowAt)})`} sub="Turns back on automatically" selected={choice === 'tomorrow'} onPress={() => setChoice('tomorrow')} />
      ) : null}
      <RadioRow label="Until I turn it on" selected={choice === 'manual'} onPress={() => setChoice('manual')} />
      <Button label="Mark out of stock" variant="reject" onPress={apply} style={{ marginTop: space.xs }} />
    </Sheet>
  );
}

export function PriceEditSheet({ item, onClose, onSave }: {
  item: MenuItem | null; onClose: () => void; onSave: (item: MenuItem, price: number) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setText(item ? String(item.price) : '');
    setErr(null);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const validate = (t: string): number | null => {
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(t.trim())) return null;
    const n = Number(t);
    return n > 0 && n <= 100000 ? n : null;
  };

  const save = async () => {
    if (!item) return;
    const n = validate(text);
    if (n === null) { setErr('Enter a price between ₹1 and ₹1,00,000 (up to 2 decimals).'); return; }
    setSaving(true);
    setErr(null);
    try {
      await onSave(item, n);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : errorMessage(e, "Couldn't save the price."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={!!item} onClose={onClose} title={item ? `Price of ${item.name}` : ''}>
      <View style={styles.inputRow}>
        <Text style={[type.money, { color: color.text }]}>₹</Text>
        <TextInput
          value={text}
          onChangeText={(t) => { setText(t.replace(/[^\d.]/g, '')); setErr(null); }}
          keyboardType="decimal-pad"
          autoFocus
          style={[type.money, styles.input]}
          accessibilityLabel="New price in rupees"
          onSubmitEditing={save}
          maxLength={9}
        />
      </View>
      <Text style={[type.bodySm, { color: color.textMuted, marginTop: space.xs }]}>Customers see the new price right away.</Text>
      {err ? <Text style={[type.body, { color: color.alert, marginTop: space.xs }]}>{err}</Text> : null}
      <Button label="Save price" variant="primary" onPress={save} loading={saving} style={{ marginTop: space.md }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 72, paddingHorizontal: space.md, paddingVertical: space.xs,
    backgroundColor: color.surface, borderBottomWidth: 1, borderBottomColor: color.surfaceAlt,
  },
  veg: { width: 18, height: 18, borderWidth: 2, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  price: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  switch: { width: 112, height: touch.minHit, borderRadius: radius.pill, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  knob: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.surface },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, borderWidth: 2, borderColor: color.text, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 64 },
  input: { flex: 1, color: color.text, paddingVertical: 0 },
});
