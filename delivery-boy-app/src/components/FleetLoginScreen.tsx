import React, { useState, useEffect, useRef } from 'react';
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
  Keyboard,
  TouchableWithoutFeedback,
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
  onForgotPassword?: () => void;
}

export const FleetLoginScreen: React.FC<FleetLoginScreenProps> = ({
  email,
  setEmail,
  password,
  setPassword,
  isLoading,
  onLogin,
  onForgotPassword,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
        setFocusedField(null);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleInputFocus = (field: 'email' | 'password') => {
    setFocusedField(field);
    setTimeout(() => {
      if (field === 'password') {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      } else {
        scrollViewRef.current?.scrollTo({ y: 80, animated: true });
      }
    }, 150);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <StatusBar barStyle="light-content" backgroundColor="#08090C" />
      <LinearGradient
        colors={['#08090C', '#12141F', '#08090C']}
        style={StyleSheet.absoluteFill}
      />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            keyboardVisible && {
              justifyContent: 'flex-start',
              paddingTop: 24,
              paddingBottom: keyboardHeight > 0 ? keyboardHeight + 40 : 120,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={true}
          showsVerticalScrollIndicator={false}
        >
          {/* Brand Emblem */}
          <View style={[styles.brandHeader, keyboardVisible && styles.brandHeaderCompact]}>
            <View style={[styles.emblemRing, keyboardVisible && styles.emblemRingCompact]}>
              <LinearGradient
                colors={['#D4AF7A', '#8F662F']}
                style={styles.emblemCore}
              >
                <Text style={[styles.emblemLetter, keyboardVisible && styles.emblemLetterCompact]}>Z</Text>
              </LinearGradient>
            </View>
            <Text style={[styles.brandTitle, keyboardVisible && styles.brandTitleCompact]}>ZENVY FLEET</Text>
            {!keyboardVisible && (
              <>
                <Text style={styles.brandSub}>CAMPUS DISPATCH & LOGISTICS</Text>
                <ZenvyBadge
                  label="SRM AP RIDER PORTAL"
                  variant="gold"
                  size="sm"
                  style={{ marginTop: 8 }}
                />
              </>
            )}
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
                style={[
                  styles.input,
                  focusedField === 'email' && styles.inputFocused,
                ]}
                value={email}
                onChangeText={setEmail}
                placeholder="Registered mobile or email"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                onFocus={() => handleInputFocus('email')}
                onBlur={() => setFocusedField(null)}
              />

              {/* Password Field */}
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <TextInput
                ref={passwordInputRef}
                style={[
                  styles.input,
                  focusedField === 'password' && styles.inputFocused,
                ]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your secure password"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                returnKeyType="go"
                onSubmitEditing={onLogin}
                onFocus={() => handleInputFocus('password')}
                onBlur={() => setFocusedField(null)}
              />

              {/* Forgot Password Row */}
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={onForgotPassword}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotText}>Forgot credentials? Contact Fleet Control</Text>
              </TouchableOpacity>

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
            </LinearGradient>
          </View>

          {/* Secure Campus Ops Footer */}
          {!keyboardVisible && (
            <View style={styles.footerContainer}>
              <Text style={styles.footerBrand}>ZENVY LOGISTICS PLATFORM</Text>
              <Text style={styles.footerSub}>SRM University AP • Campus Dispatch v1.0.0</Text>
            </View>
          )}
        </ScrollView>
      </TouchableWithoutFeedback>
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
  brandHeaderCompact: {
    marginBottom: SPACING.sm,
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
  emblemRingCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 4,
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
  emblemLetterCompact: {
    fontSize: 18,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  brandTitleCompact: {
    fontSize: 16,
    letterSpacing: 1,
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
  inputFocused: {
    borderColor: '#D4AF7A',
    backgroundColor: 'rgba(212, 175, 122, 0.08)',
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
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.lg,
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gold,
  },
  footerContainer: {
    marginTop: SPACING.xxl,
    alignItems: 'center',
  },
  footerBrand: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
  },
  footerSub: {
    fontSize: 9,
    fontWeight: '600',
    color: '#475569',
    marginTop: 4,
    letterSpacing: 0.5,
  },
});
