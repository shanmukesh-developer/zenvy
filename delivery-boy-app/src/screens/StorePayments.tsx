// "Paid amount" (owner, 24 Nov 2026): at restaurants that are paid before pickup, the rider pays the counter from the
// hand cash ZenWe gave them and records it here: the order, the amount and a photo of the bill. A record for the rider
// and the admin only; it never changes Cash with you or earnings (ZenWe settles it with the rider separately).
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { C, R, S, T } from '../theme';
import { Btn } from '../ui/kit';
import { Sheet } from '../ui/Sheet';
import { useRider } from '../state/RiderStore';
import { fetchStorePayments, recordStorePayment } from '../services/deliveryApi';
import { errorMessage } from '../services/apiClient';
import { rupees, timeIST } from '../services/format';
import type { StorePayment, StorePayments } from '../types';

/** Home: "Paid amount" button with today's total; opens the sheet to record a payment. */
export function PaidAmountButton() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<StorePayments | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await fetchStorePayments());
    } catch {
      /* the button still works; the sheet shows the error */
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const waiting = data?.toRecord.length ?? 0;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Paid amount. Paid to restaurants today ${data ? data.total : 0} rupees.${waiting ? ` ${waiting} to record.` : ''}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
      >
        <MaterialCommunityIcons name="receipt-text-check-outline" size={26} color={C.ink} />
        <View style={{ flex: 1 }}>
          <Text style={[T.h3, { color: C.ink }]}>Paid amount</Text>
          <Text style={[T.small, { color: C.muted }]}>
            Paid to restaurants today: {rupees(data?.total ?? 0)}
          </Text>
        </View>
        {waiting ? (
          <View style={styles.count}>
            <Text style={[T.small, { color: C.white, fontWeight: '800' }]}>{waiting} to record</Text>
          </View>
        ) : null}
        <MaterialCommunityIcons name="chevron-right" size={24} color={C.muted} />
      </Pressable>
      <PaidAmountSheet visible={open} onClose={() => setOpen(false)} onChanged={setData} />
    </>
  );
}

