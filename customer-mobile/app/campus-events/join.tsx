// Zenvy Campus Events: open a team join link (zenvy://campus-events/join?t=<token>). Joining is the student's
// own action (consent): nothing happens until they tap Join. The server checks the hashed token, expiry,
// blocks, eligibility, team size and the one-team-per-event rule.
import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { campusEventsApi, errorCopy, needsVerification } from '../../modules/campusEvents/campusEventsApi';
import { EHeader, usePalette, Btn, Notice, StateView, CE_HOME } from '../../modules/campusEvents/ui';

export default function JoinTeamScreen() {
  const params = useLocalSearchParams<{ t?: string | string[] }>();
  const token = String(Array.isArray(params.t) ? params.t[0] : params.t || '').trim();
  const router = useRouter();
  const p = usePalette();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ title: string; message: string; verify?: boolean } | null>(null);
  const valid = /^[A-Za-z0-9_-]{30,64}$/.test(token);
  const signedIn = !!((user as any)?.id || (user as any)?._id);

  const join = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await campusEventsApi.joinByLink(token);
      router.replace(`/campus-events/team/${r.team.id}` as any);
    } catch (e: any) {
      setErr({ ...errorCopy(e), verify: needsVerification(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <EHeader title="Join a team" onBack={() => (router.canGoBack() ? router.back() : router.replace(CE_HOME as any))} />
      {!signedIn ? (
        <StateView kind="empty" icon="🔐" title="Log in to join" message="Team join links work for verified students signed in to Zenvy." actionLabel="Log in" onAction={() => router.push('/login' as any)} />
      ) : !valid ? (
        <StateView kind="error" icon="🔗" title="This link is not valid" message="Ask your captain to share the join link again." actionLabel="Campus Events" onAction={() => router.replace(CE_HOME as any)} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 32 }}>
          <Text style={{ fontSize: 54, textAlign: 'center' }}>👥</Text>
          <Text style={{ fontSize: 20, fontWeight: '900', color: p.text, textAlign: 'center', marginTop: 8 }}>You were invited to a team</Text>
          <Text style={{ fontSize: 13, color: p.sub, textAlign: 'center', marginTop: 6, marginBottom: 18, lineHeight: 19 }}>
            Joining adds you to the captain&apos;s roster for that event. The captain and teammates will see your name.
          </Text>
          {err ? <Notice tone="danger" icon="⚠️">{err.title}: {err.message}</Notice> : null}
          {err?.verify ? <Btn label="Verify my college" kind="secondary" onPress={() => router.push('/friends?screen=verification' as any)} style={{ marginBottom: 10 }} /> : null}
          <Btn label="Join team" onPress={join} loading={busy} />
          <Btn label="Not now" kind="ghost" onPress={() => router.replace(CE_HOME as any)} style={{ marginTop: 10 }} />
        </ScrollView>
      )}
    </View>
  );
}
