// SOS: one tap opens a confirm sheet; "Send SOS" pages the Zenvy team (POST /delivery/sos) with the last GPS fix.
// A real emergency number is always one tap away in the same sheet.
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { C, S, T } from '../theme';
import { Btn, IconBtn } from './kit';
import { Sheet } from './Sheet';
import { useRider } from '../state/RiderStore';
import * as links from '../services/links';

export function SosButton() {
  const r = useRider();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (await r.sendSos()) setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <IconBtn icon="alarm-light" label="SOS. Ask Zenvy for help" color={C.white} bg={C.red} onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)} title="Need help?">
        <Text style={[T.body, { color: C.ink2 }]}>
          Send SOS to alert the Zenvy team with your location. They will call you. If you are in danger, call 112 first.
        </Text>
        <View style={{ gap: S.md }}>
          <Btn
            title={r.connected ? 'Send SOS' : 'No internet: call 112'}
            icon="alarm-light"
            variant="red"
            loading={busy}
            disabled={!r.connected}
            onPress={send}
          />
          <Btn title="Call 112" icon="phone" variant="outline" size="mid" textColor={C.red} onPress={() => links.callNumber('112')} />
          <Btn title="Cancel" variant="soft" size="mid" onPress={() => setOpen(false)} />
        </View>
      </Sheet>
    </>
  );
}
