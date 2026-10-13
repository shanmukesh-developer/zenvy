import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, SHADOWS } from '../constants/theme';
import { API_URL, ENDPOINTS } from '../constants/api';
import {
  useCart,
  useBasketQuote,
  useServiceability,
  isCustomRequest,
  toOrderLine,
  friendlyNetworkMessage,
  newIdempotencyKey,
  DELIVERY_INSTRUCTIONS,
  DELIVERY_INSTRUCTIONS_KEY,
} from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiFetch } from '../utils/auth';
import { StaggeredSection, FloatingPulse, BounceIn } from '../components/AnimatedSection';
import DopaminePressable, { ActionPressable } from '../components/DopaminePressable';
import { stallErrorMessage, stallPayCopy } from '../utils/localVendor';

type CampusKey = 'srmap' | 'vitap' | 'amrita';
type PayMethod = 'COD' | 'Wallet';

interface ExtraItem {
  id: string;
  name: string;
  price: number;
  emoji?: string | null;
  image?: string | null;
  restaurantId: string;
  storeName?: string;
}

interface UserCoupon {
  id: string;
  code: string;
  type: string;
  label?: string;
  expiresInDays?: number | null;
}

// Campuses the order service delivers to (server: resolveCampus in orderController).
const CAMPUSES: { key: CampusKey; label: string; sub: string; icon: string; code: string }[] = [
  { key: 'srmap', label: 'SRM AP', sub: 'SRM University', icon: '🏢', code: 'SRMAP' },
  { key: 'vitap', label: 'VIT AP', sub: 'VIT Campus', icon: '🏫', code: 'VITAP' },
  { key: 'amrita', label: 'AMRITA', sub: 'Amrita Campus', icon: '🏥', code: 'AMRITA' },
];

// Which add-on shelf (GET /api/catalogue/items?type=extras&for=…) fits the dishes in the basket.
function detectDishType(name: string): string {
  const n = name.toLowerCase();
  if (/cake|pastry|brownie|cupcake|cheesecake|gateau|truffle/.test(n)) return 'cake';
  if (/pizza|calzone/.test(n)) return 'pizza';
  if (/biryani|biriyani|pulao|rice bowl/.test(n)) return 'biryani';
  if (/juice|shake|coffee|tea|chai|lassi|smoothie|lemonade|mojito|frappe|milkshake/.test(n)) return 'beverage';
  if (/sweet|laddu|ladoo|barfi|halwa|jalebi|kaju|peda|mysore pak|mithai/.test(n)) return 'sweets';
  if (/burger|sandwich|wrap|sub|roll|frank|hotdog/.test(n)) return 'burger';
  if (/ice cream|kulfi|falooda|sundae|gelato/.test(n)) return 'dessert';
  if (/chicken|tandoori|kebab|tikka|grilled/.test(n)) return 'chicken';
  if (/noodle|chowmein|fried rice|manchurian|momos/.test(n)) return 'chinese';
  if (/dosa|idli|uttapam|vada|sambar|upma/.test(n)) return 'south';
  return 'meal';
}

const rupees = (n: number) => `₹${Math.round((Number(n) || 0) * 100) / 100}`;
const cleanRoom = (room: any) => String(room || '').replace(/^\s*room\s*/i, '').trim();

