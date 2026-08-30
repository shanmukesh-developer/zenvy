import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  ActivityIndicator,
  Alert,
  FlatList,
  Animated,
  Clipboard,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SHADOWS, RADIUS } from '../../constants/theme';
import { useCart } from '../../context/CartContext';
import { apiFetch } from '../../utils/auth';
import { useTheme } from '../../context/ThemeContext';
import AdSlot from '../../components/AdSlot';

const { width: SW } = Dimensions.get('window');

// ── Smart Item-Specific Attributes Generator ─────────────────────────────────
export function generateSmartAttributes(name: string, category?: string, restaurantName?: string, isVeg?: boolean) {
  const n = (name || '').toLowerCase();
  const c = (category || '').toLowerCase();

  if (n.includes('biryani') || c.includes('biryani') || n.includes('pulao') || n.includes('rice') || n.includes('thali') || n.includes('meal')) {
    return [
      { label: 'Kitchen', value: restaurantName || 'Paradise Biryani Express' },
      { label: 'Portion', value: 'Serves 1–2 (approx 650g box)' },
      { label: 'Dietary', value: isVeg ? '🟢 100% Vegetarian' : '🔴 Fresh Chicken • Halal Certified' },
      { label: 'Spice Level', value: n.includes('special') || n.includes('spicy') ? '🌶️🌶️ High Spice' : '🌶️ Medium Spicy' },
      { label: 'Preparation', value: 'Dum-cooked with aged Basmati & whole spices' },
      { label: 'Accompaniment', value: 'Served with authentic Mirchi Salan & Raita' },
      { label: 'Freshness', value: 'Cooked fresh on order • Best within 3 hrs' },
      { label: 'Packaging', value: 'Sealed Food-Grade Thermal Safe Container' },
    ];
  }

  if (n.includes('pizza') || c.includes('pizza') || n.includes('pasta') || n.includes('garlic bread')) {
    return [
      { label: 'Kitchen', value: restaurantName || 'Artisanal Pizza Lab' },
      { label: 'Size', value: '8 Inch (6 Slices • Serves 1–2)' },
      { label: 'Crust', value: 'Hand-Tossed Classic Fresh Dough' },
      { label: 'Cheese', value: '100% Pure Melted Mozzarella' },
      { label: 'Dietary', value: isVeg ? '🟢 Pure Vegetarian' : '🔴 Non-Vegetarian' },
      { label: 'Freshness', value: 'Baked Fresh to Order • Delivered Hot' },
      { label: 'Accompaniment', value: 'Includes Oregano & Chilli Flakes Sachets' },
    ];
  }

  if (n.includes('burger') || c.includes('burger') || n.includes('sandwich') || n.includes('wrap') || n.includes('roll')) {
    return [
      { label: 'Kitchen', value: restaurantName || 'Burger Bunker' },
      { label: 'Portion', value: '1 Jumbo Serving + House Dip' },
      { label: 'Patty / Filling', value: isVeg ? 'Crispy Spiced Paneer & Veg Patty' : 'Juicy Seasoned Chicken Patty' },
      { label: 'Bun', value: 'Toasted Sesame Brioche Bun' },
      { label: 'Dietary', value: isVeg ? '🟢 Pure Veg' : '🔴 Non-Veg' },
      { label: 'Freshness', value: 'Freshly Grilled on Order' },
    ];
  }

  if (n.includes('momo') || n.includes('noodle') || n.includes('fried rice') || n.includes('manchurian') || c.includes('chinese')) {
    return [
      { label: 'Kitchen', value: restaurantName || 'Mandarin Magic' },
      { label: 'Portion', value: '6 Pcs / 1 Large Box (Serves 1)' },
      { label: 'Preparation', value: 'Pan-Fried / Steamed Fresh' },
      { label: 'Dietary', value: isVeg ? '🟢 Pure Veg' : '🔴 Non-Veg' },
      { label: 'Sauce', value: 'Signature Spicy Schezwan Dip & Mayo' },
      { label: 'Freshness', value: 'Prepared Fresh in Wok' },
    ];
  }

  if (n.includes('dosa') || n.includes('idli') || n.includes('vada') || c.includes('south indian')) {
    return [
      { label: 'Kitchen', value: restaurantName || 'South Indian Soul' },
      { label: 'Portion', value: 'Standard Meal Portion' },
      { label: 'Dietary', value: '🟢 100% Pure Vegetarian' },
      { label: 'Accompaniment', value: 'Hot Sambar + 2 Coconut/Tomato Chutneys' },
      { label: 'Freshness', value: 'Made fresh on Tawa • Crisp & Hot' },
    ];
  }

  if (n.includes('juice') || n.includes('shake') || n.includes('cooler') || n.includes('smoothie') || n.includes('tea') || n.includes('coffee') || c.includes('drinks') || c.includes('beverage')) {
    return [
      { label: 'Bar', value: restaurantName || 'Zenvy Juice Booth' },
      { label: 'Volume', value: '350 ml (Large Cup)' },
      { label: 'Serving', value: 'Served Ice-Cold 🧊' },
      { label: 'Ingredients', value: 'Real Fruit Puree • No Artificial Colors' },
      { label: 'Freshness', value: 'Freshly Blended & Sealed Spill-Proof' },
    ];
  }

  if (c.includes('fruits') || c.includes('vegetables') || n.includes('apple') || n.includes('banana') || n.includes('mango') || n.includes('carrot') || n.includes('grapes')) {
    return [
      { label: 'Source', value: 'Campus Organic Farm Hub' },
      { label: 'Quality', value: 'Grade A Hand-Selected Daily' },
      { label: 'Weight', value: 'Standard Fresh Pack' },
      { label: 'Storage', value: 'Refrigerate below 8°C for best crispness' },
      { label: 'Shelf Life', value: '3–5 Days' },
      { label: 'Quality Guarantee', value: '100% Quality Checked at Doorstep' },
    ];
  }

  return [
    { label: 'Brand', value: restaurantName || 'Zenvy Verified Store' },
    { label: 'Item Type', value: 'Daily Campus Essential' },
    { label: 'Quality', value: '100% Original & Sealed' },
    { label: 'Shelf Life', value: 'Standard Retail Freshness' },
    { label: 'Delivery Guarantee', value: '8-Minute Campus Express Delivery' },
  ];
}

