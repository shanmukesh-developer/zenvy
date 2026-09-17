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
  Modal,
  TextInput,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SHADOWS, RADIUS } from '../../constants/theme';
import { useCart } from '../../context/CartContext';
import { apiFetch } from '../../utils/auth';
import { useTheme } from '../../context/ThemeContext';
import AdSlot from '../../components/AdSlot';
import SafeImage from '../../components/SafeImage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width: SW } = Dimensions.get('window');

export function getFoodImage(name?: string, category?: string, currentUri?: string): string {
  if (currentUri && typeof currentUri === 'string' && currentUri.startsWith('http')) {
    return currentUri;
  }
  const n = (name || '').toLowerCase();
  if (n.includes('biryani')) return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80';
  if (n.includes('pizza')) return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80';
  if (n.includes('burger')) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80';
  if (n.includes('paneer') || n.includes('tikka')) return 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=800&q=80';
  if (n.includes('shake') || n.includes('coffee') || n.includes('drink')) return 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800&q=80';
  if (n.includes('momo') || n.includes('roll')) return 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=800&q=80';
  if (n.includes('cake') || n.includes('dessert') || n.includes('sweet')) return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80';
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80';
}

// ── Smart Item-Specific Attributes Generator ─────────────────────────────────
export function generateSmartAttributes(name: string, category?: string, restaurantName?: string, isVeg?: boolean) {
  const n = (name || '').toLowerCase();
  const c = (category || '').toLowerCase();

  if (n.includes('biryani') || c.includes('biryani') || n.includes('pulao') || n.includes('rice') || n.includes('thali') || n.includes('meal')) {
    return [
      { label: 'Kitchen', value: restaurantName || 'Campus Partner Kitchen' },
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
      { label: 'Kitchen', value: restaurantName || 'Campus Partner Kitchen' },
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
      { label: 'Kitchen', value: restaurantName || 'Campus Partner Kitchen' },
      { label: 'Portion', value: '1 Jumbo Serving + House Dip' },
      { label: 'Patty / Filling', value: isVeg ? 'Crispy Spiced Paneer & Veg Patty' : 'Juicy Seasoned Chicken Patty' },
      { label: 'Bun', value: 'Toasted Sesame Brioche Bun' },
      { label: 'Dietary', value: isVeg ? '🟢 Pure Veg' : '🔴 Non-Veg' },
      { label: 'Freshness', value: 'Freshly Grilled on Order' },
    ];
  }

  if (n.includes('momo') || n.includes('noodle') || n.includes('fried rice') || n.includes('manchurian') || c.includes('chinese')) {
    return [
      { label: 'Kitchen', value: restaurantName || 'Campus Partner Kitchen' },
      { label: 'Portion', value: '6 Pcs / 1 Large Box (Serves 1)' },
      { label: 'Preparation', value: 'Pan-Fried / Steamed Fresh' },
      { label: 'Dietary', value: isVeg ? '🟢 Pure Veg' : '🔴 Non-Veg' },
      { label: 'Sauce', value: 'Signature Spicy Schezwan Dip & Mayo' },
      { label: 'Freshness', value: 'Prepared Fresh in Wok' },
    ];
  }

  if (n.includes('dosa') || n.includes('idli') || n.includes('vada') || c.includes('south indian')) {
    return [
      { label: 'Kitchen', value: restaurantName || 'Campus Partner Kitchen' },
      { label: 'Portion', value: 'Standard Meal Portion' },
      { label: 'Dietary', value: '🟢 100% Pure Vegetarian' },
      { label: 'Accompaniment', value: 'Hot Sambar + 2 Coconut/Tomato Chutneys' },
      { label: 'Freshness', value: 'Made fresh on Tawa • Crisp & Hot' },
    ];
  }

  if (n.includes('juice') || n.includes('shake') || n.includes('cooler') || n.includes('smoothie') || n.includes('tea') || n.includes('coffee') || c.includes('drinks') || c.includes('beverage')) {
    return [
      { label: 'Bar', value: restaurantName || 'Campus Beverage Hub' },
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

// ── Parse Attributes into Quick Highlights Matrix & Remaining Specs ──────────
export function parseProductHighlights(attributes: any[], isVeg?: boolean) {
  if (!attributes || attributes.length === 0) {
    return { highlights: [], remaining: [] };
  }

  const portion = attributes.find(a => a.label === 'Portion' || a.label === 'Size' || a.label === 'Weight' || a.label === 'Volume');
  const dietary = attributes.find(a => a.label === 'Dietary');
  const spice = attributes.find(a => a.label === 'Spice Level' || a.label === 'Sauce');
  const freshness = attributes.find(a => a.label === 'Freshness' || a.label === 'Shelf Life' || a.label === 'Quality');

  const highlights = [
    {
      icon: '🍽️',
      label: portion?.label || 'PORTION',
      value: portion?.value || 'Standard Meal',
      desc: 'Optimal for 1–2 persons'
    },
    {
      icon: (isVeg ?? true) ? '🌿' : '🍗',
      label: 'DIETARY',
      value: dietary?.value?.replace(/^[🟢🔴]\s*/, '') || (isVeg ? '100% Pure Veg' : 'Non-Vegetarian'),
      isVeg: isVeg ?? true,
      desc: 'FSSAI Certified'
    },
    {
      icon: spice?.label === 'Spice Level' ? '🌶️' : '✨',
      label: spice?.label || 'SPICE LEVEL',
      value: spice?.value?.replace(/^🌶️+\s*/, '') || 'Balanced Flavor',
      desc: 'Aromatic & Fresh'
    },
    {
      icon: '⏱️',
      label: freshness?.label || 'FRESHNESS',
      value: freshness?.value || 'Cooked to Order',
      desc: 'Delivered in 8 mins'
    },
  ];

  const remaining = attributes.filter(a =>
    !['Portion', 'Size', 'Weight', 'Volume', 'Dietary', 'Spice Level'].includes(a.label)
  );

  return { highlights, remaining };
}

export function getAttrIcon(label: string): string {
  const l = (label || '').toLowerCase();
  if (l.includes('prep') || l.includes('cook')) return '👨‍🍳';
  if (l.includes('accompaniment') || l.includes('dip') || l.includes('side')) return '🥣';
  if (l.includes('fresh') || l.includes('shelf')) return '⏱️';
  if (l.includes('pack') || l.includes('contain')) return '🛡️';
  if (l.includes('storage') || l.includes('chill')) return '❄️';
  if (l.includes('source') || l.includes('origin')) return '🌱';
  if (l.includes('kitchen') || l.includes('brand') || l.includes('bar')) return '🏪';
  if (l.includes('crust') || l.includes('cheese') || l.includes('patty') || l.includes('bun')) return '🍕';
  return '📌';
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
    verifiedShops: ['Campus Kirana', 'Campus SuperStore', 'Campus Mart'],
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
    verifiedShops: ['Campus Bakery', 'Campus Central Mart', 'Campus Kirana'],
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

  useEffect(() => {
    AsyncStorage.getItem('zenvy_wishlist').then(stored => {
      if (stored) {
        try {
          const ids = JSON.parse(stored);
          if (Array.isArray(ids) && ids.includes(cleanId)) {
            setIsWishlisted(true);
          }
        } catch (e) {}
      }
    });
  }, [cleanId]);

  const handleToggleWishlist = async () => {
    const nextState = !isWishlisted;
    setIsWishlisted(nextState);
    try {
      const stored = await AsyncStorage.getItem('zenvy_wishlist');
      let list: string[] = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(list)) list = [];
      if (nextState) {
        if (!list.includes(cleanId)) list.push(cleanId);
      } else {
        list = list.filter(id => id !== cleanId);
      }
      await AsyncStorage.setItem('zenvy_wishlist', JSON.stringify(list));
    } catch (e) {}
  };

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

            const foodImg = getFoodImage(data.name, data.category, data.imageUrl || data.image);
            const resolved = {
              id: data.id || data._id || cleanId,
              name: data.name || 'Zenvy Specialty Dish',
              price: data.price ?? 99,
              originalPrice: data.originalPrice ?? data.price,
              discount,
              weight: data.weight || data.quantity || '1 Serving',
              images: (data.images && data.images.length > 0 && data.images[0]) ? data.images.map((im: string) => getFoodImage(data.name, data.category, im)) : [foodImg],
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
            const cleanName = cleanId.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            const smartAttrs = generateSmartAttributes(cleanName);
            const crossSells = generateSmartCrossSells(cleanName);
            const foodImg = getFoodImage(cleanName);
            setProduct({
              id: cleanId,
              name: cleanName,
              price: 99,
              originalPrice: 120,
              discount: '18% OFF',
              weight: '1 Serving',
              images: [foodImg],
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

  if (loading) {
    return (
      <View style={[styles.loadingBox, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={{ marginTop: 12, fontSize: 11, fontWeight: '800', color: COLORS.inkMuted }}>
          SYNCHRONIZING DISH SPECS...
        </Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, padding: 24, justifyContent: 'center', alignItems: 'center' }]}>
        <TouchableOpacity
          style={{ position: 'absolute', top: Platform.OS === 'android' ? 44 : 54, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => router.back()}
        >
          <Text style={{ fontSize: 18, color: isDark ? '#FFF' : '#000' }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 44, marginBottom: 16 }}>🍱</Text>
        <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text, letterSpacing: 2, textAlign: 'center', marginBottom: 8 }}>
          DISH UNAVAILABLE
        </Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: 24, paddingHorizontal: 20 }}>
          This item is currently out of stock or rotated off the active kitchen menu.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: COLORS.red, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, ...SHADOWS.redGlow }}
          onPress={() => router.replace('/(tabs)' as any)}
        >
          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900', letterSpacing: 2 }}>EXPLORE CAMPUS MENU →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentCartItem = cart.find((i: any) => i.id === product.id || i.menuItemId === product.id);
  const qty = currentCartItem ? currentCartItem.quantity : 0;
  const currentPack = product.packSizes ? product.packSizes[selectedPackIndex] || product : product;
  const { highlights, remaining } = parseProductHighlights(product.attributes || [], product.isVegetarian);

  const handleShare = () => {
    Clipboard.setString(`Check out ${product.name} on Zenvy: https://zenvy.com/products/${product.id}`);
    Alert.alert('Link Copied', 'Product link copied to clipboard!');
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0B0C10' : '#F8FAFC' }]}>
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
              <SafeImage
                source={{ uri: item || getFoodImage(product?.name, product?.category) }}
                fallbackUri={getFoodImage(product?.name, product?.category)}
                style={[styles.galleryImage, { width: imgWidth || SW }]}
              />
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

            <TouchableOpacity style={styles.iconCircleBtn} onPress={handleToggleWishlist}>
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
        {/* ZONE 2 — CORE INFO SHEET (Swiggy / Zepto standard)                   */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <View style={[styles.coreInfoSheet, { backgroundColor: isDark ? '#141418' : '#FFFFFF' }]}>
          {/* Top Badges Row: Swiggy/Zepto Express Delivery, FSSAI Veg/Non-Veg, Rating */}
          <View style={styles.topBadgesRow}>
            {/* Express Delivery Badge */}
            <View style={styles.expressBadge}>
              <Text style={styles.expressBolt}>⚡</Text>
              <Text style={styles.expressText}>8 MINS DELIVERY</Text>
            </View>

            {/* Authentic FSSAI Veg / Non-Veg Badge */}
            <View style={[
              styles.fssaiBadge,
              product.isVegetarian ? styles.fssaiVegBadge : styles.fssaiNonVegBadge
            ]}>
              <View style={[
                styles.fssaiSquare,
                { borderColor: product.isVegetarian ? '#16A34A' : '#DC2626' }
              ]}>
                <View style={[
                  styles.fssaiCircle,
                  { backgroundColor: product.isVegetarian ? '#16A34A' : '#DC2626' }
                ]} />
              </View>
              <Text style={[
                styles.fssaiText,
                { color: product.isVegetarian ? '#15803D' : '#B91C1C' }
              ]}>
                {product.isVegetarian ? 'PURE VEG' : 'NON-VEG'}
              </Text>
            </View>

            {/* Gold Rating Pill */}
            <View style={styles.topRatingPill}>
              <Text style={styles.topRatingStar}>★</Text>
              <Text style={styles.topRatingScore}>{calculatedRating.toFixed(1)}</Text>
              <Text style={styles.topRatingCount}>({totalRatingCount}+)</Text>
            </View>
          </View>

          {/* Product Title */}
          <Text style={[styles.productNameTitle, { color: isDark ? '#FFF' : '#0F172A' }]}>
            {product.name}
          </Text>

          {/* Kitchen / Restaurant Brand Pill */}
          <View style={styles.kitchenStoreRow}>
            <Text style={{ fontSize: 13, marginRight: 4 }}>🏪</Text>
            <Text style={[styles.kitchenStoreName, { color: isDark ? '#CBD5E1' : '#334155' }]}>
              {product.restaurantName || 'Campus Central Kitchen'}
            </Text>
            <View style={styles.kitchenDot} />
            <Text style={styles.kitchenVerifiedText}>✓ FSSAI Verified</Text>
          </View>

          {/* Unit / Pack Size Selector */}
          {product.packSizes && product.packSizes.length > 1 && (
            <View style={styles.unitSelectorRow}>
              {product.packSizes.map((pack: any, index: number) => {
                const isSelected = selectedPackIndex === index;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.unitPill,
                      isDark ? styles.unitPillDark : styles.unitPillLight,
                      isSelected && styles.unitPillActive,
                    ]}
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

          {/* Pricing Row */}
          <View style={styles.priceContainerRow}>
            <Text style={[styles.priceCurrentBig, { color: isDark ? '#FFF' : '#0F172A' }]}>
              ₹{currentPack.price}
            </Text>
            {currentPack.originalPrice && currentPack.originalPrice > currentPack.price && (
              <Text style={styles.priceOriginalStrikethrough}>
                ₹{currentPack.originalPrice}
              </Text>
            )}
            {currentPack.discount && (
              <View style={styles.priceDiscountChip}>
                <Text style={styles.priceDiscountChipText}>{currentPack.discount}</Text>
              </View>
            )}
          </View>

          {/* Lowest Price Guarantee Trust Banner (BigBasket & Blinkit style) */}
          <TouchableOpacity
            style={[
              styles.priceGuaranteeCard,
              {
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#F0FDF4',
                borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#BBF7D0',
              },
            ]}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowShopsModal(true);
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={styles.shieldIconPill}>
                <Text style={{ fontSize: 14 }}>🛡️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.priceGuaranteeTitle}>Campus Lowest Price Guarantee</Text>
                <Text style={styles.priceGuaranteeSub}>Price matched across campus kitchens & stores</Text>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowShopsModal(true);
              }}
            >
              <Text style={styles.priceGuaranteeCompareLink}>Compare ›</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* ZONE 4 — HIGHLIGHTS MATRIX & CULINARY SPECS (Swiggy/Zepto/BigBasket) */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <View style={[styles.pdpSectionBox, { backgroundColor: isDark ? '#141418' : '#FFFFFF' }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.pdpSectionTitle, { color: isDark ? '#FFF' : '#0F172A' }]}>
                Product Information
              </Text>
              <Text style={styles.sectionSub}>Authentic culinary preparation & nutrition</Text>
            </View>
            <View style={styles.chefHatPill}>
              <Text style={styles.chefHatPillText}>👨‍🍳 Kitchen Fresh</Text>
            </View>
          </View>

          {/* Description with comfortable typography */}
          <Text
            style={[styles.pdpDescriptionText, { color: isDark ? '#94A3B8' : '#475569' }]}
            numberOfLines={descExpanded ? undefined : 3}
          >
            {product.description}
          </Text>
          <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)} style={styles.readMoreTouch}>
            <Text style={styles.readMoreLink}>
              {descExpanded ? 'Show less ▴' : 'Read full culinary notes ▾'}
            </Text>
          </TouchableOpacity>

          {/* 4-Card Highlights Matrix (Zepto & Swiggy standard) */}
          <View style={styles.highlightsGrid}>
            {highlights.map((h: any, i: number) => (
              <View
                key={i}
                style={[
                  styles.highlightCard,
                  {
                    backgroundColor: isDark ? '#1A1D24' : '#F8FAFC',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                  },
                ]}
              >
                <View style={styles.highlightIconCircle}>
                  <Text style={{ fontSize: 16 }}>{h.icon}</Text>
                </View>
                <Text style={styles.highlightLabel}>{h.label}</Text>
                <Text
                  style={[styles.highlightValue, { color: isDark ? '#FFF' : '#0F172A' }]}
                  numberOfLines={1}
                >
                  {h.value}
                </Text>
                <Text style={styles.highlightDesc} numberOfLines={1}>
                  {h.desc}
                </Text>
              </View>
            ))}
          </View>

          {/* Detailed Culinary Specs Card (Zomato & BigBasket standard) */}
          {remaining.length > 0 && (
            <View
              style={[
                styles.specsCard,
                {
                  backgroundColor: isDark ? '#1A1D24' : '#FAFAFA',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                },
              ]}
            >
              <Text style={[styles.specsCardTitle, { color: isDark ? '#CBD5E1' : '#334155' }]}>
                CULINARY & PACKAGING DETAILS
              </Text>
              {remaining.map((attr: any, idx: number) => (
                <View
                  key={idx}
                  style={[
                    styles.specItemRow,
                    idx < remaining.length - 1 && styles.specItemBorder,
                    { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0' },
                  ]}
                >
                  <View style={styles.specIconBadge}>
                    <Text style={{ fontSize: 13 }}>{getAttrIcon(attr.label)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.specLabel}>{attr.label}</Text>
                    <Text style={[styles.specValue, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>
                      {attr.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* ZONE 5 — OFTEN BOUGHT TOGETHER (Swiggy Cross-Sell Cards)             */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <View style={[styles.pdpSectionBox, { backgroundColor: isDark ? '#141418' : '#FFFFFF' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <View>
              <Text style={[styles.pdpSectionTitle, { color: isDark ? '#FFF' : '#0F172A', marginBottom: 2 }]}>
                Often bought together
              </Text>
              <Text style={styles.sectionSub}>Pairs perfectly with this dish</Text>
            </View>
            <View style={styles.popularBadge}>
              <Text style={styles.popularBadgeText}>🔥 TOP PAIRINGS</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
            {(product.crossSells || []).map((rel: any) => {
              const inCart = cart.find((i: any) => i.id === rel.id || i.menuItemId === rel.id);
              const relQty = inCart ? inCart.quantity : 0;
              return (
                <View
                  key={rel.id}
                  style={[
                    styles.pairingCard,
                    {
                      backgroundColor: isDark ? '#1A1D24' : '#FFFFFF',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                    },
                  ]}
                >
                  <View style={styles.pairingImgContainer}>
                    <Image source={{ uri: rel.image }} style={styles.pairingImg} />
                    <View style={styles.pairingTagBadge}>
                      <Text style={styles.pairingTagText}>
                        {rel.tag === 'Beverage' ? '🥤 DRINK' : rel.tag === 'Starter' ? '🍗 STARTER' : rel.tag === 'Dessert' ? '🍮 SWEET' : '🥗 SIDE'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.pairingContent}>
                    <Text
                      style={[styles.pairingTitle, { color: isDark ? '#FFF' : '#0F172A' }]}
                      numberOfLines={2}
                    >
                      {rel.name}
                    </Text>

                    <View style={styles.pairingFooterRow}>
                      <Text style={[styles.pairingPrice, { color: isDark ? '#FFF' : '#0F172A' }]}>
                        ₹{rel.price}
                      </Text>

                      {relQty === 0 ? (
                        <TouchableOpacity
                          style={styles.pairingAddBtn}
                          activeOpacity={0.8}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            handleSafeAddToCart({
                              id: rel.id,
                              name: rel.name,
                              price: rel.price,
                              image: rel.image,
                              restaurantId: product.restaurantId || 'market-hub',
                              restaurantName: product.restaurantName || 'Campus Mart',
                            }, `${rel.name} added!`);
                          }}
                        >
                          <Text style={styles.pairingAddBtnText}>ADD +</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.pairingMiniStepper}>
                          <TouchableOpacity
                            style={styles.pairingMiniStepBtn}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              updateQuantity(rel.id, relQty - 1);
                            }}
                          >
                            <Text style={styles.pairingMiniStepText}>–</Text>
                          </TouchableOpacity>
                          <Text style={styles.pairingMiniStepVal}>{relQty}</Text>
                          <TouchableOpacity
                            style={styles.pairingMiniStepBtn}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              handleSafeAddToCart({
                                id: rel.id,
                                name: rel.name,
                                price: rel.price,
                                image: rel.image,
                                restaurantId: product.restaurantId || 'market-hub',
                                restaurantName: product.restaurantName || 'Campus Mart',
                              });
                            }}
                          >
                            <Text style={styles.pairingMiniStepText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
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
                    <View style={{ width: (b.pct as any), height: '100%', backgroundColor: b.star >= 4 ? '#22C55E' : b.star === 3 ? '#F59E0B' : '#EF4444', borderRadius: 3 }} />
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
      {/* ZONE 3 — STICKY BOTTOM ACTION BAR (Zepto & Swiggy Standard)            */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <View
        style={[
          styles.stickyBottomBar,
          {
            backgroundColor: isDark ? '#111317' : '#FFFFFF',
            borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          },
        ]}
      >
        {qty === 0 ? (
          <>
            {/* Left Price Breakdown */}
            <View style={styles.bottomPriceCol}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={[styles.bottomPriceBig, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  ₹{currentPack.price}
                </Text>
                {currentPack.originalPrice && (
                  <Text style={styles.bottomPriceStrikethrough}>₹{currentPack.originalPrice}</Text>
                )}
              </View>
              <Text style={styles.bottomPriceSub}>Inclusive of taxes & pack</Text>
            </View>

            {/* Right Emerald Gradient Add CTA */}
            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.bottomAddCtaBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleSafeAddToCart({
                  id: product.id,
                  name: product.name,
                  price: currentPack.price,
                  image: product.image || product.images?.[0] || '',
                  restaurantId: product.restaurantId || 'market-hub',
                  restaurantName: product.verifiedShops?.[0] || product.restaurantName || 'Campus Mart',
                });
              }}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.bottomCtaGradient}
              >
                <Text style={styles.bottomAddCtaText}>ADD TO BASKET</Text>
                <Text style={styles.bottomAddPlusText}>+</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Active Stepper on Left */}
            <View
              style={[
                styles.activeStepperPill,
                {
                  backgroundColor: isDark ? '#1E232B' : '#F1F5F9',
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#10B981',
                },
              ]}
            >
              <TouchableOpacity
                style={styles.activeStepperBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (qty > 1) {
                    updateQuantity(product.id, qty - 1);
                  } else {
                    updateQuantity(product.id, 0);
                  }
                }}
              >
                <Text style={styles.activeStepperBtnText}>–</Text>
              </TouchableOpacity>
              <Text style={[styles.activeStepperCountText, { color: isDark ? '#FFF' : '#0F172A' }]}>
                {qty}
              </Text>
              <TouchableOpacity
                style={styles.activeStepperBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleSafeAddToCart({
                    id: product.id,
                    name: product.name,
                    price: currentPack.price,
                    image: product.image || product.images?.[0] || '',
                    restaurantId: product.restaurantId || 'market-hub',
                    restaurantName: product.verifiedShops?.[0] || product.restaurantName || 'Campus Mart',
                  });
                }}
              >
                <Text style={styles.activeStepperBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {/* View Basket Button with Live Subtotal */}
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.bottomViewCartBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(tabs)/basket' as any);
              }}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.bottomCtaGradient}
              >
                <View>
                  <Text style={styles.bottomCartTotalLabel}>{qty} ITEM{qty > 1 ? 'S' : ''}</Text>
                  <Text style={styles.bottomCartTotalVal}>₹{qty * currentPack.price}</Text>
                </View>
                <Text style={styles.bottomViewCartText}>View Basket ›</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
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
              placeholderTextColor={isDark ? COLORS.textMuted : '#9CA3AF'}
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

      {/* ── BigBasket / Blinkit Campus Price Comparison Modal ── */}
      <Modal
        visible={showShopsModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowShopsModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowShopsModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.modalCard,
              {
                backgroundColor: isDark ? '#14171F' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                borderWidth: 1,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={[styles.shieldIconPill, { width: 34, height: 34, borderRadius: 17 }]}>
                <Text style={{ fontSize: 18 }}>🛡️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: isDark ? '#FFF' : '#0F172A', marginBottom: 2 }]}>
                  Campus Price Match
                </Text>
                <Text style={[styles.modalSub, { color: isDark ? '#94A3B8' : '#64748B', marginBottom: 0 }]}>
                  Live prices matched across campus dining spots
                </Text>
              </View>
            </View>

            {/* Savings Banner */}
            <View style={[styles.modalSavingsBanner, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5', borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0' }]}>
              <Text style={{ fontSize: 14 }}>✨</Text>
              <Text style={[styles.modalSavingsText, { color: isDark ? '#6EE7B7' : '#047857' }]}>
                You get the <Text style={{ fontWeight: '900' }}>lowest verified price</Text> on this item today!
              </Text>
            </View>

            {/* Comparison Rows */}
            <View style={{ marginVertical: 12, gap: 8 }}>
              {/* Row 1: Active Outlet (Best Price) */}
              <View style={[styles.comparisonRow, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#F0FDF4', borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#86EFAC', borderWidth: 1 }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.comparisonStoreName, { color: isDark ? '#FFF' : '#0F172A', fontWeight: '900' }]}>
                      🏪 {product.restaurantName || product.verifiedShops?.[0] || 'Selected Kitchen'}
                    </Text>
                    <View style={styles.bestPriceBadge}>
                      <Text style={styles.bestPriceBadgeText}>BEST PRICE</Text>
                    </View>
                  </View>
                  <Text style={styles.comparisonDeliveryNote}>Instant 8-min hostel room delivery</Text>
                </View>
                <Text style={[styles.comparisonPriceActive, { color: '#059669' }]}>₹{currentPack.price}</Text>
              </View>

              {/* Row 2: Central Food Court */}
              <View style={[styles.comparisonRow, { backgroundColor: isDark ? '#1C2029' : '#F8FAFC', borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0', borderWidth: 1 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.comparisonStoreName, { color: isDark ? '#CBD5E1' : '#334155' }]}>
                    🏢 Central Food Court
                  </Text>
                  <Text style={styles.comparisonDeliveryNote}>Dine-in counter price</Text>
                </View>
                <Text style={[styles.comparisonPriceOther, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  ₹{Math.round(currentPack.price * 1.08)}
                </Text>
              </View>

              {/* Row 3: Campus Night Canteen */}
              <View style={[styles.comparisonRow, { backgroundColor: isDark ? '#1C2029' : '#F8FAFC', borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0', borderWidth: 1 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.comparisonStoreName, { color: isDark ? '#CBD5E1' : '#334155' }]}>
                    🌙 Campus Night Canteen
                  </Text>
                  <Text style={styles.comparisonDeliveryNote}>Standard night tariff</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.comparisonPriceOther, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    ₹{currentPack.price}
                  </Text>
                  <Text style={{ fontSize: 9, color: '#10B981', fontWeight: '800' }}>MATCHED</Text>
                </View>
              </View>

              {/* Row 4: Tuck Shop & Retail */}
              <View style={[styles.comparisonRow, { backgroundColor: isDark ? '#1C2029' : '#F8FAFC', borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0', borderWidth: 1 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.comparisonStoreName, { color: isDark ? '#CBD5E1' : '#334155' }]}>
                    🛒 Campus Tuck Shop
                  </Text>
                  <Text style={styles.comparisonDeliveryNote}>Printed counter rate</Text>
                </View>
                <Text style={[styles.comparisonPriceOther, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  ₹{Math.round(currentPack.price * 1.12)}
                </Text>
              </View>
            </View>

            {/* Bottom Guarantee Trust Note */}
            <Text style={[styles.modalGuaranteeFooterText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              🛡️ If you ever spot a lower verified in-store rate anywhere on campus, we match it and refund 2x the difference instantly.
            </Text>

            {/* Done CTA */}
            <TouchableOpacity
              style={styles.modalClosePrimaryBtn}
              activeOpacity={0.88}
              onPress={() => setShowShopsModal(false)}
            >
              <Text style={styles.modalClosePrimaryBtnText}>Got it, Thanks!</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}



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
  // ZONE 2: TOP BADGES & CORE INFO
  topBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  expressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  expressBolt: {
    fontSize: 10,
    color: '#B45309',
  },
  expressText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#92400E',
    letterSpacing: 0.3,
  },
  fssaiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 5,
    borderWidth: 1,
    gap: 5,
  },
  fssaiVegBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderColor: '#22C55E',
  },
  fssaiNonVegBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: '#EF4444',
  },
  fssaiSquare: {
    width: 13,
    height: 13,
    borderWidth: 1.5,
    borderRadius: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fssaiCircle: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
  },
  fssaiText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  topRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 6,
    gap: 4,
  },
  topRatingStar: {
    fontSize: 10,
  },
  topRatingScore: {
    fontSize: 10,
    fontWeight: '900',
    color: '#D97706',
  },
  topRatingCount: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B45309',
  },
  productNameTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
    lineHeight: 28,
    marginBottom: 4,
  },
  kitchenStoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  kitchenStoreName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  kitchenDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94A3B8',
  },
  kitchenVerifiedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
  },
  unitSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  unitPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  unitPillLight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  unitPillDark: {
    backgroundColor: '#1E232B',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  unitPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  unitPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  unitPillTextActive: {
    color: '#FFFFFF',
  },
  priceContainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  priceCurrentBig: {
    fontSize: 26,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  priceOriginalStrikethrough: {
    fontSize: 15,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    fontVariant: ['tabular-nums'],
  },
  priceDiscountChip: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priceDiscountChipText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#DC2626',
    letterSpacing: 0.2,
  },
  priceGuaranteeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  shieldIconPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceGuaranteeTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#047857',
    letterSpacing: 0.1,
  },
  priceGuaranteeSub: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#065F46',
    marginTop: 1,
  },
  priceGuaranteeCompareLink: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },

  // ZONE 4: DETAILS, HIGHLIGHTS MATRIX & CULINARY SPECS
  pdpSectionBox: {
    marginTop: 10,
    padding: 18,
    borderRadius: 16,
    ...SHADOWS.cardElevated,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  pdpSectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  chefHatPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chefHatPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  pdpDescriptionText: {
    fontSize: 12.5,
    lineHeight: 19,
    letterSpacing: 0.1,
  },
  readMoreTouch: {
    marginTop: 4,
    marginBottom: 14,
  },
  readMoreLink: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  highlightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  highlightCard: {
    width: '48.5%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  highlightIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  highlightLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  highlightValue: {
    fontSize: 12.5,
    fontWeight: '900',
    marginTop: 2,
  },
  highlightDesc: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  specsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  specsCardTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  specItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  specItemBorder: {
    borderBottomWidth: 1,
  },
  specIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  specLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  specValue: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 1,
  },

  // ZONE 5: OFTEN BOUGHT TOGETHER (SWIGGY PAIRING CARDS)
  popularBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  popularBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#DC2626',
    letterSpacing: 0.4,
  },
  pairingCard: {
    width: 142,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    ...SHADOWS.cardElevated,
  },
  pairingImgContainer: {
    position: 'relative',
    width: '100%',
    height: 96,
  },
  pairingImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  pairingTagBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pairingTagText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.3,
  },
  pairingContent: {
    padding: 10,
  },
  pairingTitle: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
    minHeight: 30,
    marginBottom: 6,
  },
  pairingFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pairingPrice: {
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  pairingAddBtn: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pairingAddBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.3,
  },
  pairingMiniStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
    gap: 6,
  },
  pairingMiniStepBtn: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairingMiniStepText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFF',
  },
  pairingMiniStepVal: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFF',
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

  // STICKY BOTTOM BAR (ZEPTO & SWIGGY STANDARD)
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    ...SHADOWS.cardElevated,
    zIndex: 100,
  },
  bottomPriceCol: {
    justifyContent: 'center',
  },
  bottomPriceBig: {
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  bottomPriceStrikethrough: {
    fontSize: 13,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    fontVariant: ['tabular-nums'],
  },
  bottomPriceSub: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  bottomAddCtaBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    ...SHADOWS.cardElevated,
  },
  bottomCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  bottomAddCtaText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  bottomAddPlusText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  activeStepperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 12,
  },
  activeStepperBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeStepperBtnText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#10B981',
  },
  activeStepperCountText: {
    fontSize: 15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    minWidth: 18,
    textAlign: 'center',
  },
  bottomViewCartBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    ...SHADOWS.cardElevated,
  },
  bottomCartTotalLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
  },
  bottomCartTotalVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  bottomViewCartText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
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
  modalSavingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 4,
  },
  modalSavingsText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  comparisonStoreName: {
    fontSize: 12,
  },
  bestPriceBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bestPriceBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 0.3,
  },
  comparisonDeliveryNote: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  comparisonPriceActive: {
    fontSize: 15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  comparisonPriceOther: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  modalGuaranteeFooterText: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  modalClosePrimaryBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.cardElevated,
  },
  modalClosePrimaryBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  compareBtnPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modalCloseBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
