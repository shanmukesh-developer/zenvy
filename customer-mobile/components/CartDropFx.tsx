/**
 * Add-to-cart motion (owner, 27 Nov 2026, from the "image drop" reference video). Mounted once at the app root over
 * everything (pointer events pass through except the card's button). On every add (utils/cartFx):
 *
 *  1. Pop   0-180 ms   the item's photo springs up out of the tapped button: scale 0.3 -> 1, rises 70 px, tilts -18deg.
 *  2. Drop  230-650 ms it arcs into the basket on screen - the "View basket" bar or the yellow basket button
 *                      (components/CartDropTarget; owner: "the animation should go into the View basket bar") -
 *                      sideways fast, down with gravity, turning flat and shrinking to 0.3; the bar squashes and
 *                      bounces and a ring in the accent colour ripples out of it. No basket on screen: it falls back into the button.
 *  3. Card  +380 ms    an "Added to basket" card slides down from the top (spring), photo + name + View basket;
 *                      it leaves on its own after 2.4 s, or at once when tapped.
 * The yellow basket button hops by itself when the count goes up (components/FloatingBasket).
 * Reduce motion: no flight, the card just fades in. Rapid adds: the card updates in place (the newest item).
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { findDropTarget, onCartAdded, type CartAddedEvent } from '../utils/cartFx';
import { useDietLight } from './local/dietLightTheme';

// Owner, 27 Nov 2026: no yellow / navy - the app's Veg / Non-veg accent (useDietLight) for the ripple and button.
const INK = '#111827';
const PHOTO = 54;

function Flight({ ev, onDone, acc, soft }: { ev: CartAddedEvent & { x: number; y: number }; onDone: () => void; acc: string; soft: string }) {
  const pop = useRef(new Animated.Value(0)).current;    // 0 -> 1 rise out of the tapped button
  const dropX = useRef(new Animated.Value(0)).current;  // 0 -> 1 sideways (fast first: the path curves)
  const dropY = useRef(new Animated.Value(0)).current;  // 0 -> 1 down (gravity: slow first)
  const ring = useRef(new Animated.Value(0)).current;   // landing ripple
  // Where it lands, relative to the tap: the basket bar / button on screen (utils/cartFx), else back into the button.
  const [to, setTo] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  useEffect(() => {
    let alive = true;
    Animated.timing(pop, { toValue: 1, duration: 180, easing: Easing.out(Easing.back(1.8)), useNativeDriver: false }).start();
    (async () => {
      const target = await findDropTarget().catch(() => null);
      await new Promise((r) => setTimeout(r, 230)); // the pop, plus a beat at the top
      if (!alive) return;
      const dx = target ? target.x - ev.x : 0;
      const dy = target ? target.y - ev.y : 0;
      setTo({ dx, dy });
      const far = Math.hypot(dx, dy) > 60;
      const dur = far ? 420 : 300;
      Animated.parallel([
        Animated.timing(dropX, { toValue: 1, duration: dur, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(dropY, { toValue: 1, duration: dur, easing: Easing.in(Easing.quad), useNativeDriver: false }),
        Animated.sequence([
          Animated.delay(dur - 70),
          Animated.timing(ring, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        ]),
      ]).start(() => { if (alive) onDone(); });
      setTimeout(() => { if (alive && target) target.land(); }, dur - 40);
    })();
    return () => { alive = false; };
  }, [pop, dropX, dropY, ring, onDone, ev.x, ev.y]);

  const translateX = dropX.interpolate({ inputRange: [0, 1], outputRange: [0, to.dx] });
  const translateY = Animated.add(
    pop.interpolate({ inputRange: [0, 1], outputRange: [0, -70] }),
    dropY.interpolate({ inputRange: [0, 1], outputRange: [0, to.dy + 70] }),
  );
  const scale = Animated.multiply(
    pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    dropY.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.75, 0.3] }),
  );
  const rotate = Animated.add(
    pop.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }),
    dropY.interpolate({ inputRange: [0, 1], outputRange: [0, 30] }),
  ).interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });
  const opacity = dropY.interpolate({ inputRange: [0, 0.88, 1], outputRange: [1, 1, 0] });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[st.ring, { borderColor: acc, left: ev.x + to.dx - 28, top: ev.y + to.dy - 28, opacity: ring.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.6, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.9] }) }] }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[st.photoWrap, { left: ev.x - PHOTO / 2, top: ev.y - PHOTO / 2, opacity, transform: [{ translateX }, { translateY }, { scale }, { rotate }] }]}
      >
        {ev.image ? <Image source={{ uri: ev.image }} style={st.photo} /> : <View style={[st.photo, st.photoBlank]}><Ionicons name="bag-handle" size={24} color={INK} /></View>}
      </Animated.View>
    </>
  );
}

export default function CartDropFx() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const d = useDietLight();
  const [flights, setFlights] = useState<(CartAddedEvent & { x: number; y: number; key: number })[]>([]);
  const [card, setCard] = useState<CartAddedEvent | null>(null);
  const cardY = useRef(new Animated.Value(0)).current;
  const reduce = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastFlight = useRef(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((r) => { reduce.current = !!r; }).catch(() => {});
  }, []);

  const hideCard = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    Animated.timing(cardY, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(({ finished }) => { if (finished) setCard(null); });
  };

  useEffect(() => onCartAdded((ev) => {
    // The flight only for a real tap, and at most one every 350 ms (a reorder adds many lines at once).
    const fly = ev.x != null && ev.y != null && !reduce.current && ev.at - lastFlight.current > 350;
    if (fly) {
      lastFlight.current = ev.at;
      setFlights((f) => [...f.slice(-2), { ...ev, x: ev.x as number, y: ev.y as number, key: ev.at }]);
    }
    if (showTimer.current) clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => {
      setCard(ev);
      if (reduce.current) cardY.setValue(1);
      else Animated.spring(cardY, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }).start();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(hideCard, 2400);
    }, fly ? 380 : 0);
  }), [cardY]);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); if (showTimer.current) clearTimeout(showTimer.current); }, []);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {flights.map((f) => (
        <Flight key={f.key} ev={f} acc={d.acc} soft={d.soft} onDone={() => setFlights((all) => all.filter((x) => x.key !== f.key))} />
      ))}
      {card && (
        <Animated.View
          pointerEvents="box-none"
          style={[st.cardWrap, { top: insets.top + 10, opacity: cardY, transform: [{ translateY: cardY.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) }, { scale: cardY.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}
        >
          <View style={st.card} accessibilityLiveRegion="polite">
            {card.image ? <Image source={{ uri: card.image }} style={st.cardPhoto} /> : <View style={[st.cardPhoto, st.photoBlank]}><Ionicons name="bag-handle" size={18} color={INK} /></View>}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={st.cardTitle} numberOfLines={1}>Added to basket</Text>
              <Text style={st.cardName} numberOfLines={1}>{card.name}</Text>
            </View>
            <Pressable onPress={() => { hideCard(); router.push('/(tabs)/basket' as any); }} style={[st.cardBtn, { backgroundColor: d.acc }]} accessibilityRole="button" accessibilityLabel="View basket" hitSlop={6}>
              <Text style={st.cardBtnTxt}>View</Text>
              <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  photoWrap: { position: 'absolute', width: PHOTO, height: PHOTO, borderRadius: 14, backgroundColor: '#FFFFFF', padding: 3, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 10, zIndex: 100000 },
  photo: { width: '100%', height: '100%', borderRadius: 11 },
  photoBlank: { backgroundColor: '#F2F3F6', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 3, zIndex: 99999 },
  cardWrap: { position: 'absolute', left: 14, right: 14, alignItems: 'center', zIndex: 100001 },
  card: { width: '100%', maxWidth: 420, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 9, paddingLeft: 9, paddingRight: 10, borderWidth: 1, borderColor: '#E6E8EC', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  cardPhoto: { width: 40, height: 40, borderRadius: 10 },
  cardTitle: { color: INK, fontSize: 13.5, fontWeight: '900' },
  cardName: { color: '#4B5160', fontSize: 12.5, marginTop: 1 },
  cardBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 34, paddingHorizontal: 12, borderRadius: 17 },
  cardBtnTxt: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