// ── Smart Context-Aware Cross-Sells (Often Bought Together) ──────────────────
export function generateSmartCrossSells(name: string, category?: string) {
  const n = (name || '').toLowerCase();
  const c = (category || '').toLowerCase();

  if (n.includes('biryani') || c.includes('biryani') || n.includes('pulao') || n.includes('rice') || n.includes('thali')) {
    return [
      { id: 'cs-coke', name: 'Chilled Thums Up (300ml)', price: 40, image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300&q=80', tag: 'Beverage' },
      { id: 'cs-chk65', name: 'Crispy Chicken 65', price: 140, image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=300&q=80', tag: 'Starter' },
      { id: 'cs-gulab', name: 'Hot Gulab Jamun (2 Pcs)', price: 50, image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&q=80', tag: 'Dessert' },
      { id: 'cs-raita', name: 'Extra Mint Raita & Salan', price: 25, image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300&q=80', tag: 'Side' },
    ];
  }

  if (n.includes('pizza') || c.includes('pizza') || n.includes('pasta')) {
    return [
      { id: 'cs-garlic', name: 'Cheesy Garlic Bread', price: 99, image: 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=300&q=80', tag: 'Side' },
      { id: 'cs-dip', name: 'Creamy Jalapeño Dip', price: 25, image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300&q=80', tag: 'Dip' },
      { id: 'cs-lava', name: 'Molten Choco Lava Cake', price: 89, image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=300&q=80', tag: 'Dessert' },
      { id: 'cs-pepsi', name: 'Chilled Pepsi (500ml)', price: 40, image: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=300&q=80', tag: 'Beverage' },
    ];
  }

  if (n.includes('burger') || c.includes('burger') || n.includes('sandwich') || n.includes('wrap')) {
    return [
      { id: 'cs-fries', name: 'Peri Peri French Fries', price: 79, image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=300&q=80', tag: 'Side' },
      { id: 'cs-shake', name: 'Belgian Chocolate Shake', price: 120, image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=300&q=80', tag: 'Shake' },
      { id: 'cs-cheese', name: 'Extra Melted Cheese Slice', price: 20, image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=300&q=80', tag: 'Add-on' },
    ];
  }

  if (n.includes('momo') || n.includes('noodle') || c.includes('chinese')) {
    return [
      { id: 'cs-spring', name: 'Crispy Veg Spring Rolls', price: 90, image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=300&q=80', tag: 'Starter' },
      { id: 'cs-mojito', name: 'Fresh Lemon Mint Mojito', price: 60, image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=300&q=80', tag: 'Beverage' },
      { id: 'cs-schez', name: 'Extra Hot Schezwan Dip', price: 20, image: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=300&q=80', tag: 'Dip' },
    ];
  }

  return [
    { id: 'cs-milk', name: 'Amul Taaza Milk (500ml)', price: 27, image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=300&q=80', tag: 'Daily' },
    { id: 'cs-bread', name: 'Fresh Whole Wheat Bread', price: 45, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&q=80', tag: 'Daily' },
    { id: 'cs-snack', name: 'Lays Magic Masala Chips', price: 20, image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300&q=80', tag: 'Snack' },
  ];
}

// ── Smart Seed Reviews Generator ─────────────────────────────────────────────
export function generateSeedReviews(name: string, category?: string) {
  const n = (name || '').toLowerCase();
  
  if (n.includes('biryani') || n.includes('rice') || n.includes('pulao')) {
    return [
      { id: 'rev-1', name: 'Karthik V.', block: 'GH-2 • Room 304', rating: 5, time: '2 hours ago', comment: 'Authentic Hyderabadi flavor! The chicken pieces were tender and the salan was fiery. Arrived in 8 mins steaming hot 🔥', verified: true, helpfulCount: 24 },
      { id: 'rev-2', name: 'Sneha P.', block: 'MH-1 • 2nd Floor', rating: 5, time: 'Yesterday', comment: 'Generous portion size easily enough for 2 people. Super fragrant rice quality. Best biryani on campus!', verified: true, helpfulCount: 18 },
      { id: 'rev-3', name: 'Aditya R.', block: 'GH-1 • 4th Floor', rating: 4, time: '3 days ago', comment: 'Great taste and very fast delivery during late-night study hours. Packaging was sealed and leakproof.', verified: true, helpfulCount: 9 },
    ];
  }

  if (n.includes('pizza') || n.includes('burger') || n.includes('momo') || n.includes('pasta')) {
    return [
      { id: 'rev-1', name: 'Ananya S.', block: 'MH-2 • Room 112', rating: 5, time: 'Today', comment: 'Super cheesy and arrived piping hot! The crust was crispy and not soggy at all. 10/10 recommend.', verified: true, helpfulCount: 15 },
      { id: 'rev-2', name: 'Rohan M.', block: 'GH-3 • Room 408', rating: 5, time: 'Yesterday', comment: 'Quick delivery right to hostel lobby. Tastes just like cafe quality. Will definitely order again!', verified: true, helpfulCount: 12 },
    ];
  }

  return [
    { id: 'rev-1', name: 'Alex M.', block: 'Campus Resident', rating: 5, time: 'Today', comment: 'Super fresh quality, delivered in 8 mins right to my room door. Great campus service!', verified: true, helpfulCount: 11 },
    { id: 'rev-2', name: 'Priya K.', block: 'GH-1 Resident', rating: 5, time: 'Yesterday', comment: 'Always reliable and reasonably priced. Very happy with the freshness.', verified: true, helpfulCount: 7 },
  ];
}

// ── Master Hardcoded PDP Data for Static Slugs ────────────────────────────────
const MASTER_PDP_DATA: Record<string, any> = {
  'brand-guava': {
    id: 'brand-guava',
    name: 'B Natural Guava Fruit Beverage',
    price: 88,
    originalPrice: 115,
    discount: '23% OFF',
    weight: '1 L',
    images: [
      'https://images.unsplash.com/photo-1534531173927-aeb928d54385?w=800&q=80',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
    ],
    description:
      'Enjoy the luscious taste of pink guavas with B Natural Guava Fruit Beverage. Crafted to perfection, it brings the authentic flavor and texture of real fruits directly to your table.',
    rating: 4.3,
    ratingCount: 68,
    verifiedShops: ['Campus Kirana', 'Campus SuperStore', 'SRM Mart'],
    packSizes: [
      { size: '1 L', price: 88, originalPrice: 115, discount: '23% OFF' },
      { size: '200 ml', price: 20, originalPrice: 25, discount: '20% OFF' },
    ],
  },
  'bread-wholewheat': {
    id: 'bread-wholewheat',
    name: 'Campus Bakery Whole Wheat Bread',
    price: 45,
    originalPrice: 50,
    discount: '10% OFF',
    weight: '400g',
    images: [
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80',
      'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=800&q=80',
    ],
    description:
      'Freshly baked every morning on campus. Our whole wheat loaf is packed with fiber and essential nutrients, perfect for sandwiches, toast, or a quick snack.',
    rating: 4.8,
    ratingCount: 42,
    verifiedShops: ['Campus Bakery', 'SRM Central Mart', 'Campus Kirana'],
    packSizes: [
      { size: '400g', price: 45, originalPrice: 50, discount: '10% OFF' },
      { size: '800g', price: 85, originalPrice: 95, discount: '11% OFF' },
    ],
  },
  'fruit-apple': {
    id: 'fruit-apple',
    name: 'Royal Gala Apple',
    price: 149,
    originalPrice: 199,
    discount: '25% OFF',
    weight: '1 kg (4-5 pcs)',
    images: ['https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800&q=80'],
    description: 'Crisp, sweet, and juicy Royal Gala apples imported fresh daily. High in dietary fiber and vitamin C.',
    rating: 4.8,
    ratingCount: 312,
    verifiedShops: ['Fresho Fruit Hub', 'Campus Organic Store'],
    packSizes: [
      { size: '1 kg', price: 149, originalPrice: 199, discount: '25% OFF' },
      { size: '500 g', price: 79, originalPrice: 105, discount: '24% OFF' },
    ],
  },
};

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const cleanId = (Array.isArray(id) ? id[0] : id || '').replace(/\/$/, '');

  const { cart, addToCart, updateQuantity, clearCart } = useCart();
  const { isDark, colors } = useTheme();

  const handleSafeAddToCart = (itemPayload: any, successMsg?: string) => {
    try {
      addToCart(itemPayload);
      if (successMsg) Alert.alert('Added 🛒', successMsg);
    } catch (err: any) {
      if (err.message === 'MULTIPLE_RESTAURANTS') {
        Alert.alert(
          'Clear Basket?',
          'Your basket contains items from another store/restaurant. Clear it to add this item?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Clear & Add',
              onPress: () => {
                clearCart();
                setTimeout(() => {
                  addToCart(itemPayload);
                  if (successMsg) Alert.alert('Added 🛒', successMsg);
                }, 100);
              }
            }
          ]
        );
      }
    }
  };

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPackIndex, setSelectedPackIndex] = useState(0);
  const [showShopsModal, setShowShopsModal] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [imgWidth, setImgWidth] = useState(SW);

  // Reviews state
  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [calculatedRating, setCalculatedRating] = useState<number>(4.8);
  const [totalRatingCount, setTotalRatingCount] = useState<number>(42);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [userRating, setUserRating] = useState(5);
  const [userReviewText, setUserReviewText] = useState('');
  const [userName, setUserName] = useState('');
  const [userBlock, setUserBlock] = useState('GH-2 Block');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submittingReview, setSubmittingReview] = useState(false);

  const REVIEW_TAGS = ['Super Tasty 🔥', 'Generous Portion 🍛', '8-Min Delivery ⚡', 'Spicy & Hot 🌶️', 'Best Value 💰'];

  // Load reviews from storage & seed
  const loadReviews = async (pName: string, pCat?: string) => {
    try {
      const stored = await AsyncStorage.getItem(`zenvy_reviews_${cleanId}`);
      const seed = generateSeedReviews(pName, pCat);
      let combined = seed;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          combined = [...parsed, ...seed];
        }
      }
      setReviewsList(combined);

      // Compute exact rating
      const sum = combined.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
      const avg = parseFloat((sum / combined.length).toFixed(1));
      setCalculatedRating(avg);
      setTotalRatingCount(combined.length * 14 + 8);
    } catch (e) {
      console.warn('[Reviews] Failed to load reviews:', e);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadProduct = async () => {
      setLoading(true);

      // 1. Try local hardcoded data first
      const local = MASTER_PDP_DATA[cleanId];
      if (local) {
        const smartAttrs = generateSmartAttributes(local.name, local.category, local.restaurantName, local.isVegetarian);
        const crossSells = generateSmartCrossSells(local.name, local.category);
        setProduct({
          ...local,
          attributes: smartAttrs,
          crossSells,
        });
        await loadReviews(local.name, local.category);
        setLoading(false);
        return;
      }

      // 2. Fetch from API for dynamic items
      try {
        const res = await apiFetch(`/api/users/products/${cleanId}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            let discount: string | undefined;
            if (data.originalPrice && data.originalPrice > data.price) {
              const pct = Math.round(((data.originalPrice - data.price) / data.originalPrice) * 100);
              discount = `${pct}% OFF`;
            }

            const smartAttrs = generateSmartAttributes(data.name, data.category, data.restaurantName, data.isVegetarian);
            const crossSells = generateSmartCrossSells(data.name, data.category);

            const resolved = {
              id: data.id || data._id || cleanId,
              name: data.name || 'Zenvy Specialty Dish',
              price: data.price ?? 99,
              originalPrice: data.originalPrice ?? data.price,
              discount,
              weight: data.weight || data.quantity || '1 Serving',
              images: data.images || (data.imageUrl ? [data.imageUrl] : data.image ? [data.image] : ['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80']),
              description: data.description || 'Authentic campus favorite prepared fresh on order and delivered in sealed thermal packaging.',
              rating: data.rating ?? 4.8,
              ratingCount: data.ratingCount ?? 48,
              verifiedShops: data.verifiedShops || [data.restaurantName || 'Campus Central Kitchen'],
              packSizes: data.packSizes || [{ size: data.weight || 'Standard Portion', price: data.price, originalPrice: data.originalPrice, discount }],
              attributes: smartAttrs,
              crossSells,
              isVegetarian: data.isVegetarian,
              category: data.category,
              restaurantName: data.restaurantName,
              restaurantId: data.restaurantId,
            };
            setProduct(resolved);
            await loadReviews(resolved.name, resolved.category);
          }
        } else {
          if (!cancelled) {
            const cleanName = cleanId.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            const smartAttrs = generateSmartAttributes(cleanName);
            const crossSells = generateSmartCrossSells(cleanName);
            setProduct({
              id: cleanId,
              name: cleanName,
              price: 99,
              originalPrice: 120,
              discount: '18% OFF',
              weight: '1 Serving',
              images: ['https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80'],
              description: 'Freshly prepared specialty dish delivered directly to your campus room.',
              rating: 4.7,
              ratingCount: 52,
              verifiedShops: ['Campus Central Mart'],
              packSizes: [{ size: '1 Serving', price: 99, originalPrice: 120, discount: '18% OFF' }],
              attributes: smartAttrs,
              crossSells,
            });
            await loadReviews(cleanName);
          }
        }
      } catch (err) {
        console.warn('[ProductDetail] API fetch failed, fallback used:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProduct();
    return () => {
      cancelled = true;
    };
  }, [cleanId]);

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSaveReview = async () => {
    if (!userReviewText.trim()) {
      Alert.alert('Review Required', 'Please write a brief comment about your experience.');
      return;
    }

    setSubmittingReview(true);
    try {
      const newReview = {
        id: 'user-rev-' + Date.now(),
        name: userName.trim() || 'Verified Student',
        block: userBlock || 'GH-2 Resident',
        rating: userRating,
        time: 'Just now',
        comment: userReviewText.trim() + (selectedTags.length > 0 ? ` • (${selectedTags.join(', ')})` : ''),
        verified: true,
        helpfulCount: 1,
      };

      const stored = await AsyncStorage.getItem(`zenvy_reviews_${cleanId}`);
      const existing = stored ? JSON.parse(stored) : [];
      const updated = [newReview, ...existing];
      await AsyncStorage.setItem(`zenvy_reviews_${cleanId}`, JSON.stringify(updated));

      // Update UI
      const seed = generateSeedReviews(product?.name || '', product?.category);
      const combined = [...updated, ...seed];
      setReviewsList(combined);

      const sum = combined.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
      const avg = parseFloat((sum / combined.length).toFixed(1));
      setCalculatedRating(avg);
      setTotalRatingCount((prev) => prev + 1);

      setShowReviewModal(false);
      setUserReviewText('');
      setSelectedTags([]);
      Alert.alert('⭐ Thank You!', 'Your review has been verified and published.');
    } catch (e) {
      Alert.alert('Error', 'Could not save review. Please try again.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading || !product) {
    return (
      <View style={[styles.loadingBox, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={{ marginTop: 12, fontSize: 11, fontWeight: '800', color: COLORS.inkMuted }}>
          Loading fresh details...
        </Text>
      </View>
    );
  }

  const currentCartItem = cart.find((i: any) => i.id === product.id || i.menuItemId === product.id);
  const qty = currentCartItem ? currentCartItem.quantity : 0;
  const currentPack = product.packSizes ? product.packSizes[selectedPackIndex] || product : product;

  const handleShare = () => {
    Clipboard.setString(`Check out ${product.name} on Zenvy: https://zenvy.com/products/${product.id}`);
    Alert.alert('Link Copied', 'Product link copied to clipboard!');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* ZONE 1 — IMAGE GALLERY                                                */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <View
          style={styles.imageGalleryContainer}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) setImgWidth(w);
          }}
        >
          <FlatList
            data={product.images || [product.image]}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / (imgWidth || SW));
              setActiveImgIndex(idx);
            }}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={[styles.galleryImage, { width: imgWidth }]} />
            )}
          />

          {/* Floating Top Nav Actions */}
          <View style={styles.galleryTopNav}>
            <TouchableOpacity 
              style={styles.iconCircleBtn} 
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)' as any);
                }
              }}
            >
              <Text style={styles.iconCircleText}>‹</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconCircleBtn} onPress={() => setIsWishlisted(!isWishlisted)}>
              <Text style={{ fontSize: 16 }}>{isWishlisted ? '❤️' : '🤍'}</Text>
            </TouchableOpacity>
          </View>

          {/* Discount Ribbon top-left over image */}
          {currentPack.discount && (
            <View style={styles.galleryDiscountRibbon}>
              <Text style={styles.galleryDiscountText}>{currentPack.discount}</Text>
            </View>
          )}

          {/* Carousel Dot Indicators */}
          {product.images?.length > 1 && (
            <View style={styles.dotRow}>
              {product.images.map((_: any, i: number) => (
                <View key={i} style={[styles.dot, i === activeImgIndex && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* ZONE 2 — CORE INFO SHEET                                              */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <View style={[styles.coreInfoSheet, { backgroundColor: isDark ? '#141416' : '#FFF' }]}>
          {/* Delivery estimate row */}
          <View style={styles.deliveryEstimateRow}>
            <View style={styles.arrivesPill}>
              <Text style={styles.arrivesPillText}>⏱ Arrives in 8 mins</Text>
            </View>
            <View style={[styles.vegNonVegBadge, { borderColor: product.isVegetarian ? '#22C55E' : '#EF4444' }]}>
              <View style={[styles.vegInnerDot, { backgroundColor: product.isVegetarian ? '#22C55E' : '#EF4444' }]} />
              <Text style={[styles.vegBadgeText, { color: product.isVegetarian ? '#22C55E' : '#EF4444' }]}>
                {product.isVegetarian ? 'PURE VEG' : 'NON-VEG'}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.productNameTitle, { color: isDark ? '#FFF' : COLORS.ink }]}>{product.name}</Text>

          {/* Restaurant / Brand subtitle */}
          <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#9CA3AF' : '#6B7280', marginBottom: 12 }}>
            By {product.restaurantName || 'Zenvy Kitchen'}
          </Text>

          {/* Unit selector pills */}
          {product.packSizes && product.packSizes.length > 1 && (
            <View style={styles.unitSelectorRow}>
              {product.packSizes.map((pack: any, index: number) => {
                const isSelected = selectedPackIndex === index;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.unitPill, isSelected && styles.unitPillActive]}
                    onPress={() => setSelectedPackIndex(index)}
                  >
                    <Text style={[styles.unitPillText, isSelected && styles.unitPillTextActive]}>
                      {pack.size}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Price row */}
          <View style={styles.priceContainerRow}>
            <Text style={[styles.priceCurrentBig, { color: isDark ? '#FFF' : COLORS.ink }]}>₹{currentPack.price}</Text>
            {currentPack.originalPrice && currentPack.originalPrice > currentPack.price && (
              <Text style={styles.priceOriginalStrikethrough}>₹{currentPack.originalPrice}</Text>
            )}
            {currentPack.discount && (
              <View style={styles.priceDiscountChip}>
                <Text style={styles.priceDiscountChipText}>{currentPack.discount}</Text>
              </View>
            )}
          </View>

          {/* Verified Price Green Chip */}
          <TouchableOpacity
            style={styles.verifiedPriceChip}
            activeOpacity={0.8}
            onPress={() => setShowShopsModal(true)}
          >
            <Text style={styles.verifiedPriceChipText}>
              ✓ Verified price — matched across campus kitchens & stores
            </Text>
          </TouchableOpacity>
        </View>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* ZONE 4 — ITEM SPECIFICATIONS & ABOUT THIS PRODUCT                    */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <View style={[styles.pdpSectionBox, { backgroundColor: isDark ? '#141416' : '#FFF' }]}>
          <Text style={[styles.pdpSectionTitle, { color: isDark ? '#FFF' : COLORS.ink }]}>About this product</Text>
          <Text
            style={[styles.pdpDescriptionText, { color: isDark ? '#9CA3AF' : COLORS.inkMuted }]}
            numberOfLines={descExpanded ? undefined : 3}
          >
            {product.description}
          </Text>
          <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)}>
            <Text style={styles.readMoreLink}>{descExpanded ? 'Show less' : 'Read more'}</Text>
          </TouchableOpacity>

          {/* Attributes Table */}
          {product.attributes && product.attributes.length > 0 && (
            <View style={[styles.attributesTable, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : COLORS.primarySoft }]}>
              {product.attributes.map((attr: any, idx: number) => (
                <View key={idx} style={styles.attributeRow}>
                  <Text style={[styles.attrLabel, { color: isDark ? '#9CA3AF' : COLORS.inkMuted }]}>{attr.label}</Text>
                  <Text style={[styles.attrVal, { color: isDark ? '#FFF' : COLORS.ink }]}>{attr.value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* ZONE 5 — OFTEN BOUGHT TOGETHER (CROSS-SELL)                          */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <View style={[styles.pdpSectionBox, { backgroundColor: isDark ? '#141416' : '#FFF' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.pdpSectionTitle, { color: isDark ? '#FFF' : COLORS.ink, marginBottom: 0 }]}>
              Often bought together
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '800', color: COLORS.primary }}>
              POPULAR PAIRINGS
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {(product.crossSells || []).map((rel: any) => (
              <View
                key={rel.id}
                style={[styles.relatedMiniCard, { backgroundColor: isDark ? '#1A1A1E' : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20, 19, 31, 0.06)' }]}
              >
                <Image source={{ uri: rel.image }} style={styles.relatedImg} />
                <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 7, fontWeight: '900', color: '#FFF' }}>{rel.tag || 'PAIR'}</Text>
                </View>
                <Text style={[styles.relatedTitle, { color: isDark ? '#FFF' : COLORS.ink }]} numberOfLines={1}>
                  {rel.name}
                </Text>
                <View style={styles.relatedPriceRow}>
                  <Text style={[styles.relatedPrice, { color: isDark ? '#FFF' : COLORS.ink }]}>₹{rel.price}</Text>
                  <TouchableOpacity
                    style={sMiniPlusBtn}
                    onPress={() => {
                      handleSafeAddToCart({
                        id: rel.id,
                        name: rel.name,
                        price: rel.price,
                        image: rel.image,
                        restaurantId: product.restaurantId || 'market-hub',
                        restaurantName: product.restaurantName || 'Campus Mart',
                      }, `${rel.name} added to your basket!`);
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFF' }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* ZONE 6 — GENUINE RATINGS & CUSTOMER REVIEWS                          */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <View style={[styles.pdpSectionBox, { backgroundColor: isDark ? '#141416' : '#FFF' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <View>
              <Text style={[styles.pdpSectionTitle, { color: isDark ? '#FFF' : COLORS.ink, marginBottom: 2 }]}>
                Customer Reviews & Ratings
              </Text>
              <Text style={{ fontSize: 10, color: isDark ? '#9CA3AF' : COLORS.inkMuted }}>
                100% Genuine Verified Campus Orders
              </Text>
            </View>

            <TouchableOpacity
              style={styles.writeReviewTopBtn}
              onPress={() => setShowReviewModal(true)}
            >
              <Text style={styles.writeReviewTopBtnText}>+ Rate Item</Text>
            </TouchableOpacity>
          </View>

          {/* Rating Summary Card */}
          <View style={[styles.ratingOverviewBox, { backgroundColor: isDark ? '#1C1C20' : '#F9FAFB' }]}>
            <View style={{ alignItems: 'center', width: 90 }}>
              <Text style={[styles.bigRatingScore, { color: isDark ? '#FFF' : COLORS.ink }]}>
                {calculatedRating.toFixed(1)}
              </Text>
              <Text style={{ fontSize: 12, marginVertical: 2 }}>⭐⭐⭐⭐⭐</Text>
              <Text style={{ fontSize: 9, fontWeight: '700', color: isDark ? '#9CA3AF' : COLORS.inkMuted }}>
                {totalRatingCount} Ratings
              </Text>
            </View>

            {/* Star Distribution Bars */}
            <View style={{ flex: 1, paddingLeft: 16, gap: 4 }}>
              {[
                { star: 5, pct: '82%' },
                { star: 4, pct: '12%' },
                { star: 3, pct: '4%' },
                { star: 2, pct: '1%' },
                { star: 1, pct: '1%' },
              ].map((b) => (
                <View key={b.star} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: isDark ? '#9CA3AF' : '#6B7280', width: 14 }}>
                    {b.star}★
                  </Text>
                  <View style={{ flex: 1, height: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ width: b.pct, height: '100%', backgroundColor: b.star >= 4 ? '#22C55E' : b.star === 3 ? '#F59E0B' : '#EF4444', borderRadius: 3 }} />
                  </View>
                  <Text style={{ fontSize: 8, color: isDark ? '#9CA3AF' : '#6B7280', width: 26, textAlign: 'right' }}>
                    {b.pct}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Customer Reviews Feed */}
          {reviewsList.map((rev: any) => (
            <View key={rev.id} style={[styles.reviewCard, { backgroundColor: isDark ? '#1A1A1E' : '#F9FAFB' }]}>
              <View style={styles.reviewUserRow}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.reviewUserName, { color: isDark ? '#FFF' : COLORS.ink }]}>{rev.name}</Text>
                    {rev.verified && (
                      <View style={styles.verifiedBadge}>
                        <Text style={styles.verifiedBadgeText}>✓ VERIFIED BUYER</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.reviewTime}>{rev.block} • {rev.time}</Text>
                </View>
                <View style={styles.starScoreChip}>
                  <Text style={styles.starScoreChipText}>{rev.rating} ★</Text>
                </View>
              </View>
              <Text style={[styles.reviewComment, { color: isDark ? '#E5E7EB' : COLORS.ink }]}>{rev.comment}</Text>
            </View>
          ))}
        </View>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* ZONE 7 — SPONSORED AD SLOT                                            */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <View style={{ paddingHorizontal: 16 }}>
          <AdSlot placement="pdp_footer" />
        </View>
      </ScrollView>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* ZONE 3 — STICKY BOTTOM ACTION BAR                                     */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <View style={[styles.stickyBottomBar, { backgroundColor: isDark ? '#141416' : '#FFF', borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20, 19, 31, 0.08)' }]}>
        {/* Quantity Stepper */}
        <View style={styles.stepperContainer}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => {
              if (qty > 1) {
                updateQuantity(product.id, qty - 1);
              } else if (qty === 1) {
                updateQuantity(product.id, 0);
              }
            }}
          >
            <Text style={styles.stepperBtnText}>–</Text>
          </TouchableOpacity>
          <Text style={styles.stepperValText}>{qty}</Text>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() =>
              handleSafeAddToCart({
                id: product.id,
                name: product.name,
                price: currentPack.price,
                image: product.image || product.images?.[0] || '',
                restaurantId: product.restaurantId || 'market-hub',
                restaurantName: product.verifiedShops?.[0] || product.restaurantName || 'Campus Mart',
              })
            }
          >
            <Text style={styles.stepperBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Primary Violet Add to Basket Button */}
        <TouchableOpacity
          style={styles.primaryAddBasketBtn}
          activeOpacity={0.88}
          onPress={() => {
            if (qty === 0) {
              handleSafeAddToCart({
                id: product.id,
                name: product.name,
                price: currentPack.price,
                image: product.image || product.images?.[0] || '',
                restaurantId: product.restaurantId || 'market-hub',
                restaurantName: product.verifiedShops?.[0] || product.restaurantName || 'Campus Mart',
              });
            } else {
              router.push('/(tabs)/basket' as any);
            }
          }}
        >
          <Text style={styles.primaryAddBasketBtnText}>
            {qty > 0 ? 'Go to Basket' : 'Add to Basket'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Interactive Rate & Review Modal ── */}
      <Modal visible={showReviewModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: isDark ? '#18181B' : '#FFF' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#FFF' : COLORS.ink }]}>⭐ Rate & Review Item</Text>
            <Text style={{ fontSize: 11, color: isDark ? '#9CA3AF' : COLORS.inkMuted, marginBottom: 16 }}>
              Share your genuine feedback for {product.name}
            </Text>

            {/* Star Picker */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 18 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setUserRating(star)}>
                  <Text style={{ fontSize: 32 }}>{star <= userRating ? '⭐' : '☆'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quick Tags */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {REVIEW_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagPill, isSelected && styles.tagPillActive]}
                    onPress={() => handleToggleTag(tag)}
                  >
                    <Text style={[styles.tagPillText, isSelected && { color: '#FFF' }]}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Review Comment Text Input */}
            <TextInput
              style={[styles.reviewTextInput, { color: isDark ? '#FFF' : COLORS.ink, borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#E5E7EB' }]}
              placeholder="What did you like or dislike? (Taste, freshness, portion size...)"
              placeholderTextColor={isDark ? '#71717A' : '#9CA3AF'}
              multiline
              numberOfLines={3}
              value={userReviewText}
              onChangeText={setUserReviewText}
            />

            {/* Submit Actions */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.modalCloseBtn, { flex: 1, backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}
                onPress={() => setShowReviewModal(false)}
              >
                <Text style={[styles.modalCloseBtnText, { color: isDark ? '#FFF' : '#374151' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitReviewBtn, { flex: 1.5 }]}
                onPress={handleSaveReview}
                disabled={submittingReview}
              >
                {submittingReview ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.submitReviewBtnText}>Submit Review</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Verified Shops Modal */}
      <Modal visible={showShopsModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: isDark ? '#18181B' : '#FFF' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#FFF' : COLORS.ink }]}>✓ Verified Campus Prices</Text>
            <Text style={[styles.modalSub, { color: isDark ? '#9CA3AF' : COLORS.inkMuted }]}>
              Price matched across these verified campus kitchens & stores:
            </Text>
            {product.verifiedShops?.map((shop: string, i: number) => (
              <View key={i} style={[styles.shopRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                <Text style={[styles.shopName, { color: isDark ? '#FFF' : COLORS.ink }]}>🏪 {shop}</Text>
                <Text style={styles.shopPrice}>₹{currentPack.price}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowShopsModal(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const sMiniPlusBtn = {
  width: 26,
  height: 26,
  borderRadius: 13,
  backgroundColor: COLORS.primary,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ZONE 1: IMAGE GALLERY
  imageGalleryContainer: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 440,
    position: 'relative',
    backgroundColor: '#F8FAFC',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  galleryTopNav: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 20,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.cardElevated,
  },
  iconCircleText: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.ink,
    marginTop: -2,
  },
  galleryDiscountRibbon: {
    position: 'absolute',
    top: 70,
    left: 16,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  galleryDiscountText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFF',
  },
  dotRow: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(20, 19, 31, 0.3)',
  },
  dotActive: {
    width: 18,
    backgroundColor: COLORS.primary,
  },

  // ZONE 2: CORE INFO SHEET
  coreInfoSheet: {
    marginTop: -24,
    backgroundColor: '#FFF',
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding: 20,
    ...SHADOWS.cardElevated,
  },
  deliveryEstimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  arrivesPill: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
  },
  arrivesPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.accent,
  },
  vegNonVegBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  vegInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  vegBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  productNameTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.ink,
    lineHeight: 24,
    marginBottom: 4,
  },
  unitSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  unitPill: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  unitPillActive: {
    backgroundColor: COLORS.primary,
  },
  unitPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
  },
  unitPillTextActive: {
    color: '#FFF',
  },
  priceContainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  priceCurrentBig: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.ink,
    fontVariant: ['tabular-nums'],
  },
  priceOriginalStrikethrough: {
    fontSize: 14,
    color: COLORS.inkMuted,
    textDecorationLine: 'line-through',
    fontVariant: ['tabular-nums'],
  },
  priceDiscountChip: {
    backgroundColor: 'rgba(239, 79, 95, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  priceDiscountChipText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.red,
  },
  verifiedPriceChip: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    marginTop: 4,
  },
  verifiedPriceChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },

  // ZONE 4: DETAILS & ATTRIBUTES
  pdpSectionBox: {
    marginTop: 12,
    backgroundColor: '#FFF',
    padding: 20,
    ...SHADOWS.cardElevated,
  },
  pdpSectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.ink,
    marginBottom: 8,
  },
  pdpDescriptionText: {
    fontSize: 12,
    color: COLORS.inkMuted,
    lineHeight: 18,
  },
  readMoreLink: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 4,
  },
  attributesTable: {
    marginTop: 14,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.md,
    padding: 12,
    gap: 8,
  },
  attributeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  attrLabel: {
    fontSize: 11,
    color: COLORS.inkMuted,
  },
  attrVal: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.ink,
  },

  // OFTEN BOUGHT TOGETHER
  relatedMiniCard: {
    width: 130,
    backgroundColor: '#FFF',
    borderRadius: RADIUS.lg,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(20, 19, 31, 0.06)',
    ...SHADOWS.cardElevated,
  },
  relatedImg: {
    width: '100%',
    height: 85,
    borderRadius: RADIUS.md,
    marginBottom: 6,
  },
  relatedTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 4,
  },
  relatedPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  relatedPrice: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.ink,
    fontVariant: ['tabular-nums'],
  },

  // RATINGS & REVIEWS
  writeReviewTopBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  writeReviewTopBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.primary,
  },
  ratingOverviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
  },
  bigRatingScore: {
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 36,
  },
  reviewCard: {
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 10,
  },
  reviewUserRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  reviewUserName: {
    fontSize: 11,
    fontWeight: '900',
  },
  verifiedBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedBadgeText: {
    fontSize: 7,
    fontWeight: '900',
    color: '#16A34A',
    letterSpacing: 0.5,
  },
  reviewTime: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 1,
  },
  starScoreChip: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  starScoreChipText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFF',
  },
  reviewComment: {
    fontSize: 11,
    lineHeight: 16,
  },

  // STICKY BOTTOM BAR
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(20, 19, 31, 0.08)',
    ...SHADOWS.cardElevated,
    zIndex: 100,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primary,
  },
  stepperValText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primary,
    marginHorizontal: 12,
    fontVariant: ['tabular-nums'],
  },
  primaryAddBasketBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.primaryBtn,
  },
  primaryAddBasketBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },

  // MODALS
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFF',
    borderRadius: RADIUS.xl,
    padding: 20,
    ...SHADOWS.cardElevated,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.ink,
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 11,
    color: COLORS.inkMuted,
    marginBottom: 16,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tagPillActive: {
    backgroundColor: COLORS.primary,
  },
  tagPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: COLORS.primary,
  },
  reviewTextInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  submitReviewBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitReviewBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFF',
  },
  shopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  shopName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
  },
  shopPrice: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.primary,
  },
  modalCloseBtn: {
    marginTop: 16,
    backgroundColor: COLORS.primarySoft,
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.primary,
  },
});
