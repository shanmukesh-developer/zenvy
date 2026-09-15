import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING, SHADOWS } from '../constants/theme';
import { ZenvyBadge } from './ZenvyBadge';

interface FleetLoginScreenProps {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  isLoading: boolean;
  onLogin: () => void;
  onQuickDemo: () => void;
  apiHost: string;
  onOpenConfig: () => void;
}

export const FleetLoginScreen: React.FC<FleetLoginScreenProps> = ({
  email,
  setEmail,
  password,
  setPassword,
  isLoading,
  onLogin,
  onQuickDemo,
  apiHost,
  onOpenConfig,
}) => {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="#08090C" />
      <LinearGradient
        colors={['#08090C', '#12141F', '#08090C']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Emblem */}
        <View style={styles.brandHeader}>
          <View style={styles.emblemRing}>
            <LinearGradient
              colors={['#D4AF7A', '#8F662F']}
              style={styles.emblemCore}
            >
              <Text style={styles.emblemLetter}>Z</Text>
            </LinearGradient>
          </View>
          <Text style={styles.brandTitle}>ZENVY FLEET</Text>
          <Text style={styles.brandSub}>CAMPUS DISPATCH & LOGISTICS</Text>
          <ZenvyBadge
            label="SRM AP RIDER PORTAL"
            variant="gold"
            size="sm"
            style={{ marginTop: 8 }}
          />
        </View>

        {/* Login Card */}
        <View style={styles.loginCard}>
          <LinearGradient
            colors={['#141622', '#0F1118']}
            style={styles.cardGradient}
          >
            <Text style={styles.cardTitle}>Rider Authentication</Text>
            <Text style={styles.cardSub}>
              Sign in with your verified driver credentials to accept campus orders.
            </Text>

            {/* Email / Mobile Field */}
            <Text style={styles.fieldLabel}>DRIVER MOBILE OR EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="8765432100 or rider@zenvy.com"
              placeholderTextColor="#64748B"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Password Field */}
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#64748B"
              secureTextEntry
            />

            {/* Sign In Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={onLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>ENTER FLEET DUTY</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Quick Demo Login Pill */}
            <TouchableOpacity
              style={styles.demoPill}
              onPress={onQuickDemo}
              activeOpacity={0.7}
            >
              <Text style={styles.demoPillText}>
                ⚡ AUTO-FILL VIKRAM SINGH (TEST RIDER)
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Config Host IP link */}
        <TouchableOpacity
          style={styles.configLink}
          onPress={onOpenConfig}
          activeOpacity={0.7}
        >
          <Text style={styles.configLinkText}>
            ⚙ Connected Server: {apiHost}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08090C',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xxl,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  emblemRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: COLORS.goldBorder,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    ...SHADOWS.goldGlow,
  },
  emblemCore: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emblemLetter: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000000',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  loginCard: {
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 122, 0.25)',
    ...SHADOWS.cardElevated,
  },
  cardGradient: {
    padding: SPACING.xl,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cardSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: SPACING.lg,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: SPACING.md,
  },
  submitBtn: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
    ...SHADOWS.emeraldGlow,
  },
  btnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  demoPill: {
    paddingVertical: 10,
    borderRadius: RADIUS.xs,
    backgroundColor: 'rgba(212, 175, 122, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    alignItems: 'center',
  },
  demoPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.goldLight,
    letterSpacing: 0.6,
  },
  configLink: {
    marginTop: SPACING.xl,
    alignItems: 'center',
  },
  configLinkText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
});
