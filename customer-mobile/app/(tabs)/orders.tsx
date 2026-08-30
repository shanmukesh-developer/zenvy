import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, RefreshControl, Animated, LayoutAnimation, UIManager, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { COLORS, SHADOWS } from '../../constants/theme';
import { ENDPOINTS } from '../../constants/api';
import { useTheme } from '../../context/ThemeContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/auth';
import AmbientBackground from '../../components/AmbientBackground';
import { StaggeredSection, BounceIn, FloatingPulse, PulseGlow } from '../../components/AnimatedSection';
import { ActionPressable } from '../../components/DopaminePressable';

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

export default function OrdersScreen() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { user } = useAuth();
  const { addToCart, clearCart, cart } = useCart();
  const [orders, setOrders] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleReorder = (order: any) => {
    try {
      let items = order.items || [];
      if (typeof items === 'string') {
        try {
          items = JSON.parse(items);
        } catch {
          items = [];
        }
      }
      if (!Array.isArray(items) || items.length === 0) {
        Alert.alert('Reorder Unavailable', 'Could not retrieve items from this past order.');
        return;
      }

      const targetRestaurantId = order.restaurantId;
      const targetRestaurantName = order.restaurant || 'Zenvy Partner';
      const hasConflict = cart.length > 0 && cart[0].restaurantId !== targetRestaurantId;

      const performReorder = () => {
        if (hasConflict) {
          clearCart();
        }
        items.forEach((item: any) => {
          addToCart({
            id: item.itemId || item.id || String(Math.random()),
            name: item.name,
            price: item.price,
            basePrice: item.basePrice || item.price,
            image: item.image || item.imageUrl || '',
            restaurantId: targetRestaurantId,
            restaurantName: targetRestaurantName,
            quantity: item.quantity || 1,
            customizations: item.customizations || {},
          });
        });
        router.push('/(tabs)/basket' as any);
      };

      if (hasConflict) {
        Alert.alert(
          'Replace Basket?',
          `Your basket contains items from another restaurant. Replace them with items from ${targetRestaurantName}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Replace & Reorder', onPress: performReorder }
          ]
        );
      } else {
        performReorder();
      }
    } catch (e) {
      console.error('Reorder error:', e);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await apiFetch(ENDPOINTS.myOrders);
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
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
          AUTHENTICATION REQUIRED
        </Text>
        <Text style={{ fontSize: 12, color: txtSec, fontWeight: '600', textAlign: 'center', marginBottom: 24, lineHeight: 18 }}>
          Please sign in to access your live order records, OTP verification, and tracking.
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
        <Text style={[st.pageSub, { color: txtSec }]}>LIVE TRACKING • ONE-TAP REORDER • OTP CODES</Text>

        {orders.length === 0 && (
          <View style={[st.emptyBox, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>🍱</Text>
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
        )}

        {orders.map((o, idx) => {
          const id = (o._id || o.id || '').slice(-6).toUpperCase();
          const isExpanded = expanded === (o._id || o.id);
          let orderItems: any[] = [];
          if (Array.isArray(o.items)) {
            orderItems = o.items;
          } else if (typeof o.items === 'string') {
            try { orderItems = JSON.parse(o.items); } catch { orderItems = []; }
          }

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
                  <Text style={[st.restaurantName, { color: txt }]}>{o.restaurant || 'Zenvy Partner'}</Text>
                  <Text style={{ fontSize: 10, color: txtSec, fontWeight: '600' }}>{orderItems.length} item{orderItems.length !== 1 ? 's' : ''} • {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                    {o.status !== 'Delivered' && o.status !== 'Cancelled' && (
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                    )}
                    <Text style={[st.statusBadge, { color: statusColor(o.status) }]}>{(o.status || 'PENDING').toUpperCase()}</Text>
                  </View>
                  <Text style={[st.price, { color: txt }]}>₹{o.totalPrice || 0}</Text>
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
                    📍 LIVE MISSION IN PROGRESS • TRACK NOW
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? goldColor : COLORS.red }}>→</Text>
                </TouchableOpacity>
              )}

              {isExpanded && (
                <View style={[st.details, { borderTopColor: border }]}>
                  {o.deliveryOTP && (
                    <View style={[st.otpSection, { borderColor: isDark ? 'rgba(212,175,122,0.3)' : 'rgba(201,151,46,0.3)', backgroundColor: isDark ? 'rgba(212,175,122,0.08)' : 'rgba(201,151,46,0.08)' }]}>
                      <Text style={{ fontSize: 9, fontWeight: '900', color: goldColor, letterSpacing: 2, marginBottom: 4 }}>DELIVERY OTP PIN</Text>
                      <View style={st.otpBox}>
                        <Text style={[st.otpText, { color: goldColor }]}>{o.deliveryOTP}</Text>
                        <Text style={{ fontSize: 9, color: txtSec, fontWeight: '700', lineHeight: 14 }}>VERIFICATION PIN{'\n'}Show to Delivery Partner</Text>
                      </View>
                    </View>
                  )}
                  {orderItems.map((item: any, i: number) => (
                    <View key={i} style={st.itemRow}>
                      <Text style={{ fontSize: 11, color: txt, fontWeight: '600' }}>{item.quantity}x  {item.name}</Text>
                      <Text style={{ fontSize: 11, color: txt, fontWeight: '800' }}>₹{(item.price || 0) * (item.quantity || 1)}</Text>
                    </View>
                  ))}
                  {o.status !== 'Delivered' && o.status !== 'Cancelled' ? (
                    <ActionPressable style={{ borderRadius: 16, overflow: 'hidden', marginTop: 12 }} onPress={() => router.push(`/tracking/${o._id || o.id}` as any)} sound="click">
                      <LinearGradient
                        colors={['#D4AF7A', '#F0D9A8']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={st.trackBtnGradient}
                      >
                        <Text style={st.trackBtnText}>TRACK LIVE LOCATION →</Text>
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
                        <Text style={[st.trackBtnText, { color: '#fff' }]}>REORDER THIS MEAL 🔁</Text>
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
