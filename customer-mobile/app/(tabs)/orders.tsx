import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, RefreshControl, Animated, LayoutAnimation, UIManager, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ShimmerCard } from '../../components/ShimmerLoader';
import { connectSocket } from '../../utils/socket';
import { COLORS, SHADOWS } from '../../constants/theme';
import { ENDPOINTS } from '../../constants/api';
import { useTheme } from '../../context/ThemeContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/auth';
import AmbientBackground from '../../components/AmbientBackground';
import { StaggeredSection, BounceIn, FloatingPulse, PulseGlow } from '../../components/AnimatedSection';
import { ActionPressable } from '../../components/DopaminePressable';
import { isVendorFulfilled } from '../../utils/localVendor';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ScalePressable = ({ children, onPress, style, activeOpacity = 0.85 }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  
  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={activeOpacity}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

// Friendly labels for the backend status enum (never show raw enums like READYFORPICKUP).
const STATUS_LABEL: Record<string, string> = {
  Pending: 'Awaiting store',
  Accepted: 'Confirmed',
  Preparing: 'Preparing',
  ReadyForPickup: 'Ready for pickup',
  Picking: 'Rider at store',
  PickedUp: 'Out for delivery',
  OutForDelivery: 'Out for delivery',
  ArrivedAtGate: 'Rider at gate',
  Delivered: 'Delivered',
  Cancelled: 'Cancelled',
};
const statusLabel = (s?: string) => (s && STATUS_LABEL[s]) || s || 'Pending';
const isActiveStatus = (s?: string) => s !== 'Delivered' && s !== 'Cancelled';
const PIN_STATUSES = ['Accepted', 'Preparing', 'ReadyForPickup', 'Picking', 'PickedUp', 'ArrivedAtGate'];

const parseItems = (raw: any): any[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
};

const parseBreakdown = (raw: any): any => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
};

// Service bookings (repairs, print, laundry, tailoring…)
const SERVICE_STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Requested',
  DIAGNOSED_QUOTED: 'Quote ready',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In progress',
  READY_FOR_DELIVERY: 'Ready for delivery',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};
const serviceStatusLabel = (s?: string) => (s && SERVICE_STATUS_LABEL[s]) || (s ? s.replace(/_/g, ' ').toLowerCase() : 'Requested');
const isServiceOpen = (s?: string) => s !== 'COMPLETED' && s !== 'CANCELLED';
// The partner has the student's items: cancelling goes through support (the server refuses it too).
const PICKED_UP_STATUSES = ['IN_PROGRESS', 'READY_FOR_DELIVERY'];
const formatWhen = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

const amountCharged = (o: any) => Number(o.finalPrice ?? o.priceBreakdown?.finalPrice ?? o.totalPrice ?? 0) || 0;

