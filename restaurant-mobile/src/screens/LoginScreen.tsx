// Real restaurant login (POST /api/restaurants/login). No presets or pre-filled passwords.
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SUPPORT_PHONE } from '../constants/api';
import { Button } from '../components/ui';
import { ApiError, NetworkError } from '../services/apiClient';
import { health, login } from '../services/restaurantApi';
import { loadSavedId, setSavedId } from '../services/session';
import { useSession } from '../state/SessionProvider';
import { color, radius, space, touch, type } from '../theme/tokens';

type ServerState = 'checking' | 'up' | 'waking';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, notice, clearNotice } = useSession();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [, force] = useState(0);
  const [server, setServer] = useState<ServerState>('checking');
  const pwRef = useRef<TextInput>(null);

  useEffect(() => {
    loadSavedId().then((v) => { if (v) setIdentifier(v); });
    let alive = true;
    health().then((ok) => { if (alive) setServer(ok ? 'up' : 'waking'); });
    return () => { alive = false; };
  }, []);

  // Re-render each second while locked so the button re-enables on time.
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const t = setInterval(() => {
      force((n) => n + 1);
      if (Date.now() >= lockedUntil) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);
  const locked = lockedUntil > Date.now();

  const submit = async () => {
    const id = identifier.trim();
    if (!id || !password) {
      setError('Enter your restaurant ID (or registered name) and password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    clearNotice();
    try {
      const data = await login(id, password);
      if (!data?.token || !data?.restaurant) throw new Error('bad response');
      await setSavedId(remember ? id : null);
      await signIn(data.token, data.restaurant);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        if (e.status === 429) setLockedUntil(Date.now() + 60000);
      } else if (e instanceof NetworkError) {
        setError(server === 'waking' ? 'Zenvy is still waking up. Please try again in a few seconds.' : 'No internet connection. Check your Wi-Fi or mobile data.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const call = () => Linking.openURL(`tel:+${SUPPORT_PHONE}`).catch(() => {});
  const wa = () => Linking.openURL(`https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent('Hi Zenvy, I need help logging in to the restaurant partner app.')}`).catch(() => {});

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
          <Text style={[type.title1, { color: color.text }]}>Zenvy Partner</Text>
          <Text style={[type.body, { color: color.textSecondary }]}>Restaurant login</Text>
        </View>

        {notice ? (
          <View style={[styles.msg, { backgroundColor: color.warningTint }]}>
            <Ionicons name="time-outline" size={20} color={color.warning} />
            <Text style={[type.body, { color: color.warning, flex: 1 }]}>{notice}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>Restaurant ID or registered name</Text>
          <TextInput
            value={identifier}
            onChangeText={(t) => { setIdentifier(t); setError(null); }}
            placeholder="e.g. your restaurant name"
            placeholderTextColor={color.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            returnKeyType="next"
            onSubmitEditing={() => pwRef.current?.focus()}
            style={styles.input}
            accessibilityLabel="Restaurant ID or registered name"
          />

          <Text style={[styles.label, { marginTop: space.md }]}>Password</Text>
          <View style={styles.pwRow}>
            <TextInput
              ref={pwRef}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(null); }}
              placeholder="Password"
              placeholderTextColor={color.textMuted}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              returnKeyType="go"
              onSubmitEditing={submit}
              style={[styles.input, { flex: 1, borderWidth: 0 }]}
              accessibilityLabel="Password"
            />
            <Pressable onPress={() => setShowPw((v) => !v)} accessibilityRole="button" accessibilityLabel={showPw ? 'Hide password' : 'Show password'} style={styles.eye}>
              <Ionicons name={showPw ? 'eye-off' : 'eye'} size={22} color={color.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.rememberRow}>
            <Text style={[type.body, { color: color.text, flex: 1 }]}>Remember restaurant ID</Text>
            <Switch value={remember} onValueChange={setRemember} trackColor={{ true: color.open, false: color.border }} thumbColor={color.surface} accessibilityLabel="Remember restaurant ID" />
          </View>

          {error ? (
            <View style={[styles.msg, { backgroundColor: color.alertTint, marginTop: space.sm }]} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={20} color={color.alert} />
              <Text style={[type.body, { color: color.alertDark, flex: 1 }]}>{error}</Text>
            </View>
          ) : null}

          <Button
            label={locked ? `Try again in ${Math.ceil((lockedUntil - Date.now()) / 1000)} s` : 'Log in'}
            onPress={submit}
            loading={submitting}
            disabled={locked}
            variant="primary"
            style={{ marginTop: space.md, minHeight: 56 }}
          />
        </View>

        <View style={styles.server}>
          {server === 'checking' ? <ActivityIndicator size="small" color={color.textMuted} /> : (
            <View style={[styles.dot, { backgroundColor: server === 'up' ? color.open : color.warning }]} />
          )}
          <Text style={[type.bodySm, { color: color.textMuted }]}>
            {server === 'checking' ? 'Checking Zenvy server…' : server === 'up' ? 'Zenvy server is online' : 'Server waking up — first login may take ~30 s'}
          </Text>
        </View>

        <View style={styles.help}>
          <Text style={[type.body, { color: color.textSecondary, textAlign: 'center' }]}>Forgot password or new partner?</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="Call Zenvy" icon="call" variant="secondary" size="secondary" onPress={call} style={{ flex: 1 }} />
            <Button label="WhatsApp" icon="logo-whatsapp" variant="secondary" size="secondary" onPress={wa} style={{ flex: 1 }} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.md, gap: space.lg, flexGrow: 1, maxWidth: 520, width: '100%', alignSelf: 'center' },
  brand: { alignItems: 'center', gap: space.xxs },
  logo: { width: 72, height: 72, borderRadius: radius.lg, marginBottom: space.xs },
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.md, borderWidth: 1, borderColor: color.border },
  label: { ...type.label, color: color.textSecondary, marginBottom: space.xxs },
  input: {
    minHeight: touch.secondary + 4, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, paddingHorizontal: space.sm,
    ...type.body, color: color.text, backgroundColor: color.surface,
  },
  pwRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: color.border, borderRadius: radius.md },
  eye: { width: touch.icon, height: touch.icon, alignItems: 'center', justifyContent: 'center' },
  rememberRow: { flexDirection: 'row', alignItems: 'center', minHeight: touch.minHit, marginTop: space.sm },
  msg: { flexDirection: 'row', alignItems: 'center', gap: space.xs, borderRadius: radius.md, padding: space.sm },
  server: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
  help: { gap: space.sm, marginTop: 'auto' },
});
