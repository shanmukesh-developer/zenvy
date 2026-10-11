import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, Platform, ActivityIndicator, Alert, Linking, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS, SHADOWS, RADIUS } from '../../constants/theme';
import { API_URL, ENDPOINTS, ZENVY_SUPPORT_WHATSAPP } from '../../constants/api';
import { apiFetch } from '../../utils/auth';
import { useLiveSync } from '../../utils/useLiveSync';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { StaggeredSection } from '../../components/AnimatedSection';

const { width: SW } = Dimensions.get('window');

interface Room {
  id: string;
  roomNumber: string;
  sharingType: number;
  pricePerBed: number;
  totalBeds: number;
  availableBeds: number;
  floorNumber: number;
  hasAttachedBathroom: boolean;
  hasAC: boolean;
  hasBalcony: boolean;
  furnishing: string;
  images: string[];
}

type MealSlot = string | { start?: string; end?: string } | null | undefined;

interface PG {
  id: string;
  name: string;
  address: string;
  genderType: string;
  distanceFromCollege: number;
  baseRent: number;
  securityDeposit: number;
  description: string;
  amenities: string[];
  images: string[];
  messMenu: Record<string, { breakfast?: string; lunch?: string; dinner?: string }>;
  foodTimetable: { breakfast?: MealSlot; lunch?: MealSlot; dinner?: MealSlot };
  rules: string[];
  totalRooms?: number;
  contactInfo: {
    phone?: string;
    email?: string;
    ownerName?: string;
    wardenName?: string;
    warden?: string; // legacy admin-dashboard field
    emergencyContact?: string;
    lat?: number | string;
    lng?: number | string;
  };
  rooms?: Room[];
}

interface MyBooking {
  id: string;
  status: 'Pending' | 'Confirmed' | 'Cancelled';
  checkInDate: string;
  hostel?: { id: string; name: string } | null;
  room?: { id: string; roomNumber: string; sharingType: number; pricePerBed: number } | null;
}

/** Local (device-time) YYYY-MM-DD, so the default is never "yesterday" before 5:30 AM IST. */
function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Next 30 days, starting today, for the check-in date picker. */
function buildCheckInOptions(): { ymd: string; top: string; bottom: string }[] {
  const out: { ymd: string; top: string; bottom: string }[] = [];
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  for (let i = 0; i < 30; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push({
      ymd: toLocalYmd(d),
      top: i === 0 ? 'TODAY' : i === 1 ? 'TMRW' : d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase(),
      bottom: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    });
  }
  return out;
}

function prettyDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d, 12).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function mealText(slot: MealSlot): string | null {
  if (!slot) return null;
  if (typeof slot === 'string') return slot.trim() || null;
  if (typeof slot === 'object') {
    const start = (slot.start || '').trim();
    const end = (slot.end || '').trim();
    if (start && end) return `${start} - ${end}`;
    return start || end || null;
  }
  return null;
}

function toNum(v: any): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function formatInr(n: any): string {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString('en-IN') : '0';
}

