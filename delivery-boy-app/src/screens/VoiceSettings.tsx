// Voice announcements: on/off, language, test.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BOTTOM_INSET, C, R, S, T } from '../theme';
import { Banner, Btn, Card, Label, ScreenHeader } from '../ui/kit';
import { useVoice } from '../voice/useVoice';
import { announceTest, checkVoices, updateVoiceSettings } from '../voice/announcer';
import { LANG_LABEL, phrase, type VoiceLang } from '../voice/phrases';

const LANGS: VoiceLang[] = ['te', 'hi', 'en'];

export function VoiceSettingsScreen({ onBack }: { onBack: () => void }) {
  const v = useVoice();
  const samples = [
    phrase(v.lang, 'newOrder', { earning: 30 }),
    phrase(v.lang, 'delivered', { amount: 30 }),
    phrase(v.lang, 'cod', { amount: 250 }),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Voice" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.switchRow}>
          <MaterialCommunityIcons name={v.enabled ? 'volume-high' : 'volume-off'} size={30} color={v.enabled ? C.greenDark : C.muted} />
          <View style={{ flex: 1 }}>
            <Text style={[T.h3, { color: C.ink }]}>Voice announcements</Text>
            <Text style={[T.small, { color: C.muted }]}>New orders, cash to collect, money credited</Text>
          </View>
          <Switch
            value={v.enabled}
            onValueChange={(on) => updateVoiceSettings({ enabled: on })}
            trackColor={{ true: C.green, false: C.line }}
            thumbColor={C.white}
            accessibilityLabel="Voice announcements"
          />
        </Card>

        <Label>LANGUAGE</Label>
        <View style={{ gap: S.sm }}>
          {LANGS.map((l) => {
            const on = v.lang === l;
            const missing = v.available[l] === false;
            return (
              <Pressable
                key={l}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => updateVoiceSettings({ lang: l })}
                style={[styles.lang, on && { borderColor: C.ink, backgroundColor: C.card }]}
              >
                <MaterialCommunityIcons name={on ? 'radiobox-marked' : 'radiobox-blank'} size={26} color={on ? C.ink : C.muted} />
                <Text style={[T.h3, { color: C.ink, flex: 1 }]}>{LANG_LABEL[l]}</Text>
                {missing ? <Text style={[T.small, { color: C.amber, fontWeight: '800' }]}>Not on this phone</Text> : null}
              </Pressable>
            );
          })}
        </View>

        {v.check === 'fallback' ? (
          <Banner
            tone="amber"
            icon="translate"
            text={`${LANG_LABEL[v.lang]} voice is not installed on this phone. Speaking in ${LANG_LABEL[v.effectiveLang]} for now. Install it in phone Settings → Text-to-speech, then tap Check again.`}
          />
        ) : null}
        {v.check === 'unknown' ? (
          <Banner tone="blue" icon="information" text="This phone did not list its voices. Tap Test voice to hear how it sounds." />
        ) : null}

        <Btn title="Test voice" icon="play-circle-outline" variant="green" onPress={announceTest} />
        <Btn title={v.check === 'checking' ? 'Checking voices…' : 'Check again'} icon="refresh" variant="outline" size="mid" loading={v.check === 'checking'} onPress={checkVoices} />

        <Card style={{ gap: S.sm }}>
          <Label>YOU WILL HEAR</Label>
          {samples.map((s, i) => (
            <Text key={i} style={[T.body, { color: C.ink2 }]}>
              • {s}
            </Text>
          ))}
          <Text style={[T.small, { color: C.muted }]}>Customer phone numbers and addresses are never read out.</Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: S.lg, gap: S.lg, paddingBottom: BOTTOM_INSET + S.xxl },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  lang: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    minHeight: 60,
    paddingHorizontal: S.lg,
    borderRadius: R.lg,
    borderWidth: 2,
    borderColor: C.line,
    backgroundColor: C.cardAlt,
  },
});