function PaidAmountSheet({ visible, onClose, onChanged }: { visible: boolean; onClose: () => void; onChanged: (d: StorePayments) => void }) {
  const r = useRider();
  const [data, setData] = useState<StorePayments | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StorePayment | null>(null);
  const [amount, setAmount] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setSelected(null); setAmount(''); setPhoto(null); setError(null); };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const d = await fetchStorePayments();
      setData(d);
      onChanged(d);
    } catch (e) {
      setLoadError(errorMessage(e, 'Could not load your payments.'));
    } finally {
      setLoading(false);
    }
  }, [onChanged]);

  useEffect(() => {
    if (visible) { reset(); load(); }
  }, [visible, load]);

  const pick = async (camera: boolean) => {
    setError(null);
    try {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setError(camera ? 'Allow the camera to take the bill photo.' : 'Allow photos to choose the bill photo.'); return; }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.4, base64: true, allowsEditing: false };
      const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      if (!a.base64) { setError('Could not read the photo. Please try again.'); return; }
      setPhoto(`data:${a.mimeType || 'image/jpeg'};base64,${a.base64}`);
    } catch {
      setError('Could not open the camera. Please try again.');
    }
  };

  const value = Number(amount.replace(/[^\d.]/g, ''));
  const canSave = !!selected && Number.isFinite(value) && value > 0 && !!photo && !saving;

  const save = async () => {
    if (!selected || !photo || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      await recordStorePayment(selected.orderId, Math.round(value * 100) / 100, photo);
      r.showToast(`Saved: paid ${rupees(value)} to ${selected.restaurant ?? 'the restaurant'}.`, 'success');
      reset();
      await load();
    } catch (e) {
      setError(errorMessage(e, 'Could not save the payment. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Paid amount">
      <View style={{ gap: S.md }}>
        <Text style={[T.body, { color: C.ink2 }]}>
          For restaurants paid before pickup: record what you paid from ZenWe's hand cash, with a photo of the bill.
          This does not change your cash with you or your earnings.
        </Text>

        <View style={styles.total}>
          <Text style={[T.label, { color: C.muted }]}>PAID TO RESTAURANTS TODAY</Text>
          <Text style={[T.money, { color: C.ink }]}>{rupees(data?.total ?? 0)}</Text>
        </View>

        {loading && !data ? <ActivityIndicator color={C.ink} /> : null}
        {loadError ? <Text style={[T.body, { color: C.red }]}>{loadError}</Text> : null}

        {data && !selected ? (
          data.toRecord.length ? (
            <View style={{ gap: S.sm }}>
              <Text style={[T.label, { color: C.ink2 }]}>CHOOSE THE ORDER</Text>
              {data.toRecord.map((p) => (
                <Pressable
                  key={p.orderId}
                  accessibilityRole="button"
                  accessibilityLabel={`Record payment for ${p.orderCode ?? 'order'}, ${p.restaurant ?? 'restaurant'}`}
                  onPress={() => { setSelected(p); setAmount(p.foodTotal ? String(p.foodTotal) : ''); }}
                  style={styles.orderRow}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { color: C.ink, fontWeight: '800' }]} numberOfLines={1}>{p.restaurant ?? 'Restaurant'}</Text>
                    <Text style={[T.small, { color: C.muted }]}>{p.orderCode ?? ''} · Food {rupees(p.foodTotal)}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={C.muted} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={[T.body, { color: C.muted }]}>No pay-before-pickup orders waiting to be recorded.</Text>
          )
        ) : null}

        {selected ? (
          <View style={{ gap: S.md }}>
            <View style={styles.orderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[T.body, { color: C.ink, fontWeight: '800' }]} numberOfLines={1}>{selected.restaurant ?? 'Restaurant'}</Text>
                <Text style={[T.small, { color: C.muted }]}>{selected.orderCode ?? ''} · Food {rupees(selected.foodTotal)}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={reset} hitSlop={12}>
                <Text style={[T.small, { color: C.blue ?? C.ink, fontWeight: '800' }]}>Change</Text>
              </Pressable>
            </View>

            <View style={{ gap: S.xs }}>
              <Text style={[T.label, { color: C.ink2 }]}>AMOUNT YOU PAID</Text>
              <View style={styles.inputRow}>
                <Text style={[T.h3, { color: C.ink2 }]}>₹</Text>
                <TextInput
                  value={amount}
                  onChangeText={(v) => { setAmount(v.replace(/[^\d.]/g, '')); setError(null); }}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={C.muted}
                  style={[T.h3, styles.input]}
                  accessibilityLabel="Amount you paid the restaurant"
                  maxLength={8}
                />
              </View>
            </View>

            <View style={{ gap: S.xs }}>
              <Text style={[T.label, { color: C.ink2 }]}>BILL PHOTO</Text>
              {photo ? (
                <View style={{ gap: S.sm }}>
                  <Image source={{ uri: photo }} style={styles.preview} resizeMode="cover" accessibilityLabel="Bill photo" />
                  <Btn title="Retake photo" icon="camera-retake-outline" variant="outline" size="small" onPress={() => pick(true)} />
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: S.sm }}>
                  <Btn title="Take photo" icon="camera-outline" variant="dark" size="mid" onPress={() => pick(true)} style={{ flex: 1 }} />
                  <Btn title="Gallery" icon="image-outline" variant="outline" size="mid" onPress={() => pick(false)} style={{ flex: 1 }} />
                </View>
              )}
            </View>

            {error ? <Text style={[T.body, { color: C.red }]}>{error}</Text> : null}
            <Btn title={value > 0 ? `Save ${rupees(value)} paid` : 'Save payment'} icon="check" variant="green" onPress={save} loading={saving} disabled={!canSave} />
          </View>
        ) : null}

        {data && data.paid.length ? (
          <View style={{ gap: S.sm }}>
            <Text style={[T.label, { color: C.ink2 }]}>RECORDED TODAY</Text>
            {data.paid.map((p) => (
              <View key={p.orderId} style={styles.paidRow}>
                <MaterialCommunityIcons name={p.billUrl ? 'receipt-text-check-outline' : 'receipt-text-outline'} size={22} color={C.greenDark} />
                <View style={{ flex: 1 }}>
                  <Text style={[T.body, { color: C.ink, fontWeight: '700' }]} numberOfLines={1}>{p.restaurant ?? 'Restaurant'}</Text>
                  <Text style={[T.small, { color: C.muted }]}>{p.orderCode ?? ''}{p.paidAt ? ` · ${timeIST(p.paidAt)}` : ''} · bill attached</Text>
                </View>
                <Text style={[T.h3, { color: C.ink }]}>{rupees(p.amount ?? 0)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    padding: S.lg,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
  },
  count: { backgroundColor: C.amber, borderRadius: R.pill, paddingHorizontal: S.sm, paddingVertical: 2 },
  total: { gap: 2, padding: S.md, borderRadius: R.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    padding: S.md,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
  },
  paidRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.sm, borderBottomWidth: 1, borderBottomColor: C.line },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    minHeight: 62,
    borderRadius: R.md,
    borderWidth: 2,
    borderColor: C.line,
    backgroundColor: C.card,
    paddingHorizontal: S.lg,
  },
  input: { flex: 1, color: C.ink, minHeight: 54 },
  preview: { width: '100%', height: 180, borderRadius: R.md, backgroundColor: C.card },
});
