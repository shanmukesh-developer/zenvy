// SOS (adapted from delivery-boy-app/src/ui/Sos.tsx): one tap opens a sheet. "Call 112" is always first.
// "Alert Zenvy" files a SAFETY incident (POST /api/auto-ride/driver/incidents, category SAFETY) linked to
// the current trip, which reaches the admin panel live (notify.admin 'auto_incident'). There is no
// location in it: this app does not use GPS.
import React, { useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { color, font, radius, space } from '../theme';
import { Button, Chip, IconButton, Sheet } from './kit';
import { useToast } from './Toast';
import { driverApi } from '../api/driverApi';
import { errorMessage } from '../lib/http';
import { EMERGENCY_NUMBER, SUPPORT_PHONE } from '../config';

const QUICK = ['Accident', 'Passenger misbehaving', 'Feeling unsafe', 'Auto broke down', 'Medical help'];

export const call = (num: string) => { Linking.openURL(`tel:${num}`).catch(() => {}); };

export function SosButton({ tripId }: { tripId?: string | null }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const send = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const description = `SOS from the driver app${note.trim() ? `: ${note.trim()}` : ''}`;
      const r = await driverApi.reportIncident({ category: 'SAFETY', description, ...(tripId ? { tripId } : {}) });
      toast.show(r.message || 'Zenvy has been alerted.', 'success');
      setOpen(false);
    } catch (e) {
      toast.show(`${errorMessage(e)} Call 112 if you are in danger.`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <IconButton icon="warning" label="SOS. Get help" tint={color.textInverse} bg={color.alert} onPress={() => { setNote(''); setOpen(true); }} />
      <Sheet visible={open} onClose={() => setOpen(false)} title="Need help?">
        <View style={{ gap: space.md }}>
          <Button label={`Call ${EMERGENCY_NUMBER} now`} icon="call" variant="reject" size="huge" onPress={() => call(EMERGENCY_NUMBER)} />
          <Text style={[font.body, { color: color.textSecondary }]}>Or alert the Zenvy team. They will call you back.</Text>
          <View style={styles.chips}>
            {QUICK.map((q) => (
              <Chip key={q} label={q} selected={note === q} tone="red" onPress={() => setNote((c) => (c === q ? '' : q))} style={{ flexGrow: 1 }} />
            ))}
          </View>
          <TextInput
            value={note}
            onChangeText={(v) => setNote(v.slice(0, 300))}
            placeholder="Or type a short note"
            placeholderTextColor={color.textMuted}
            multiline
            style={[font.body, styles.input]}
            accessibilityLabel="Note for the Zenvy team"
          />
          <Button label="Alert Zenvy" icon="megaphone" variant="rejectOutline" loading={busy} onPress={send} />
          <Button label="Call Zenvy support" icon="headset" variant="secondary" size="secondary" onPress={() => call(`+${SUPPORT_PHONE}`)} />
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  input: { minHeight: 64, maxHeight: 120, textAlignVertical: 'top', borderRadius: radius.md, borderWidth: 2, borderColor: color.border, padding: space.md, color: color.text, backgroundColor: color.surface },
});
