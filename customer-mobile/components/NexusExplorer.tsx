import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SHADOWS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { useDietary } from '../context/DietaryContext';
import DopaminePressable, { CardPressable, ActionPressable } from './DopaminePressable';
import SafeImage from './SafeImage';

const { width: SW } = Dimensions.get('window');

interface NexusExplorerProps {
  restaurants: any[];
  activeCategory: string;
  onSelectItem: (restaurantId: string) => void;
}

export default function NexusExplorer({ restaurants, activeCategory, onSelectItem }: NexusExplorerProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const { addToCart } = useCart();
  const { dietMode, isItemAllowed } = useDietary();
  const [activeFilter, setActiveFilter] = useState<'all' | 'veg'>('all');
  const [activeSort, setActiveSort] = useState<'recommended' | 'rating' | 'fastest'>('recommended');
  const [sortValue, setSortValue] = useState<'default' | 'low' | 'high'>('default');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  // Sync local filter with global dietary mode
  useEffect(() => {
    if (dietMode === 'veg' || dietMode === 'eggarian') {
      setActiveFilter('veg');
    } else {
      setActiveFilter('all');
    }
  }, [dietMode]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const CURATED_CATEGORY_ITEMS: Record<string, any[]> = {
    biryani: [
      { id: 'cur-bir-1', name: 'Dum Mutton Biryani', price: 340, isVegetarian: false, category: 'Biryani', restaurantName: 'Royal Biryani Handi', restaurantId: 'royal-biryani', rating: 4.8, image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&q=80' },
      { id: 'cur-bir-2', name: 'Kolkata Chicken Biryani', price: 280, isVegetarian: false, category: 'Biryani', restaurantName: 'Royal Biryani Handi', restaurantId: 'royal-biryani', rating: 4.7, image: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=600&q=80' },
      { id: 'cur-bir-3', name: 'Paneer Dum Biryani', price: 240, isVegetarian: true, category: 'Biryani', restaurantName: 'Royal Biryani Handi', restaurantId: 'royal-biryani', rating: 4.6, image: 'https://images.unsplash.com/photo-1642821373181-696a54913e93?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1642821373181-696a54913e93?w=600&q=80' },
      { id: 'cur-bir-4', name: 'Special Hyderabadi Dum Biryani', price: 320, isVegetarian: false, category: 'Biryani', restaurantName: 'Royal Biryani Handi', restaurantId: 'royal-biryani', rating: 4.9, image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&q=80' },
    ],
    pizza: [
      { id: 'cur-piz-1', name: 'Italian Buffalo Margherita', price: 320, isVegetarian: true, category: 'Pizza', restaurantName: 'Artisanal Pizza Lab', restaurantId: 'pizza-lab', rating: 4.7, image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600&q=80' },
      { id: 'cur-piz-2', name: 'Truffle Mushroom Pizza', price: 450, isVegetarian: true, category: 'Pizza', restaurantName: 'Artisanal Pizza Lab', restaurantId: 'pizza-lab', rating: 4.8, image: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=600&q=80' },
      { id: 'cur-piz-3', name: 'Spicy Chicken Pepperoni', price: 420, isVegetarian: false, category: 'Pizza', restaurantName: 'Artisanal Pizza Lab', restaurantId: 'pizza-lab', rating: 4.9, image: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&q=80' },
      { id: 'cur-piz-4', name: 'Farmhouse Garden Veggie', price: 360, isVegetarian: true, category: 'Pizza', restaurantName: 'Artisanal Pizza Lab', restaurantId: 'pizza-lab', rating: 4.6, image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80' },
    ],
    burgers: [
      { id: 'cur-brg-1', name: 'Double Angus Jalapeño Burger', price: 380, isVegetarian: false, category: 'Burgers', restaurantName: 'Burger Bunker', restaurantId: 'burger-bunker', rating: 4.9, image: 'https://images.unsplash.com/photo-1550317138-10000687ad32?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1550317138-10000687ad32?w=600&q=80' },
      { id: 'cur-brg-2', name: 'Classic Cheese Melt Burger', price: 290, isVegetarian: true, category: 'Burgers', restaurantName: 'Burger Bunker', restaurantId: 'burger-bunker', rating: 4.6, image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=600&q=80' },
      { id: 'cur-brg-3', name: 'Crispy Fried Chicken Zinger', price: 260, isVegetarian: false, category: 'Burgers', restaurantName: 'Burger Bunker', restaurantId: 'burger-bunker', rating: 4.8, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80' },
      { id: 'cur-brg-4', name: 'Smoky BBQ Paneer Burger', price: 280, isVegetarian: true, category: 'Burgers', restaurantName: 'Burger Bunker', restaurantId: 'burger-bunker', rating: 4.7, image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&q=80' },
    ],
    'south indian': [
      { id: 'cur-si-1', name: 'Ghee Roast Masala Dosa', price: 120, isVegetarian: true, category: 'South Indian', restaurantName: 'South Indian Soul', restaurantId: 'south-soul', rating: 4.8, image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&q=80' },
      { id: 'cur-si-2', name: 'Steamed Button Ghee Idli (4 Pcs)', price: 90, isVegetarian: true, category: 'South Indian', restaurantName: 'South Indian Soul', restaurantId: 'south-soul', rating: 4.7, image: 'https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?w=600&q=80' },
      { id: 'cur-si-3', name: 'Crispy Medu Vada Sambar', price: 80, isVegetarian: true, category: 'South Indian', restaurantName: 'South Indian Soul', restaurantId: 'south-soul', rating: 4.6, image: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=600&q=80' },
      { id: 'cur-si-4', name: 'Butter Onion Rava Dosa', price: 140, isVegetarian: true, category: 'South Indian', restaurantName: 'South Indian Soul', restaurantId: 'south-soul', rating: 4.9, image: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=600&q=80' },
    ],
    drinks: [
      { id: 'cur-drk-1', name: 'Dragon Fruit Mint Cooler', price: 180, isVegetarian: true, category: 'Drinks', restaurantName: 'Zenvy Juice Booth', restaurantId: 'juice-booth', rating: 4.7, image: 'https://images.unsplash.com/photo-1525385133512-2f3bdd039054?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1525385133512-2f3bdd039054?w=600&q=80' },
      { id: 'cur-drk-2', name: 'Cold Brew Signature Frappe', price: 220, isVegetarian: true, category: 'Drinks', restaurantName: 'Zenvy Juice Booth', restaurantId: 'juice-booth', rating: 4.8, image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&q=80' },
      { id: 'cur-drk-3', name: 'Fresh Mint Lemon Mojito', price: 140, isVegetarian: true, category: 'Drinks', restaurantName: 'Zenvy Juice Booth', restaurantId: 'juice-booth', rating: 4.6, image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&q=80' },
      { id: 'cur-drk-4', name: 'Belgian Dark Chocolate Shake', price: 190, isVegetarian: true, category: 'Drinks', restaurantName: 'Zenvy Juice Booth', restaurantId: 'juice-booth', rating: 4.9, image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&q=80' },
    ],
    chinese: [
      { id: 'cur-chn-1', name: 'Hakka Noodles (Special Wok)', price: 220, isVegetarian: true, category: 'Chinese', restaurantName: 'Mandarin Magic', restaurantId: 'mandarin-magic', rating: 4.8, image: 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=600&q=80' },
      { id: 'cur-chn-2', name: 'Chili Garlic Crispy Chicken', price: 280, isVegetarian: false, category: 'Chinese', restaurantName: 'Mandarin Magic', restaurantId: 'mandarin-magic', rating: 4.9, image: 'https://images.unsplash.com/photo-1623341214825-9f4f963727da?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1623341214825-9f4f963727da?w=600&q=80' },
      { id: 'cur-chn-3', name: 'Schezwan Veggie Fried Rice', price: 200, isVegetarian: true, category: 'Chinese', restaurantName: 'Mandarin Magic', restaurantId: 'mandarin-magic', rating: 4.7, image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&q=80' },
      { id: 'cur-chn-4', name: 'Steamed Classic Veg Momos', price: 150, isVegetarian: true, category: 'Chinese', restaurantName: 'Mandarin Magic', restaurantId: 'mandarin-magic', rating: 4.6, image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&q=80', imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&q=80' },
    ],
  };

  const filteredItems = useMemo(() => {
    const catKey = (activeCategory || 'biryani').toLowerCase();
    
    // Collect matching items from restaurants
    const collectedFromRestaurants = restaurants.flatMap(res => 
      (res.menu || []).map((item: any) => {
        const isVeg = item.isVegetarian === true || 
                      String(item.isVegetarian).toLowerCase() === 'true' || 
                      Number(item.isVegetarian) === 1 || 
                      (item.tags || []).includes('veg') || 
                      (item.tags || []).includes('fruits');

        return {
          ...item,
          isVegetarian: isVeg,
          restaurantName: res.name,
          restaurantId: res._id || res.id,
          rating: Number(res.rating) || 4.2,
        };
      })
    ).filter(item => {
      const itemCat = (item.category || '').toLowerCase();
      const itemName = (item.name || '').toLowerCase();
      const itemTags = (item.tags || []).map((t: string) => t.toLowerCase());

      // Strict category matching
      if (catKey === 'biryani') return itemCat.includes('biryani') || itemName.includes('biryani') || itemTags.includes('biryani');
      if (catKey === 'pizza') return itemCat.includes('pizza') || itemName.includes('pizza') || itemTags.includes('pizza');
      if (catKey === 'burgers') return itemCat.includes('burger') || itemName.includes('burger') || itemTags.includes('burgers');
      if (catKey === 'south indian') return itemCat.includes('south') || itemName.includes('dosa') || itemName.includes('idli') || itemName.includes('vada') || itemTags.includes('south-indian');
      if (catKey === 'drinks') return itemCat.includes('drink') || itemCat.includes('juice') || itemName.includes('cooler') || itemName.includes('brew') || itemName.includes('mojito') || itemName.includes('shake');
      if (catKey === 'chinese') return itemCat.includes('chinese') || itemName.includes('noodles') || itemName.includes('rice') || itemName.includes('momos') || itemName.includes('manchurian');

      return itemCat.includes(catKey) || itemName.includes(catKey);
    });

    // Use collected items or fallback to curated list for this category
    const itemsSource = collectedFromRestaurants.length > 0 
      ? collectedFromRestaurants 
      : (CURATED_CATEGORY_ITEMS[catKey] || CURATED_CATEGORY_ITEMS.biryani);

    return itemsSource.filter(item => {
      const matchesFilter = activeFilter === 'all' || (activeFilter === 'veg' && item.isVegetarian);
      const matchesDiet = isItemAllowed(item);
      return matchesFilter && matchesDiet;
    }).sort((a, b) => {
      if (sortValue === 'low') return (Number(a.price) || 0) - (Number(b.price) || 0);
      if (sortValue === 'high') return (Number(b.price) || 0) - (Number(a.price) || 0);
      
      if (activeSort === 'rating') {
        return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      }
      return 0;
    });
  }, [restaurants, activeCategory, activeFilter, activeSort, sortValue, isItemAllowed]);

  const cardBg = isDark ? '#18181B' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const txt = isDark ? '#FFFFFF' : '#111827';
  const txtSec = isDark ? '#A1A1AA' : '#6B7280';

  // Signature Black & Pink (Coral) Color Tokens
  const PINK_ACTIVE = '#EF4F5F'; // Signature vibrant coral-pink
  const BLACK_PILL = '#18181B';  // Signature obsidian black

  return (
    <View style={s.container}>
      {/* HUD Controller */}
      <View style={s.hud}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hudScroll}>
          {/* ALL Filter */}
          <DopaminePressable 
            style={[
              s.hudBtn,
              {
                backgroundColor: activeFilter === 'all' ? PINK_ACTIVE : BLACK_PILL,
                borderColor: activeFilter === 'all' ? '#F43F5E' : 'transparent',
              }
            ]} 
            onPress={() => setActiveFilter('all')}
            sound="tabSwitch"
            activeScale={0.93}
          >
            <Text style={{ fontSize: 11 }}>✨</Text>
            <Text style={[s.hudLabel, { color: '#FFFFFF' }]}>
              ALL
            </Text>
          </DopaminePressable>

          {/* Pure Veg Filter */}
          <DopaminePressable 
            style={[
              s.hudBtn,
              {
                backgroundColor: activeFilter === 'veg' ? '#10B981' : BLACK_PILL,
                borderColor: activeFilter === 'veg' ? '#059669' : 'transparent',
              }
            ]} 
            onPress={() => setActiveFilter('veg')}
            sound="tabSwitch"
            activeScale={0.93}
          >
            <Text style={{ fontSize: 11 }}>🥗</Text>
            <Text style={[s.hudLabel, { color: '#FFFFFF' }]}>
              PURE VEG
            </Text>
          </DopaminePressable>

          <View style={[s.divider, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />

          {/* Sort: REC / TOP / FAST */}
          <DopaminePressable 
            style={[
              s.hudBtn,
              {
                backgroundColor: activeSort === 'recommended' ? PINK_ACTIVE : BLACK_PILL,
                borderColor: activeSort === 'recommended' ? '#F43F5E' : 'transparent',
              }
            ]} 
            onPress={() => setActiveSort('recommended')}
            sound="tabSwitch"
            activeScale={0.93}
          >
            <Text style={[s.hudLabel, { color: '#FFFFFF' }]}>
              REC
            </Text>
          </DopaminePressable>

          <DopaminePressable 
            style={[
              s.hudBtn,
              {
                backgroundColor: activeSort === 'rating' ? PINK_ACTIVE : BLACK_PILL,
                borderColor: activeSort === 'rating' ? '#F43F5E' : 'transparent',
              }
            ]} 
            onPress={() => setActiveSort('rating')}
            sound="tabSwitch"
            activeScale={0.93}
          >
            <Text style={[s.hudLabel, { color: '#FFFFFF' }]}>
              TOP
            </Text>
          </DopaminePressable>

          <DopaminePressable 
            style={[
              s.hudBtn,
              {
                backgroundColor: activeSort === 'fastest' ? PINK_ACTIVE : BLACK_PILL,
                borderColor: activeSort === 'fastest' ? '#F43F5E' : 'transparent',
              }
            ]} 
            onPress={() => setActiveSort('fastest')}
            sound="tabSwitch"
            activeScale={0.93}
          >
            <Text style={[s.hudLabel, { color: '#FFFFFF' }]}>
              FAST
            </Text>
          </DopaminePressable>

          <View style={[s.divider, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />

          {/* Price Filters */}
          <DopaminePressable 
            style={[
              s.hudBtn,
              {
                backgroundColor: sortValue === 'low' ? PINK_ACTIVE : BLACK_PILL,
                borderColor: sortValue === 'low' ? '#F43F5E' : 'transparent',
              }
            ]} 
            onPress={() => setSortValue(sortValue === 'low' ? 'default' : 'low')}
            sound="tabSwitch"
            activeScale={0.93}
          >
            <Text style={[s.hudLabel, { color: '#FFFFFF' }]}>
              PRICE: LOW
            </Text>
          </DopaminePressable>

          <DopaminePressable 
            style={[
              s.hudBtn,
              {
                backgroundColor: sortValue === 'high' ? PINK_ACTIVE : BLACK_PILL,
                borderColor: sortValue === 'high' ? '#F43F5E' : 'transparent',
              }
            ]} 
            onPress={() => setSortValue(sortValue === 'high' ? 'default' : 'high')}
            sound="tabSwitch"
            activeScale={0.93}
          >
            <Text style={[s.hudLabel, { color: '#FFFFFF' }]}>
              PRICE: HIGH
            </Text>
          </DopaminePressable>
        </ScrollView>
      </View>

      {/* Grid */}
      {filteredItems.length === 0 ? (
        <View style={s.empty}>
          <Text style={[s.emptyText, { color: txtSec }]}>No items found in this category.</Text>
        </View>
      ) : (
        <>
          <View style={s.grid}>
            {(showAll ? filteredItems : filteredItems.slice(0, 6)).map((item, idx) => {
              const itemId = item._id || item.id || idx.toString();
              const isFav = favorites.includes(itemId);
              const img = item.image || item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300';
              return (
                <CardPressable 
                  key={itemId} 
                  style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
                  onPress={() => router.push(`/products/${itemId}` as any)}
                  sound="click"
                >
                  <View style={s.imgContainer} pointerEvents="box-none">
                    <SafeImage source={{ uri: img }} style={s.img} />
                    <DopaminePressable 
                      style={s.heartBtn} 
                      onPress={() => toggleFavorite(itemId)}
                      sound="click"
                      activeScale={0.8}
                    >
                      <Text style={{ fontSize: 12 }}>{isFav ? '❤️' : '🤍'}</Text>
                    </DopaminePressable>

                    <View style={s.vegIndicator}>
                      <View style={[s.vegOuter, { borderColor: item.isVegetarian ? '#22C55E' : '#EF4444' }]}>
                        <View style={[s.vegInner, { backgroundColor: item.isVegetarian ? '#22C55E' : '#EF4444' }]} />
                      </View>
                    </View>
                  </View>

                  <View style={s.info}>
                    <View style={s.titleRow}>
                      <Text style={[s.name, { color: txt }]} numberOfLines={1}>{item.name}</Text>
                      <Text style={s.price}>₹{item.price}</Text>
                    </View>
                    <Text style={[s.restaurantName, { color: txtSec }]} numberOfLines={1}>{item.restaurantName}</Text>
                    
                    <ActionPressable 
                      style={[s.addBtn, { backgroundColor: '#C8A265' }]}
                      onPress={() => router.push(`/products/${itemId}` as any)}
                      sound="click"
                    >
                      <Text style={[s.addBtnText, { color: '#000000', fontWeight: '900' }]}>ADD +</Text>
                    </ActionPressable>
                  </View>
                </CardPressable>
              );
            })}
          </View>

          {filteredItems.length > 6 && (
            <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
              <TouchableOpacity
                style={{
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => setShowAll(!showAll)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#F59E0B' : '#B45309', letterSpacing: 1 }}>
                  {showAll ? 'COLLAPSE CATEGORY ▲' : `VIEW ALL ${filteredItems.length} DISHES ▼`}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingBottom: 16 },
  hud: { marginBottom: 16 },
  hudScroll: { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  hudBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 0, 
    paddingHorizontal: 14, 
    paddingVertical: 8, 
    borderRadius: 22,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  hudLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  divider: { width: 1, height: 16, marginHorizontal: 4 },
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    paddingHorizontal: 16, 
    justifyContent: 'space-between',
  },
  card: { 
    width: '48.5%', 
    borderRadius: 18, 
    overflow: 'hidden', 
    borderWidth: 1, 
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  imgContainer: { 
    width: '100%', 
    height: 120, 
    backgroundColor: '#F3F4F6', 
    position: 'relative' 
  },
  img: { width: '100%', height: '100%', resizeMode: 'cover' },
  heartBtn: { 
    position: 'absolute', 
    top: 8, 
    right: 8, 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    backgroundColor: 'rgba(255,255,255,0.9)', 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  vegIndicator: { position: 'absolute', bottom: 8, left: 8 },
  vegOuter: { width: 14, height: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 3 },
  vegInner: { width: 6, height: 6, borderRadius: 3 },
  info: { padding: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  name: { fontSize: 12, fontWeight: '800', flex: 1, marginRight: 4 },
  price: { fontSize: 13, fontWeight: '900', color: COLORS.red },
  restaurantName: { fontSize: 9.5, fontWeight: '600', marginBottom: 8 },
  addBtn: { 
    paddingVertical: 7, 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  addBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 12, fontWeight: '600' },
});
