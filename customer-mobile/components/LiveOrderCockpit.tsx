import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  Alert,
  Share,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SHADOWS, RADIUS } from '../constants/theme';
import SafeImage from './SafeImage';

const { width: SW } = Dimensions.get('window');

interface LiveOrderCockpitProps {
  status: number; // 1: Placed, 2: Accepted, 3: Preparing, 4: On The Way, 5: Arrived at Gate, 6: Delivered
  currentCheckpoint?: string;
  isDark?: boolean;
  restaurantName?: string;
  hostelAddress?: string;
  orderId?: string;
  deliveryPin?: string;
  riderInfo?: any;
  onOpenChat?: () => void;
}

const MILESTONES = [
  { id: 1, label: 'Order Confirmed', sub: 'Kitchen accepted your order', icon: '📝', est: '0m' },
  { id: 2, label: 'Fresh Preparation', sub: 'Chef is cooking your meal hot & fresh', icon: '🍳', est: '6m' },
  { id: 3, label: 'Captain On The Way', sub: 'Rider picked up package & in transit', icon: '🛵', est: '12m' },
  { id: 4, label: 'At Campus Main Gate', sub: 'Rider cleared security & entering hostel sector', icon: '🛡️', est: '18m' },
  { id: 5, label: 'Arrived at Drop Point', sub: 'Rider is waiting with your order', icon: '🏠', est: '20m' },
];

