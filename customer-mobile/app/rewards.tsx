import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Dimensions, Animated, Easing, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Clipboard from '@react-native-clipboard/clipboard';
import { COLORS, SHADOWS, RADIUS } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { StaggeredSection, FloatingPulse, BounceIn } from '../components/AnimatedSection';
import { LinearGradient } from 'expo-linear-gradient';
import { apiFetch } from '../utils/auth';
import { API_URL, ENDPOINTS } from '../constants/api';

const { width: SW, height: SH } = Dimensions.get('window');

// 8 Sectors matching web SpinWheel and validated by backend
const PRIZES = [
  { label: 'FREE DEL', value: 'FREEDEL', type: 'coupon', display: 'Free Delivery 🚚' },
  { label: '10 ZEN', value: 10, type: 'points', display: '10 ZenPoints 💎' },
  { label: '20 ZEN', value: 20, type: 'points', display: '20 ZenPoints 💎' },
  { label: '5 ZEN', value: 5, type: 'points', display: '5 ZenPoints 💎' },
  { label: '50 ZEN', value: 50, type: 'points', display: '50 ZenPoints 💎' },
  { label: '100 ZEN', value: 100, type: 'points', display: '100 ZenPoints 💎' },
  { label: '5 ZEN', value: 5, type: 'points', display: '5 ZenPoints 💎' },
  { label: '2 ZEN', value: 2, type: 'points', display: '2 ZenPoints 💎' },
];

