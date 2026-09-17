import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../constants/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://hostelbites-backend-jwmt.onrender.com';

const PRESET_OUTLETS = [
  { label: '🍔 HotSpot Fast Food', id: 'HotSpot Fast Food' },
  { label: '🥘 Southern Spice', id: 'Southern Spice' },
  { label: '🍕 Midnight Pantry', id: 'Midnight Pantry' },
  { label: '🥤 Juice Corner', id: 'Juice Corner' },
  { label: '🍛 SRM Food Court', id: 'Campus Food Court' },
];

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberId, setRememberId] = useState(true);
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const navigation = useNavigation<any>();

  // Check server health on load and restore saved ID
  useEffect(() => {
    AsyncStorage.getItem('kds_saved_identifier').then((saved) => {
      if (saved) setEmail(saved);
    });

    const pingServer = async () => {
      try {
        const res = await fetch(`${API_URL}/api/health`, { method: 'GET' });
        if (res.ok) {
          setServerStatus('online');
        } else {
          setServerStatus('offline');
        }
      } catch {
        setServerStatus('offline');
      }
    };
    pingServer();
  }, []);

  const handleLogin = async () => {
    const cleanIdentifier = email.trim();
    if (!cleanIdentifier || !password) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return Alert.alert('Credentials Required', 'Please enter your Restaurant ID/Name and password.');
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/restaurants/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cleanIdentifier,
          email: cleanIdentifier,
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.token) {
        if (rememberId) {
          await AsyncStorage.setItem('kds_saved_identifier', cleanIdentifier);
        } else {
          await AsyncStorage.removeItem('kds_saved_identifier');
        }

        await AsyncStorage.setItem('restaurant_token', data.token);
        await AsyncStorage.setItem('restaurant_data', JSON.stringify(data.restaurant || {}));

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.replace('Dashboard');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Authentication Failed', data.message || 'Invalid credentials. Please verify your Restaurant ID and password.');
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Connection Error', e.message || 'Unable to connect to Zenvy Cloud Dispatch. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetSelect = (outletId: string) => {
    Haptics.selectionAsync();
    setEmail(outletId);
  };

  const handleContactOperations = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('tel:+919391955674').catch(() => {
      Alert.alert('Fleet Control', 'Contact campus merchant operations at +91 9391955674');
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <LinearGradient
        colors={['#09090B', '#111318', '#09090B']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.headerGlow} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Top Status Bar */}
        <View style={styles.statusRow}>
          <View style={styles.statusBadge}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    serverStatus === 'online'
                      ? COLORS.emerald
                      : serverStatus === 'checking'
                      ? COLORS.amber
                      : COLORS.coral,
                },
              ]}
            />
            <Text style={styles.statusText}>
              {serverStatus === 'online'
                ? 'CLOUD DISPATCH ONLINE'
                : serverStatus === 'checking'
                ? 'CONNECTING TO DISPATCH...'
                : 'OFFLINE / SERVER WAKING'}
            </Text>
          </View>

          <TouchableOpacity style={styles.helpBtn} onPress={handleContactOperations}>
            <Ionicons name="call-outline" size={14} color={COLORS.gold} />
            <Text style={styles.helpBtnText}>STORE OPS</Text>
          </TouchableOpacity>
        </View>

        {/* Brand Emblem Header */}
        <View style={styles.brandHeader}>
          <View style={styles.emblemBorder}>
            <LinearGradient colors={['#D4AF7A', '#8F662F']} style={styles.emblemCore}>
              <Ionicons name="restaurant" size={28} color="#09090B" />
            </LinearGradient>
          </View>
          <Text style={styles.title}>ZENVY</Text>
          <Text style={styles.subtitle}>KITCHEN DISPLAY SYSTEM (KDS)</Text>
          <Text style={styles.caption}>
            High-speed campus kitchen portal for live order dispatch & prep tracking
          </Text>
        </View>

        {/* Quick Outlet Selector Chips */}
        <Text style={styles.sectionLabel}>QUICK OUTLET SELECTOR</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
          {PRESET_OUTLETS.map((outlet, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.chip,
                email === outlet.id && styles.chipActive,
              ]}
              onPress={() => handlePresetSelect(outlet.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  email === outlet.id && styles.chipTextActive,
                ]}
              >
                {outlet.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Login Form Box */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>RESTAURANT ID OR NAME</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="storefront-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. HotSpot Fast Food / UUID"
              placeholderTextColor={COLORS.textDisabled}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.fieldLabel}>KITCHEN PIN / PASSWORD</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter kitchen access password"
              placeholderTextColor={COLORS.textDisabled}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Remember Me Row */}
          <View style={styles.rememberRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Switch
                value={rememberId}
                onValueChange={setRememberId}
                trackColor={{ false: '#27272A', true: COLORS.emeraldDark }}
                thumbColor={rememberId ? COLORS.emerald : '#71717A'}
              />
              <Text style={styles.rememberText}>Remember Restaurant on this Device</Text>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginBtnGradient}
            >
              {loading ? (
                <ActivityIndicator color="#09090B" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="flash" size={18} color="#09090B" />
                  <Text style={styles.btnText}>OPEN KITCHEN TERMINAL</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>SRM AP • AUTOMATED LIVE DISPATCH GATEWAY</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  headerGlow: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 320,
    height: 320,
    backgroundColor: COLORS.emerald,
    opacity: 0.08,
    borderRadius: 160,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 0.8 },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212, 175, 122, 0.12)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  helpBtnText: { fontSize: 9, fontWeight: '900', color: COLORS.gold, letterSpacing: 1 },
  brandHeader: { alignItems: 'center', marginBottom: 24 },
  emblemBorder: {
    width: 64,
    height: 64,
    borderRadius: 20,
    padding: 2,
    borderWidth: 1.5,
    borderColor: COLORS.goldBorder,
    marginBottom: 12,
    backgroundColor: '#18181B',
  },
  emblemCore: {
    flex: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 36, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: 3, textAlign: 'center' },
  subtitle: { fontSize: 11, fontWeight: '900', color: COLORS.emerald, letterSpacing: 3, textAlign: 'center', marginTop: 2 },
  caption: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
    lineHeight: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  chipsRow: { flexDirection: 'row', marginBottom: 20 },
  chip: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: COLORS.emerald,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.emeraldLight, fontWeight: '800' },
  card: {
    backgroundColor: '#141417',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 20,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  eyeBtn: { padding: 4 },
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  rememberText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  loginBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: COLORS.emerald,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  loginBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#09090B', fontSize: 14, fontWeight: '900', letterSpacing: 1.2 },
  footer: { marginTop: 28, alignItems: 'center' },
  footerText: { fontSize: 10, fontWeight: '800', color: COLORS.textDisabled, letterSpacing: 1 },
});