export default function OrdersScreen() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { user, refreshUser } = useAuth();
  const { addToCart } = useCart();
  const [orders, setOrders] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'PAST' | 'SERVICES'>('ALL');
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [bookingsLoaded, setBookingsLoaded] = useState(false);
  const [bookingDetail, setBookingDetail] = useState<Record<string, any>>({});
  const [bookingBusyId, setBookingBusyId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const { segment } = useLocalSearchParams<{ segment?: string | string[] }>();
  const segmentParam = Array.isArray(segment) ? segment[0] : segment;
  useEffect(() => {
    if (segmentParam === 'services') setFilter('SERVICES');
  }, [segmentParam]);
  const mountedRef = useRef(true);
  const hasLoadedRef = useRef(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleReorder = async (order: any) => {
    const orderKey = order._id || order.id;
    if (reorderingId) return;
    const items = parseItems(order.items);
    if (items.length === 0) {
      Alert.alert('Reorder unavailable', 'We could not find the items from this order.');
      return;
    }
    const targetRestaurantId = order.restaurantId || order.restaurant?.id;
    const targetRestaurantName = order.restaurantName || order.restaurant?.name || 'this store';
    if (!targetRestaurantId) {
      Alert.alert('Reorder unavailable', 'This store is no longer on Zenvy.');
      return;
    }

    setReorderingId(orderKey);
    try {
      // Re-read the live menu so the basket uses today's prices and availability.
      const res = await apiFetch(ENDPOINTS.restaurantMenu(targetRestaurantId));
      if (!res.ok) throw new Error(`menu ${res.status}`);
      const menu = await res.json();
      const menuById = new Map<string, any>();
      (Array.isArray(menu) ? menu : []).forEach((m: any) => menuById.set(String(m.id || m._id), m));

      const available: { item: any; live: any }[] = [];
      const dropped: string[] = [];
      items.forEach((item: any) => {
        const itemId = String(item.menuItemId || item.id || item._id || '');
        const live = itemId ? menuById.get(itemId) : null;
        // Stall orders take no add-ons: skip the old order's add-on lines
        if (item.isAddOn && isVendorFulfilled(order)) return;
        if (!live || live.isAvailable === false) {
          // Add-ons (EXTRAS) live in a different store; the basket offers them again at checkout.
          if (!item.isAddOn) dropped.push(item.name || 'An item');
          return;
        }
        available.push({ item, live });
      });

      if (!mountedRef.current) return;
      if (available.length === 0) {
        Alert.alert('Items unavailable', `None of the items from this order are available at ${targetRestaurantName} right now.`);
        return;
      }

      // The basket enforces one store per order itself: when it holds another store's items,
      // addToCart returns false and shows a single "Replace basket?" prompt for all these lines.
      let addedAny = false;
      available.forEach(({ item, live }) => {
        const added = addToCart({
            id: String(live.id || live._id),
            name: live.name || item.name,
            price: Number(live.price) || 0,
            basePrice: Number(live.price) || 0,
            image: live.imageUrl || item.image || '',
            restaurantId: targetRestaurantId,
            restaurantName: targetRestaurantName,
            quantity: Math.min(Math.max(Number(item.quantity) || 1, 1), 20),
            customizations: item.customizations || undefined,
            ...(isVendorFulfilled(order) ? { isStall: true } : {}),
        });
        if (added) addedAny = true;
      });
      if (!addedAny) return; // the basket's "Replace basket?" prompt is showing

      if (dropped.length > 0) {
        Alert.alert(
          'Some items are unavailable',
          `${dropped.join(', ')} ${dropped.length === 1 ? 'is' : 'are'} not available right now, so we left ${dropped.length === 1 ? 'it' : 'them'} out.`
        );
      }
      router.push('/(tabs)/basket' as any);
    } catch (e) {
      console.error('Reorder error:', e);
      if (mountedRef.current) Alert.alert('Could not reorder', 'Please check your connection and try again.');
    } finally {
      if (mountedRef.current) setReorderingId(null);
    }
  };

  const fetchOrders = useCallback(async (mode: 'initial' | 'silent' = 'initial') => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    // Full-screen skeleton only for the very first load; later refreshes keep the list on screen.
    if (mode === 'initial' && !hasLoadedRef.current) setLoading(true);
    try {
      const res = await apiFetch(ENDPOINTS.myOrders);
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      const data = await res.json();
      if (!mountedRef.current) return;
      setOrders(Array.isArray(data) ? data : []);
      setError(null);
      hasLoadedRef.current = true;
    } catch (e: any) {
      console.error('Orders sync error:', e);
      if (mountedRef.current) setError('We could not load your orders. Check your connection and try again.');
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const fetchBookings = useCallback(async () => {
    setBookingsLoading(true);
    try {
      const res = await apiFetch(ENDPOINTS.servicesMyBookings);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `status ${res.status}`);
      if (!mountedRef.current) return;
      setBookings(Array.isArray(data?.bookings) ? data.bookings : []);
      setBookingsError(null);
      setBookingsLoaded(true);
    } catch (e) {
      console.warn('Service bookings error:', e);
      if (mountedRef.current) setBookingsError('We could not load your service bookings. Check your connection and try again.');
    } finally {
      if (mountedRef.current) setBookingsLoading(false);
    }
  }, []);

  const toggleBooking = async (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (!next) return;
    try {
      const res = await apiFetch(ENDPOINTS.servicesDetail(id));
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.booking && mountedRef.current) {
        setBookingDetail(prev => ({ ...prev, [id]: data.booking }));
      }
    } catch {
      // The card already shows the list data; the timeline simply stays as it was.
    }
  };

  const applyBooking = (id: string, booking: any) => {
    if (!booking || !mountedRef.current) return;
    setBookings(prev => prev.map(x => (String(x.id || x._id) === id ? { ...x, ...booking } : x)));
    setBookingDetail(prev => ({ ...prev, [id]: booking }));
  };

  const cancelBooking = (b: any) => {
    const id = String(b.id || b._id);
    Alert.alert('Cancel this booking?', `${b.title || 'This service'} will be cancelled.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          setBookingBusyId(id);
          try {
            const res = await apiFetch(ENDPOINTS.servicesCancel(id), { method: 'POST', body: JSON.stringify({ reason: 'Cancelled by customer' }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              // The server sends the current booking back (e.g. already picked up): show its real stage.
              if (data?.booking) applyBooking(id, data.booking);
              Alert.alert('Could not cancel', data?.message || 'Please try again in a moment.');
              return;
            }
            applyBooking(id, data.booking || { ...b, status: 'CANCELLED' });
          } catch {
            Alert.alert('Could not cancel', 'Please check your connection and try again.');
          } finally {
            if (mountedRef.current) setBookingBusyId(null);
          }
        },
      },
    ]);
  };

  const acceptQuote = async (b: any) => {
    const id = String(b.id || b._id);
    setBookingBusyId(id);
    try {
      const res = await apiFetch(ENDPOINTS.servicesConfirmQuote(id), { method: 'POST', body: JSON.stringify({ acceptQuote: true }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Could not confirm', data?.message || 'Please try again in a moment.');
        return;
      }
      applyBooking(id, data.booking);
    } catch {
      Alert.alert('Could not confirm', 'Please check your connection and try again.');
    } finally {
      if (mountedRef.current) setBookingBusyId(null);
    }
  };

  // Refetch every time the tab gains focus (after checkout, cancel, rating...).
  useFocusEffect(
    useCallback(() => {
      if (user) fetchOrders(hasLoadedRef.current ? 'silent' : 'initial');
      if (user && filter === 'SERVICES') fetchBookings();
    }, [user, fetchOrders, fetchBookings, filter])
  );

  // Clear the list when the account signs out.
  useEffect(() => {
    if (!user) {
      setOrders([]);
      setBookings([]);
      setBookingsLoaded(false);
      setBookingDetail({});
      hasLoadedRef.current = false;
    }
  }, [user]);

  // Live status for active orders: join each order room and patch the card in place.
  const activeIdsKey = orders
    .filter(o => isActiveStatus(o.status))
    .map(o => String(o._id || o.id))
    .sort()
    .join(',');
  useEffect(() => {
    if (!user || !activeIdsKey) return;
    const ids = activeIdsKey.split(',');
    let socket: any;
    try {
      socket = connectSocket();
    } catch {
      return;
    }
    const join = () => ids.forEach(id => socket.emit('joinOrder', id));
    join();
    const onStatus = (payload: any) => {
      const pid = String(payload?.id || payload?.orderId || '');
      if (!pid || !ids.includes(pid) || !payload?.status || !mountedRef.current) return;
      // A store timeout / cancel refunds Wallet orders: keep the balance on Profile and Checkout current.
      if (payload.status === 'Cancelled' && Number(payload.refundedToWallet) > 0) refreshUser?.().catch(() => {});
      setOrders(prev => prev.map(o => (
        String(o._id || o.id) === pid
          ? {
              ...o,
              status: payload.status,
              ...(payload.finalPrice != null ? { finalPrice: payload.finalPrice } : {}),
              ...(payload.reason === 'STORE_TIMEOUT' ? { cancellationReason: 'The store did not accept the order in time' } : {}),
            }
          : o
      )));
    };
    socket.on('connect', join);
    socket.on('statusUpdated', onStatus);
    return () => {
      socket.off('connect', join);
      socket.off('statusUpdated', onStatus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeIdsKey]);

  // Admin / partner stage changes and quotes arrive live (server: serviceStatusUpdate to this user's room).
  useEffect(() => {
    if (!user) return;
    let socket: any;
    try {
      socket = connectSocket();
    } catch {
      return;
    }
    const onServiceStatus = (payload: any) => {
      const pid = String(payload?.id || '');
      if (!pid || !mountedRef.current) return;
      setBookings(prev => prev.map(x => (
        String(x.id || x._id) === pid
          ? {
              ...x,
              ...(payload.status ? { status: payload.status } : {}),
              ...(payload.quotedAmount != null ? { quotedAmount: payload.quotedAmount } : {}),
              ...(payload.finalAmount != null ? { finalAmount: payload.finalAmount } : {}),
            }
          : x
      )));
      // Pull the full booking (timeline note) for an open card, and the list for a new booking.
      apiFetch(ENDPOINTS.servicesDetail(pid))
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.booking || !mountedRef.current) return;
          setBookings(prev => (prev.some(x => String(x.id || x._id) === pid)
            ? prev.map(x => (String(x.id || x._id) === pid ? { ...x, ...data.booking } : x))
            : [data.booking, ...prev]));
          setBookingDetail(prev => ({ ...prev, [pid]: data.booking }));
        })
        .catch(() => {});
    };
    socket.on('serviceStatusUpdate', onServiceStatus);
    return () => {
      socket.off('serviceStatusUpdate', onServiceStatus);
    };
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await (filter === 'SERVICES' ? fetchBookings() : fetchOrders('silent'));
    if (mountedRef.current) setRefreshing(false);
  };

  const bg = colors.bg;
  const cardBg = colors.card;
  const txt = colors.text;
  const txtSec = colors.textSecondary;
  const border = colors.border;
  const goldColor = isDark ? COLORS.gold : colors.gold;

  if (!user) {
    return (
      <View style={[st.container, { backgroundColor: bg, justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <AmbientBackground />
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🔐</Text>
        <Text style={{ fontSize: 18, fontWeight: '900', color: txt, letterSpacing: 2, textAlign: 'center', marginBottom: 8 }}>
          SIGN IN TO SEE YOUR ORDERS
        </Text>
        <Text style={{ fontSize: 12, color: txtSec, fontWeight: '600', textAlign: 'center', marginBottom: 24, lineHeight: 18 }}>
          Sign in to see your orders, delivery PINs and live tracking.
        </Text>
        <TouchableOpacity 
          style={{ 
            backgroundColor: COLORS.red, 
            paddingHorizontal: 32, 
            paddingVertical: 14, 
            borderRadius: 16, 
            ...SHADOWS.redGlow 
          }} 
          onPress={() => router.push('/login' as any)}
        >
          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900', letterSpacing: 2 }}>SIGN IN / SIGN UP</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(expanded === id ? null : id);
  };

  const statusColor = (s: string) => {
    if (s === 'Delivered') return COLORS.emerald;
    if (s === 'Cancelled') return '#EF4444';
    return isDark ? COLORS.gold : colors.gold;
  };

  const renderServices = () => {
    if (bookingsLoading && !bookingsLoaded) {
      return (
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <ShimmerCard />
          <ShimmerCard />
        </View>
      );
    }
    if (bookingsError && bookings.length === 0) {
      return (
        <View style={[st.emptyBox, { backgroundColor: cardBg, borderColor: border }]}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>📡</Text>
          <Text style={[st.emptyTitle, { color: txt }]}>Couldn't load your bookings</Text>
          <Text style={[st.emptyDesc, { color: txtSec }]}>{bookingsError}</Text>
          <TouchableOpacity style={[st.browseBtn, { backgroundColor: COLORS.gold || '#D4AF7A' }]} activeOpacity={0.85} onPress={fetchBookings}>
            <Text style={[st.browseBtnText, { color: '#000' }]}>TRY AGAIN 🔄</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (bookings.length === 0) {
      return (
        <View style={[st.emptyBox, { backgroundColor: cardBg, borderColor: border }]}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>🛠️</Text>
          <Text style={[st.emptyTitle, { color: txt }]}>No service bookings yet</Text>
          <Text style={[st.emptyDesc, { color: txtSec }]}>
            Repairs, printouts, laundry and tailoring you book will show up here with their live status.
          </Text>
          <TouchableOpacity style={[st.browseBtn, { backgroundColor: COLORS.red }]} activeOpacity={0.85} onPress={() => router.push('/(tabs)/others' as any)}>
            <Text style={st.browseBtnText}>BROWSE SERVICES →</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return bookings.map((b, idx) => {
      const bid = String(b.id || b._id);
      const detail = bookingDetail[bid] || b;
      const isOpen = isServiceOpen(b.status);
      const isExpanded = expanded === bid;
      // A fresh quote is what the student is asked to accept; otherwise the final (or estimated) amount.
      const amount = Number((b.status === 'DIAGNOSED_QUOTED' ? b.quotedAmount : (b.finalAmount || b.quotedAmount)) || 0) || 0;
      const spec = detail.specifications && typeof detail.specifications === 'object' ? detail.specifications : {};
      const qty = Number(spec.quantity) || 0;
      const qtyText = qty > 0 ? `${qty} ${spec.unit === 'kg' ? 'kg (approx.)' : qty === 1 ? 'item' : 'items'}` : '';
      const history: any[] = Array.isArray(detail.trackingHistory) ? detail.trackingHistory : [];
      const busy = bookingBusyId === bid;
      const color = b.status === 'COMPLETED' ? COLORS.emerald : b.status === 'CANCELLED' ? '#EF4444' : goldColor;
      return (
        <StaggeredSection key={bid} delay={idx * 60} direction="up">
          <ScalePressable style={[st.card, { backgroundColor: cardBg, borderColor: border }]} onPress={() => toggleBooking(bid)}>
            <View style={st.cardHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ fontSize: 10, color: txtSec, fontWeight: '700', letterSpacing: 1.5 }}>
                  🛠️ <Text style={{ color: goldColor, fontWeight: '800' }}>BOOKING #{bid.slice(-8).toUpperCase()}</Text>
                </Text>
                <Text style={[st.restaurantName, { color: txt }]} numberOfLines={2}>{b.title || 'Service booking'}</Text>
                <Text style={{ fontSize: 10, color: txtSec, fontWeight: '600' }}>
                  {[b.pickupSlot, formatWhen(b.createdAt)].filter(Boolean).join(' • ')}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                <Text style={[st.statusBadge, { color }]}>{serviceStatusLabel(b.status).toUpperCase()}</Text>
                <Text style={[st.price, { color: txt }]}>{amount > 0 ? `₹${amount}` : 'Quote pending'}</Text>
                {amount > 0 && b.status !== 'COMPLETED' ? (
                  <Text style={{ fontSize: 9, color: txtSec, fontWeight: '700' }}>estimate</Text>
                ) : null}
              </View>
            </View>

            {isExpanded && (
              <View style={[st.details, { borderTopColor: border }]}>
                {detail.description ? (
                  <Text style={{ fontSize: 11, color: txtSec, fontWeight: '600', marginBottom: 8 }}>{detail.description}</Text>
                ) : null}
                {qtyText || detail.hostelBlock || detail.roomNumber ? (
                  <Text style={{ fontSize: 11, color: txt, fontWeight: '700', marginBottom: 8 }}>
                    {[qtyText, [detail.hostelBlock, detail.roomNumber ? `Room ${detail.roomNumber}` : ''].filter(Boolean).join(', ')].filter(Boolean).join(' • ')}
                  </Text>
                ) : null}
                {history.map((h: any, i: number) => (
                  <View key={`h-${i}`} style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 10, color: i === history.length - 1 ? goldColor : txtSec }}>●</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: txt, fontWeight: '800' }}>{serviceStatusLabel(h.stage)}</Text>
                      {h.note ? <Text style={{ fontSize: 10, color: txtSec, fontWeight: '600' }}>{h.note}</Text> : null}
                      <Text style={{ fontSize: 9, color: txtSec, fontWeight: '600' }}>{formatWhen(h.timestamp)}</Text>
                    </View>
                  </View>
                ))}
                <Text style={{ fontSize: 10, color: txtSec, fontWeight: '600', marginTop: 6 }}>
                  {b.paymentMethod === 'Wallet' ? 'Pay from Zenvy Wallet' : 'Pay in cash when the job is done'}
                </Text>
                {b.status === 'DIAGNOSED_QUOTED' && (
                  <ActionPressable style={{ borderRadius: 16, overflow: 'hidden', marginTop: 12 }} onPress={() => { if (!busy) acceptQuote(b); }} sound="click">
                    <LinearGradient colors={['#D4AF7A', '#F0D9A8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.trackBtnGradient}>
                      {busy ? <ActivityIndicator size="small" color="#000" /> : <Text style={st.trackBtnText}>ACCEPT QUOTE ₹{Number(b.quotedAmount) || 0}</Text>}
                    </LinearGradient>
                  </ActionPressable>
                )}
                {isOpen && !PICKED_UP_STATUSES.includes(b.status) && (
                  <TouchableOpacity
                    disabled={busy}
                    style={{ marginTop: 12, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: '#EF4444', alignItems: 'center' }}
                    onPress={() => cancelBooking(b)}
                  >
                    {busy ? <ActivityIndicator size="small" color="#EF4444" /> : (
                      <Text style={{ fontSize: 10, fontWeight: '900', color: '#EF4444', letterSpacing: 2 }}>CANCEL BOOKING</Text>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => router.push('/support' as any)}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? goldColor : COLORS.red }}>Need help with this booking? →</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScalePressable>
        </StaggeredSection>
      );
    });
  };

  return (
    <View style={[st.container, { backgroundColor: bg }]}>
      <AmbientBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={goldColor} colors={[COLORS.red, COLORS.gold]} />
        }
      >
        <Text style={[st.pageTitle, { color: txt }]}>MY ORDERS</Text>
        <Text style={[st.pageSub, { color: txtSec }]}>LIVE TRACKING • ONE-TAP REORDER • SERVICE BOOKINGS</Text>

        <View style={st.filterRow}>
          {['ALL', 'ACTIVE', 'PAST', 'SERVICES'].map((f) => {
            const isActive = filter === f;
            return (
              <TouchableOpacity
                key={f}
                style={[
                  st.filterBtn,
                  { 
                    backgroundColor: isActive ? (isDark ? goldColor : COLORS.red) : (isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6'),
                    borderColor: isActive ? 'transparent' : border
                  }
                ]}
                onPress={() => setFilter(f as any)}
              >
                <Text style={[
                  st.filterBtnText, 
                  { color: isActive ? (isDark ? '#000' : '#FFF') : txtSec }
                ]}>
                  {f}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {filter === 'SERVICES' ? renderServices() : null}

        {filter !== 'SERVICES' && error && orders.length > 0 && !loading ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => fetchOrders('silent')}
            style={{ marginHorizontal: 16, marginBottom: 12, padding: 10, borderRadius: 12, backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)' }}
          >
            <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>
              Couldn't refresh your orders. Tap to try again.
            </Text>
          </TouchableOpacity>
        ) : null}

        {filter === 'SERVICES' ? null : loading ? (
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            <ShimmerCard />
            <ShimmerCard />
            <ShimmerCard />
          </View>
        ) : error && orders.length === 0 ? (
          <View style={[st.emptyBox, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>📡</Text>
            <Text style={[st.emptyTitle, { color: txt }]}>Couldn't load your orders</Text>
            <Text style={[st.emptyDesc, { color: txtSec }]}>
              {error}
            </Text>
            <TouchableOpacity
              style={[st.browseBtn, { backgroundColor: COLORS.gold || '#D4AF7A' }]}
              activeOpacity={0.85}
              onPress={() => fetchOrders('initial')}
            >
              <Text style={[st.browseBtnText, { color: '#000' }]}>TRY AGAIN 🔄</Text>
            </TouchableOpacity>
          </View>
        ) : orders.length === 0 ? (
          <View style={[st.emptyBox, { backgroundColor: cardBg, borderColor: border }]}>
            <FloatingPulse>
              <Text style={{ fontSize: 50, marginBottom: 16 }}>🍱</Text>
            </FloatingPulse>
            <Text style={[st.emptyTitle, { color: txt }]}>No Orders Found Yet</Text>
            <Text style={[st.emptyDesc, { color: txtSec }]}>
              Explore our wide variety of campus bites, bulk hostel grocery baskets, and fresh student meals.
            </Text>
            <TouchableOpacity 
              style={[st.browseBtn, { backgroundColor: COLORS.red }]}
              activeOpacity={0.85}
              onPress={() => router.push('/(tabs)' as any)}
            >
              <Text style={st.browseBtnText}>EXPLORE CAMPUS EATS →</Text>
            </TouchableOpacity>
          </View>
        ) : !loading && orders.filter(o => {
          if (filter === 'ACTIVE') return o.status !== 'Delivered' && o.status !== 'Cancelled';
          if (filter === 'PAST') return o.status === 'Delivered' || o.status === 'Cancelled';
          return true;
        }).length === 0 ? (
          <View style={[st.emptyBox, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>{filter === 'ACTIVE' ? '🛵' : '📋'}</Text>
            <Text style={[st.emptyTitle, { color: txt }]}>
              {filter === 'ACTIVE' ? 'No Active Orders' : 'No Past Orders Found'}
            </Text>
            <Text style={[st.emptyDesc, { color: txtSec }]}>
              {filter === 'ACTIVE' 
                ? 'You do not have any ongoing deliveries right now. Order fresh food or canteen snacks anytime!'
                : 'You have not completed any past orders in this view.'}
            </Text>
            <TouchableOpacity 
              style={[st.browseBtn, { backgroundColor: COLORS.red }]}
              activeOpacity={0.85}
              onPress={() => filter === 'ACTIVE' ? router.push('/(tabs)' as any) : setFilter('ALL')}
            >
              <Text style={st.browseBtnText}>
                {filter === 'ACTIVE' ? 'ORDER FRESH BITES →' : 'VIEW ALL ORDERS ➔'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {filter !== 'SERVICES' && !loading && orders.filter(o => {
          if (filter === 'ACTIVE') return o.status !== 'Delivered' && o.status !== 'Cancelled';
          if (filter === 'PAST') return o.status === 'Delivered' || o.status === 'Cancelled';
          return true;
        }).map((o, idx) => {
          const id = (o._id || o.id || '').slice(-6).toUpperCase();
          const isExpanded = expanded === (o._id || o.id);
          const orderItems: any[] = parseItems(o.items);
          const breakdown = parseBreakdown(o.priceBreakdown);
          const charged = amountCharged(o);
          const restaurantName = o.restaurantName || o.restaurant?.name || (o.category === 'Mega Basket' ? 'Mega Basket' : 'Zenvy order');
          const needsRating = o.status === 'Delivered' && o.rating == null;
          // Customer cancels carry no reason (or the default one); store / system cancels explain themselves.
          const cancelReason = o.status === 'Cancelled' && typeof o.cancellationReason === 'string'
            && o.cancellationReason.trim() && !/by customer|by user/i.test(o.cancellationReason)
            ? o.cancellationReason.trim()
            : null;
          const showPin = !!o.deliveryPin && PIN_STATUSES.includes(o.status);
          const subtotal = Number(breakdown?.subtotal ?? o.totalPrice ?? 0) || 0;
          const deliveryFee = Number(breakdown?.deliveryFee ?? o.deliveryFee ?? 0) || 0;
          const discounts: any[] = Array.isArray(breakdown?.discounts)
            ? breakdown.discounts.filter((d: any) => Number(d?.amount) > 0)
            : [
                ...(Number(o.batchDiscount) > 0 ? [{ label: 'Shared delivery discount', amount: Number(o.batchDiscount) }] : []),
                ...(Number(o.gateDiscount) > 0 ? [{ label: 'Perk discount', amount: Number(o.gateDiscount) }] : []),
              ];
          const paymentLabel = o.paymentMethod === 'Wallet' ? 'Paid from Zenvy Wallet' : o.paymentMethod === 'COD' ? 'Cash on Delivery' : null;

          return (
            <StaggeredSection key={o._id || o.id} delay={idx * 80} direction="up">
              <ScalePressable 
                style={[st.card, { backgroundColor: cardBg, borderColor: border }]} 
                onPress={() => toggleExpand(o._id || o.id)}
              >
              <View style={st.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: txtSec, fontWeight: '700', letterSpacing: 1.5 }}>
                    {o.status === 'Cancelled' ? '✕' : o.status === 'Delivered' ? '✓' : '◉'}{' '}
                    <Text style={{ color: goldColor, fontWeight: '800' }}>ORDER #{id}</Text>
                  </Text>
                  <Text style={[st.restaurantName, { color: txt }]} numberOfLines={1}>{restaurantName}</Text>
                  <Text style={{ fontSize: 10, color: txtSec, fontWeight: '600' }}>{orderItems.length} item{orderItems.length !== 1 ? 's' : ''} • {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                    {o.status !== 'Delivered' && o.status !== 'Cancelled' && (
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                    )}
                    <Text style={[st.statusBadge, { color: statusColor(o.status) }]}>{statusLabel(o.status).toUpperCase()}</Text>
                  </View>
                  <Text style={[st.price, { color: txt }]}>₹{charged}</Text>
                </View>
              </View>

              {/* Quick 1-Tap Track Strip on Active Orders */}
              {o.status !== 'Delivered' && o.status !== 'Cancelled' && !isExpanded && (
                <TouchableOpacity
                  style={{
                    marginTop: 10,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: isDark ? 'rgba(212,175,122,0.15)' : 'rgba(239,79,95,0.08)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    router.push(`/tracking/${o._id || o.id}` as any);
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? goldColor : COLORS.red, letterSpacing: 1 }}>
                    📍 {statusLabel(o.status).toUpperCase()} • TRACK ORDER
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? goldColor : COLORS.red }}>→</Text>
                </TouchableOpacity>
              )}

              {/* Rate a delivered order (the tracking screen opens the rating sheet) */}
              {needsRating && !isExpanded && (
                <TouchableOpacity
                  style={{
                    marginTop: 10,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: isDark ? 'rgba(212,175,122,0.12)' : 'rgba(201,151,46,0.08)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    router.push(`/tracking/${o._id || o.id}` as any);
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '900', color: goldColor, letterSpacing: 1 }}>⭐ RATE THIS ORDER</Text>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: goldColor }}>→</Text>
                </TouchableOpacity>
              )}

              {isExpanded && (
                <View style={[st.details, { borderTopColor: border }]}>
                  {showPin && (
                    <View style={[st.otpSection, { borderColor: isDark ? 'rgba(212,175,122,0.3)' : 'rgba(201,151,46,0.3)', backgroundColor: isDark ? 'rgba(212,175,122,0.08)' : 'rgba(201,151,46,0.08)' }]}>
                      <Text style={{ fontSize: 9, fontWeight: '900', color: goldColor, letterSpacing: 2, marginBottom: 4 }}>DELIVERY PIN</Text>
                      <View style={st.otpBox}>
                        <Text style={[st.otpText, { color: goldColor }]}>{o.deliveryPin}</Text>
                        <Text style={{ fontSize: 9, color: txtSec, fontWeight: '700', lineHeight: 14 }}>Share this PIN with your{'\n'}rider at handover only</Text>
                      </View>
                    </View>
                  )}
                  {cancelReason ? (
                    <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '700', marginBottom: 8 }}>{cancelReason}</Text>
                  ) : null}
                  {orderItems.map((item: any, i: number) => {
                    const qty = Number(item.quantity) || 1;
                    const line = Number(item.lineTotal ?? (Number(item.unitPrice ?? item.price ?? 0) * qty)) || 0;
                    return (
                      <View key={i} style={st.itemRow}>
                        <Text style={{ fontSize: 11, color: txt, fontWeight: '600', flex: 1, marginRight: 8 }} numberOfLines={2}>{qty}x  {item.name}</Text>
                        <Text style={{ fontSize: 11, color: txt, fontWeight: '800' }}>₹{line}</Text>
                      </View>
                    );
                  })}
                  <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border }}>
                    <View style={st.itemRow}>
                      <Text style={{ fontSize: 11, color: txtSec, fontWeight: '600' }}>Item total</Text>
                      <Text style={{ fontSize: 11, color: txtSec, fontWeight: '700' }}>₹{subtotal}</Text>
                    </View>
                    {deliveryFee > 0 && (
                      <View style={st.itemRow}>
                        <Text style={{ fontSize: 11, color: txtSec, fontWeight: '600' }}>Delivery fee</Text>
                        <Text style={{ fontSize: 11, color: txtSec, fontWeight: '700' }}>₹{deliveryFee}</Text>
                      </View>
                    )}
                    {discounts.map((d: any, i: number) => (
                      <View key={`d-${i}`} style={st.itemRow}>
                        <Text style={{ fontSize: 11, color: COLORS.emerald, fontWeight: '600', flex: 1, marginRight: 8 }} numberOfLines={1}>{d.label || 'Discount'}</Text>
                        <Text style={{ fontSize: 11, color: COLORS.emerald, fontWeight: '700' }}>−₹{Number(d.amount)}</Text>
                      </View>
                    ))}
                    <View style={st.itemRow}>
                      <Text style={{ fontSize: 12, color: txt, fontWeight: '900' }}>{o.status === 'Cancelled' ? 'Order total' : 'Total'}</Text>
                      <Text style={{ fontSize: 12, color: txt, fontWeight: '900' }}>₹{charged}</Text>
                    </View>
                    {paymentLabel && (
                      <Text style={{ fontSize: 10, color: txtSec, fontWeight: '600', marginTop: 2 }}>
                        {paymentLabel}
                        {o.status === 'Cancelled' && o.paymentMethod === 'Wallet' ? ' • refunded to Wallet' : ''}
                        {o.status === 'Cancelled' && o.paymentMethod === 'COD' ? ' • no payment taken' : ''}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={{ marginTop: 10, alignSelf: 'flex-start' }}
                    onPress={() => router.push({ pathname: '/support', params: { orderId: String(o._id || o.id) } } as any)}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? goldColor : COLORS.red }}>Need help with this order? →</Text>
                  </TouchableOpacity>
                  {needsRating && (
                    <TouchableOpacity
                      style={{ marginTop: 8, alignSelf: 'flex-start' }}
                      onPress={() => router.push(`/tracking/${o._id || o.id}` as any)}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: goldColor }}>⭐ Rate this order →</Text>
                    </TouchableOpacity>
                  )}
                  {o.status !== 'Delivered' && o.status !== 'Cancelled' ? (
                    <ActionPressable style={{ borderRadius: 16, overflow: 'hidden', marginTop: 12 }} onPress={() => router.push(`/tracking/${o._id || o.id}` as any)} sound="click">
                      <LinearGradient
                        colors={['#D4AF7A', '#F0D9A8']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={st.trackBtnGradient}
                      >
                        <Text style={st.trackBtnText}>TRACK ORDER →</Text>
                      </LinearGradient>
                    </ActionPressable>
                  ) : (
                    <ActionPressable style={{ borderRadius: 16, overflow: 'hidden', marginTop: 12 }} onPress={() => handleReorder(o)} sound="click">
                      <LinearGradient
                        colors={['#EF4F5F', '#FF6B7B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={st.trackBtnGradient}
                      >
                        {reorderingId === (o._id || o.id) ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={[st.trackBtnText, { color: '#fff' }]}>REORDER 🔁</Text>
                        )}
                      </LinearGradient>
                    </ActionPressable>
                  )}
                </View>
              )}
            </ScalePressable>
            </StaggeredSection>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'android' ? 40 : 50, width: '100%', maxWidth: 600, alignSelf: 'center' },
  pageTitle: { fontSize: 24, fontWeight: '900', letterSpacing: 4, paddingHorizontal: 16, marginBottom: 4 },
  pageSub: { fontSize: 9, fontWeight: '700', letterSpacing: 2, paddingHorizontal: 16, marginBottom: 20 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 12, fontWeight: '600' },
  emptyBox: { marginHorizontal: 16, marginTop: 20, padding: 32, borderRadius: 24, alignItems: 'center', borderWidth: 1, ...SHADOWS.card },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 12 },
  browseBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, ...SHADOWS.redGlow },
  browseBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginBottom: 20, gap: 8 },
  filterBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1 },
  filterBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 20, padding: 16, borderWidth: 1, ...SHADOWS.card },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  restaurantName: { fontSize: 15, fontWeight: '900', marginVertical: 3, letterSpacing: -0.2 },
  statusBadge: { fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  price: { fontSize: 16, fontWeight: '900', marginTop: 4 },
  details: { marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  otpSection: { marginBottom: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  otpBox: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  otpText: { fontSize: 28, fontWeight: '900', color: '#D4AF7A', fontVariant: ['tabular-nums'], letterSpacing: 6 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  trackBtnGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  trackBtnText: { fontSize: 10, fontWeight: '900', color: '#000', letterSpacing: 3 },
});
