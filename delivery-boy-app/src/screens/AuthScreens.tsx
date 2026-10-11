// Splash, Login and PendingApproval.
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { color, radius, space, touch, type } from '../theme/tokens';
import { PrimaryButton, SecondaryButton } from '../components/ui/Buttons';
import { Spinner } from '../components/ui/Basics';
import { TOP_INSET, BOTTOM_INSET } from '../components/ui/insets';
import { useRider } from '../state/RiderProvider';
import { ApiError, NetworkError, errorMessage } from '../services/apiClient';

const logo = require('../../assets/icon.png');

export function SplashScreen() {
  const { phase, retryBoot } = useRider();
  return (
    <View style={[styles.center, { backgroundColor: color.bg }]}>
      <Image source={logo} style={styles.logo} accessibilityLabel="Zenvy Rider" />
      <Text style={[type.title2, { color: color.text }]}>Zenvy Rider</Text>
      {phase === 'splash-error' ? (
        <View style={{ gap: space.sm, alignItems: 'center', paddingHorizontal: space.xl }}>
          <Text style={[type.body, { color: color.textSecondary, textAlign: 'center' }]}>
            Can't reach Zenvy. Check your internet and try again.
          </Text>
          <SecondaryButton title="Try again" icon="refresh" onPress={retryBoot} />
        </View>
      ) : (
        <Spinner />
      )}
    </View>
  );
}

export function LoginScreen() {
  const { login } = useRider();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanPhone = (v: string) => {
    let d = v.replace(/\D/g, '');
    if (d.length > 10 && d.startsWith('91')) d = d.slice(2);
    if (d.length > 10 && d.startsWith('0')) d = d.slice(1);
    return d.slice(0, 10);
  };

  const canSubmit = phone.length === 10 && password.length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await login(phone, password);
    } catch (e) {
      if (e instanceof NetworkError) setError('No internet. Check your connection and try again.');
      else if (e instanceof ApiError && e.status === 401) setError(e.message || 'Invalid phone or password');
      else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={styles.loginWrap} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: space.xs }}>
          <Image source={logo} style={styles.logo} accessibilityLabel="Zenvy Rider" />
          <Text style={[type.title1, { color: color.text }]}>Zenvy Rider</Text>
          <Text style={[type.body, { color: color.textSecondary, textAlign: 'center' }]}>Log in with the phone number your fleet admin registered.</Text>
        </View>

        <View style={{ gap: space.xs }}>
          <Text style={[type.label, { color: color.textSecondary }]}>PHONE NUMBER</Text>
          <View style={styles.inputRow}>
            <Text style={[type.title3, { color: color.textSecondary }]}>+91</Text>
            <TextInput
              value={phone}
              onChangeText={(v) => setPhone(cleanPhone(v))}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              placeholder="10-digit mobile"
              placeholderTextColor={color.textMuted}
              style={[type.title3, styles.input]}
              accessibilityLabel="Phone number"
              maxLength={14}
              returnKeyType="next"
            />
          </View>
        </View>

        <View style={{ gap: space.xs }}>
          <Text style={[type.label, { color: color.textSecondary }]}>PASSWORD</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              placeholder="Password"
              placeholderTextColor={color.textMuted}
              style={[type.title3, styles.input]}
              accessibilityLabel="Password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <Pressable accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'} onPress={() => setShow((s) => !s)} hitSlop={12}>
              <MaterialCommunityIcons name={show ? 'eye-off-outline' : 'eye-outline'} size={26} color={color.textSecondary} />
            </Pressable>
          </View>
        </View>

        {error ? (
          <View style={styles.error} accessibilityRole="alert">
            <MaterialCommunityIcons name="alert-circle" size={20} color={color.danger} />
            <Text style={[type.body, { color: color.danger, flex: 1 }]}>{error}</Text>
          </View>
        ) : null}

        <PrimaryButton title="Log in" onPress={submit} loading={busy} disabled={!canSubmit} size="lg" />
        <Text style={[type.bodySm, { color: color.textMuted, textAlign: 'center' }]}>
          Forgot password? Ask your Zenvy fleet admin to reset it.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function PendingApprovalScreen() {
  const { recheckApproval, logout, profile, showToast } = useRider();
  const [busy, setBusy] = useState(false);
  return (
    <View style={[styles.center, { backgroundColor: color.bg, paddingHorizontal: space.lg, gap: space.md }]}>
      <View style={styles.pendingIcon}>
        <MaterialCommunityIcons name="shield-account-outline" size={44} color={color.warning} />
      </View>
      <Text style={[type.title2, { color: color.text, textAlign: 'center' }]}>
        {profile?.name ? `Hi ${profile.name.split(' ')[0]}, almost there` : 'Almost there'}
      </Text>
      <Text style={[type.body, { color: color.textSecondary, textAlign: 'center' }]}>
        Your account is being verified. You can go online once Zenvy approves your documents.
      </Text>
      <View style={{ alignSelf: 'stretch', gap: space.sm, marginTop: space.md }}>
        <PrimaryButton
          title="Check again"
          icon="refresh"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await recheckApproval();
            } catch (e) {
              showToast(errorMessage(e), 'error');
            } finally {
              setBusy(false);
            }
          }}
        />
        <SecondaryButton title="Log out" icon="logout" onPress={logout} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingTop: TOP_INSET },
  logo: { width: 88, height: 88, borderRadius: 22 },
  loginWrap: { flexGrow: 1, justifyContent: 'center', padding: space.lg, gap: space.lg, paddingTop: TOP_INSET + space.lg, paddingBottom: BOTTOM_INSET + space.lg },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: color.border,
    backgroundColor: color.surface,
    paddingHorizontal: space.md,
  },
  input: { flex: 1, color: color.text, minHeight: touch.secondary },
  error: { flexDirection: 'row', gap: space.xs, alignItems: 'center', backgroundColor: color.dangerTint, padding: space.sm, borderRadius: radius.md },
  pendingIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: color.warningTint, alignItems: 'center', justifyContent: 'center' },
});