export default function PGDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pgId = (Array.isArray(id) ? id[0] : id || '').trim();
  const router = useRouter();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const mountedRef = useRef(true);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const [pg, setPg] = useState<PG | null>(null);
  const pgRef = useRef<PG | null>(null);
  useEffect(() => { pgRef.current = pg; }, [pg]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<'notfound' | 'error' | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [mainImageFailed, setMainImageFailed] = useState(false);
  const [bookingRoomId, setBookingRoomId] = useState('');
  const bookingRef = useRef(false);
  const [checkInOptions] = useState(buildCheckInOptions);
  const [checkInDate, setCheckInDate] = useState(() => toLocalYmd(new Date()));
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [myBooking, setMyBooking] = useState<MyBooking | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState(false);

  const loadMyBooking = useCallback(async () => {
    if (!pgId) return;
    try {
      const res = await apiFetch(`${API_URL}/api/pg/bookings/mine`);
      if (!res.ok) return; // guests / errors: just don't show the banner
      const list = await res.json();
      if (!mountedRef.current || !Array.isArray(list)) return;
      const open = list.find((b: any) => (b.hostel?.id === pgId || b.hostelId === pgId) && (b.status === 'Pending' || b.status === 'Confirmed'));
      setMyBooking(open || null);
    } catch {
      // non-critical
    }
  }, [pgId]);

  const fetchDetails = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
    if (!pgId) {
      setLoading(false);
      setLoadError('notfound');
      return;
    }
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const res = await apiFetch(ENDPOINTS.pgDetail(pgId));
      if (!mountedRef.current) return;
      if (res.ok) {
        const data = await res.json();
        if (!mountedRef.current) return;
        setPg(data);
        setLoadError(null);
      } else if (res.status === 404) {
        setPg(null);
        setLoadError('notfound');
      } else if (mode !== 'silent' || !pgRef.current) {
        if (mode === 'refresh' && pgRef.current) showToast("Couldn't refresh. Pull down to try again.");
        else setLoadError('error');
      }
    } catch (err) {
      console.warn('[PG_DETAIL]', err);
      if (!mountedRef.current) return;
      if (mode === 'refresh' && pgRef.current) showToast('No connection. Pull down to try again.');
      else if (mode !== 'silent') setLoadError('error');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
    loadMyBooking();
  }, [pgId, loadMyBooking]);

  useEffect(() => {
    fetchDetails('initial');
  }, [fetchDetails]);

  // Live sync: room / price / bed-availability edits for this stay refresh it in place
  useLiveSync({
    types: ['pg'],
    filter: (e) => e.id == null || String(e.id) === String(pgId),
    onChange: () => { fetchDetails('silent'); },
  });

  // Signing in (or out) from this screen changes whose request banner we show
  const userKey = (user as any)?.id || (user as any)?._id || null;
  useEffect(() => {
    if (userKey) loadMyBooking();
    else setMyBooking(null);
  }, [userKey, loadMyBooking]);

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setToastMessage(null);
    }, 4000);
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/others' as any);
  };

  const submitBooking = async (room: Room) => {
    if (bookingRef.current) return;
    bookingRef.current = true;
    setBookingRoomId(room.id);
    try {
      const res = await apiFetch(ENDPOINTS.pgBook(room.id), {
        method: 'POST',
        body: JSON.stringify({ checkInDate }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!mountedRef.current) return;
      if (res.status === 401) {
        Alert.alert('Please log in', 'Log in to request a bed at this residence.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Log in', onPress: () => router.push('/login' as any) },
        ]);
        return;
      }
      if (!res.ok) {
        if (data?.code === 'BOOKING_EXISTS') loadMyBooking();
        Alert.alert(
          data?.code === 'BOOKING_EXISTS' ? 'Request already sent' : 'Could not send request',
          data?.message || 'Something went wrong. Please try again.'
        );
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      fetchDetails('silent');
      const buttons: any[] = [{ text: 'Done', style: 'cancel' }];
      if (data?.whatsappUrl) {
        buttons.unshift({
          text: 'Message housing desk',
          onPress: () => Linking.openURL(data.whatsappUrl).catch(() => showToast('WhatsApp is not available on this device.')),
        });
      }
      Alert.alert(
        '🏠 Request sent!',
        `${data?.message || 'Booking request received. The Zenvy housing team will confirm it with you.'}\n\nRoom ${room.roomNumber} • Check-in ${prettyDate(checkInDate)}`,
        buttons
      );
    } catch (err) {
      if (mountedRef.current) Alert.alert('No connection', 'Could not reach Zenvy. Check your internet and try again.');
    } finally {
      bookingRef.current = false;
      if (mountedRef.current) setBookingRoomId('');
    }
  };

  const handleBookRoom = (room: Room) => {
    if (bookingRef.current || !pg) return;
    if (!user) {
      Alert.alert('Please log in', 'Log in to request a bed at this residence.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Log in', onPress: () => router.push('/login' as any) },
      ]);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const deposit = Number(pg.securityDeposit) > 0 ? `\nSecurity deposit: ₹${formatInr(pg.securityDeposit)}` : '';
    Alert.alert(
      'Confirm booking request',
      `${pg.name}\nRoom ${room.roomNumber} • ${room.sharingType}-sharing\nRent: ₹${formatInr(room.pricePerBed)} / month per bed${deposit}\nCheck-in: ${prettyDate(checkInDate)}\n\nThe housing team will call you to confirm. Nothing is charged in the app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send request', onPress: () => submitBooking(room) },
      ]
    );
  };

  const handleCancelMyBooking = () => {
    if (!myBooking || cancellingBooking) return;
    Alert.alert('Cancel your request?', 'Your booking request for this residence will be withdrawn.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: async () => {
          setCancellingBooking(true);
          try {
            const res = await apiFetch(`${API_URL}/api/pg/bookings/${myBooking.id}/cancel`, { method: 'PUT' });
            const data = await res.json().catch(() => ({} as any));
            if (!mountedRef.current) return;
            if (res.ok) {
              setMyBooking(null);
              showToast(data?.message || 'Booking request cancelled.');
              fetchDetails('silent');
            } else {
              Alert.alert('Could not cancel', data?.message || 'Please try again.');
            }
          } catch {
            if (mountedRef.current) Alert.alert('No connection', 'Check your internet and try again.');
          } finally {
            if (mountedRef.current) setCancellingBooking(false);
          }
        },
      },
    ]);
  };

  const getAmenityEmoji = (amenity: string) => {
    const lower = String(amenity || '').toLowerCase();
    if (lower.includes('wifi') || lower.includes('wi-fi')) return '📶';
    if (/\bac\b/.test(lower) || lower.includes('air con')) return '❄️';
    if (lower.includes('washing') || lower.includes('laundry')) return '🧺';
    if (lower.includes('housekeeping') || lower.includes('clean')) return '🧹';
    if (lower.includes('power') || lower.includes('backup')) return '🔋';
    if (lower.includes('gym')) return '🏋️';
    if (lower.includes('lounge')) return '🛋️';
    if (lower.includes('security') || lower.includes('cctv')) return '📹';
    if (lower.includes('biometric')) return '🔐';
    if (lower.includes('nurse') || lower.includes('medical')) return '🩺';
    if (lower.includes('kitchen') || lower.includes('mess') || lower.includes('food')) return '🍳';
    if (lower.includes('tv')) return '📺';
    if (lower.includes('co-working') || lower.includes('study')) return '📚';
    if (lower.includes('bed')) return '🛏️';
    if (lower.includes('bathroom') || lower.includes('washroom')) return '🚿';
    if (lower.includes('parking')) return '🅿️';
    return '✨';
  };

  const bg = isDark ? COLORS.bgDark : COLORS.bgLight;

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={[s.loadingText, { color: isDark ? COLORS.textSecondary : COLORS.textDarkSecondary }]}>
          LOADING RESIDENCE...
        </Text>
      </View>
    );
  }

  if (!pg) {
    const isNetwork = loadError === 'error';
    return (
      <View style={[s.center, { backgroundColor: bg, paddingHorizontal: 32 }]}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>{isNetwork ? '📡' : '🏠'}</Text>
        <Text style={{ color: isDark ? '#fff' : '#000', fontWeight: '900', letterSpacing: 1, fontSize: 15, textAlign: 'center' }}>
          {isNetwork ? "Couldn't load this residence" : 'Residence not found'}
        </Text>
        <Text style={{ color: isDark ? COLORS.textSecondary : COLORS.textDarkSecondary, fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 }}>
          {isNetwork ? 'Check your internet connection and try again.' : 'It may have been removed or is not taking bookings right now.'}
        </Text>
        {isNetwork ? (
          <TouchableOpacity style={s.backNavBtn} onPress={() => fetchDetails('initial')}>
            <Text style={s.backNavBtnText}>RETRY</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[s.backNavBtn, isNetwork && { backgroundColor: 'transparent', marginTop: 10 }]} onPress={goBack}>
          <Text style={[s.backNavBtnText, isNetwork && { color: COLORS.red }]}>BROWSE RESIDENCES</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const images = Array.isArray(pg.images) ? pg.images.filter((u) => typeof u === 'string' && u.trim()) : [];
  const activeImg = images[activeImageIdx] || images[0] || null;
  const cardBg = isDark ? COLORS.bgCard : COLORS.bgLightCard;
  const txt = isDark ? COLORS.textPrimary : COLORS.textDark;
  const txtSec = isDark ? COLORS.textSecondary : COLORS.textDarkSecondary;
  const border = isDark ? COLORS.borderDark : COLORS.borderLight;

  const genderType = pg.genderType || 'Co-ed';
  let genderColor: string = COLORS.red;
  if (genderType === 'Boys') genderColor = '#3B82F6';
  if (genderType === 'Girls') genderColor = '#EC4899';
  if (genderType === 'Co-ed') genderColor = '#8B5CF6';

  const amenities = Array.isArray(pg.amenities) ? pg.amenities.filter(Boolean) : [];
  const rules = Array.isArray(pg.rules) ? pg.rules.filter(Boolean) : [];
  const rooms = Array.isArray(pg.rooms) ? pg.rooms : [];
  const bedsLeft = rooms.reduce((acc, r) => acc + (Number(r.availableBeds) || 0), 0);

  const timetable = pg.foodTimetable || {};
  const timetableRows = [
    { icon: '🍳', label: 'BREAKFAST', value: mealText(timetable.breakfast) },
    { icon: '🍲', label: 'LUNCH', value: mealText(timetable.lunch) },
    { icon: '🍛', label: 'DINNER', value: mealText(timetable.dinner) },
  ].filter((r) => !!r.value);

  const messMenuEntries = pg.messMenu && typeof pg.messMenu === 'object'
    ? Object.entries(pg.messMenu).filter(([, meal]) => meal && (meal.breakfast || meal.lunch || meal.dinner))
    : [];

  const contact = pg.contactInfo || {};
  const wardenName = (contact.wardenName || contact.warden || '').trim();
  const ownerName = (contact.ownerName || '').trim();
  const pgPhone = (contact.phone || '').trim();
  const emergency = (contact.emergencyContact || '').trim();
  const lat = toNum(contact.lat);
  const lng = toNum(contact.lng);
  const hasCoords = lat !== null && lng !== null;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : pg.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pg.name}, ${pg.address}`)}`
      : null;

  const adminRows = [
    ownerName ? { icon: '👤', label: 'OWNER', value: ownerName, color: txt } : null,
    wardenName ? { icon: '🛡️', label: 'WARDEN', value: wardenName, color: txt } : null,
    pgPhone ? { icon: '📞', label: 'PHONE', value: pgPhone, color: txt } : null,
    emergency ? { icon: '🚨', label: 'EMERGENCY', value: emergency, color: COLORS.red } : null,
  ].filter(Boolean) as { icon: string; label: string; value: string; color: string }[];

  const openWhatsApp = () => {
    let phone = (pgPhone || ZENVY_SUPPORT_WHATSAPP).replace(/\D/g, '');
    if (phone.length === 10) phone = `91${phone}`;
    const msg = `Hi, I am interested in visiting/booking a room at ${pg.name} (${genderType}) on Zenvy. Could you please share the current availability and visiting timings?`;
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`).catch(() => showToast('WhatsApp is not available on this device.'));
  };

  const myBookingHere = myBooking && (myBooking.status === 'Pending' || myBooking.status === 'Confirmed') ? myBooking : null;

  return (
    <View style={[s.container, { backgroundColor: bg }]}>
      {toastMessage && (
        <View style={s.toastContainer} pointerEvents="none">
          <Text style={s.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Header bar */}
      <View style={[s.headerBar, { borderBottomColor: border }]}>
        <TouchableOpacity style={s.backArrow} onPress={goBack} accessibilityLabel="Go back">
          <Text style={[s.backArrowText, { color: txt }]}>◀ BACK</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: txt }]} numberOfLines={1}>{(pg.name || '').toUpperCase()}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchDetails('refresh')} tintColor={COLORS.red} colors={[COLORS.red]} />}
      >
        {/* Gallery */}
        <View style={s.galleryContainer}>
          {activeImg && !mainImageFailed ? (
            <Image source={{ uri: activeImg }} style={s.mainImage} onError={() => setMainImageFailed(true)} />
          ) : (
            <View style={[s.mainImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#1A1D24' : '#E2E8F0' }]}>
              <Text style={{ fontSize: 56 }}>🏠</Text>
              <Text style={{ fontSize: 10, fontWeight: '800', color: txtSec, marginTop: 6, letterSpacing: 1 }}>NO PHOTOS YET</Text>
            </View>
          )}
          <View style={s.galleryOverlay} pointerEvents="none" />

          <View style={{ position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={[s.genderTag, { backgroundColor: genderColor, position: 'relative', top: 0, left: 0 }]}>
              <Text style={s.genderTagText}>{genderType.toUpperCase()}</Text>
            </View>
          </View>

          {images.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.thumbScroll}>
              {images.map((img, idx) => (
                <TouchableOpacity
                  key={`${idx}-${img}`}
                  onPress={() => {
                    setMainImageFailed(false);
                    setActiveImageIdx(idx);
                  }}
                  style={[s.thumbWrap, activeImageIdx === idx && { borderColor: '#3B82F6', borderWidth: 2.5 }]}
                >
                  <Image source={{ uri: img }} style={s.thumbImg} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Title details */}
        <StaggeredSection delay={50} direction="up">
        <View style={[s.sectionCard, { backgroundColor: cardBg, borderColor: border }]}>
          <Text style={[s.pgName, { color: txt }]}>{pg.name}</Text>
          {pg.address ? <Text style={[s.pgAddress, { color: txtSec }]}>📍 {pg.address}</Text> : null}
          {toNum(pg.distanceFromCollege) !== null && (
            <View style={s.proximityBadge}>
              <Text style={{ fontSize: 20 }}>🏃</Text>
              <View>
                <Text style={s.proximityLabel}>DISTANCE FROM CAMPUS</Text>
                <Text style={[s.proximityValue, { color: COLORS.red }]}>{pg.distanceFromCollege} km</Text>
              </View>
            </View>
          )}
          {pg.description ? <Text style={[s.pgDesc, { color: txt }]}>{pg.description}</Text> : null}
        </View>
        </StaggeredSection>

        {/* Quick Stats Grid (real values only) */}
        <StaggeredSection delay={100} direction="up">
        <View style={s.statsGrid}>
          <View style={[s.statBox, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={s.statEmoji}>🏷️</Text>
            <Text style={s.statLabel}>RENT FROM</Text>
            <Text style={[s.statVal, { color: txt }]}>₹{formatInr(pg.baseRent)}</Text>
            <Text style={s.statDesc}>per month</Text>
          </View>
          <View style={[s.statBox, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={s.statEmoji}>💰</Text>
            <Text style={s.statLabel}>DEPOSIT</Text>
            <Text style={[s.statVal, { color: txt }]}>{Number(pg.securityDeposit) > 0 ? `₹${formatInr(pg.securityDeposit)}` : 'None'}</Text>
            <Text style={s.statDesc}>Security deposit</Text>
          </View>
          <View style={[s.statBox, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={s.statEmoji}>👥</Text>
            <Text style={s.statLabel}>FOR</Text>
            <Text style={[s.statVal, { color: txt }]}>{genderType}</Text>
            <Text style={s.statDesc}>Residents</Text>
          </View>
          <View style={[s.statBox, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={s.statEmoji}>🛏️</Text>
            <Text style={s.statLabel}>BEDS FREE</Text>
            <Text style={[s.statVal, { color: bedsLeft > 0 ? COLORS.emerald : '#EF4444' }]}>{bedsLeft}</Text>
            <Text style={s.statDesc}>across {rooms.length} room{rooms.length === 1 ? '' : 's'}</Text>
          </View>
        </View>
        </StaggeredSection>

        {/* Room Inventory */}
        <StaggeredSection delay={150} direction="up">
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={[s.blockTitle, { color: txt }]}>ROOMS</Text>
          <Text style={[s.blockSub, { color: txtSec }]}>AVAILABLE BEDS • PULL DOWN TO REFRESH</Text>

          {myBookingHere && (
            <View style={[s.checkInWrap, { backgroundColor: myBookingHere.status === 'Confirmed' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', borderColor: myBookingHere.status === 'Confirmed' ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)' }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[s.checkInLabel, { color: txt }]}>
                  {myBookingHere.status === 'Confirmed' ? '✅ BOOKING CONFIRMED' : '⏳ REQUEST PENDING'}
                </Text>
                <Text style={{ fontSize: 10, color: txtSec, marginTop: 3, fontWeight: '600' }}>
                  {myBookingHere.room?.roomNumber ? `Room ${myBookingHere.room.roomNumber} • ` : ''}
                  {myBookingHere.checkInDate ? `Check-in ${new Date(myBookingHere.checkInDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                </Text>
              </View>
              {myBookingHere.status === 'Pending' && (
                <TouchableOpacity onPress={handleCancelMyBooking} disabled={cancellingBooking} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
                  {cancellingBooking ? <ActivityIndicator size="small" color={COLORS.red} /> : <Text style={{ color: COLORS.red, fontSize: 10, fontWeight: '900' }}>CANCEL</Text>}
                </TouchableOpacity>
              )}
            </View>
          )}

          {rooms.length > 0 && (
            <View style={[s.checkInWrap, { backgroundColor: cardBg, borderColor: border, flexDirection: 'column', alignItems: 'stretch' }]}>
              <Text style={[s.checkInLabel, { color: txt, marginBottom: 10 }]}>CHECK-IN DATE • {prettyDate(checkInDate)}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {checkInOptions.map((opt) => {
                  const selected = opt.ymd === checkInDate;
                  return (
                    <TouchableOpacity
                      key={opt.ymd}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setCheckInDate(opt.ymd);
                      }}
                      style={{
                        width: 58,
                        paddingVertical: 8,
                        borderRadius: 12,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: selected ? COLORS.red : border,
                        backgroundColor: selected ? COLORS.red : 'transparent',
                      }}
                    >
                      <Text style={{ fontSize: 8, fontWeight: '900', letterSpacing: 1, color: selected ? '#fff' : txtSec }}>{opt.top}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', marginTop: 2, color: selected ? '#fff' : txt }}>{opt.bottom}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {rooms.length > 0 ? (
            rooms.map(room => (
              <View key={room.id} style={[s.roomCard, { backgroundColor: cardBg, borderColor: border }]}>
                <View style={s.roomCardLeft}>
                  <Text style={[s.roomTitle, { color: txt }]}>{room.sharingType}-Sharing Room</Text>
                  <Text style={[s.roomNo, { color: txtSec }]}>
                    Room {room.roomNumber}{room.floorNumber !== undefined && room.floorNumber !== null ? ` • Floor ${room.floorNumber}` : ''}
                  </Text>

                  <View style={s.roomBadgeRow}>
                    <View style={s.roomBadge}><Text style={s.roomBadgeText}>{room.hasAC ? '❄️ AC' : '🌬️ Non-AC'}</Text></View>
                    <View style={s.roomBadge}><Text style={s.roomBadgeText}>{room.hasAttachedBathroom ? '🚿 Attached Bath' : '🚪 Shared Bath'}</Text></View>
                    {room.hasBalcony ? <View style={s.roomBadge}><Text style={s.roomBadgeText}>🌇 Balcony</Text></View> : null}
                    {room.furnishing ? <View style={s.roomBadge}><Text style={s.roomBadgeText}>🪑 {room.furnishing}</Text></View> : null}
                  </View>

                  <View style={{ marginTop: 12 }}>
                    <Text style={{ fontSize: 8, color: txtSec, fontWeight: '700' }}>RENT PER BED</Text>
                    <Text style={s.roomPrice}>₹{formatInr(room.pricePerBed)}<Text style={{ fontSize: 9, color: txtSec }}> / month</Text></Text>
                  </View>
                </View>

                <View style={s.roomCardRight}>
                  <View style={[s.bedsBadge, { backgroundColor: room.availableBeds > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                    <Text style={[s.bedsBadgeText, { color: room.availableBeds > 0 ? COLORS.emerald : '#EF4444' }]}>
                      {room.availableBeds > 0 ? `${room.availableBeds} bed${room.availableBeds === 1 ? '' : 's'} left` : 'No beds'}
                    </Text>
                  </View>

                  {myBookingHere && room.availableBeds > 0 ? (
                    // One open request per residence (server: 409 BOOKING_EXISTS)
                    <View style={s.bookedBtn}>
                      <Text style={s.bookedBtnText}>{myBookingHere.room?.id === room.id ? 'REQUESTED' : 'REQUEST SENT'}</Text>
                    </View>
                  ) : room.availableBeds > 0 ? (
                    <TouchableOpacity
                      style={[s.bookBtn, { backgroundColor: COLORS.red }, !!bookingRoomId && bookingRoomId !== room.id && { opacity: 0.5 }]}
                      onPress={() => handleBookRoom(room)}
                      disabled={!!bookingRoomId}
                    >
                      {bookingRoomId === room.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={s.bookBtnText}>REQUEST BED</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={s.bookedBtn}>
                      <Text style={s.bookedBtnText}>FULL</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View style={[s.emptyBox, { backgroundColor: cardBg }]}>
              <Text style={{ fontSize: 26, marginBottom: 6 }}>🛏️</Text>
              <Text style={[s.emptyBoxText, { color: txtSec, textAlign: 'center' }]}>No rooms are listed yet. Chat with us to ask about availability.</Text>
            </View>
          )}
        </View>
        </StaggeredSection>

        {/* Amenities */}
        {amenities.length > 0 && (
          <StaggeredSection delay={200} direction="up">
          <View style={[s.sectionCard, { backgroundColor: cardBg }]}>
            <Text style={[s.blockTitle, { color: txt, borderBottomWidth: 1, borderBottomColor: border, paddingBottom: 8, marginBottom: 12 }]}>AMENITIES</Text>
            <View style={s.amenitiesGrid}>
              {amenities.map((amenity, idx) => (
                <View key={idx} style={[s.amenityCell, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                  <Text style={{ fontSize: 24, marginBottom: 4 }}>{getAmenityEmoji(amenity)}</Text>
                  <Text style={[s.amenityText, { color: txt }]} numberOfLines={2}>{amenity}</Text>
                </View>
              ))}
            </View>
          </View>
          </StaggeredSection>
        )}

        {/* Meal timings */}
        {timetableRows.length > 0 && (
          <StaggeredSection delay={250} direction="up">
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <Text style={[s.blockTitle, { color: txt }]}>MEAL TIMINGS</Text>
            <View style={[s.scheduleCard, { backgroundColor: cardBg }]}>
              {timetableRows.map((row) => (
                <View key={row.label} style={s.scheduleRow}>
                  <Text style={s.scheduleDot}>{row.icon}</Text>
                  <View>
                    <Text style={s.scheduleTitle}>{row.label}</Text>
                    <Text style={[s.scheduleTime, { color: txt }]}>{row.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
          </StaggeredSection>
        )}

        {/* Mess menu */}
        {messMenuEntries.length > 0 && (
          <StaggeredSection delay={300} direction="up">
          <View style={[s.sectionCard, { backgroundColor: cardBg }]}>
            <Text style={[s.blockTitle, { color: txt, borderBottomWidth: 1, borderBottomColor: border, paddingBottom: 8, marginBottom: 12 }]}>MESS MENU</Text>
            {messMenuEntries.map(([day, meal]) => (
              <View key={day} style={[s.menuRow, { borderBottomColor: border }]}>
                <Text style={[s.menuDay, { color: txt }]}>{day.substring(0, 3).toUpperCase()}</Text>
                <View style={s.menuDetails}>
                  {meal.breakfast ? <Text style={[s.menuMeal, { color: txtSec }]}><Text style={{ color: COLORS.gold, fontWeight: '800' }}>BF: </Text>{meal.breakfast}</Text> : null}
                  {meal.lunch ? <Text style={[s.menuMeal, { color: txtSec }]}><Text style={{ color: '#3B82F6', fontWeight: '800' }}>LN: </Text>{meal.lunch}</Text> : null}
                  {meal.dinner ? <Text style={[s.menuMeal, { color: txtSec }]}><Text style={{ color: COLORS.emerald, fontWeight: '800' }}>DN: </Text>{meal.dinner}</Text> : null}
                </View>
              </View>
            ))}
          </View>
          </StaggeredSection>
        )}

        {/* House rules */}
        {rules.length > 0 && (
          <StaggeredSection delay={350} direction="up">
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <Text style={[s.blockTitle, { color: txt }]}>HOUSE RULES</Text>
            <View style={[s.rulesCard, { backgroundColor: cardBg }]}>
              {rules.map((rule, idx) => (
                <View key={idx} style={s.ruleRow}>
                  <Text style={s.ruleNumber}>{String(idx + 1).padStart(2, '0')}</Text>
                  <Text style={[s.ruleText, { color: txt }]}>{rule}</Text>
                </View>
              ))}
            </View>
          </View>
          </StaggeredSection>
        )}

        {/* Location */}
        {mapsUrl && (
          <StaggeredSection delay={400} direction="up">
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <Text style={[s.blockTitle, { color: txt }]}>LOCATION</Text>
            <View style={[s.mapCard, { backgroundColor: cardBg }]}>
              <Text style={[s.mapCoordinates, { color: txt, textAlign: 'center' }]}>
                {hasCoords ? `${lat!.toFixed(5)}, ${lng!.toFixed(5)}` : pg.address}
              </Text>
              <TouchableOpacity
                style={s.directionsBtn}
                onPress={() => Linking.openURL(mapsUrl).catch(() => showToast('Could not open Maps on this device.'))}
              >
                <Text style={s.directionsBtnText}>{hasCoords ? 'GET DIRECTIONS 🗺️' : 'OPEN IN MAPS 🗺️'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          </StaggeredSection>
        )}

        {/* Contact */}
        <StaggeredSection delay={450} direction="up">
        <View style={[s.sectionCard, { backgroundColor: cardBg, marginBottom: 40 }]}>
          <Text style={[s.blockTitle, { color: txt, borderBottomWidth: 1, borderBottomColor: border, paddingBottom: 8, marginBottom: 12 }]}>CONTACT</Text>

          {adminRows.length > 0 ? (
            <View style={s.adminGrid}>
              {adminRows.map((row) => (
                <View key={row.label} style={s.adminItem}>
                  <Text style={{ fontSize: 18 }}>{row.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.adminLabel}>{row.label}</Text>
                    <Text style={[s.adminVal, { color: row.color }]} numberOfLines={1}>{row.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 11, color: txtSec, marginBottom: 14, lineHeight: 16 }}>
              The Zenvy housing desk handles visits and bookings for this residence.
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: '#25D366' }}
              onPress={openWhatsApp}
            >
              <Text style={{ fontSize: 14 }}>💬</Text>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>
                {pgPhone ? 'WHATSAPP PG' : 'ZENVY SUPPORT'}
              </Text>
            </TouchableOpacity>

            {pgPhone ? (
              <TouchableOpacity
                style={[s.callBtn, { flex: 1, marginTop: 0, borderColor: border }]}
                onPress={() => Linking.openURL(`tel:${pgPhone.replace(/[^\d+]/g, '')}`).catch(() => showToast('Calling is not available on this device.'))}
              >
                <Text style={[s.callBtnText, { color: txt }]}>CALL 📞</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        </StaggeredSection>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'android' ? 40 : 50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 9, fontWeight: '900', letterSpacing: 2, marginTop: 16 },
  backNavBtn: { marginTop: 24, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.red },
  backNavBtnText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  
  toastContainer: { position: 'absolute', bottom: 30, left: 16, right: 16, backgroundColor: '#11111A', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.goldBorder, zIndex: 999 },
  toastText: { color: COLORS.gold, fontSize: 10, fontWeight: '800', textAlign: 'center', letterSpacing: 1.5 },
  
  headerBar: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1 },
  backArrow: { width: 60 },
  backArrowText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  headerTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 2, textAlign: 'center', flex: 1 },

  galleryContainer: { position: 'relative', width: SW, height: 260, marginBottom: 12 },
  mainImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  galleryOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.3)' },
  verifiedTag: { position: 'absolute', top: 12, right: 12, backgroundColor: COLORS.greenRating, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  verifiedTagText: { fontSize: 8, fontWeight: '900', color: '#fff', letterSpacing: 1.5 },
  genderTag: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  genderTagText: { fontSize: 8, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  thumbScroll: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  thumbWrap: { width: 50, height: 50, borderRadius: 8, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden', marginRight: 8 },
  thumbImg: { width: '100%', height: '100%' },

  sectionCard: { marginHorizontal: 16, padding: 20, borderRadius: 24, marginBottom: 16, borderWidth: 1, borderColor: COLORS.borderDark },
  pgName: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
  pgAddress: { fontSize: 10, fontWeight: '700', marginBottom: 12 },
  proximityBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(239,79,95,0.06)', padding: 12, borderRadius: 16, marginBottom: 16 },
  proximityLabel: { fontSize: 8, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.5 },
  proximityValue: { fontSize: 15, fontWeight: '900' },
  pgDesc: { fontSize: 11, fontWeight: '500', lineHeight: 16 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  statBox: { width: (SW - 40) / 2, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.borderDark },
  statEmoji: { fontSize: 22, marginBottom: 6 },
  statLabel: { fontSize: 8, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1 },
  statVal: { fontSize: 14, fontWeight: '900', marginVertical: 2 },
  statDesc: { fontSize: 8, fontWeight: '600', color: COLORS.textMuted },

  blockTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  blockSub: { fontSize: 8, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12 },
  checkInWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.borderDark },
  checkInLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  checkInInput: { width: 120, height: 36, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 11, fontWeight: '700', textAlign: 'center' },

  roomCard: { flexDirection: 'row', padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 10, justifyContent: 'space-between' },
  roomCardLeft: { flex: 1, paddingRight: 10 },
  roomTitle: { fontSize: 14, fontWeight: '800' },
  roomNo: { fontSize: 9, fontWeight: '600', marginTop: 2, marginBottom: 8 },
  roomBadgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  roomBadge: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  roomBadgeText: { fontSize: 8, fontWeight: '800', color: COLORS.textMuted },
  roomPrice: { fontSize: 18, fontWeight: '900', color: COLORS.red },
  roomCardRight: { alignItems: 'flex-end', justifyContent: 'space-between', width: 100 },
  bedsBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  bedsBadgeText: { fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  bookBtn: { width: '100%', paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', ...SHADOWS.redGlow },
  bookBtnText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  bookedBtn: { width: '100%', paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  bookedBtnText: { color: COLORS.textMuted, fontSize: 8, fontWeight: '900' },
  emptyBox: { padding: 24, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyBoxText: { fontSize: 10, fontWeight: '600' },

  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityCell: { width: (SW - 40 - 16) / 3, paddingVertical: 14, alignItems: 'center', borderRadius: 16 },
  amenityText: { fontSize: 9, fontWeight: '800', width: '90%', textAlign: 'center' },
  amenitySub: { fontSize: 7, fontWeight: '600', color: COLORS.textMuted, marginTop: 2 },

  scheduleCard: { padding: 16, borderRadius: 20 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  scheduleDot: { fontSize: 20 },
  scheduleTitle: { fontSize: 8, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1 },
  scheduleTime: { fontSize: 13, fontWeight: '800', marginTop: 1 },

  menuRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1 },
  menuDay: { width: 50, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  menuDetails: { flex: 1, gap: 4 },
  menuMeal: { fontSize: 10, fontWeight: '600' },

  rulesCard: { padding: 16, borderRadius: 20 },
  ruleRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  ruleNumber: { fontSize: 11, fontWeight: '900', color: COLORS.textMuted },
  ruleText: { fontSize: 11, fontWeight: '600', flex: 1 },

  mapCard: { padding: 16, borderRadius: 20, alignItems: 'center' },
  mapCoordinates: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  directionsBtn: { backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  directionsBtnText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },

  adminGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  adminItem: { width: (SW - 40 - 12) / 2, flexDirection: 'row', gap: 8, alignItems: 'center' },
  adminLabel: { fontSize: 7, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1 },
  adminVal: { fontSize: 11, fontWeight: '800', marginTop: 1 },
  callBtn: { width: '100%', paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, alignItems: 'center' },
  callBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 2 },

  termsCard: { padding: 16, borderRadius: 20, borderWidth: 1, borderColor: COLORS.goldBorder },
  termTitle: { fontSize: 8, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
  termText: { fontSize: 9, fontWeight: '600', lineHeight: 14 },
});
