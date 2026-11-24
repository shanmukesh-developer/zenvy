/**
 * About ZenWe (owner, 24 Nov 2026): replaces the old "About" popup. Information about the app only - what ZenWe does,
 * where it delivers, how to reach us (the support email, for help, promotions and collaborations), the version and the
 * policies. No personal details of anyone (no developer / founder name, no phone numbers) anywhere in it.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useDietLight } from '../components/local/dietLightTheme';
import { useTopInset } from '../utils/useTopInset';
import ZenvBadge from '../components/ZenvBadge';
import { appVersionText } from '../components/ProfileSettingsSection';
import { ZENWE_SUPPORT_EMAIL, zenweMailto } from '../constants/api';
import { openLegal, type LegalPage } from '../utils/legal';

type IconName = keyof typeof Ionicons.glyphMap;

const OFFERS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'restaurant-outline', title: 'Food', text: 'Meals from campus restaurants, tiffins and fast food, delivered in fixed evening slots.' },
  { icon: 'basket-outline', title: 'Groceries & fruits', text: 'Daily needs and fresh fruit from nearby stores.' },
  { icon: 'shirt-outline', title: 'Laundry', text: 'Wash, dry clean and ironing, picked up from your room.' },
  { icon: 'bicycle-outline', title: 'Co-Ride', text: 'Share bike and car rides or a shared auto with other students.' },
];

const PLACES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'school-outline', title: 'SRM University AP', text: 'Delivered to your hostel block.' },
  { icon: 'school-outline', title: 'Amrita University', text: 'Delivered at the Amrita main gate.' },
];

const POLICIES: { key: LegalPage; label: string }[] = [
  { key: 'terms', label: 'Terms of Service' },
  { key: 'privacy', label: 'Privacy Policy' },
  { key: 'refunds', label: 'Refunds & cancellations' },
];

const PACKAGE = (Constants.expoConfig as any)?.android?.package || 'com.srm.hostelbites';

export default function AboutScreen() {
  const router = useRouter();
  const d = useDietLight();
  const topPad = useTopInset();

  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)' as any); };
  const email = () => {
    Linking.openURL(zenweMailto('Hello ZenWe')).catch(() => Alert.alert('Could not open your email app', `Write to us at ${ZENWE_SUPPORT_EMAIL}.`));
  };
  const openPlay = () => {
    Linking.openURL(`market://details?id=${PACKAGE}`)
      .catch(() => Linking.openURL(`https://play.google.com/store/apps/details?id=${PACKAGE}`).catch(() => {}));
  };

  const card = [st.card, { backgroundColor: d.card, borderColor: d.edge }];
  const Row = ({ icon, title, text, last }: { icon: IconName; title: string; text: string; last?: boolean }) => (
    <View style={[st.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: d.line }]}>
      <View style={[st.iconWell, { backgroundColor: d.soft }]}><Ionicons name={icon} size={18} color={d.acc} /></View>
      <View style={{ flex: 1 }}>
        <Text style={[st.rowTitle, { color: d.dk }]}>{title}</Text>
        <Text style={[st.rowText, { color: d.muteInk }]}>{text}</Text>
      </View>
    </View>
  );

  return (
    <View style={[st.container, { paddingTop: topPad, backgroundColor: d.top }]}>
      <View style={[st.header, { backgroundColor: d.top }]}>
        <TouchableOpacity style={[st.backBtn, { borderColor: d.line, backgroundColor: d.card }]} onPress={back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={18} color={d.dk} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[st.kicker, { color: d.acc }]}>Version & info</Text>
          <Text style={[st.title, { color: d.dk }]}>About ZenWe</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1, backgroundColor: d.page }} contentContainerStyle={st.body}>
        <View style={st.brand} accessible accessibilityRole="header" accessibilityLabel="ZenWe">
          <ZenvBadge size={72} />
          <Text style={[st.wordmark, { color: d.dk }]}>Zen<Text style={{ color: d.acc }}>We</Text></Text>
          <Text style={[st.tagline, { color: d.muteInk }]}>Food, groceries, laundry and rides for students, delivered on campus.</Text>
        </View>

        <Text style={[st.section, { color: d.dk }]}>What we do</Text>
        <View style={card}>
          {OFFERS.map((o, i) => <Row key={o.title} {...o} last={i === OFFERS.length - 1} />)}
        </View>

        <Text style={[st.section, { color: d.dk }]}>Where we deliver</Text>
        <View style={card}>
          {PLACES.map((p, i) => <Row key={p.title} {...p} last={i === PLACES.length - 1} />)}
        </View>

        <Text style={[st.section, { color: d.dk }]}>Contact us</Text>
        <View style={[card, { padding: 14 }]}>
          <Text style={[st.rowText, { color: d.muteInk, marginBottom: 12 }]}>
            For help with an order, raise a ticket in Help & support. For anything else, including promotions and
            collaborations, email us.
          </Text>
          <TouchableOpacity onPress={email} style={[st.emailBtn, { backgroundColor: d.acc }]} accessibilityRole="button" accessibilityLabel={`Email ZenWe at ${ZENWE_SUPPORT_EMAIL}`}>
            <Ionicons name="mail-outline" size={16} color={d.onAcc} />
            <Text style={[st.emailBtnText, { color: d.onAcc }]}>Email us</Text>
          </TouchableOpacity>
          <Text selectable style={[st.email, { color: d.dk }]}>{ZENWE_SUPPORT_EMAIL}</Text>
          <TouchableOpacity onPress={() => router.push('/support' as any)} style={st.linkRow} accessibilityRole="link">
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={d.acc} />
            <Text style={[st.link, { color: d.acc }]}>Help & support</Text>
          </TouchableOpacity>
        </View>

        <Text style={[st.section, { color: d.dk }]}>App</Text>
        <View style={card}>
          <TouchableOpacity onPress={openPlay} style={[st.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: d.line }]} accessibilityRole="button" accessibilityHint="Opens ZenWe on Google Play to check for updates">
            <View style={[st.iconWell, { backgroundColor: d.soft }]}><Ionicons name="pricetag-outline" size={18} color={d.acc} /></View>
            <Text style={[st.rowTitle, { color: d.dk, flex: 1 }]}>Version</Text>
            <Text style={[st.rowTitle, { color: d.dk }]}>{appVersionText()}</Text>
            <Ionicons name="chevron-forward" size={16} color={d.muteInk} />
          </TouchableOpacity>
          {POLICIES.map((p, i) => (
            <TouchableOpacity key={p.key} onPress={() => openLegal(p.key)} style={[st.row, i < POLICIES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: d.line }]} accessibilityRole="link">
              <View style={[st.iconWell, { backgroundColor: d.soft }]}><Ionicons name="document-text-outline" size={18} color={d.acc} /></View>
              <Text style={[st.rowTitle, { color: d.dk, flex: 1 }]}>{p.label}</Text>
              <Ionicons name="open-outline" size={15} color={d.muteInk} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[st.footer, { color: d.muteInk }]}>ZenWe · Version {appVersionText()}</Text>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  title: { fontSize: 18, fontWeight: '900' },
  body: { padding: 16, paddingBottom: 40 },
  brand: { alignItems: 'center', marginTop: 4, marginBottom: 8 },
  wordmark: { fontSize: 30, fontWeight: '900', marginTop: 10, letterSpacing: 0.3 },
  tagline: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6, marginHorizontal: 12 },
  section: { fontSize: 14, fontWeight: '900', marginTop: 20, marginBottom: 8, marginLeft: 2 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  iconWell: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '800' },
  rowText: { fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  emailBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12 },
  emailBtnText: { fontSize: 14, fontWeight: '800' },
  email: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 12, paddingVertical: 4 },
  link: { fontSize: 13, fontWeight: '800' },
  footer: { fontSize: 12, textAlign: 'center', marginTop: 24 },
});
