/**
 * Groceries tab: the Snacks, Fruits & pickles and Bakeries sections (owner, 26 Nov 2026). Each lists the SHOPS the
 * admins put in that section (store editor "Groceries tab section"; backend utils/shopSections,
 * GET /api/catalogue/stores?section=snacks|fruits_pickles|bakeries) as store cards in the shops-list style
 * (FoodV2Shops); a tap opens the shop's own page with its products (app/restaurant/[id]). Opened from the Groceries
 * landing's "Shop by category" tiles (route 'section' in FoodV2Screen); the back arrow / Android back returns there.
 * A section with no shops yet shows an empty state.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CachedImage as Image } from '../../components/SafeImage';
import { PressScale } from '../../modules/others/motion';
import { useSWRJson } from '../../utils/swrCache';
import { BUTTON_ROLE } from '../../utils/pressRole';
import { FOOD } from './foodV2Theme';
import { FALLBACK_IMG, etaText, fmtShortClock, type ShopSectionKey } from './FoodV2Data';
import { useFoodScale } from './FoodV2Scale';
import { useFoodV2 } from './useFoodV2';
import { useFoodV2Ui } from './FoodV2Ui';
import { Icon } from './FoodV2Icons';
import { s } from './FoodV2Styles';

export type { ShopSectionKey };
export const SHOP_SECTION_COPY: Record<ShopSectionKey, { title: string; noun: string; hints: string[] }> = {
  snacks: { title: 'Snacks', noun: 'snack shops', hints: ['Find a snack shop', 'Chips, namkeen and more'] },
  fruits_pickles: { title: 'Fruits & pickles', noun: 'fruit and pickle shops', hints: ['Find a fruit or pickle shop', 'Fresh fruits, home pickles'] },
  bakeries: { title: 'Bakeries', noun: 'bakeries', hints: ['Find a bakery', 'Cakes, breads and puffs'] },
};

type Shop = {
  id: string; name: string; imageUrl: string | null; logoUrl: string | null; rating: number | null; description: string | null;
  isOpen: boolean; opensAt: string | null; takesSlotOrders: boolean; nextSlotLabel: string | null; deliveryTime: string | null; itemCount: number;
};
const toShops = (raw: any): Shop[] => (Array.isArray(raw) ? raw : [])
  .filter((x: any) => x && (x.id || x._id) && typeof x.name === 'string')
  .map((x: any) => ({
    id: String(x.id || x._id), name: x.name, imageUrl: x.imageUrl || null, logoUrl: x.logoUrl || null,
    rating: Number(x.rating) > 0 ? Number(x.rating) : null, description: typeof x.description === 'string' ? x.description : null,
    isOpen: x.isOpen !== false, opensAt: typeof x.opensAt === 'string' ? x.opensAt : null,
    takesSlotOrders: !!x.takesSlotOrders, nextSlotLabel: typeof x.nextSlotLabel === 'string' ? x.nextSlotLabel : null,
    deliveryTime: etaText(x.deliveryTime), itemCount: Number(x.itemCount) || 0,
  }))
  // Open (or taking orders for the next slot) first, then by name.
  .sort((a, b) => Number(b.isOpen || b.takesSlotOrders) - Number(a.isOpen || a.takesSlotOrders) || a.name.localeCompare(b.name));

function FoodV2SectionShops({ section }: { section: ShopSectionKey }) {
  const { router, isDark, c, topPad, pop, shopCount, groceryOn, bakeryOn } = useFoodV2();
  const { headerBtn, basketBar } = useFoodV2Ui();
  const sc = useFoodScale();
  const copy = SHOP_SECTION_COPY[section];
  const paused = section === 'bakeries' ? !bakeryOn : !groceryOn;
  const swr = useSWRJson<any[]>(`/api/catalogue/stores?section=${section}`, { freshMs: 30_000 });
  const shops = useMemo(() => toShops(swr.data), [swr.data]);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = needle ? shops.filter(x => x.name.toLowerCase().includes(needle) || (x.description || '').toLowerCase().includes(needle)) : shops;
  const loading = swr.loading && !swr.data;
  const failed = !swr.data && !!swr.error && !swr.loading;

  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      {/* Back to the Groceries landing (the arrow here; Android back pops the same stack). */}
      <LinearGradient colors={FOOD.headerDeep} style={{ paddingTop: topPad }}>
        <View style={st.bar}>
          <PressScale onPress={pop} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole={BUTTON_ROLE} accessibilityLabel="Back" style={s.backBtn}>
            <Icon name="arrow-back" size={22} color="#FFFFFF" />
          </PressScale>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.barTitle} numberOfLines={1} accessibilityRole="header">{copy.title}</Text>
            <Text style={st.barSub} numberOfLines={1}>{loading ? `Finding ${copy.noun}…` : `${shops.length} ${shops.length === 1 ? copy.noun.replace(/ies$/, 'y').replace(/s$/, '') : copy.noun}`}</Text>
          </View>
          {headerBtn('search', `Search ${copy.noun}`, () => setSearching(v => !v))}
          {headerBtn('cart-outline', 'Basket', () => router.push('/(tabs)/basket?basket=store' as any), shopCount)}
        </View>
      </LinearGradient>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: shopCount > 0 ? sc.barSpace : 40 + sc.insets.bottom }} keyboardShouldPersistTaps="handled">
        <View style={{ padding: 16, gap: 14 }}>
          {searching && (
            <View style={[st.searchRow, { backgroundColor: c.field }]}>
              <Icon name="search" size={18} color={c.slate} />
              <TextInput
                autoFocus
                value={q}
                onChangeText={setQ}
                placeholder={`Search ${copy.noun}`}
                placeholderTextColor={c.slate}
                style={[st.searchInput, { color: c.title }]}
                accessibilityLabel={`Search ${copy.noun}`}
              />
              <PressScale onPress={() => { setQ(''); setSearching(false); }} accessibilityRole={BUTTON_ROLE} accessibilityLabel="Close search" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="close" size={18} color={c.slate} />
              </PressScale>
            </View>
          )}
          {paused ? (
            <View style={[s.emptyCard, { backgroundColor: c.soft }]}>
              <Icon name="time-outline" size={34} color={FOOD.primary} />
              <Text style={[s.emptyTitle, { color: c.title }]}>{copy.title} is paused</Text>
              <Text style={[s.emptyText, { color: c.slate }]}>Delivery from these shops is paused right now. Please check back soon.</Text>
            </View>
          ) : loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}><ActivityIndicator color={FOOD.primary} /></View>
          ) : failed ? (
            <View style={[s.emptyCard, { backgroundColor: c.soft }]}>
              <Icon name="cloud-offline-outline" size={34} color={FOOD.primary} />
              <Text style={[s.emptyTitle, { color: c.title }]}>Could not load the shops</Text>
              <Text style={[s.emptyText, { color: c.slate }]}>Check your connection and try again.</Text>
              <PressScale onPress={() => swr.refresh({ silent: false })} accessibilityRole={BUTTON_ROLE} style={[st.retry, { borderColor: FOOD.primary }]}>
                <Text style={{ color: FOOD.primary, fontWeight: '600' }}>Try again</Text>
              </PressScale>
            </View>
          ) : shown.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: c.soft }]}>
              <Icon name="storefront-outline" size={34} color={FOOD.primary} />
              <Text style={[s.emptyTitle, { color: c.title }]}>{needle ? 'No shops match' : 'No shops here yet'}</Text>
              <Text style={[s.emptyText, { color: c.slate }]}>{needle ? 'Try another name.' : `${copy.title} shops are being added. Please check back soon.`}</Text>
            </View>
          ) : shown.map((shop) => {
            const open = shop.isOpen || shop.takesSlotOrders;
            const opens = fmtShortClock(shop.opensAt);
            const status = shop.isOpen ? 'Open now' : shop.takesSlotOrders ? (shop.nextSlotLabel ? `Next delivery ${shop.nextSlotLabel}` : 'Taking orders for the next slot') : (opens ? `Opens ${opens}` : 'Closed now');
            return (
              <PressScale
                key={shop.id}
                onPress={() => router.push(`/restaurant/${shop.id}` as any)}
                scaleTo={0.98}
                accessibilityRole={BUTTON_ROLE}
                accessibilityLabel={`${shop.name}, ${status}. Open the shop`}
                style={[st.card, { backgroundColor: c.card, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }]}
              >
                <View>
                  {shop.imageUrl || !shop.logoUrl ? (
                    <Image source={{ uri: shop.imageUrl || FALLBACK_IMG }} style={[st.cover, !open && { opacity: 0.55 }]} />
                  ) : (
                    <View style={[st.cover, st.logoBand, { backgroundColor: isDark ? 'rgba(76,193,122,0.10)' : '#EEF7F1' }, !open && { opacity: 0.55 }]}>
                      <Image source={{ uri: shop.logoUrl }} style={st.bandLogo} />
                    </View>
                  )}
                  {!!shop.logoUrl && !!shop.imageUrl && (
                    <View style={[st.logoWrap, { backgroundColor: c.card }]}>
                      <Image source={{ uri: shop.logoUrl }} style={st.logo} />
                    </View>
                  )}
                  {!open && <View style={st.closedPill}><Text style={st.closedText}>{status}</Text></View>}
                </View>
                <View style={[st.body, { paddingTop: shop.logoUrl && shop.imageUrl ? 28 : 14 }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[st.name, { color: c.title }]} numberOfLines={1}>{shop.name}</Text>
                    <Text style={[st.meta, { color: c.slate }]} numberOfLines={1}>
                      {[shop.description, shop.itemCount ? `${shop.itemCount} item${shop.itemCount === 1 ? '' : 's'}` : null, shop.deliveryTime].filter(Boolean).join(' · ') || 'Tap to see the menu'}
                    </Text>
                    {open && <Text style={[st.meta, { color: FOOD.primary, fontWeight: '600' }]} numberOfLines={1}>{status}</Text>}
                  </View>
                  {!!shop.rating && (
                    <View style={st.rating}>
                      <Icon name="star" size={12} color="#FFFFFF" />
                      <Text style={st.ratingText}>{shop.rating.toFixed(1)}</Text>
                    </View>
                  )}
                  <Icon name="chevron-forward" size={18} color={c.slate} />
                </View>
              </PressScale>
            );
          })}
        </View>
      </ScrollView>
      {shopCount > 0 && basketBar()}
    </View>
  );
}
export default React.memo(FoodV2SectionShops);

const st = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 14 },
  barTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '700' },
  barSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12.5, marginTop: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, height: 46 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  retry: { marginTop: 14, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 9 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  cover: { width: '100%', height: 132 },
  logoWrap: { position: 'absolute', left: 14, bottom: -22, width: 52, height: 52, borderRadius: 14, padding: 3, elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  logo: { width: '100%', height: '100%', borderRadius: 11 },
  logoBand: { alignItems: 'center', justifyContent: 'center' },
  bandLogo: { width: 96, height: 96, borderRadius: 22 },
  closedPill: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(15,23,42,0.82)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  closedText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  body: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 28, paddingBottom: 14 },
  name: { fontSize: 16.5, fontWeight: '700' },
  meta: { fontSize: 12.5, marginTop: 2 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#1F9D55', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  ratingText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
