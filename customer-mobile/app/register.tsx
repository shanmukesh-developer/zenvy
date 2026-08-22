import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Animated, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { COLORS, SHADOWS } from '../constants/theme';
import { ENDPOINTS } from '../constants/api';
import { useAuth } from '../context/AuthContext';
import { StaggeredSection, BounceIn } from '../components/AnimatedSection';
import { setToken } from '../utils/auth';
import DopaminePressable from '../components/DopaminePressable';
import ServerWakeupOverlay from '../components/ServerWakeupOverlay';

import { useTheme } from '../context/ThemeContext';

const { width: SW, height: SH } = Dimensions.get('window');

// Official 8K curated Zenvy Campus brand visual assets
const IMAGES = [
  'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=2000&q=90', // 8K Luxury Sushi Platter
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=2000&q=90', // 8K Woodfired Artisanal Pizza
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=2000&q=90', // 8K Gourmet Burger
  'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=2000&q=90', // 8K Royal Dum Biryani
  'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=2000&q=90', // 8K Glazed Donuts
];

export default function RegisterScreen() {
  const router = useRouter();
  const { setUser } = useAuth();
  const { isDark, colors } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWakeup, setShowWakeup] = useState(false);

  // Background Slideshow Animation State
  const [imgIndex, setImgIndex] = useState(1); // offset starting image
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // 3D Parallax Hover/Drag Coordinates
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Bottom Card Entrance Animation State
  const slideUp = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    // 1. Slideshow cycle loop
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.15,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        })
      ]).start();

      setTimeout(() => {
        setImgIndex((prev) => (prev + 1) % IMAGES.length);
      }, 900);
    }, 5000);

    // 2. Card slide up on mount
    Animated.spring(slideUp, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 30,
    }).start();

    return () => clearInterval(interval);
  }, []);

  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const validateForm = () => {
    setError('');
    if (!name || name.trim().length < 2) {
      setError('Please enter your full name (minimum 2 characters)');
      return false;
    }
    const cleanedPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanedPhone || cleanedPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanedPhone)) {
      setError('Please enter a valid 10-digit mobile number (e.g. 9876543210)');
      return false;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address (e.g. name@domain.com)');
      return false;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    return true;
  };

  const handleSendOtp = async () => {
    if (!validateForm()) return;
    setLoading(true);
    setError('');
    try {
      const cleanedPhone = phone.replace(/\D/g, '').slice(-10);
      const res = await fetch(ENDPOINTS.sendOtp, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanedPhone }),
      });
      const data = await res.json();
      
      setIsOtpSent(true);
      setCountdown(30);
      const { playSound } = require('../utils/sounds');
      playSound('success');

      if (data.otp) {
        Alert.alert(
          '📲 OTP Verification Code Sent',
          `Verification SMS sent for +91 ${cleanedPhone}.\n\nYour 6-digit verification code is: ${data.otp}`,
          [{ text: 'ENTER OTP', onPress: () => {} }]
        );
      } else {
        Alert.alert(
          '📲 SMS Sent',
          `We sent a 6-digit OTP code to +91 ${cleanedPhone}. Please enter it below.`,
          [{ text: 'OK' }]
        );
      }
    } catch (e: any) {
      if (e.message && (e.message.includes('Network') || e.message.includes('Failed to fetch') || e.message.includes('JSON'))) {
        setShowWakeup(true);
      } else {
        setError(`Could not send OTP: ${e.message || 'Server unavailable. Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!otp || otp.trim().length < 6) {
      setError('Please enter the 6-digit OTP sent to your phone');
      return;
    }
    setLoading(true); 
    setError('');
    try {
      const cleanedPhone = phone.replace(/\D/g, '').slice(-10);
      const payload: any = { name: name.trim(), phone: cleanedPhone, password, otp: otp.trim() };
      if (email.trim()) payload.email = email.trim().toLowerCase();

      const res = await fetch(ENDPOINTS.register, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.token) {
          await setToken(data.token);
        }
        await setUser(data.user || data);
        const { playSound } = require('../utils/sounds');
        playSound('success');
        router.replace('/(tabs)' as any);
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (e: any) { 
      if (e.message && (e.message.includes('Network') || e.message.includes('Failed to fetch') || e.message.includes('JSON'))) {
        setShowWakeup(true);
      } else {
        setError(`Network error: ${e.message || 'Server waking up. Try again.'}`); 
      }
    }
    finally { setLoading(false); }
  };

  return (
    <View 
      {...({
        style: s.container,
        onMouseMove: (e: any) => {
          if (Platform.OS === 'web') {
            const { clientX, clientY } = e;
            const x = (clientX - SW / 2) / 32; 
            const y = (clientY - SH / 2) / 32;
            Animated.spring(pan, {
              toValue: { x, y },
              useNativeDriver: true,
              friction: 12,
            }).start();
          }
        }
      } as any)}
    >
      <ServerWakeupOverlay 
        visible={showWakeup} 
        onWakeupComplete={() => {
          setShowWakeup(false);
          handleRegister();
        }} 
      />

      {/* Background Slideshow with Parallax Shift */}
      <View style={StyleSheet.absoluteFill}>
        <Animated.Image 
          source={typeof IMAGES[imgIndex] === 'string' ? { uri: IMAGES[imgIndex] } : IMAGES[imgIndex]} 
          style={[
            StyleSheet.absoluteFill, 
            { 
              opacity: fadeAnim, 
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
                { scale: 1.15 }
              ] 
            }
          ]} 
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.15)', 'rgba(10,8,6,0.4)', 'rgba(10,8,6,0.75)']}
          locations={[0, 0.4, 0.85]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          
          {/* Header Branding */}
          <Animated.View style={[s.logoWrap, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}>
            <StaggeredSection delay={0} direction="down">
              <View style={s.iconBadge}>
                <Text style={s.logoIcon}>✨</Text>
              </View>
              <Text style={s.brand}>ZENVY</Text>
              <Text style={s.tagline}>CREATE YOUR ACCOUNT</Text>
            </StaggeredSection>
          </Animated.View>

          {/* Registration Form Sheet */}
          <Animated.View style={[
            s.card, 
            { 
              backgroundColor: isDark ? 'rgba(26,26,28,0.95)' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
              transform: [
                { translateY: Animated.add(slideUp, Animated.multiply(pan.y, -0.4)) },
                { translateX: Animated.multiply(pan.x, -0.4) }
              ] 
            }
          ]}>
            <StaggeredSection delay={100} direction="up">
              <Text style={[s.cardTitle, { color: isDark ? '#FFF' : '#111827' }]}>Create Your Account</Text>
              <Text style={[s.cardSubtitle, { color: isDark ? COLORS.textSecondary : '#6B7280' }]}>Get fresh campus food & services delivered to your hostel room</Text>

              <Text style={[s.label, { color: isDark ? COLORS.textSecondary : '#4B5563' }]}>FULL NAME</Text>
              <TextInput 
                style={[
                  s.input, 
                  { 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB', 
                    borderColor: isDark ? COLORS.borderDark : '#E5E7EB',
                    color: isDark ? '#FFF' : '#111827' 
                  }
                ]} 
                value={name} 
                onChangeText={setName} 
                placeholder="Enter your full name" 
                placeholderTextColor={isDark ? COLORS.textMuted : '#9CA3AF'} 
                editable={!isOtpSent}
              />

              <Text style={[s.label, { color: isDark ? COLORS.textSecondary : '#4B5563' }]}>EMAIL (OPTIONAL)</Text>
              <TextInput 
                style={[
                  s.input, 
                  { 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB', 
                    borderColor: isDark ? COLORS.borderDark : '#E5E7EB',
                    color: isDark ? '#FFF' : '#111827' 
                  }
                ]} 
                value={email} 
                onChangeText={setEmail} 
                placeholder="name@example.com (optional)" 
                placeholderTextColor={isDark ? COLORS.textMuted : '#9CA3AF'} 
                keyboardType="email-address" 
                autoCapitalize="none" 
                editable={!isOtpSent}
              />

              <Text style={[s.label, { color: isDark ? COLORS.textSecondary : '#4B5563' }]}>PHONE NUMBER</Text>
              <TextInput 
                style={[
                  s.input, 
                  { 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB', 
                    borderColor: isDark ? COLORS.borderDark : '#E5E7EB',
                    color: isDark ? '#FFF' : '#111827' 
                  }
                ]} 
                value={phone} 
                onChangeText={setPhone} 
                placeholder="Enter 10-digit mobile number" 
                placeholderTextColor={isDark ? COLORS.textMuted : '#9CA3AF'} 
                keyboardType="phone-pad" 
                editable={!isOtpSent}
              />

              <Text style={[s.label, { color: isDark ? COLORS.textSecondary : '#4B5563' }]}>PASSWORD</Text>
              <TextInput 
                style={[
                  s.input, 
                  { 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB', 
                    borderColor: isDark ? COLORS.borderDark : '#E5E7EB',
                    color: isDark ? '#FFF' : '#111827' 
                  }
                ]} 
                value={password} 
                onChangeText={setPassword} 
                placeholder="Enter password (min 8 chars)" 
                placeholderTextColor={isDark ? COLORS.textMuted : '#9CA3AF'} 
                secureTextEntry 
                editable={!isOtpSent}
              />

              {isOtpSent && (
                <View style={{ marginTop: 12 }}>
                  <Text style={[s.label, { color: COLORS.gold, fontWeight: '900' }]}>ENTER 6-DIGIT PHONE OTP</Text>
                  <TextInput 
                    style={[
                      s.input, 
                      { 
                        backgroundColor: isDark ? 'rgba(201,168,76,0.1)' : '#FEF3C7',
                        borderColor: COLORS.gold, 
                        fontSize: 20, 
                        letterSpacing: 6, 
                        textAlign: 'center', 
                        fontWeight: '900',
                        color: isDark ? '#FFF' : '#78350F'
                      }
                    ]} 
                    value={otp} 
                    onChangeText={setOtp} 
                    placeholder="123456" 
                    placeholderTextColor={isDark ? COLORS.textMuted : '#B45309'} 
                    keyboardType="number-pad" 
                    maxLength={6}
                  />
                  <TouchableOpacity 
                    disabled={countdown > 0} 
                    onPress={handleSendOtp}
                    style={{ alignSelf: 'flex-end', marginTop: 6 }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '800', color: countdown > 0 ? (isDark ? COLORS.textMuted : '#9CA3AF') : COLORS.gold }}>
                      {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {error ? <Text style={s.error}>{error}</Text> : null}

              {!isOtpSent ? (
                <TouchableOpacity style={s.regBtn} onPress={handleSendOtp} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={s.regBtnText}>VERIFY PHONE & CONTINUE</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.regBtn} onPress={handleRegister} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={s.regBtnText}>VERIFY OTP & CREATE ACCOUNT</Text>
                  )}
                </TouchableOpacity>
              )}

              <DopaminePressable onPress={() => router.push('/login' as any)} style={s.switchLink} sound="click">
                <Text style={[s.switchText, { color: isDark ? COLORS.textSecondary : '#6B7280' }]}>
                  Already have an account? <Text style={{ color: COLORS.gold, fontWeight: '800' }}>SIGN IN</Text>
                </Text>
              </DopaminePressable>
            </StaggeredSection>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  scroll: { 
    flexGrow: 1, 
    justifyContent: 'flex-end',
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  
  logoWrap: { 
    alignItems: 'center', 
    marginBottom: 20, 
    marginTop: Platform.OS === 'web' ? 30 : 40, 
    paddingHorizontal: 24, 
    zIndex: 5 
  },
  iconBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(201, 168, 76, 0.1)', borderWidth: 1.5, borderColor: COLORS.goldBorder, alignItems: 'center', justifyContent: 'center', ...SHADOWS.goldGlow },
  logoIcon: { fontSize: 28 },
  brand: { fontSize: 32, fontWeight: '900', color: COLORS.gold, letterSpacing: 8, marginTop: 10, textShadowColor: 'rgba(201,168,76,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  tagline: { fontSize: 8, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 3, marginTop: 4, textTransform: 'uppercase' },
  
  card: {
    backgroundColor: 'rgba(26,26,28,0.94)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderBottomLeftRadius: Platform.OS === 'web' ? 32 : 0,
    borderBottomRightRadius: Platform.OS === 'web' ? 32 : 0,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 36,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    marginBottom: Platform.OS === 'web' ? 24 : 0,
    ...SHADOWS.card,
    zIndex: 15,
  },
  cardTitle: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  cardSubtitle: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', marginTop: 4, marginBottom: 8, letterSpacing: 0.5 },
  
  label: { fontSize: 8, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 2.5, marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: COLORS.borderDark, borderRadius: 14, padding: 13, fontSize: 13, color: '#fff', fontWeight: '600' },
  error: { color: '#EF4444', fontSize: 11, fontWeight: '600', marginTop: 8 },
  
  regBtn: { backgroundColor: COLORS.gold, paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 20, ...SHADOWS.goldGlow },
  regBtnText: { fontSize: 11, fontWeight: '900', color: '#000', letterSpacing: 3 },
  
  switchLink: { alignItems: 'center', marginTop: 20 },
  switchText: { fontSize: 11, color: COLORS.textSecondary },
});
