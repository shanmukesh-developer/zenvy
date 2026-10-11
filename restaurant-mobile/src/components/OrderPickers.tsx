// Prep-time and reject-reason pickers. Rendered inside a bottom sheet (cards, detail) or inline in the
// full-screen new-order alert (a second Modal on top of a Modal is unreliable on Android).
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PREP_TIMES, REJECT_REASONS } from '../constants/api';
import { rupees } from '../services/orderModel';
import { useStore } from '../state/StoreProvider';
import { color, radius, space, touch, type } from '../theme/tokens';
import { Button, RadioRow, Sheet } from './ui';
import type { Order } from '../types';

export function defaultPrep(deliveryTime: number | null | undefined): number {
  return deliveryTime && (PREP_TIMES as readonly number[]).includes(deliveryTime) ? deliveryTime : 15;
}

export function PrepTimePicker({ order, onDone, onCancel, inverse }: {
  order: Order; onDone: () => void; onCancel?: () => void; inverse?: boolean;
}) {
  const { accept, busy, store, restaurant } = useStore();
  const [mins, setMins] = useState(defaultPrep(store?.deliveryTime ?? restaurant.deliveryTime));
  const [failed, setFailed] = useState(false);
  const fg = inverse ? color.textInverse : color.text;
  return (
    <View style={{ gap: space.md }}>
      {inverse ? <Text style={[type.title2, { color: fg }]}>How long to prepare?</Text> : null}
      <View style={styles.chips}>
        {PREP_TIMES.map((m) => {
          const sel = m === mins;
          return (
            <Pressable
              key={m}
              onPress={() => setMins(m)}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={`${m} minutes`}
              style={[styles.chip, sel ? styles.chipSel : null, inverse && !sel ? styles.chipInv : null]}
            >
              <Text style={[type.title2, { color: sel ? color.textInverse : inverse ? color.textInverse : color.text }]}>{m}</Text>
              <Text style={[type.label, { color: sel ? color.textInverse : inverse ? color.textInverse : color.textMuted }]}>min</Text>
            </Pressable>
          );
        })}
      </View>
      {failed ? <Text style={[type.bodySm, { color: inverse ? color.textInverse : color.alert }]}>Couldn't accept. Please check and try again.</Text> : null}
      <Button
        label={`Accept · ${mins} min`}
        variant="accept"
        icon="checkmark-circle"
        loading={busy[order.id] === 'accept'}
        disabled={!!busy[order.id]}
        onPress={async () => {
          setFailed(false);
          const ok = await accept(order, mins);
          if (ok) onDone(); else setFailed(true);
        }}
      />
      {onCancel ? <Button label="Back" variant="ghost" size="secondary" onPress={onCancel} textColor={inverse ? color.textInverse : undefined} style={inverse ? { borderWidth: 2, borderColor: color.textInverse } : undefined} /> : null}
    </View>
  );
}

export function RejectPicker({ order, onDone, onCancel, inverse }: {
  order: Order; onDone: () => void; onCancel?: () => void; inverse?: boolean;
}) {
  const { reject, busy } = useStore();
  const [reason, setReason] = useState<string | null>(null);
  const [other, setOther] = useState('');
  const [failed, setFailed] = useState(false);
  const isOther = reason === 'Other';
  const finalReason = isOther ? other.trim() : reason;
  return (
    <View style={{ gap: space.sm }}>
      {inverse ? <Text style={[type.title2, { color: color.textInverse }]}>Why are you rejecting?</Text> : null}
      <View style={inverse ? styles.invPanel : null}>
        {[...REJECT_REASONS, 'Other'].map((r) => (
          <RadioRow key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
        ))}
        {isOther ? (
          <TextInput
            value={other}
            onChangeText={(t) => setOther(t.slice(0, 250))}
            placeholder="Tell the customer why (max 250 characters)"
            placeholderTextColor={color.textMuted}
            style={styles.input}
            multiline
            maxLength={250}
            accessibilityLabel="Other reason"
          />
        ) : null}
        {order.paymentMethod === 'Wallet' ? (
          <Text style={[type.bodySm, { color: color.textSecondary, marginTop: space.xs }]}>
            The customer's {rupees(order.finalPrice)} is refunded to their Zenvy Wallet automatically.
          </Text>
        ) : null}
      </View>
      {failed ? <Text style={[type.bodySm, { color: inverse ? color.textInverse : color.alert }]}>Couldn't reject. Please check and try again.</Text> : null}
      <Button
        label="Reject order"
        variant={inverse ? 'inverse' : 'reject'}
        icon="close-circle"
        disabled={!finalReason || !!busy[order.id]}
        loading={busy[order.id] === 'reject'}
        onPress={async () => {
          if (!finalReason) return;
          setFailed(false);
          const ok = await reject(order, finalReason);
          if (ok) onDone(); else setFailed(true);
        }}
      />
      {onCancel ? <Button label="Back" variant="ghost" size="secondary" onPress={onCancel} textColor={inverse ? color.textInverse : undefined} style={inverse ? { borderWidth: 2, borderColor: color.textInverse } : undefined} /> : null}
    </View>
  );
}

/** Accept / Reject sheets for any screen: `const { openAccept, openReject, sheets } = useOrderSheets()`. */
export function useOrderSheets() {
  const [acceptFor, setAcceptFor] = useState<Order | null>(null);
  const [rejectFor, setRejectFor] = useState<Order | null>(null);
  const sheets = (
    <>
      <Sheet visible={!!acceptFor} onClose={() => setAcceptFor(null)} title={acceptFor ? `How long to prepare #${acceptFor.shortId}?` : ''}>
        {acceptFor ? <PrepTimePicker order={acceptFor} onDone={() => setAcceptFor(null)} /> : null}
      </Sheet>
      <Sheet visible={!!rejectFor} onClose={() => setRejectFor(null)} title={rejectFor ? `Reject #${rejectFor.shortId}?` : ''}>
        {rejectFor ? (
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>
            <RejectPicker order={rejectFor} onDone={() => setRejectFor(null)} />
          </ScrollView>
        ) : null}
      </Sheet>
    </>
  );
  return { openAccept: setAcceptFor, openReject: setRejectFor, sheets };
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: {
    flexGrow: 1, flexBasis: 56, minHeight: touch.primary, borderRadius: radius.md, borderWidth: 2, borderColor: color.border,
    backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center',
  },
  chipSel: { backgroundColor: color.open, borderColor: color.openDark },
  chipInv: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.6)' },
  invPanel: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.sm },
  input: {
    minHeight: 72, borderWidth: 2, borderColor: color.border, borderRadius: radius.md, padding: space.sm,
    ...type.body, color: color.text, textAlignVertical: 'top', marginBottom: space.xs,
  },
});
