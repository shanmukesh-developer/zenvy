// One rental booking, for the renter or the owner: status, money, contact (after confirmation),
// PIN handover / return, accept / decline / cancel / complete, rate and report.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Alert, Linking, Modal, TextInput } from 'react-native';
import { KeyboardAvoidingView } from '../../../components/KeyboardAvoidingView';
import { useLocalSearchParams, useRouter } from 'expo-router';
import SafeImage from '../../../components/SafeImage';
import { rentalsApi, type Booking, BOOKING_STATUS_META, inr, fmtDateTime, fmtHours, RentalsError } from '../../../modules/rentals/rentalsApi';
import { VEHICLE_FALLBACK, RHeader, usePalette, Card, SectionTitle, Badge, Btn, Row, Notice, StateView, Field, useRentalLive } from '../../../modules/rentals/ui';

const until = (iso: string | null) => {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

export default function RentalBookingScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = String(Array.isArray(params.id) ? params.id[0] : params.id || '');
  const router = useRouter();
  const p = usePalette();
  const [b, setB] = useState<Booking | null>(null);
  const [error, setError] = useState<RentalsError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [extraKm, setExtraKm] = useState('');
  const [otherCharges, setOtherCharges] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [prompt, setPrompt] = useState<null | { kind: 'decline' | 'cancel'; required: boolean }>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await rentalsApi.booking(id);
      setB(res.booking);
      setError(null);
    } catch (e: any) {
      setError(e instanceof RentalsError ? e : new RentalsError(e?.message || 'Could not load this booking.'));
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useRentalLive((e) => { if (!e.id || e.id === id || e.kind === 'reconnect') load(); });

  const run = async (key: string, fn: () => Promise<{ booking: Booking }>, done?: string) => {
    if (busy) return;
    setBusy(key);
    try {
      const res = await fn();
      setB(res.booking);
      setPin('');
      if (done) Alert.alert('Done', done);
    } catch (e: any) {
      Alert.alert('Could not update', e?.message || 'Please try again.');
      if (e?.code === 'INVALID_STATE' || e?.code === 'EXPIRED') load();
    } finally {
      setBusy(null);
    }
  };

  if (!b) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <RHeader title="Booking" />
        {error ? <StateView kind={error.status === 404 ? 'empty' : 'error'} title={error.status === 404 ? 'Booking not found' : 'Could not load'} message={error.message} actionLabel={error.status === 404 ? 'My bookings' : 'Retry'} onAction={error.status === 404 ? () => router.replace('/rentals/bookings' as any) : load} /> : <StateView kind="loading" />}
      </View>
    );
  }

  const meta = BOOKING_STATUS_META[b.status];
  const isOwner = b.role === 'OWNER';
  const other = b.counterpart;
  const beforeStart = new Date(b.startAt).getTime() > Date.now();
  const guidance = (() => {
    switch (b.status) {
      case 'REQUESTED': return isOwner ? `Answer within ${until(b.respondBy)} or the request expires.` : `Waiting for the owner. They have ${until(b.respondBy)} to answer.`;
      case 'ACCEPTED': return isOwner ? 'At pickup: check the renter\'s licence, collect the cash, then type the 4-digit pickup PIN the renter shows you.' : 'At pickup: show this PIN to the owner after you pay the cash. Check the vehicle and take photos before you ride.';
      case 'ACTIVE': return isOwner ? 'When the vehicle is back, check it and type the renter\'s return PIN. Then return the deposit.' : 'Enjoy the ride. When you return the vehicle, show the owner this return PIN and collect your deposit.';
      case 'RETURNED': return isOwner ? 'Close the trip: add any extra km or charges you agreed, or just complete it.' : 'Returned. The owner is closing the trip.';
      case 'COMPLETED': return 'Trip completed. Rate each other to help the community.';
      case 'DECLINED': return b.declineReason ? `Declined: ${b.declineReason}` : 'The owner could not take this booking.';
      case 'EXPIRED': return 'This request expired.';
      case 'CANCELLED': return `Cancelled by ${b.cancelledBy === 'OWNER' ? 'the owner' : 'the renter'}${b.cancelReason ? `: ${b.cancelReason}` : '.'}`;
      default: return '';
    }
  })();

  const call = (phone?: string | null, wa = false) => {
    if (!phone) return;
    const digits = phone.replace(/\D/g, '');
    const url = wa ? `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}` : `tel:${digits}`;
    Linking.openURL(url).catch(() => Alert.alert('Could not open', wa ? 'WhatsApp is not available.' : 'Calling is not available on this device.'));
  };

  const confirmPrompt = () => {
    if (!prompt) return;
    const r = reason.trim();
    if (prompt.required && r.length < 5) { Alert.alert('Add a reason', 'Tell the renter why (at least 5 characters).'); return; }
    const kind = prompt.kind;
    setPrompt(null);
    setReason('');
    run(kind, () => (kind === 'decline' ? rentalsApi.decline(b.id, r || undefined) : rentalsApi.cancel(b.id, r || undefined)), kind === 'decline' ? 'Request declined.' : 'Booking cancelled.');
  };

  // Render helpers (plain functions, not components: the PIN input must keep focus while typing).
  const pinBox = (value: string | null | undefined, label: string, hint: string) => (
    <Card style={{ alignItems: 'center', borderColor: p.accent, backgroundColor: p.accentSoft }}>
      <Text style={{ fontSize: 11, fontWeight: '900', color: p.accent, letterSpacing: 1 }}>{label}</Text>
      <Text style={{ fontSize: 42, fontWeight: '900', color: p.text, letterSpacing: 12, marginVertical: 6 }} accessibilityLabel={`${label} ${String(value || '').split('').join(' ')}`}>{value || '••••'}</Text>
      <Text style={{ fontSize: 11.5, color: p.sub, textAlign: 'center' }}>{hint}</Text>
    </Card>
  );

  const pinEntry = (label: string, action: () => void) => (
    <Card>
      <Text style={{ fontSize: 12, fontWeight: '900', color: p.sub, marginBottom: 8 }}>{label}</Text>
      <TextInput value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" maxLength={4} placeholder="••••" placeholderTextColor={p.muted}
        accessibilityLabel={label}
        style={{ fontSize: 30, fontWeight: '900', letterSpacing: 14, textAlign: 'center', color: p.text, borderWidth: 1, borderColor: p.inputBorder, backgroundColor: p.input, borderRadius: 14, paddingVertical: 10 }} />
      {b.pinLocked ? <Text style={{ color: p.danger, fontSize: 12, marginTop: 6 }}>Too many wrong tries. Wait 15 minutes and try again.</Text> : null}
      <Btn label="Confirm PIN" onPress={action} disabled={pin.length !== 4} loading={busy === 'pin'} style={{ marginTop: 10 }} />
    </Card>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }}>
      <RHeader title={b.vehicleTitle} subtitle={isOwner ? 'Your vehicle' : 'Your rental'} right={<Badge label={meta.label.toUpperCase()} color={meta.color} />} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 50 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={p.accent} />} keyboardShouldPersistTaps="handled">
        {guidance ? <Notice tone={['DECLINED', 'CANCELLED', 'EXPIRED'].includes(b.status) ? 'warn' : 'info'}>{guidance}</Notice> : null}

        {!isOwner && b.status === 'ACCEPTED' ? pinBox(b.pickupPin, 'PICKUP PIN', 'Show this to the owner at pickup, only after you get the vehicle keys.') : null}
        {!isOwner && b.status === 'ACTIVE' ? pinBox(b.returnPin, 'RETURN PIN', 'Show this to the owner when you hand the vehicle back and get your deposit.') : null}

        {isOwner && b.status === 'ACCEPTED' ? pinEntry("Renter's pickup PIN", () => run('pin', () => rentalsApi.handover(b.id, pin), 'Trip started. Return is due ' + fmtDateTime(b.endAt) + '.')) : null}
        {isOwner && b.status === 'ACTIVE' ? pinEntry("Renter's return PIN", () => run('pin', () => rentalsApi.markReturned(b.id, pin), 'Vehicle returned. Give back the deposit, then complete the trip.')) : null}

        <Card style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 70, height: 70, borderRadius: 12, overflow: 'hidden', backgroundColor: p.card2 }}>
            {b.vehiclePhoto ? <SafeImage source={{ uri: b.vehiclePhoto }} style={{ width: 70, height: 70 }} contentFit="cover" fallbackUri={VEHICLE_FALLBACK} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14.5, fontWeight: '900', color: p.text }}>{b.vehicleTitle}</Text>
            {b.registration ? <Text style={{ fontSize: 12, color: p.sub, marginTop: 2 }}>🔢 {b.registration}</Text> : null}
            <Text style={{ fontSize: 12, color: p.sub, marginTop: 2 }}>📍 {b.pickupLocation || 'Pickup point shared by the owner'}</Text>
            {b.vehicleType !== 'CAR' ? <Text style={{ fontSize: 12, color: p.sub, marginTop: 2 }}>⛑️ {b.helmetIncluded ? 'Helmet included' : 'Bring your own helmet'}</Text> : null}
          </View>
        </Card>

        <Card>
          <Row label="Pickup" value={fmtDateTime(b.startAt)} />
          <Row label="Return" value={fmtDateTime(b.endAt)} />
          <Row label="Billed" value={fmtHours(b.billableHours)} />
          {b.kmAllowance ? <Row label="Km included" value={`${b.kmAllowance} km`} /> : null}
        </Card>

        <SectionTitle>Payment (cash, between you two)</SectionTitle>
        <Card>
          <Row label="Rent" value={inr(b.rentAmount)} />
          <Row label="Refundable deposit" value={inr(b.depositAmount)} />
          <Row label="Cash at pickup" value={inr(b.payAtHandover)} strong />
          {b.status === 'COMPLETED' ? (
            <>
              <View style={{ height: 1, backgroundColor: p.border, marginVertical: 6 }} />
              {b.extraCharges > 0 ? <Row label={`Extras${b.extraBreakdown?.extraKm ? ` (${b.extraBreakdown.extraKm} km)` : ''}`} value={inr(b.extraCharges)} /> : null}
              {b.extraBreakdown?.note ? <Text style={{ fontSize: 11.5, color: p.sub }}>Note: {b.extraBreakdown.note}</Text> : null}
              <Row label="Final rent" value={inr(b.finalAmount ?? b.rentAmount)} strong />
              <Text style={{ fontSize: 11, color: p.muted }}>The deposit of {inr(b.depositAmount)} goes back to the renter.</Text>
            </>
          ) : <Text style={{ fontSize: 11, color: p.muted, marginTop: 4 }}>Zenvy does not collect rental money. The deposit is returned in cash at drop-off.</Text>}
        </Card>

        <SectionTitle>{isOwner ? 'Renter' : 'Owner'}</SectionTitle>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: p.card2, alignItems: 'center', justifyContent: 'center' }}>
              {other?.avatar ? <SafeImage source={{ uri: other.avatar }} style={{ width: 44, height: 44 }} /> : <Text style={{ fontSize: 18 }}>🧑‍🎓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: p.text }}>{other?.name || 'Student'} <Text style={{ color: p.success, fontSize: 11.5 }}>✓ verified</Text></Text>
              <Text style={{ fontSize: 11.5, color: p.sub, marginTop: 2 }}>
                {other?.rating && other.rating.avg ? `★ ${other.rating.avg} (${other.rating.count})` : 'No ratings yet'}{other?.rating?.trips ? ` · ${other.rating.trips} trips` : ''}
              </Text>
            </View>
          </View>
          {isOwner && b.renterLicence ? (
            <Text style={{ fontSize: 12, color: b.renterLicence.status === 'VERIFIED' ? p.success : p.warn, marginTop: 10 }}>
              🪪 Driving licence: {b.renterLicence.status === 'VERIFIED' ? `verified by Zenvy (${b.renterLicence.classes.join(', ')})` : b.renterLicence.status === 'PENDING' ? 'being verified by Zenvy, you can accept once verified' : b.renterLicence.status.toLowerCase()}
            </Text>
          ) : null}
          {b.renterNote ? <Text style={{ fontSize: 12.5, color: p.text, marginTop: 10 }}>💬 “{b.renterNote}”</Text> : null}
          {b.contactVisible && other?.phone ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Btn label="Call" icon="📞" small kind="success" onPress={() => call(other.phone)} style={{ flex: 1 }} />
              <Btn label="WhatsApp" icon="💬" small kind="secondary" onPress={() => call(other.phone, true)} style={{ flex: 1 }} />
            </View>
          ) : <Text style={{ fontSize: 11, color: p.muted, marginTop: 10 }}>{['REQUESTED'].includes(b.status) ? 'Phone numbers are shared once the owner accepts.' : 'Phone numbers are visible only during a confirmed trip.'}</Text>}
        </Card>

        {b.fuelPolicy || b.rules ? (
          <>
            <SectionTitle>Rules</SectionTitle>
            <Card>
              {b.fuelPolicy ? <Text style={{ fontSize: 12.5, color: p.text }}>⛽ {b.fuelPolicy}</Text> : null}
              {b.rules ? <Text style={{ fontSize: 12.5, color: p.text, marginTop: 6, lineHeight: 18 }}>{b.rules}</Text> : null}
            </Card>
          </>
        ) : null}

        {isOwner && b.status === 'RETURNED' ? (
          <>
            <SectionTitle>Close the trip</SectionTitle>
            <Card>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Field label="Extra km driven" value={extraKm} onChangeText={(t) => setExtraKm(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="0" style={{ flex: 1 }} hint={b.priceBreakdown?.extraPerKm ? `₹${b.priceBreakdown.extraPerKm}/km` : 'No km charge set'} />
                <Field label="Other charges ₹" value={otherCharges} onChangeText={(t) => setOtherCharges(t.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 7))} keyboardType="decimal-pad" placeholder="0" style={{ flex: 1 }} hint="Fuel, late fee…" />
              </View>
              <Field label="Note for the renter" value={closeNote} onChangeText={(t) => setCloseNote(t.slice(0, 300))} placeholder="Optional" />
              <Btn label="Complete trip" kind="success" loading={busy === 'complete'} onPress={() => run('complete', () => rentalsApi.complete(b.id, { extraKm: extraKm ? Number(extraKm) : 0, otherCharges: otherCharges ? Number(otherCharges) : 0, note: closeNote.trim() || undefined }), 'Trip completed. Rate your renter!')} />
            </Card>
          </>
        ) : null}

        <View style={{ gap: 10, marginTop: 8 }}>
          {isOwner && b.status === 'REQUESTED' ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn label="Decline" kind="secondary" onPress={() => setPrompt({ kind: 'decline', required: false })} style={{ flex: 1 }} loading={busy === 'decline'} />
              <Btn label="Accept" onPress={() => run('accept', () => rentalsApi.accept(b.id), 'Confirmed. The renter can now see your number and their pickup PIN.')} style={{ flex: 2 }} loading={busy === 'accept'}
                disabled={b.renterLicence ? b.renterLicence.status !== 'VERIFIED' : false} />
            </View>
          ) : null}
          {!isOwner && (b.status === 'REQUESTED' || (b.status === 'ACCEPTED' && beforeStart)) ? <Btn label={b.status === 'REQUESTED' ? 'Withdraw request' : 'Cancel booking'} kind="secondary" onPress={() => setPrompt({ kind: 'cancel', required: false })} loading={busy === 'cancel'} /> : null}
          {isOwner && b.status === 'ACCEPTED' ? <Btn label="Cancel booking" kind="secondary" onPress={() => setPrompt({ kind: 'cancel', required: true })} loading={busy === 'cancel'} /> : null}
          {b.canRate ? <Btn label={isOwner ? 'Rate the renter' : 'Rate your trip'} icon="⭐" onPress={() => router.push(`/rentals/rate/${b.id}` as any)} /> : null}
          {b.rated ? <Text style={{ color: p.success, fontSize: 12, textAlign: 'center', fontWeight: '800' }}>✓ You rated this trip. Thanks!</Text> : null}
          {b.canReport ? <Btn label="Report a problem" kind="ghost" onPress={() => router.push(`/rentals/report/${b.id}` as any)} style={{ borderColor: p.danger }} /> : null}
          <Btn label="View vehicle" kind="ghost" onPress={() => router.push(`/rentals/${b.listingId}` as any)} />
        </View>
      </ScrollView>

      <Modal visible={!!prompt} transparent animationType="fade" onRequestClose={() => setPrompt(null)}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: p.bg, borderRadius: 20, padding: 18 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: p.text, marginBottom: 10 }}>{prompt?.kind === 'decline' ? 'Decline this request?' : 'Cancel this booking?'}</Text>
            <Field label={prompt?.required ? 'Reason (required)' : 'Reason (optional)'} value={reason} onChangeText={(t) => setReason(t.slice(0, 300))} placeholder={prompt?.kind === 'decline' ? 'e.g. I need it that day' : 'Tell them why'} multiline />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn label="Back" kind="secondary" onPress={() => { setPrompt(null); setReason(''); }} style={{ flex: 1 }} />
              <Btn label={prompt?.kind === 'decline' ? 'Decline' : 'Cancel booking'} kind="danger" onPress={confirmPrompt} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}