export default function RewardsScreen() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const { isDark, colors } = useTheme();

  const streak = user?.streakCount || 0;
  const progressPercent = Math.min(100, (streak / 14) * 100);

  const getTier = (days: number) => {
    if (days >= 14) return 'Gold Tier';
    if (days >= 7) return 'Silver Tier';
    if (days >= 3) return 'Bronze Tier';
    return 'Starter Tier';
  };

  // Backend Eligibility State
  const [eligibility, setEligibility] = useState<{ spinsAvailable: number, nextMilestoneIn: number, spinsUsed: number } | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(true);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Wheel State
  const [spinning, setSpinning] = useState(false);
  const [selectedPrize, setSelectedPrize] = useState<string | null>(null);
  
  // Animation Values
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pointerBounce = useRef(new Animated.Value(0)).current; // Tactile Pointer Bounce
  const bulbPulse = useRef(new Animated.Value(0.3)).current;   // Perimeter Chase Lights

  useEffect(() => {
    if (user) {
      fetchEligibility();
      fetchCoupons();
    } else {
      setLoadingEligibility(false);
    }
  }, [user]);

  const fetchEligibility = async () => {
    try {
      const res = await apiFetch(`${API_URL}/api/rewards/spin-eligibility`);
      if (res.ok) {
        const data = await res.json();
        setEligibility(data);
      }
    } catch (err) {
      console.error('Failed to fetch spin eligibility:', err);
    } finally {
      setLoadingEligibility(false);
    }
  };

  const fetchCoupons = async () => {
    setLoadingCoupons(true);
    try {
      const res = await apiFetch(`${API_URL}/api/rewards/coupons`);
      if (res.ok) {
        const data = await res.json();
        setCoupons(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch user coupons:', err);
    } finally {
      setLoadingCoupons(false);
    }
  };

  const handleCopyCoupon = (code: string) => {
    Clipboard.setString(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Bulb pulsing loop
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bulbPulse, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        Animated.timing(bulbPulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const startSpin = async () => {
    if (spinning) return;
    if (!eligibility || eligibility.spinsAvailable <= 0) {
      Alert.alert('No Spins Left', 'Complete more orders to earn your next spin!');
      return;
    }

    setSpinning(true);
    setSelectedPrize(null);

    spinAnim.setValue(0);
    pointerBounce.setValue(0);

    // Predict winning prize based on developer logic: Free Delivery on 15th overall spin, else random
    const spinsCount = (eligibility.spinsUsed || 0) + 1;
    let targetIndex = 0;
    if (spinsCount % 15 === 0) {
      targetIndex = 0; // Forced to FREE DEL
    } else {
      // Pick any prize except index 0 (FREE DEL)
      targetIndex = Math.floor(Math.random() * (PRIZES.length - 1)) + 1;
    }

    const prizeRotation = (360 / PRIZES.length) * targetIndex;
    const finalVal = 8 - (targetIndex / PRIZES.length); // 8 full spins minus relative segment position

    // 1. Decelerating pointer click trigger loop
    let tickCount = 0;
    const maxTicks = 42; 
    const triggerTicks = (delay: number) => {
      if (tickCount >= maxTicks) return;

      Animated.sequence([
        Animated.timing(pointerBounce, {
          toValue: -15, // click back
          duration: delay * 0.2,
          useNativeDriver: true,
        }),
        Animated.spring(pointerBounce, {
          toValue: 0, // snap back
          friction: 4,
          tension: 110,
          useNativeDriver: true,
        })
      ]).start();

      tickCount++;
      // Progressively slower ticks to simulate deceleration
      const nextDelay = delay * 1.09;
      setTimeout(() => triggerTicks(nextDelay), delay);
    };
    triggerTicks(55); // start with fast click-ticks

    // 2. Main Wheel Spin Animation
    Animated.timing(spinAnim, {
      toValue: finalVal,
      duration: 5000,
      easing: Easing.out(Easing.bezier(0.12, 0.8, 0.32, 1)),
      useNativeDriver: true,
    }).start(async () => {
      const wonPrize = PRIZES[targetIndex];
      setSelectedPrize(wonPrize.display);
      setSpinning(false);

      // Record spin in backend
      try {
        const res = await apiFetch(`${API_URL}/api/rewards/use-spin`, {
          method: 'POST',
          body: JSON.stringify({
            prizeType: wonPrize.type,
            prizeValue: wonPrize.value
          })
        });
        
        const data = await res.json();
        if (res.ok) {
          Alert.alert(
            'You Won! 🎉', 
            `You unlocked: ${wonPrize.display}! Check your coupons & wallet.`
          );
          
          // Refresh eligibility
          fetchEligibility();
          
          // Sync fresh user profile details (points, streak, etc.)
          const profileRes = await apiFetch(ENDPOINTS.profile);
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            setUser(profileData);
          }
        } else {
          Alert.alert('Spin Recording Failed', data.message || 'Could not save spin result.');
        }
      } catch (err) {
        console.error('Failed to record spin result:', err);
        Alert.alert('Error', 'Network error registering your prize.');
      }
    });
  };

  const rotateWheel = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const txt = colors.text;
  const txtSec = colors.textSecondary;
  const bg = colors.bg;
  const cardBg = colors.card;
  const border = colors.border;

  // Perimeter Bulb Positions (8 light bulbs around the wheel rim)
  const bulbPositions = Array.from({ length: 8 }).map((_, idx) => {
    const angle = (idx * 45 * Math.PI) / 180;
    const r = 114; // slightly wider than wheel radius
    const cx = 120; // half of wheel size (240px container)
    const cy = 120;
    return {
      x: cx + r * Math.cos(angle) - 4,
      y: cy + r * Math.sin(angle) - 4,
    };
  });

  if (!user) {
    return (
      <View style={[s.container, { backgroundColor: bg }]}>
        <View style={[s.header, { borderBottomColor: border, backgroundColor: cardBg }]}>
          <TouchableOpacity
            style={[s.backBtn, { borderColor: border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6' }]}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/profile' as any);
              }
            }}
          >
            <Text style={{ fontSize: 16, color: txt }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.subText}>ELYSIAN ACCESS</Text>
            <Text style={[s.title, { color: txt }]}>Rewards & Streaks</Text>
          </View>
        </View>

        <View style={[s.center, { flex: 1, padding: 24 }]}>
          <Text style={{ fontSize: 52, marginBottom: 16 }}>👑</Text>
          <Text style={{ fontSize: 18, fontWeight: '900', color: txt, letterSpacing: 2, textAlign: 'center', marginBottom: 8 }}>
            ELYSIAN REWARDS
          </Text>
          <Text style={{ fontSize: 12, color: txtSec, textAlign: 'center', lineHeight: 18, marginBottom: 28, maxWidth: 280 }}>
            Sign in to unlock daily prize spins, earn streak cashback, and access exclusive campus delivery passes.
          </Text>

          <TouchableOpacity
            style={{
              backgroundColor: '#C9A84C',
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 16,
              marginBottom: 14,
              width: '100%',
              maxWidth: 280,
              alignItems: 'center',
              ...SHADOWS.goldGlow
            }}
            onPress={() => router.push('/login' as any)}
          >
            <Text style={{ color: '#000', fontSize: 11, fontWeight: '900', letterSpacing: 2 }}>
              SIGN IN TO UNLOCK →
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: border,
              width: '100%',
              maxWidth: 280,
              alignItems: 'center'
            }}
            onPress={() => router.replace('/(tabs)' as any)}
          >
            <Text style={{ color: txtSec, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
              EXPLORE MENUS FIRST
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: border, backgroundColor: cardBg }]}>
        <TouchableOpacity 
          style={[s.backBtn, { borderColor: border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6' }]} 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/profile' as any);
            }
          }}
        >
          <Text style={{ fontSize: 16, color: txt }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.subText}>YOUR REWARDS</Text>
          <Text style={[s.title, { color: txt }]}>Rewards & Streaks</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        
        {/* Streak Details Card */}
        <StaggeredSection delay={50} direction="up">
          <View style={[s.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={s.streakHeader}>
              <View>
                <Text style={s.cardLabel}>ORDER STREAK</Text>
                <Text style={[s.streakVal, { color: txt }]}>🔥 {streak} Days</Text>
              </View>
              <View style={s.tierBadge}>
                <Text style={s.tierBadgeText}>{getTier(streak).toUpperCase()}</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={s.progressContainer}>
              <View style={[s.progressBar, { width: `${progressPercent}%` }]} />
            </View>

            <Text style={[s.cardDesc, { color: txtSec }]}>
              Keep ordering daily to level up your tier and unlock better rewards.
            </Text>
          </View>
        </StaggeredSection>

        {/* ── DAILY SPIN WHEEL ── */}
        <StaggeredSection delay={130} direction="up">
          <Text style={[s.sectionTitle, { color: txt }]}>DAILY SPIN</Text>
          
          <View style={[s.wheelCard, { backgroundColor: cardBg, borderColor: border }]}>
            {loadingEligibility ? (
              <ActivityIndicator size="small" color="#C9A84C" style={{ marginBottom: 20 }} />
            ) : (
              <Text style={s.wheelSub}>
                {eligibility && eligibility.spinsAvailable > 0 
                  ? `${eligibility.spinsAvailable} SPIN${eligibility.spinsAvailable > 1 ? 'S' : ''} AVAILABLE! TAP TO SPIN`
                  : `NEXT SPIN IN ${eligibility?.nextMilestoneIn || 2} MORE ORDERS`}
              </Text>
            )}

            {/* Interactive Animated Pointer */}
            <Animated.View 
              style={[
                s.pointerContainer, 
                { 
                  transform: [
                    { 
                      rotate: pointerBounce.interpolate({
                        inputRange: [-25, 25],
                        outputRange: ['-25deg', '25deg']
                      }) 
                    }
                  ] 
                }
              ]}
            >
              <Text style={s.pointerIcon}>▼</Text>
            </Animated.View>

            {/* Wheel Canvas wrapper with chase lights */}
            <View style={s.wheelFrame}>
              
              {/* Pulsing Chase lights around the rim */}
              {bulbPositions.map((pos, idx) => (
                <Animated.View
                  key={idx}
                  style={[
                    s.chaseBulb,
                    {
                      left: pos.x,
                      top: pos.y,
                      opacity: bulbPulse.interpolate({
                        inputRange: [0.3, 1],
                        outputRange: idx % 2 === 0 ? [0.3, 1] : [1, 0.3] // Alternate pulsing patterns
                      })
                    }
                  ]}
                />
              ))}

              {/* Rotatable wheel block */}
              <Animated.View style={[s.wheelBody, { transform: [{ rotate: rotateWheel }] }]}>
                
                {/* 4 Overlapping lines dividing the circle into 8 segments */}
                {[0, 45, 90, 135].map((angle, idx) => (
                  <View 
                    key={idx} 
                    style={[s.wheelDividerLine, { transform: [{ rotate: `${angle}deg` }] }]} 
                  />
                ))}

                {/* Prize labels placed along the slices */}
                {PRIZES.map((prize, idx) => {
                  const angle = idx * 45 + 22.5; // center text in slice
                  return (
                    <View
                      key={idx}
                      style={[
                        s.sliceTextWrap,
                        { transform: [{ rotate: `${angle}deg` }] }
                      ]}
                    >
                      <Text style={s.sliceText} numberOfLines={1}>
                        {prize.label}
                      </Text>
                    </View>
                  );
                })}

                {/* Glass core dial */}
                <View style={s.coreBadge}>
                  <Text style={{ fontSize: 10 }}>✨</Text>
                </View>
              </Animated.View>

            </View>

            {/* Initialize Trigger Button */}
            <TouchableOpacity 
              style={[
                s.spinBtn, 
                (spinning || !eligibility || eligibility.spinsAvailable <= 0) && s.spinBtnDisabled
              ]} 
              onPress={startSpin}
              disabled={spinning || !eligibility || eligibility.spinsAvailable <= 0}
            >
              <Text style={s.spinBtnText}>
                {spinning 
                  ? 'SPINNING...' 
                  : (eligibility && eligibility.spinsAvailable <= 0) 
                    ? 'NO SPINS LEFT' 
                    : 'SPIN THE WHEEL'
                }
              </Text>
            </TouchableOpacity>

            {selectedPrize && (
              <View style={s.resultBox}>
                <Text style={s.resultLabel}>YOU WON</Text>
                <Text style={s.resultVal}>{selectedPrize}</Text>
              </View>
            )}
          </View>
        </StaggeredSection>

        {/* Streak Rewards */}
        <StaggeredSection delay={210} direction="up">
          <Text style={[s.sectionTitle, { color: txt }]}>STREAK REWARDS</Text>
          <View style={s.tierList}>
            {[
              { icon: '🥉', title: '3 Day Streak', desc: 'Free Delivery on next order', level: 'Bronze', req: 3 },
              { icon: '🥈', title: '7 Day Streak', desc: '₹50 Cashback', level: 'Silver', req: 7 },
              { icon: '🥇', title: '14 Day Streak', desc: 'Unlimited Free Delivery Pass', level: 'Gold', req: 14 }
            ].map((reward, idx) => {
              const unlocked = streak >= reward.req;
              return (
                <View 
                  key={idx} 
                  style={[
                    s.rewardRow, 
                    { backgroundColor: cardBg, borderColor: unlocked ? '#C9A84C' : border }
                  ]}
                >
                  <View style={[s.rewardIconWrap, { backgroundColor: isDark ? '#1F1E24' : '#F0F0F3' }]}>
                    <Text style={{ fontSize: 24 }}>{reward.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[s.rewardTitle, { color: txt }]}>{reward.title}</Text>
                      <View style={[s.levelBadge, { backgroundColor: unlocked ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)' }]}>
                        <Text style={[s.levelBadgeText, { color: unlocked ? '#22c55e' : txtSec }]}>
                          {reward.level.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={[s.rewardDesc, { color: txtSec }]}>{reward.desc}</Text>
                  </View>
                  <View style={[s.statusBox, unlocked && s.statusBoxUnlocked]}>
                    <Text style={[s.statusBoxText, unlocked && { color: '#22c55e' }]}>
                      {unlocked ? 'UNLOCKED' : 'LOCKED'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </StaggeredSection>
        {/* Active Won Vouchers / Coupons */}
        {coupons.length > 0 && (
          <StaggeredSection delay={280} direction="up">
            <Text style={[s.sectionTitle, { color: txt, marginTop: 16 }]}>MY ACTIVE VOUCHERS</Text>
            <View style={{ gap: 10, marginBottom: 16 }}>
              {coupons.map((c, idx) => {
                const isCopied = copiedCode === c.code;
                return (
                  <View
                    key={c.id || c.code || idx}
                    style={[s.rewardRow, { backgroundColor: cardBg, borderColor: border, justifyContent: 'space-between' }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View style={[s.rewardIconWrap, { backgroundColor: 'rgba(201,168,76,0.1)' }]}>
                        <Text style={{ fontSize: 20 }}>🎟️</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.rewardTitle, { color: txt, letterSpacing: 1 }]} numberOfLines={1}>
                          {c.code}
                        </Text>
                        <Text style={[s.rewardDesc, { color: '#C9A84C' }]}>
                          {c.type === 'FREEDEL' ? 'Free Delivery Pass' : 'Exclusive Discount'}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        s.statusBox,
                        { backgroundColor: isCopied ? '#22c55e' : 'rgba(201,168,76,0.15)', borderWidth: 1, borderColor: isCopied ? '#22c55e' : '#C9A84C' }
                      ]}
                      onPress={() => handleCopyCoupon(c.code)}
                    >
                      <Text style={[s.statusBoxText, { color: isCopied ? '#FFF' : '#C9A84C', fontWeight: '900' }]}>
                        {isCopied ? 'COPIED! ✓' : 'COPY CODE'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </StaggeredSection>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'android' ? 40 : 50 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  subText: { fontSize: 8, fontWeight: '900', color: '#C9A84C', letterSpacing: 2 },
  title: { fontSize: 18, fontWeight: '900' },

  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  card: { padding: 20, borderRadius: 28, borderWidth: 1, marginBottom: 20 },
  streakHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardLabel: { fontSize: 8, fontWeight: '900', color: '#888', letterSpacing: 1 },
  streakVal: { fontSize: 24, fontWeight: '900', marginTop: 2 },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(201,168,76,0.15)', borderWidth: 1, borderColor: '#C9A84C' },
  tierBadgeText: { fontSize: 8, fontWeight: '900', color: '#C9A84C', letterSpacing: 0.5 },

  progressContainer: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginBottom: 12 },
  progressBar: { height: '100%', borderRadius: 3, backgroundColor: '#C9A84C' },
  cardDesc: { fontSize: 9, fontWeight: '700', lineHeight: 14 },

  sectionTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 12, marginLeft: 4 },
  wheelCard: { padding: 24, borderRadius: 28, borderWidth: 1, alignItems: 'center', marginBottom: 24 },
  wheelSub: { fontSize: 8, fontWeight: '900', color: '#888', letterSpacing: 1, marginBottom: 20, textAlign: 'center' },

  // Tactile Pointer
  pointerContainer: { zIndex: 50, marginBottom: -12, transformOrigin: 'top center' },
  pointerIcon: { fontSize: 24, color: '#C9A84C', textShadowColor: 'rgba(201,168,76,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  
  // Wheel Frame
  wheelFrame: { width: 240, height: 240, position: 'relative', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  chaseBulb: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#C9A84C', zIndex: 40, shadowColor: '#C9A84C', shadowOpacity: 0.8, shadowRadius: 6 },
  
  // Wheel Body
  wheelBody: { width: 220, height: 220, borderRadius: 110, borderWidth: 4, borderColor: '#C9A84C', backgroundColor: '#0B0A0C', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', position: 'relative', shadowColor: '#C9A84C', shadowOpacity: 0.25, shadowRadius: 15, elevation: 8 },
  wheelDividerLine: { position: 'absolute', top: 0, bottom: 0, left: 107.5, width: 1.5, backgroundColor: 'rgba(201,168,76,0.22)' },
  
  // Text segments
  sliceTextWrap: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 20 },
  sliceText: { fontSize: 7, fontWeight: '900', color: '#EBE3CE', letterSpacing: 0.5, textTransform: 'uppercase', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  
  // Core center badge
  coreBadge: { position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(11,10,12,0.95)', borderWidth: 2, borderColor: '#C9A84C', justifyContent: 'center', alignItems: 'center', zIndex: 30, shadowColor: '#C9A84C', shadowOpacity: 0.4, shadowRadius: 6 },

  spinBtn: { width: '100%', height: 46, backgroundColor: '#C9A84C', borderRadius: 14, alignItems: 'center', justifyContent: 'center', ...SHADOWS.goldGlow },
  spinBtnDisabled: { backgroundColor: 'rgba(201,168,76,0.45)' },
  spinBtnText: { fontSize: 10, fontWeight: '900', color: '#000', letterSpacing: 1.5 },

  resultBox: { width: '100%', padding: 14, borderRadius: 16, backgroundColor: 'rgba(34,197,94,0.06)', borderWidth: 1.5, borderColor: 'rgba(34,197,94,0.18)', marginTop: 18, alignItems: 'center' },
  resultLabel: { fontSize: 7.5, fontWeight: '900', color: '#22c55e', letterSpacing: 1.5 },
  resultVal: { fontSize: 12, fontWeight: '900', color: '#22c55e', marginTop: 3 },

  tierList: { gap: 10 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20, borderWidth: 1, gap: 12 },
  rewardIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rewardTitle: { fontSize: 12, fontWeight: '900' },
  levelBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  levelBadgeText: { fontSize: 6, fontWeight: '900' },
  rewardDesc: { fontSize: 9, fontWeight: '700', marginTop: 2 },
  statusBox: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)' },
  statusBoxUnlocked: { backgroundColor: 'rgba(34,197,94,0.1)' },
  statusBoxText: { fontSize: 8, fontWeight: '900', color: '#888', letterSpacing: 0.5 }
});