export default function LiveOrderCockpit({
  status = 4,
  currentCheckpoint = 'Neerukonda Main Road',
  isDark = true,
  restaurantName = 'Paradise Kitchen',
  hostelAddress = 'Hostel Block C',
  orderId = 'ZV-8821',
  deliveryPin = '4829',
  riderInfo = {
    name: 'Ravi Kumar',
    phone: '+919876543210',
    vehicleNumber: 'AP 39 ZV 4022',
    vehicleType: 'Hero Splendor Plus',
    rating: 4.9,
    photoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&q=80',
  },
  onOpenChat,
}: LiveOrderCockpitProps) {
  const [speed, setSpeed] = useState<number>(36);
  const [etaMinutes, setEtaMinutes] = useState<number>(status >= 5 ? 1 : status === 4 ? 11 : 18);
  const [copiedPin, setCopiedPin] = useState(false);

  useEffect(() => {
    if (status === 4) {
      const interval = setInterval(() => {
        setSpeed((prev) => Math.min(46, Math.max(26, prev + Math.floor(Math.random() * 7) - 3)));
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [status]);

  const handleCallRider = () => {
    if (riderInfo.phone) {
      Linking.openURL(`tel:${riderInfo.phone}`).catch(() => {
        Alert.alert('Calling Rider', `Rider contact: ${riderInfo.phone}`);
      });
    } else {
      Alert.alert('Rider Assigned', 'Your delivery captain will contact you upon arriving at the campus gate.');
    }
  };

  const handleShareTracking = async () => {
    try {
      await Share.share({
        message: `Track my Zenvy campus food delivery order #${orderId.slice(-6).toUpperCase()} live to ${hostelAddress}! Delivery PIN: ${deliveryPin}`,
      });
    } catch {
      Clipboard.setString(`https://zenvy.in/track/${orderId}`);
      Alert.alert('Link Copied', 'Live order tracking link copied to clipboard!');
    }
  };

  const handleCopyPin = () => {
    Clipboard.setString(deliveryPin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const progressPercent = Math.min(100, Math.max(10, (status / 5) * 100));

  const cardBg = isDark ? '#141416' : '#FFFFFF';
  const border = isDark ? 'rgba(212, 175, 55, 0.25)' : 'rgba(0, 0, 0, 0.08)';
  const txt = isDark ? '#FFFFFF' : '#0F172A';
  const txtSec = isDark ? '#94A3B8' : '#64748B';

  return (
    <View style={[styles.cockpitCard, { backgroundColor: cardBg, borderColor: border }]}>
      {/* ── TOP HERO BANNER (DYNAMIC ISLAND ETA) ── */}
      <LinearGradient
        colors={isDark ? ['#1E1B18', '#141416'] : ['#FEF3C7', '#FFFBEB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGradient}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.liveBeaconWrap}>
            <View style={styles.liveBeaconDot} />
            <Text style={styles.liveBeaconText}>LIVE DISPATCH COCKPIT</Text>
          </View>
          <Text style={[styles.orderIdBadge, { color: COLORS.gold }]}>#{orderId.slice(-6).toUpperCase()}</Text>
        </View>

        <View style={styles.etaRow}>
          <View>
            <Text style={[styles.etaTitle, { color: txt }]}>
              {status >= 6 ? 'Order Delivered 🎉' : status === 5 ? 'Arrived at Gate 🔔' : `Arriving in ${etaMinutes} mins ⚡`}
            </Text>
            <Text style={[styles.etaSubtitle, { color: txtSec }]}>
              {status >= 5 ? 'Waiting for handoff with delivery PIN' : `From ${restaurantName} ➔ ${hostelAddress}`}
            </Text>
          </View>
          <View style={[styles.etaPulseIconBox, { backgroundColor: COLORS.gold }]}>
            <Text style={{ fontSize: 22 }}>{status === 5 ? '🏠' : status === 4 ? '🛵' : '🍳'}</Text>
          </View>
        </View>

        {/* Dynamic Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: COLORS.gold }]} />
        </View>
      </LinearGradient>

      {/* ── VERIFIED RIDER DRIVER CARD ── */}
      <View style={[styles.riderSection, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
        <View style={styles.riderAvatarWrapper}>
          <SafeImage
            source={{ uri: riderInfo.photoUrl }}
            fallbackUri="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&q=80"
            style={styles.riderPhoto}
          />
          <View style={styles.riderOnlineBadge}>
            <Text style={{ fontSize: 8 }}>⚡</Text>
          </View>
        </View>

        <View style={{ flex: 1, paddingHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.riderName, { color: txt }]}>{riderInfo.name || 'Campus Delivery Captain'}</Text>
            <View style={styles.ratingPill}>
              <Text style={styles.ratingText}>⭐ {riderInfo.rating || 4.9}</Text>
            </View>
          </View>
          <Text style={[styles.vehicleText, { color: txtSec }]}>
            {riderInfo.vehicleType || 'Hero Splendor'} • <Text style={{ fontWeight: '800', color: txt }}>{riderInfo.vehicleNumber || 'AP 39 ZV 4022'}</Text>
          </Text>
          <Text style={styles.securityTag}>🛡️ SRM Campus Background Verified</Text>
        </View>

        {/* Quick Contact Action Buttons */}
        <View style={styles.actionButtonsCol}>
          <TouchableOpacity style={[styles.actionRoundBtn, { backgroundColor: '#10B981' }]} onPress={handleCallRider}>
            <Text style={{ fontSize: 16 }}>📞</Text>
          </TouchableOpacity>
          {onOpenChat && (
            <TouchableOpacity style={[styles.actionRoundBtn, { backgroundColor: COLORS.gold }]} onPress={onOpenChat}>
              <Text style={{ fontSize: 16 }}>💬</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── DELIVERY SECURITY PIN CARD ── */}
      {status < 6 && (
        <View style={[styles.pinBox, { backgroundColor: isDark ? 'rgba(212,175,55,0.08)' : '#FFFBEB', borderColor: isDark ? 'rgba(212,175,55,0.3)' : '#FDE68A' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pinHeading, { color: COLORS.gold }]}>DELIVERY GATE OTP PIN</Text>
            <Text style={[styles.pinDescription, { color: txtSec }]}>Share this 4-digit code with your rider upon room arrival</Text>
          </View>
          <TouchableOpacity style={styles.pinCodePill} onPress={handleCopyPin}>
            <Text style={styles.pinDigits}>{deliveryPin}</Text>
            <Text style={{ fontSize: 10, marginLeft: 4 }}>{copiedPin ? '✅' : '📋'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── STEP-BY-STEP LIVE CHECKPOINTS PROGRESSOR ── */}
      <View style={styles.milestonesContainer}>
        <Text style={[styles.milestonesSectionTitle, { color: txtSec }]}>LIVE ROUTE CHECKPOINTS</Text>

        {MILESTONES.map((m, idx) => {
          const isDone = status >= m.id;
          const isCurrent = status === m.id || (status === 4 && m.id === 3);
          const isPending = status < m.id && !isCurrent;

          return (
            <View key={m.id} style={styles.milestoneRow}>
              {/* Timeline Icon Node */}
              <View style={styles.timelineNodeCol}>
                <View
                  style={[
                    styles.timelineDot,
                    isDone && { backgroundColor: COLORS.gold, borderColor: '#FFF' },
                    isCurrent && { backgroundColor: COLORS.gold, transform: [{ scale: 1.2 }], borderWidth: 2, borderColor: '#FFF' },
                    isPending && { backgroundColor: isDark ? '#2D3748' : '#E2E8F0' },
                  ]}
                >
                  <Text style={{ fontSize: 12 }}>{m.icon}</Text>
                </View>
                {idx < MILESTONES.length - 1 && (
                  <View
                    style={[
                      styles.timelineLine,
                      { backgroundColor: isDone ? COLORS.gold : (isDark ? '#2D3748' : '#E2E8F0') },
                    ]}
                  />
                )}
              </View>

              {/* Text Description */}
              <View style={{ flex: 1, paddingBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text
                    style={[
                      styles.milestoneLabel,
                      { color: isCurrent ? COLORS.gold : isDone ? txt : txtSec },
                      isCurrent && { fontWeight: '900' },
                    ]}
                  >
                    {m.label}
                  </Text>
                  <Text style={[styles.milestoneEst, { color: isCurrent ? COLORS.gold : txtSec }]}>
                    {isDone ? 'DONE' : `~${m.est}`}
                  </Text>
                </View>
                <Text style={[styles.milestoneSub, { color: txtSec }]} numberOfLines={2}>
                  {m.id === 3 && status === 4 ? `Passing through ${currentCheckpoint}` : m.sub}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* ── BOTTOM TELEMETRY FOOTER & SHARE BUTTON ── */}
      <View style={styles.footerRow}>
        <View style={styles.telemetryTag}>
          <Text style={[styles.telemetryTagText, { color: txtSec }]}>
            SPEED: <Text style={{ color: COLORS.gold, fontWeight: '800' }}>{speed} KM/H</Text> • 4G GPS LOCKED
          </Text>
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShareTracking}>
          <Text style={styles.shareBtnText}>🔗 SHARE LIVE LINK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cockpitCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: 16,
    ...SHADOWS.goldGlow,
  },
  heroGradient: {
    padding: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveBeaconWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveBeaconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  liveBeaconText: {
    fontSize: 8,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 1.5,
  },
  orderIdBadge: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  etaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  etaTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  etaSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  etaPulseIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginTop: 14,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  riderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  riderAvatarWrapper: {
    position: 'relative',
  },
  riderPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  riderOnlineBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#10B981',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  riderName: {
    fontSize: 13,
    fontWeight: '800',
  },
  ratingPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#92400E',
  },
  vehicleText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  securityTag: {
    fontSize: 9,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 2,
  },
  actionButtonsCol: {
    flexDirection: 'row',
    gap: 8,
  },
  actionRoundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  pinBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  pinHeading: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  pinDescription: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  pinCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4AF37',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  pinDigits: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 2,
  },
  milestonesContainer: {
    padding: 16,
    paddingBottom: 0,
  },
  milestonesSectionTitle: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  milestoneRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineNodeCol: {
    alignItems: 'center',
    width: 28,
  },
  timelineDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
    minHeight: 24,
  },
  milestoneLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  milestoneEst: {
    fontSize: 9,
    fontWeight: '800',
  },
  milestoneSub: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    paddingTop: 10,
  },
  telemetryTag: {
    flex: 1,
  },
  telemetryTagText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  shareBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  shareBtnText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
});