export default function CheckoutScreen() {
  const router = useRouter();
  const { cart, totalItems, addToCart, setCart, removeItems } = useCart();
  const { user, refreshUser } = useAuth();
  const { isDark, colors } = useTheme();

  const [campus, setCampus] = useState<CampusKey>('srmap');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [instructionIds, setInstructionIds] = useState<string[]>([]);
  const [campusBlocks, setCampusBlocks] = useState<Record<string, string[]>>({});

  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('COD');

  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [couponCode, setCouponCode] = useState<string | null>(null);

  // Rewards "USE NOW" opens checkout with ?coupon=CODE. The quote drops it (COUPON_INVALID) if it is not usable.
  const { coupon: couponParam } = useLocalSearchParams<{ coupon?: string | string[] }>();
  const couponFromLink = String((Array.isArray(couponParam) ? couponParam[0] : couponParam) || '').trim().toUpperCase();
  const couponLinkAppliedRef = useRef(false);
  useEffect(() => {
    if (couponLinkAppliedRef.current || !couponFromLink) return;
    couponLinkAppliedRef.current = true;
    setCouponCode(couponFromLink.slice(0, 40));
  }, [couponFromLink]);

  const [extras, setExtras] = useState<ExtraItem[]>([]);

  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);
  const idempotencyKeyRef = useRef<string>(newIdempotencyKey());
  // Separate key for the Mega Basket shopping list, tied to its exact contents and kept across retries
  // until the server answers, so a timed-out request that was processed is not created twice.
  const basketKeyRef = useRef<{ sig: string; key: string } | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const orderLines = useMemo(() => cart.filter((i) => !isCustomRequest(i)), [cart]);
  const customLines = useMemo(() => cart.filter((i) => isCustomRequest(i)), [cart]);
  const hasOrder = orderLines.length > 0;
  const hasCustom = customLines.length > 0;

  const { quote, loading: quoteLoading, error: quoteError, refresh: refreshQuote } = useBasketQuote(couponCode, !!user);
  const { serviceability, refresh: refreshServiceability } = useServiceability();
  // CampusBites stall basket: the stall delivers, cash on delivery to the stall, no coupons / add-ons.
  const isStallOrder = hasOrder && (quote ? quote.fulfilment === 'VENDOR' : orderLines.some((i) => i.isStall));
  const stallName = (isStallOrder && (quote?.store?.name || orderLines.find((i) => i.isStall)?.restaurantName)) || 'the stall';
  const isClosed = (quote?.serviceability?.open === false) || serviceability?.open === false;
  const closedMessage = quote?.serviceability?.message || serviceability?.message ||
    `Campus kitchens are closed for the night. Ordering opens again at ${serviceability?.reopensAt || quote?.serviceability?.reopensAt || '6:00 AM'}.`;

  // A new basket or a new bill means a new checkout attempt.
  useEffect(() => {
    idempotencyKeyRef.current = newIdempotencyKey();
  }, [quote?.finalPrice, paymentMethod, cart.length]);

  // Prefill the address from the profile
  useEffect(() => {
    if (!user) return;
    const block = (user as any)?.hostelBlock;
    const room = cleanRoom((user as any)?.roomNumber);
    setAddress((prev) => {
      if (prev) return prev;
      if (block && room) return `${block}, Room ${room}`;
      if (block) return String(block);
      return (user as any)?.address || '';
    });
  }, [user]);

  // Delivery notes picked on the Basket tab
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(DELIVERY_INSTRUCTIONS_KEY);
        const parsed = stored ? JSON.parse(stored) : null;
        if (Array.isArray(parsed) && mountedRef.current) setInstructionIds(parsed.filter((x) => typeof x === 'string'));
      } catch {}
    })();
  }, []);

  // Hostel blocks per campus come from the campus directory (admin-managed)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/campus/campuses`);
        const data = await res.json().catch(() => null);
        if (cancelled || !res.ok || !Array.isArray(data)) return;
        const map: Record<string, string[]> = {};
        data.forEach((c: any) => {
          const code = String(c?.code || '').toUpperCase().replace(/[^A-Z]/g, '');
          const match = CAMPUSES.find((k) => code.startsWith(k.code));
          const blocks = c?.settings?.hostelBlocks;
          if (match && Array.isArray(blocks)) {
            map[match.key] = blocks.filter((b: any) => typeof b === 'string' && b.trim()).slice(0, 16);
          }
        });
        setCampusBlocks(map);
      } catch {
        // Chips are a shortcut only; the address field always works.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Usable coupons
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`${API_URL}/api/rewards/coupons`);
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && Array.isArray(data)) setCoupons(data);
      } catch {
        // No coupons shown; checkout still works.
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // An invalid coupon is dropped with the server's reason
  useEffect(() => {
    if (quoteError?.code === 'COUPON_INVALID' && couponCode) {
      Alert.alert('Coupon not applied', quoteError.message);
      setCouponCode(null);
    }
  }, [quoteError, couponCode]);

  // Stall orders take no coupon (COUPON_NOT_FOR_STALL): drop it quietly, the coupon section is hidden for them.
  useEffect(() => {
    if (couponCode && (isStallOrder || quoteError?.code === 'COUPON_NOT_FOR_STALL')) setCouponCode(null);
  }, [quoteError, couponCode, isStallOrder]);

  // Wallet is not possible when the balance is short, or for a stall (cash to the stall only)
  useEffect(() => {
    if (paymentMethod === 'Wallet' && ((quote && quote.canPayWithWallet === false) || isStallOrder)) setPaymentMethod('COD');
  }, [quote, paymentMethod, isStallOrder]);

  // "Pairs well with your order": real add-ons from the catalogue
  const dishTypesKey = useMemo(() => {
    const types = new Set(orderLines.filter((i) => !i.isAddOn).map((i) => detectDishType(i.name)));
    return [...types].slice(0, 3).sort().join(',');
  }, [orderLines]);

  useEffect(() => {
    if (!dishTypesKey) { setExtras([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const lists = await Promise.all(dishTypesKey.split(',').map(async (t) => {
          const res = await fetch(`${API_URL}/api/catalogue/items?type=extras&for=${encodeURIComponent(t)}`);
          const data = await res.json().catch(() => null);
          return res.ok && data && Array.isArray(data.items) ? data.items : [];
        }));
        if (cancelled) return;
        const seen = new Set<string>();
        const result: ExtraItem[] = [];
        lists.flat().forEach((it: any) => {
          const id = String(it?.id || it?._id || '');
          if (!id || seen.has(id) || it.isAvailable === false || it.orderable === false) return;
          seen.add(id);
          result.push({
            id,
            name: String(it.name || ''),
            price: Number(it.price) || 0,
            emoji: it.emoji || null,
            image: it.imageUrl || it.image || null,
            restaurantId: String(it.restaurantId || it.storeId || ''),
            storeName: it.storeName,
          });
        });
        setExtras(result);
      } catch {
        if (!cancelled) setExtras([]);
      }
    })();
    return () => { cancelled = true; };
  }, [dishTypesKey]);

  const suggestions = useMemo(() => {
    if (isStallOrder) return [];
    const inCart = new Set(cart.map((i) => String(i.id)));
    return extras.filter((e) => !inCart.has(e.id)).slice(0, 8);
  }, [extras, cart, isStallOrder]);
  const addOnLines = useMemo(() => orderLines.filter((i) => i.isAddOn), [orderLines]);
  const removeAddOns = () => {
    const keys = new Set(addOnLines.map((l) => l.cartKey));
    setCart((prev) => prev.filter((i) => !keys.has(i.cartKey)));
  };

  const customEstimate = customLines.reduce((acc, i) => acc + (Number(i.price) || 0) * i.quantity, 0);
  const campusLabel = CAMPUSES.find((c) => c.key === campus)?.label || 'SRM AP';

  const deliveryNotes = useMemo(
    () => DELIVERY_INSTRUCTIONS.filter((d) => instructionIds.includes(d.id)).map((d) => d.note),
    [instructionIds]
  );

  // Food orders carry the notes as deliveryInstructions (both partner apps show them), so they are
  // left out of the address there. Mega Basket has no instructions field: keep them in its address.
  const buildDeliveryAddress = (withNotes = false) => {
    const parts = [`${campusLabel} - ${address.trim()}`];
    if (landmark.trim()) parts.push(`Landmark: ${landmark.trim()}`);
    if (withNotes && deliveryNotes.length) parts.push(`Note: ${deliveryNotes.join(', ')}`);
    return parts.join(' · ').slice(0, 480);
  };

  const unavailableFrom = (body: any) => {
    const list = Array.isArray(body?.unavailableItems) ? body.unavailableItems : [];
    // BOOKING_ONLY_ITEMS: services (print, laundry, …) that must be booked, not ordered
    const bookingOnly = Array.isArray(body?.bookingOnlyItems) ? body.bookingOnlyItems : [];
    return {
      ids: list.map((u: any) => String(u?.id || '')).filter(Boolean),
      names: [...list.map((u: any) => String(u?.name || '')), ...bookingOnly.map((n: any) => String(n || ''))].filter(Boolean),
    };
  };

  const offerRemoveUnavailable = (message: string, body: any) => {
    const { ids, names } = unavailableFrom(body);
    Alert.alert('Some items are unavailable', message, [
      { text: 'Keep editing', style: 'cancel' },
      ...(ids.length || names.length
        ? [{ text: 'Remove them', style: 'destructive' as const, onPress: () => removeItems({ ids, names }) }]
        : []),
    ]);
  };

  const offerRemoveStallAddOns = (message: string) => {
    Alert.alert('Remove add-ons', message || `Add-ons can't be added to a ${stallName} order.`, [
      { text: 'Keep editing', style: 'cancel' },
      ...(addOnLines.length ? [{ text: 'Remove add-ons', style: 'destructive' as const, onPress: removeAddOns }] : []),
    ]);
  };

  const canPlace = !placing && !isClosed && !!user && address.trim().length >= 3 &&
    (hasOrder ? (!!quote && !quoteLoading) : hasCustom);

  const handlePlaceOrder = () => {
    if (placingRef.current) return;
    if (cart.length === 0) {
      Alert.alert('Your basket is empty', 'Add something tasty first!');
      return;
    }
    if (isClosed) {
      Alert.alert('Closed for the night', closedMessage);
      return;
    }
    if (address.trim().length < 3) {
      Alert.alert('Where should we deliver?', `Add your hostel block and room number (e.g. Ganga, Room 304) so ${isStallOrder ? stallName : 'the rider'} can find you.`);
      return;
    }
    if (hasOrder && (!quote || quoteLoading)) {
      if (quoteLoading) Alert.alert('One moment', 'We are updating your bill. Try again in a second.');
      else if (quoteError?.code === 'ITEMS_UNAVAILABLE' || quoteError?.code === 'BOOKING_ONLY_ITEMS') offerRemoveUnavailable(quoteError.message, quoteError.body);
      else if (quoteError?.code === 'ADDONS_NOT_FOR_STALL') offerRemoveStallAddOns(quoteError.message);
      else if (quoteError && stallErrorMessage(quoteError.code, quoteError.message, stallName)) {
        const m = stallErrorMessage(quoteError.code, quoteError.message, stallName)!;
        Alert.alert(m.title, m.message);
      }
      else if (quoteError) Alert.alert('We could not get your bill', quoteError.message, [{ text: 'OK', style: 'cancel' }, { text: 'Retry', onPress: refreshQuote }]);
      return;
    }

    const lines: string[] = [];
    if (hasOrder && quote) {
      const n = orderLines.reduce((a, i) => a + i.quantity, 0);
      lines.push(`${n} item${n === 1 ? '' : 's'} from ${quote.store?.name || 'your store'} • ${rupees(quote.finalPrice)}`);
      lines.push(isStallOrder
        ? `💵 ${stallPayCopy(stallName)} (${stallName} delivers it, no Zenvy rider)`
        : `💳 ${paymentMethod === 'Wallet' ? 'Zenvy Wallet' : 'Cash on Delivery'}`);
    }
    if (hasCustom) {
      lines.push(`🛍️ Mega Basket shopping list (${customLines.length}) • est. ${rupees(customEstimate)} + fees, cash on delivery`);
    }
    lines.push(`📍 ${campusLabel} - ${address.trim()}`);

    Alert.alert('Confirm your order', lines.join('\n'), [
      { text: 'Edit', style: 'cancel' },
      { text: 'Place order', onPress: () => { executeOrderPlacement(); } },
    ]);
  };

  const executeOrderPlacement = async () => {
    if (placingRef.current) return;
    placingRef.current = true;
    setPlacing(true);
    const deliveryAddress = buildDeliveryAddress();
    let placedOrderId: string | null = null;
    let placedBasket = false;

    try {
      // 1. The food / store order — priced and charged by the server
      if (hasOrder) {
        let res: Response;
        try {
          res = await apiFetch(ENDPOINTS.placeOrder, {
            method: 'POST',
            headers: { 'Idempotency-Key': idempotencyKeyRef.current },
            body: JSON.stringify({
              items: orderLines.map(toOrderLine),
              paymentMethod: isStallOrder ? 'COD' : paymentMethod,
              deliveryAddress,
              campus,
              deliverySlot: 'ASAP',
              ...(deliveryNotes.length ? { deliveryInstructions: deliveryNotes } : {}),
              idempotencyKey: idempotencyKeyRef.current,
              ...(couponCode && !isStallOrder ? { couponCode } : {}),
            }),
          });
        } catch {
          // Same key on retry, so a request that did get through is never placed twice.
          Alert.alert('Connection problem', `${friendlyNetworkMessage} If your order went through, it will show up in Orders.`);
          return;
        }
        const data = await res.json().catch(() => null);
        if (res.ok && data && (data._id || data.id)) {
          placedOrderId = String(data._id || data.id);
          const placedKeys = new Set(orderLines.map((l) => l.cartKey));
          setCart((prev) => prev.filter((i) => !placedKeys.has(i.cartKey)));
        } else {
          const code = data?.code;
          const message = (data && typeof data.message === 'string' && data.message) || 'We could not place your order. Please try again.';
          if (res.status !== 409) idempotencyKeyRef.current = newIdempotencyKey();
          if (code === 'ITEMS_UNAVAILABLE' || code === 'BOOKING_ONLY_ITEMS') offerRemoveUnavailable(message, data);
          else if (code === 'STALL_COD_ONLY') {
            setPaymentMethod('COD');
            Alert.alert('Cash only', `${message} Payment is now set to cash. Tap Place order again.`);
          } else if (code === 'COUPON_NOT_FOR_STALL') {
            setCouponCode(null);
            Alert.alert('Coupon removed', `Coupons can't be used on ${stallName} orders, so we removed it. Tap Place order again.`);
          } else if (code === 'ADDONS_NOT_FOR_STALL') {
            offerRemoveStallAddOns(message);
          } else if (stallErrorMessage(code, message, stallName)) {
            const m = stallErrorMessage(code, message, stallName)!;
            Alert.alert(m.title, m.message);
          } else if (code === 'INSUFFICIENT_WALLET') {
            Alert.alert('Not enough Wallet balance', message, [
              { text: 'OK', style: 'cancel' },
              { text: 'Pay cash instead', onPress: () => setPaymentMethod('COD') },
            ]);
          } else if (code === 'COUPON_INVALID') {
            setCouponCode(null);
            Alert.alert('Coupon not applied', message);
          } else if (code === 'ORDERING_CLOSED') {
            refreshServiceability();
            Alert.alert('Closed for the night', message);
          } else if (code === 'ORDER_IN_PROGRESS') {
            Alert.alert('Almost there', message);
          } else {
            Alert.alert('Order not placed', message);
          }
          refreshQuote();
          return;
        }
      }

      // 2. Mega Basket shopping list (free-text requests a rider buys for you; cash on delivery)
      if (hasCustom) {
        const basketBody = {
          items: customLines.map((i) => ({
            name: String(i.name || '').replace(/^\[Custom Request\]\s*/i, ''),
            quantity: i.quantity,
            unit: 'pcs',
            priceEstimated: Number(i.price) || 0,
          })),
          deliveryAddress: buildDeliveryAddress(true),
          paymentMethod: 'COD',
        };
        const basketSig = JSON.stringify(basketBody);
        if (!basketKeyRef.current || basketKeyRef.current.sig !== basketSig) {
          basketKeyRef.current = { sig: basketSig, key: newIdempotencyKey() };
        }
        const basketKey = basketKeyRef.current.key;
        try {
          const res = await apiFetch(`${API_URL}/api/mega-basket`, {
            method: 'POST',
            headers: { 'Idempotency-Key': basketKey },
            body: JSON.stringify({ ...basketBody, idempotencyKey: basketKey }),
          });
          const data = await res.json().catch(() => null);
          // The server answered: this attempt is settled (409 = the same key is still being processed).
          if (res.status !== 409 && basketKeyRef.current?.key === basketKey) basketKeyRef.current = null;
          if (res.ok) {
            placedBasket = true;
            const keys = new Set(customLines.map((l) => l.cartKey));
            setCart((prev) => prev.filter((i) => !keys.has(i.cartKey)));
          } else {
            const message = (data && typeof data.message === 'string' && data.message) || 'We could not send your shopping list.';
            Alert.alert(placedOrderId ? 'Order placed, shopping list not sent' : 'Shopping list not sent',
              placedOrderId ? `${message} Your shopping list is still in your basket — try again from there.` : message);
          }
        } catch {
          // The list may have reached the server before the connection dropped; the same key is reused
          // on retry, but tell the user to check first instead of claiming it was not sent.
          Alert.alert(placedOrderId ? 'Order placed, shopping list not confirmed' : 'Couldn’t confirm your shopping list',
            `We couldn't confirm whether your shopping list was sent. Check Mega Basket → My lists before trying again.${placedOrderId ? ' Your shopping list is still in your basket.' : ''}`);
        }
      }

      if (placedOrderId || placedBasket) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        refreshUser().catch(() => {});
        if (placedOrderId) router.replace(`/tracking/${placedOrderId}` as any);
        else router.replace('/mega-basket?tab=list' as any);
      }
    } finally {
      placingRef.current = false;
      if (mountedRef.current) setPlacing(false);
    }
  };

  const bg = colors.bg;
  const cardBg = colors.card;
  const txt = colors.text;
  const txtSec = colors.textSecondary;
  const border = colors.border;
  const goldColor = isDark ? COLORS.gold : colors.gold;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)' as any);
  };

  const header = (
    <View style={[s.header, { backgroundColor: bg, borderBottomColor: border }]}>
      <TouchableOpacity onPress={goBack} style={[s.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
        <Text style={{ color: txt, fontSize: 18 }}>‹</Text>
      </TouchableOpacity>
      <Text style={[s.title, { color: goldColor }]}>CHECKOUT & DELIVERY</Text>
    </View>
  );

  // Guests: sign in first (the bill and the order need an account)
  if (!user) {
    return (
      <View style={[s.container, { backgroundColor: bg }]}>
        {header}
        <View style={s.centerBox}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>🔐</Text>
          <Text style={[s.centerTitle, { color: txt }]}>Sign in to check out</Text>
          <Text style={[s.centerSub, { color: txtSec }]}>Your basket is saved. Sign in to see your bill and place the order.</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.push('/login' as any)}>
            <Text style={s.primaryBtnText}>SIGN IN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (cart.length === 0) {
    return (
      <View style={[s.container, { backgroundColor: bg }]}>
        {header}
        <View style={s.centerBox}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>🛒</Text>
          <Text style={[s.centerTitle, { color: txt }]}>Your basket is empty</Text>
          <Text style={[s.centerSub, { color: txtSec }]}>Add something from a campus kitchen or store to check out.</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace('/(tabs)' as any)}>
            <Text style={s.primaryBtnText}>BROWSE FOOD</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const blocks = campusBlocks[campus] || [];
  const profileBlock = (user as any)?.hostelBlock ? String((user as any).hostelBlock) : null;
  const blockChips = profileBlock && !blocks.includes(profileBlock) ? [profileBlock, ...blocks] : blocks;
  const walletBalance = Number(quote?.walletBalance ?? (user as any)?.walletBalance ?? 0) || 0;
  const walletAllowed = hasOrder && !!quote && quote.canPayWithWallet !== false;

  return (
    <KeyboardAvoidingView style={[s.container, { backgroundColor: bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: 220 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {isClosed && (
          <View style={[s.noticeCard, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.3)' }]}>
            <Text style={{ fontSize: 20 }}>🌙</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.noticeTitle, { color: txt }]}>Closed for the night</Text>
              <Text style={[s.noticeSub, { color: txtSec }]}>{closedMessage}</Text>
            </View>
          </View>
        )}

        {/* Campus Selection */}
        <StaggeredSection delay={50} direction="up">
          <Text style={[s.sectionTitle, { color: txt }]}>DELIVERY CAMPUS</Text>
          <View style={s.campusRow}>
            {CAMPUSES.map(item => {
              const isActive = campus === item.key;
              return (
                <DopaminePressable
                  key={item.key}
                  style={[
                    s.campusBtnNew,
                    { backgroundColor: cardBg, borderColor: border },
                    isActive && { borderColor: goldColor, backgroundColor: isDark ? 'rgba(201,168,76,0.08)' : 'rgba(239,79,95,0.05)' }
                  ]}
                  onPress={() => setCampus(item.key)}
                  sound="click"
                  activeScale={0.95}
                >
                  <Text style={{ fontSize: 18, marginBottom: 4 }}>{item.icon}</Text>
                  <Text style={[s.campusLabelNew, { color: isActive ? goldColor : txt }]}>{item.label}</Text>
                  <Text style={[s.campusSubLabelNew, { color: txtSec }]} numberOfLines={1}>{item.sub}</Text>
                  {isActive && (
                    <BounceIn delay={0}>
                      <View style={[s.activeCheckBadge, { backgroundColor: goldColor }]}>
                        <Text style={s.activeCheckText}>✓</Text>
                      </View>
                    </BounceIn>
                  )}
                </DopaminePressable>
              );
            })}
          </View>

          <TextInput
            style={[s.input, { backgroundColor: cardBg, color: txt, borderColor: address.trim().length >= 3 ? border : 'rgba(239,68,68,0.5)' }]}
            placeholder="Hostel block & room no. (e.g. Ganga, Room 304)"
            placeholderTextColor={txtSec}
            value={address}
            onChangeText={setAddress}
            maxLength={200}
            returnKeyType="next"
          />
          {blockChips.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {blockChips.map((block) => {
                const isSelected = address.toLowerCase().startsWith(block.toLowerCase());
                return (
                  <DopaminePressable
                    key={block}
                    style={[s.blockChip, {
                      backgroundColor: isSelected ? (isDark ? goldColor : '#EF4F5F') : cardBg,
                      borderColor: isSelected ? (isDark ? goldColor : '#EF4F5F') : border,
                    }]}
                    onPress={() => {
                      const roomMatch = address.match(/(?:room\s*#?\s*|#\s*)(\w+)/i) || address.match(/\b(\d{3,4})\b/);
                      const roomPart = roomMatch ? `Room ${roomMatch[1]}` : '';
                      if (isSelected) setAddress(roomPart);
                      else setAddress(roomPart ? `${block}, ${roomPart}` : `${block}, Room `);
                    }}
                    sound="click"
                    activeScale={0.92}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '800', color: isSelected ? '#FFFFFF' : txt, letterSpacing: 0.5 }}>
                      🏢 {block}
                    </Text>
                  </DopaminePressable>
                );
              })}
            </View>
          )}
          <TextInput
            style={[s.input, { backgroundColor: cardBg, color: txt, borderColor: border }]}
            placeholder={isStallOrder ? `Landmark or note for ${stallName} (optional)` : 'Landmark or note for the rider (optional)'}
            placeholderTextColor={txtSec}
            value={landmark}
            onChangeText={setLandmark}
            maxLength={120}
          />
          {deliveryNotes.length > 0 && (
            <Text style={[s.helperText, { color: txtSec }]}>📝 {isStallOrder ? 'Note for the stall' : 'Rider note'}: {deliveryNotes.join(', ')}</Text>
          )}
        </StaggeredSection>

        {/* Pairs Well With Your Order (catalogue add-ons) */}
        {hasOrder && suggestions.length > 0 && (
          <StaggeredSection delay={130} direction="up">
            <View style={{ marginTop: 20 }}>
              <Text style={[s.sectionTitle, { color: txt, marginBottom: 8 }]}>PAIRS WELL WITH YOUR ORDER</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.extrasScroll}>
                {suggestions.map(extra => (
                  <TouchableOpacity
                    key={extra.id}
                    style={[s.extraCard, { backgroundColor: cardBg }]}
                    activeOpacity={0.85}
                    onPress={() => {
                      const added = addToCart({
                        id: extra.id,
                        name: extra.name,
                        price: extra.price,
                        image: extra.image || '',
                        restaurantId: extra.restaurantId,
                        restaurantName: extra.storeName || 'Add-ons',
                        isAddOn: true,
                      });
                      if (added) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }}
                  >
                    <Text style={{ fontSize: 24, marginBottom: 4 }}>{extra.emoji || '➕'}</Text>
                    <Text style={[s.extraName, { color: txt }]} numberOfLines={2}>{extra.name}</Text>
                    <Text style={s.extraPrice}>{rupees(extra.price)}</Text>
                    <Text style={s.extraAddBtn}>+ ADD</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </StaggeredSection>
        )}

        {/* Stall order: how it works (+ leftover add-ons to remove) */}
        {isStallOrder && (
          <View style={[s.noticeCard, { marginTop: 20, backgroundColor: isDark ? 'rgba(249,115,22,0.10)' : 'rgba(249,115,22,0.07)', borderColor: 'rgba(249,115,22,0.3)' }]}>
            <Text style={{ fontSize: 20 }}>🏪</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.noticeTitle, { color: txt }]}>{stallName} delivers this order</Text>
              <Text style={[s.noticeSub, { color: txtSec }]}>
                {stallPayCopy(stallName)}. No Zenvy rider or delivery PIN. Coupons and add-ons don't apply to stall orders.
              </Text>
              {addOnLines.length > 0 && (
                <TouchableOpacity style={[s.smallBtn, { marginTop: 10 }]} onPress={removeAddOns}>
                  <Text style={s.smallBtnText}>REMOVE {addOnLines.length} ADD-ON{addOnLines.length === 1 ? '' : 'S'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Coupons */}
        {hasOrder && !isStallOrder && (
          <StaggeredSection delay={210} direction="up">
            <View style={{ marginTop: 20 }}>
              <Text style={[s.sectionTitle, { color: txt, marginBottom: 10 }]}>YOUR COUPONS</Text>
              {coupons.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.couponsScroll}>
                  {coupons.map(cpn => {
                    const isActive = couponCode === cpn.code;
                    return (
                      <TouchableOpacity
                        key={cpn.id || cpn.code}
                        style={[s.couponCard, isActive && s.couponCardActive, { backgroundColor: cardBg }]}
                        onPress={() => setCouponCode(isActive ? null : cpn.code)}
                      >
                        <Text style={{ fontSize: 20, marginBottom: 4 }}>{cpn.type === 'FREEDEL' ? '🚚' : '🏷️'}</Text>
                        <Text style={[s.couponCode, { color: txt }]}>{cpn.code}</Text>
                        <Text style={s.couponType}>{cpn.label || (cpn.type === 'FREEDEL' ? 'Free delivery' : 'Discount')}</Text>
                        {typeof cpn.expiresInDays === 'number' && (
                          <Text style={s.couponType}>{cpn.expiresInDays <= 0 ? 'Expires today' : `Expires in ${cpn.expiresInDays}d`}</Text>
                        )}
                        {isActive && <Text style={s.activeIndicator}>{quoteLoading ? 'APPLYING…' : 'APPLIED'}</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <TouchableOpacity style={[s.emptyCoupons, { backgroundColor: cardBg }]} onPress={() => router.push('/rewards' as any)} activeOpacity={0.85}>
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>🎡</Text>
                  <Text style={s.emptyCouponsText}>NO COUPONS YET</Text>
                  <Text style={s.emptyCouponsSub}>Spin the wheel in Rewards to win one →</Text>
                </TouchableOpacity>
              )}
            </View>
          </StaggeredSection>
        )}

        {/* Payment: Cash on Delivery or Wallet */}
        <StaggeredSection delay={290} direction="up">
          <Text style={[s.sectionTitle, { color: txt, marginTop: 24 }]}>PAYMENT METHOD</Text>
          <View style={s.payRowNew}>
            {(isStallOrder ? [
              { key: 'COD' as PayMethod, title: 'CASH ON DELIVERY', desc: stallPayCopy(stallName), icon: '💵', enabled: true },
            ] : [
              { key: 'COD' as PayMethod, title: 'CASH ON DELIVERY', desc: 'Pay the rider in cash when it arrives', icon: '💵', enabled: true },
              {
                key: 'Wallet' as PayMethod,
                title: 'ZENVY WALLET',
                desc: !hasOrder
                  ? 'Shopping lists are paid in cash on delivery'
                  : walletAllowed
                    ? `Balance ${rupees(walletBalance)}`
                    : `Balance ${rupees(walletBalance)} — not enough for this order`,
                icon: '👛',
                enabled: walletAllowed,
              },
            ]).map(item => {
              const isActive = paymentMethod === item.key;
              return (
                <DopaminePressable
                  key={item.key}
                  style={[
                    s.payCardNew,
                    { backgroundColor: cardBg, borderColor: border, opacity: item.enabled ? 1 : 0.55 },
                    isActive && { borderColor: COLORS.red, backgroundColor: isDark ? 'rgba(239,79,95,0.06)' : 'rgba(239,79,95,0.03)' }
                  ]}
                  onPress={() => { if (item.enabled) setPaymentMethod(item.key); }}
                  disabled={!item.enabled}
                  sound="click"
                  activeScale={0.97}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <Text style={{ fontSize: 22 }}>{item.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.payCardTitle, { color: isActive ? COLORS.red : txt }]}>{item.title}</Text>
                        <Text style={[s.payCardDesc, { color: txtSec }]}>{item.desc}</Text>
                      </View>
                    </View>
                    <View style={[s.radioOuter, { borderColor: isActive ? COLORS.red : border }]}>
                      {isActive && (
                        <BounceIn delay={0}>
                          <View style={[s.radioInner, { backgroundColor: COLORS.red }]} />
                        </BounceIn>
                      )}
                    </View>
                  </View>
                </DopaminePressable>
              );
            })}
          </View>
          {hasOrder && hasCustom && paymentMethod === 'Wallet' && (
            <Text style={[s.helperText, { color: txtSec }]}>Your Mega Basket shopping list is paid in cash when it arrives.</Text>
          )}
        </StaggeredSection>

        {/* Bill (from the server quote — exactly what you will be charged) */}
        <StaggeredSection delay={370} direction="up">
          <View style={[s.billCard, { backgroundColor: cardBg, borderColor: border, borderWidth: 1, marginTop: 24 }]}>
            {hasOrder && quoteLoading && !quote && (
              <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                <ActivityIndicator color={COLORS.red} />
                <Text style={[s.helperText, { color: txtSec, marginTop: 8 }]}>Calculating your bill…</Text>
              </View>
            )}

            {hasOrder && !quote && !quoteLoading && quoteError && (
              <View style={{ paddingVertical: 8 }}>
                <Text style={[s.noticeTitle, { color: txt }]}>We couldn't calculate your bill</Text>
                <Text style={[s.noticeSub, { color: txtSec, marginBottom: 10 }]}>{quoteError.message}</Text>
                {quoteError.code === 'ITEMS_UNAVAILABLE' || quoteError.code === 'BOOKING_ONLY_ITEMS' ? (
                  <TouchableOpacity style={s.smallBtn} onPress={() => { const u = unavailableFrom(quoteError.body); removeItems(u); }}>
                    <Text style={s.smallBtnText}>REMOVE UNAVAILABLE ITEMS</Text>
                  </TouchableOpacity>
                ) : quoteError.code === 'ADDONS_NOT_FOR_STALL' ? (
                  <TouchableOpacity style={s.smallBtn} onPress={removeAddOns}>
                    <Text style={s.smallBtnText}>REMOVE ADD-ONS</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={s.smallBtn} onPress={refreshQuote}>
                    <Text style={s.smallBtnText}>TRY AGAIN</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {hasOrder && quote && (
              <View style={{ opacity: quoteLoading ? 0.5 : 1 }}>
                <View style={s.billRow}>
                  <Text style={[s.billLabel, { color: txt }]}>ITEM TOTAL</Text>
                  <Text style={[s.billVal, { color: txt }]}>{rupees(quote.subtotal)}</Text>
                </View>
                <View style={s.billRow}>
                  <Text style={[s.billLabel, { color: txt }]}>DELIVERY FEE</Text>
                  <Text style={[s.billVal, { color: quote.deliveryFee === 0 ? COLORS.emerald : txt }]}>
                    {quote.deliveryFee === 0 ? 'FREE' : rupees(quote.deliveryFee)}
                  </Text>
                </View>
                {quote.packagingFee > 0 && (
                  <View style={s.billRow}>
                    <Text style={[s.billLabel, { color: txt }]}>PACKAGING</Text>
                    <Text style={[s.billVal, { color: txt }]}>{rupees(quote.packagingFee)}</Text>
                  </View>
                )}
                {quote.taxes > 0 && (
                  <View style={s.billRow}>
                    <Text style={[s.billLabel, { color: txt }]}>TAXES</Text>
                    <Text style={[s.billVal, { color: txt }]}>{rupees(quote.taxes)}</Text>
                  </View>
                )}
                {(quote.discounts || []).filter((d) => d && d.amount > 0).map((d, idx) => (
                  <View style={s.billRow} key={`${d.type}-${idx}`}>
                    <Text style={[s.billLabel, { color: COLORS.emerald, flex: 1 }]} numberOfLines={1}>{String(d.label || 'Discount').toUpperCase()}</Text>
                    <Text style={[s.billVal, { color: COLORS.emerald }]}>-{rupees(d.amount)}</Text>
                  </View>
                ))}
                <View style={[s.billRow, { borderTopWidth: 1, borderTopColor: border, paddingTop: 12, marginTop: 8 }]}>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: txt }}>{isStallOrder ? 'PAY THE STALL' : 'TO PAY'}</Text>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: COLORS.red }}>{rupees(quote.finalPrice)}</Text>
                </View>
                {isStallOrder && (
                  <Text style={[s.helperText, { color: txtSec, marginTop: 6 }]}>💵 {stallPayCopy(stallName)}.</Text>
                )}
                {quote.totalDiscount > 0 && (
                  <Text style={[s.savingsText]}>🎉 You save {rupees(quote.totalDiscount)} on this order</Text>
                )}
              </View>
            )}

            {hasCustom && (
              <View style={[hasOrder && { borderTopWidth: 1, borderTopColor: border, marginTop: 12, paddingTop: 12 }]}>
                <View style={s.billRow}>
                  <Text style={[s.billLabel, { color: txt }]}>MEGA BASKET (EST.)</Text>
                  <Text style={[s.billVal, { color: txt }]}>{rupees(customEstimate)}</Text>
                </View>
                <Text style={[s.helperText, { color: txtSec }]}>
                  A rider shops your list. You pay the actual shop bill plus shopping and delivery fees, in cash on delivery.
                </Text>
              </View>
            )}
          </View>
        </StaggeredSection>

        <FloatingPulse color={COLORS.red} style={s.placeBtnContainer}>
          <ActionPressable
            style={[s.placeBtn, { width: '100%', opacity: canPlace ? 1 : 0.5 }]}
            onPress={handlePlaceOrder}
            disabled={placing}
            sound="success"
          >
            {placing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color="#fff" />
                <Text style={[s.placeText, { fontSize: 11 }]}>PLACING ORDER…</Text>
              </View>
            ) : (
              <Text style={s.placeText}>
                {isClosed
                  ? 'CLOSED FOR THE NIGHT'
                  : hasOrder && quote
                    ? `PLACE ORDER • ${rupees(quote.finalPrice)}`
                    : `PLACE ORDER${totalItems ? ` • ${totalItems} ITEM${totalItems === 1 ? '' : 'S'}` : ''}`}
              </Text>
            )}
          </ActionPressable>
        </FloatingPulse>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 40 : 50, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  title: { fontSize: 13, fontWeight: '900', letterSpacing: 4 },
  scroll: { padding: 16 },
  sectionTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 3, marginBottom: 12 },
  campusRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  campusBtnNew: { flex: 1, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 16, alignItems: 'center', borderWidth: 1.5, position: 'relative', overflow: 'hidden' },
  campusLabelNew: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  campusSubLabelNew: { fontSize: 7, fontWeight: '600', color: COLORS.textMuted, marginTop: 2 },
  activeCheckBadge: { position: 'absolute', top: 0, right: 0, borderBottomLeftRadius: 8, width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  activeCheckText: { color: '#000', fontSize: 8, fontWeight: '900' },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 13, marginBottom: 10, fontWeight: '600' },
  blockChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5 },
  helperText: { fontSize: 10, fontWeight: '600', lineHeight: 15, marginBottom: 6 },
  payRowNew: { gap: 10, marginBottom: 12 },
  payCardNew: { padding: 14, borderRadius: 16, borderWidth: 1.5 },
  payCardTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  payCardDesc: { fontSize: 9, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },
  radioOuter: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 8, height: 8, borderRadius: 4 },
  billCard: { padding: 16, borderRadius: 20 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 },
  billLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  billVal: { fontSize: 12, fontWeight: '800' },
  savingsText: { fontSize: 10, fontWeight: '800', color: COLORS.emerald, marginTop: 8, textAlign: 'center' },
  placeBtnContainer: {
    marginTop: 24,
    marginBottom: Platform.OS === 'android' ? 80 : 40,
  },
  placeBtn: {
    backgroundColor: COLORS.red,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    ...SHADOWS.redGlow,
  },
  placeText: { fontSize: 12, fontWeight: '900', color: '#fff', letterSpacing: 3 },

  noticeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  noticeTitle: { fontSize: 12, fontWeight: '900' },
  noticeSub: { fontSize: 10, fontWeight: '600', marginTop: 2, lineHeight: 15 },
  smallBtn: { alignSelf: 'flex-start', backgroundColor: COLORS.red, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  smallBtnText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centerTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  centerSub: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  primaryBtn: { backgroundColor: COLORS.red, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16, ...SHADOWS.redGlow },
  primaryBtnText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 2 },

  // Suggested Extras
  extrasScroll: { gap: 10, paddingRight: 16 },
  extraCard: { width: 120, padding: 12, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderDark, alignItems: 'center' },
  extraName: { fontSize: 9, fontWeight: '800', marginTop: 4, width: '100%', textAlign: 'center' },
  extraPrice: { fontSize: 10, fontWeight: '900', color: COLORS.gold, marginTop: 2 },
  extraAddBtn: { fontSize: 8, fontWeight: '900', color: '#000', backgroundColor: COLORS.gold, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, marginTop: 8, overflow: 'hidden' },

  // Coupons
  couponsScroll: { gap: 10, paddingRight: 16 },
  couponCard: { width: 130, padding: 12, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderDark, alignItems: 'center', position: 'relative' },
  couponCardActive: { borderColor: COLORS.gold, borderWidth: 1.5 },
  couponCode: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  couponType: { fontSize: 8, fontWeight: '800', color: COLORS.textSecondary, marginTop: 2 },
  activeIndicator: { fontSize: 8, fontWeight: '900', color: COLORS.gold, marginTop: 6 },
  emptyCoupons: { padding: 20, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.borderDark, alignItems: 'center' },
  emptyCouponsText: { fontSize: 9, fontWeight: '900', color: COLORS.textSecondary },
  emptyCouponsSub: { fontSize: 9, color: COLORS.textSecondary, marginTop: 2 },
});
