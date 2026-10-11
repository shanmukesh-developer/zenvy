// Rider support: raise a ticket (POST /delivery/support) and see replies.
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { color, radius, space, type } from '../theme/tokens';
import { Badge, Card, EmptyState, ErrorState } from '../components/ui/Basics';
import { IconButton, PrimaryButton, SecondaryButton } from '../components/ui/Buttons';
import { BOTTOM_INSET } from '../components/ui/insets';
import { useRider } from '../state/RiderProvider';
import * as api from '../services/deliveryApi';
import { errorMessage } from '../services/apiClient';
import { dayLabel, istDayKey, timeIST } from '../services/format';
import type { SupportTicket } from '../types';

const TOPICS = ['Order issue', 'Payment / earnings', 'App problem', 'Other'];

export function SupportScreen({ prefill, onBack }: { prefill?: string; onBack: () => void }) {
  const r = useRider();
  const [topic, setTopic] = useState(prefill ? 'Order issue' : '');
  const [text, setText] = useState(prefill ?? '');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setTickets(await api.fetchTickets());
      setListError(null);
    } catch (e) {
      setListError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setSending(true);
    setFormError(null);
    try {
      const urgent = /PIN locked|cancel/i.test(text);
      await api.createTicket(topic, text.trim(), urgent ? 'High' : 'Medium');
      r.showToast('Ticket sent. Zenvy support will reply here.', 'success');
      setText('');
      setTopic('');
      load();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.top}>
        <IconButton icon="arrow-left" onPress={onBack} accessibilityLabel="Back" />
        <Text style={[type.title2, { color: color.text, flex: 1 }]}>Support</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <Card style={{ gap: space.sm }}>
          <Text style={[type.title3, { color: color.text }]}>What do you need help with?</Text>
          <View style={styles.chips}>
            {TOPICS.map((t) => (
              <SecondaryButton key={t} title={t} compact tone={topic === t ? 'online' : 'default'} icon={topic === t ? 'check' : undefined} onPress={() => setTopic(t)} />
            ))}
          </View>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder="Describe the problem"
            placeholderTextColor={color.textMuted}
            style={[type.body, styles.input]}
            accessibilityLabel="Describe the problem"
            maxLength={2000}
          />
          {formError ? <Text style={[type.body, { color: color.danger }]}>{formError}</Text> : null}
          <PrimaryButton
            title={r.connected ? 'Send to support' : 'Needs internet'}
            size="lg"
            loading={sending}
            disabled={!topic || text.trim().length < 5 || !r.connected}
            onPress={submit}
          />
        </Card>

        <Text style={[type.title3, { color: color.text, marginTop: space.sm }]}>My tickets</Text>
        {listError && !tickets ? <ErrorState message={listError} onRetry={load} /> : null}
        {tickets && !tickets.length ? <EmptyState icon="lifebuoy" title="No tickets yet" /> : null}
        {(tickets ?? []).map((t) => (
          <Card key={t.id} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <Text style={[type.body, { color: color.text, fontWeight: '800', flex: 1 }]}>{t.subject}</Text>
              <Badge tone={t.status === 'Resolved' || t.status === 'Closed' ? 'online' : t.status === 'In Progress' ? 'info' : 'warning'} label={t.status} />
            </View>
            <Text style={[type.bodySm, { color: color.textSecondary }]} numberOfLines={3}>
              {t.description}
            </Text>
            {t.adminResponse ? (
              <View style={styles.reply}>
                <Text style={[type.label, { color: color.info }]}>ZENVY SUPPORT</Text>
                <Text style={[type.body, { color: color.text }]}>{t.adminResponse}</Text>
              </View>
            ) : null}
            {t.createdAt ? (
              <Text style={[type.bodySm, { color: color.textMuted }]}>
                {dayLabel(istDayKey(t.createdAt))}, {timeIST(t.createdAt)}
              </Text>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, paddingBottom: space.xs },
  content: { padding: space.md, gap: space.md, paddingBottom: BOTTOM_INSET + space.xxl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  input: {
    minHeight: 110,
    textAlignVertical: 'top',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: color.border,
    padding: space.md,
    color: color.text,
    backgroundColor: color.surface,
  },
  reply: { backgroundColor: color.infoTint, borderRadius: radius.md, padding: space.sm, gap: 2 },
});
