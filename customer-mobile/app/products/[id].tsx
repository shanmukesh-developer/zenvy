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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SHADOWS, RADIUS } from '../../constants/theme';
import { useCart } from '../../context/CartContext';
import { apiFetch } from '../../utils/auth';
import { useTheme } from '../../context/ThemeContext';
import AdSlot from '../../components/AdSlot';

const { width: SW } = Dimensions.get('window');

// ── Master Product Details Resolver ──────────────────────────────────────────
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
    ratingCount: 6802,
    verifiedShops: ['Campus Kirana', 'Campus SuperStore', 'SRM Mart'],
    packSizes: [
      { size: '1 L', price: 88, originalPrice: 115, discount: '23% OFF' },
      { size: '200 ml', price: 20, originalPrice: 25, discount: '20% OFF' },
    ],
    attributes: [
      { label: 'Brand', value: 'B Natural' },
      { label: 'Weight', value: '1 L' },
      { label: 'Shelf Life', value: '6 Months' },
      { label: 'Country of Origin', value: 'India' },
      { label: 'Return Policy', value: '24-hour hassle-free replacement' },
    ],
    reviews: [
      { id: '1', name: 'Alex M.', rating: 5, time: 'Yesterday', comment: 'Always fresh and soft. Perfect for morning toast before class!' },
      { id: '2', name: 'Jamie T.', rating: 4, time: '3 days ago', comment: 'Good taste, very refreshing guava flavor.' },
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
    attributes: [
      { label: 'Brand', value: 'Campus Bakery' },
      { label: 'Weight', value: '400g' },
      { label: 'Shelf Life', value: '5 Days' },
      { label: 'Country of Origin', value: 'India' },
      { label: 'Return Policy', value: 'Same-day freshness replacement' },
    ],
    reviews: [
      { id: '1', name: 'Alex M.', rating: 5, time: 'Yesterday', comment: 'Always fresh and soft. Perfect for morning toast before class. Delivery was super fast too.' },
      { id: '2', name: 'Jamie T.', rating: 4, time: '3 days ago', comment: 'Good bread, but slightly smaller loaf than expected. Taste is great though.' },
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
    attributes: [
      { label: 'Origin', value: 'Washington / Shimla' },
      { label: 'Shelf Life', value: '7 Days' },
      { label: 'Storage', value: 'Refrigerate below 8°C' },
    ],
    reviews: [{ id: '1', name: 'Rohan K.', rating: 5, time: 'Today', comment: 'Super fresh apples!' }],
  },
  'fruit-banana': {
    id: 'fruit-banana',
    name: 'Robusta Banana',
    price: 49,
    originalPrice: 60,
    discount: '18% OFF',
    weight: '1 dozen',
    images: ['https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=800&q=80'],
    description: 'Naturally ripened fresh Robusta bananas. Rich in potassium and instant energy.',
    rating: 4.6,
    ratingCount: 520,
    verifiedShops: ['Fresho Fruit Hub', 'SRM Mart'],
    packSizes: [{ size: '1 dozen', price: 49, originalPrice: 60, discount: '18% OFF' }],
    attributes: [{ label: 'Origin', value: 'Local Farm' }, { label: 'Shelf Life', value: '3 Days' }],
    reviews: [{ id: '1', name: 'Priya S.', rating: 5, time: 'Yesterday', comment: 'Perfect pre-workout snack!' }],
  },
  'fruit-mango': {
    id: 'fruit-mango',
    name: 'Alphonso Mango',
    price: 299,
    originalPrice: 450,
    discount: '33% OFF',
    weight: '1 kg (3-4 pcs)',
    images: ['https://images.unsplash.com/photo-1553279768-865429fa0078?w=800&q=80'],
    description: 'King of Mangoes — premium Ratnagiri Alphonso. Sweet, aromatic, and rich pulp.',
    rating: 4.9,
    ratingCount: 180,
    verifiedShops: ['Campus Organic Store', 'Campus Kirana'],
    packSizes: [{ size: '1 kg', price: 299, originalPrice: 450, discount: '33% OFF' }],
    attributes: [{ label: 'Origin', value: 'Ratnagiri' }, { label: 'Shelf Life', value: '4 Days' }],
    reviews: [{ id: '1', name: 'Vikram P.', rating: 5, time: '2 days ago', comment: 'Unbelievably sweet!' }],
  },
  'fruit-grapes': {
    id: 'fruit-grapes',
    name: 'Thompson Green Grapes',
    price: 89,
    originalPrice: 120,
    discount: '26% OFF',
    weight: '500 g',
    images: ['https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=800&q=80'],
    description: 'Seedless Thompson green grapes fresh from Nashik vineyards. Crisp, juicy, and naturally sweet.',
    rating: 4.7,
    ratingCount: 210,
    verifiedShops: ['Fresho Fruit Hub', 'Campus Organic Store'],
    packSizes: [{ size: '500 g', price: 89, originalPrice: 120, discount: '26% OFF' }],
    attributes: [{ label: 'Origin', value: 'Nashik' }, { label: 'Shelf Life', value: '5 Days' }],
    reviews: [{ id: '1', name: 'Ananya M.', rating: 5, time: '3 days ago', comment: 'Very sweet seedless grapes!' }],
  },
  'fruit-pomegranate': {
    id: 'fruit-pomegranate',
    name: 'Pomegranate Premium',
    price: 179,
    originalPrice: 220,
    discount: '19% OFF',
    weight: '1 kg (3-4 pcs)',
    images: ['https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=800&q=80'],
    description: 'Deep red, ruby arils bursting with antioxidants and rich juice.',
    rating: 4.8,
    ratingCount: 195,
    verifiedShops: ['Fresho Fruit Hub'],
    packSizes: [{ size: '1 kg', price: 179, originalPrice: 220, discount: '19% OFF' }],
    attributes: [{ label: 'Origin', value: 'Solapur' }, { label: 'Shelf Life', value: '10 Days' }],
    reviews: [{ id: '1', name: 'Rahul V.', rating: 5, time: 'Yesterday', comment: 'Juicy and sweet red seeds!' }],
  },
  'fruit-orange': {
    id: 'fruit-orange',
    name: 'Nagpur Orange',
    price: 69,
    originalPrice: 90,
    discount: '23% OFF',
    weight: '1 kg (5-6 pcs)',
    images: ['https://images.unsplash.com/photo-1547514701-42782101795e?w=800&q=80'],
    description: 'Authentic Nagpur mandarins. Juicy, tangy, and loaded with Vitamin C.',
    rating: 4.6,
    ratingCount: 140,
    verifiedShops: ['Campus Organic Store'],
    packSizes: [{ size: '1 kg', price: 69, originalPrice: 90, discount: '23% OFF' }],
    attributes: [{ label: 'Origin', value: 'Nagpur' }, { label: 'Shelf Life', value: '6 Days' }],
    reviews: [{ id: '1', name: 'Dev R.', rating: 5, time: 'Today', comment: 'Great vitamin C booster!' }],
  },
  'dairy-milk': {
    id: 'dairy-milk',
    name: 'Amul Taaza Toned Milk',
    price: 27,
    originalPrice: 30,
    discount: '10% OFF',
    weight: '500 ml',
    images: ['https://images.unsplash.com/photo-1563636619-e9143da7973b?w=800&q=80'],
    description: 'Pasteurized toned milk fortified with Vitamin A & D. Delivered cold to your hostel doorstep.',
    rating: 4.9,
    ratingCount: 1200,
    verifiedShops: ['Amul Parlour', 'Campus Kirana', 'SRM Mart'],
    packSizes: [{ size: '500 ml', price: 27, originalPrice: 30, discount: '10% OFF' }],
    attributes: [{ label: 'Brand', value: 'Amul' }, { label: 'Fat Content', value: '3.0%' }],
    reviews: [{ id: '1', name: 'Karthik S.', rating: 5, time: 'Today', comment: 'Chilled delivery in 8 mins!' }],
  },
  'dairy-yogurt': {
    id: 'dairy-yogurt',
    name: 'Epigamia Greek Yogurt Blueberry',
    price: 55,
    originalPrice: 65,
    discount: '15% OFF',
    weight: '120 g',
    images: ['https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80'],
    description: 'High protein Greek yogurt infused with real blueberries. Zero preservatives.',
    rating: 4.8,
    ratingCount: 430,
    verifiedShops: ['Campus Organic Store'],
    packSizes: [{ size: '120 g', price: 55, originalPrice: 65, discount: '15% OFF' }],
    attributes: [{ label: 'Protein', value: '8g per cup' }],
    reviews: [{ id: '1', name: 'Megha D.', rating: 5, time: 'Yesterday', comment: 'My favorite post-workout snack!' }],
  },
  'snack-lays': {
    id: 'snack-lays',
    name: 'Lays Magic Masala Chips',
    price: 20,
    originalPrice: 20,
    weight: '50 g',
    images: ['https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=800&q=80'],
    description: 'Crispy potato chips seasoned with India’s favorite spicy magic masala.',
    rating: 4.9,
    ratingCount: 3500,
    verifiedShops: ['Campus Kirana', 'Campus Mart', 'Hostel Canteen'],
    packSizes: [{ size: '50 g', price: 20, originalPrice: 20, discount: '0%' }],
    attributes: [{ label: 'Brand', value: 'Lays' }],
    reviews: [{ id: '1', name: 'Siddharth T.', rating: 5, time: 'Today', comment: 'Classic late night snack!' }],
  },
  'pharmacy-paracetamol': {
    id: 'pharmacy-paracetamol',
    name: 'Dolo 650 Pain Relief Tablets',
    price: 32,
    originalPrice: 40,
    discount: '20% OFF',
    weight: '1 Strip (15 tabs)',
    images: ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80'],
    description: 'Paracetamol 650mg tablets for effective fever and body pain relief. Verified medical express item.',
    rating: 5.0,
    ratingCount: 890,
    verifiedShops: ['24/7 Campus Pharmacy'],
    packSizes: [{ size: '1 Strip (15 tabs)', price: 32, originalPrice: 40, discount: '20% OFF' }],
    attributes: [{ label: 'Dosage', value: '650 mg' }, { label: 'Rx Required', value: 'No' }],
    reviews: [{ id: '1', name: 'Rohan N.', rating: 5, time: 'Yesterday', comment: 'Saved me during fever night!' }],
  },
  'stationery-pens': {
    id: 'stationery-pens',
    name: 'Pilot Gel Pens Set (Blue & Black)',
    price: 160,
    originalPrice: 200,
    discount: '20% OFF',
    weight: 'Pack of 4',
    images: ['https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800&q=80'],
    description: 'Smooth liquid ink gel pens for exam writing and note taking. Quick dry water-resistant ink.',
    rating: 4.9,
    ratingCount: 670,
    verifiedShops: ['Campus Stationery Mart'],
    packSizes: [{ size: 'Pack of 4', price: 160, originalPrice: 200, discount: '20% OFF' }],
    attributes: [{ label: 'Ink Color', value: '2 Blue + 2 Black' }, { label: 'Tip Size', value: '0.5 mm' }],
    reviews: [{ id: '1', name: 'Divya M.', rating: 5, time: '2 days ago', comment: 'Best pens for exam hall!' }],
  },
  'bb-carrot': {
    id: 'bb-carrot',
    name: 'Carrot - Fresh Local Harvest',
    price: 39,
    originalPrice: 56,
    discount: '30% OFF',
    weight: '500 g',
    images: [
      'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=800&q=80',
    ],
    description:
      'Fresh, crunchy, and locally sourced carrots. Rich in Beta-Carotene and Vitamin A. Perfect for healthy snacks, salads, or cooking.',
    rating: 4.5,
    ratingCount: 148,
    verifiedShops: ['Fresho Farm Hub', 'Campus Organic Store'],
    packSizes: [
      { size: '500 g', price: 39, originalPrice: 56, discount: '30% OFF' },
      { size: '1 kg', price: 74, originalPrice: 112, discount: '34% OFF' },
    ],
    attributes: [
      { label: 'Brand', value: 'Fresho' },
      { label: 'Weight', value: '500 g' },
      { label: 'Shelf Life', value: '7 Days' },
      { label: 'Country of Origin', value: 'India' },
      { label: 'Return Policy', value: 'Quality check at door' },
    ],
    reviews: [
      { id: '1', name: 'Sneha R.', rating: 5, time: '2 days ago', comment: 'Super crunchy and juicy carrots!' },
    ],
  },
};

const RELATED_PRODUCTS = [
  {
    id: 'snack-pack-apple',
    name: 'Morning Snack Pack',
    price: 65,
    image: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=400&q=80',
  },
  {
    id: 'drink-redbull',
    name: 'Red Bull Energy Drink',
    price: 125,
    image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=400&q=80',
  },
  {
    id: 'notebook-ruled',
    name: 'Ruled Notebooks (Set of 3)',
    price: 129,
    image: 'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=400&q=80',
  },
];

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const cleanId = (Array.isArray(id) ? id[0] : id || '').replace(/\/$/, '');

  const { cart, addToCart, updateQuantity } = useCart();
  const { isDark, colors } = useTheme();

  const [product, setProduct] = useState<any>(null);
  const [selectedPackIndex, setSelectedPackIndex] = useState(0);
  const [showShopsModal, setShowShopsModal] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    // Resolve product from MASTER_PDP_DATA or fallback
    const resolved = MASTER_PDP_DATA[cleanId] || {
      id: cleanId,
      name: cleanId.replace(/-/g, ' ').toUpperCase(),
      price: 99,
      originalPrice: 120,
      discount: '18% OFF',
      weight: '1 pc',
      images: ['https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80'],
      description: 'High-quality daily essential item delivered directly to your room on campus.',
      rating: 4.5,
      ratingCount: 84,
      verifiedShops: ['Campus Kirana', 'Campus Mart'],
      packSizes: [{ size: '1 pc', price: 99, originalPrice: 120, discount: '18% OFF' }],
      attributes: [
        { label: 'Brand', value: 'Zenvy Premium' },
        { label: 'Weight', value: '1 pc' },
        { label: 'Shelf Life', value: '30 Days' },
        { label: 'Country of Origin', value: 'India' },
        { label: 'Return Policy', value: '24-hour replacement' },
      ],
      reviews: [
        { id: '1', name: 'Campus Resident', rating: 5, time: 'Today', comment: 'Delivered in 8 mins!' },
      ],
    };
    setProduct(resolved);
  }, [cleanId]);

  if (!product) {
    return (
      <View style={[styles.loadingBox, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={COLORS.red} />
      </View>
    );
  }

  const currentCartItem = cart.find((i: any) => i.id === product.id || i.menuItemId === product.id);
  const qty = currentCartItem ? currentCartItem.quantity : 0;
  const currentPack = product.packSizes ? product.packSizes[selectedPackIndex] || product : product;

  const handleShare = () => {
    Clipboard.setString(`Check out ${product.name} on Zenvy Campus Store: https://zenvy.com/products/${product.id}`);
    Alert.alert('Link Copied', 'Product link copied to clipboard!');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* ZONE 1 — IMAGE GALLERY (1:1 Full-Width Swipeable Carousel)            */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <View style={styles.imageGalleryContainer}>
          <FlatList
            data={product.images || [product.image]}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
              setActiveImgIndex(idx);
            }}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.galleryImage} />
            )}
          />

          {/* Floating Top Nav Actions */}
          <View style={styles.galleryTopNav}>
            <TouchableOpacity style={styles.iconCircleBtn} onPress={() => router.back()}>
              <Text style={styles.iconCircleText}>‹</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.iconCircleBtn} onPress={handleShare}>
                <Text style={{ fontSize: 16 }}>📤</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconCircleBtn} onPress={() => setIsWishlisted(!isWishlisted)}>
                <Text style={{ fontSize: 16 }}>{isWishlisted ? '❤️' : '🤍'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Discount Ribbon top-left over image */}
          {currentPack.discount && (
            <View style={styles.galleryDiscountRibbon}>
              <Text style={styles.galleryDiscountText}>{currentPack.discount}</Text>
            </View>
          )}

          {/* Carousel Dot Indicators */}
          {(product.images?.length > 1) && (
            <View style={styles.dotRow}>
              {product.images.map((_: any, i: number) => (
                <View
                  key={i}
                  style={[styles.dot, i === activeImgIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}
        </View>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* ZONE 2 — CORE INFO SHEET (Rounded top corners overlapping image)      */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <View style={styles.coreInfoSheet}>
          {/* Delivery estimate row */}
          <View style={styles.deliveryEstimateRow}>
            <View style={styles.arrivesPill}>
              <Text style={styles.arrivesPillText}>⏱ Arrives in 8 mins</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.productNameTitle}>{product.name}</Text>

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
            <Text style={styles.priceCurrentBig}>₹{currentPack.price}</Text>
            {currentPack.originalPrice && (
              <Text style={styles.priceOriginalStrikethrough}>₹{currentPack.originalPrice}</Text>
            )}
            {currentPack.discount && (
              <View style={styles.priceDiscountChip}>
                <Text style={styles.priceDiscountChipText}>{currentPack.discount}</Text>
              </View>
            )}
          </View>

          {/* Verified Price Green Chip */}
          {product.verifiedShops && product.verifiedShops.length > 0 && (
            <TouchableOpacity
              style={styles.verifiedPriceChip}
              activeOpacity={0.8}
              onPress={() => setShowShopsModal(true)}
            >
              <Text style={styles.verifiedPriceChipText}>
                ✓ Verified price — matched across {product.verifiedShops.length} campus shops
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* ZONE 4 — DESCRIPTION & DETAILS TABLE                                 */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <View style={styles.pdpSectionBox}>
          <Text style={styles.pdpSectionTitle}>About this product</Text>
          <Text
            style={styles.pdpDescriptionText}
            numberOfLines={descExpanded ? undefined : 3}
          >
            {product.description}
          </Text>
          <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)}>
            <Text style={styles.readMoreLink}>{descExpanded ? 'Show less' : 'Read more'}</Text>
          </TouchableOpacity>

          {/* Attributes Table */}
          {product.attributes && (
            <View style={styles.attributesTable}>
              {product.attributes.map((attr: any, idx: number) => (
                <View key={idx} style={styles.attributeRow}>
                  <Text style={styles.attrLabel}>{attr.label}</Text>
                  <Text style={styles.attrVal}>{attr.value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* ZONE 5 — OFTEN BOUGHT TOGETHER RAIL                                  */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <View style={styles.pdpSectionBox}>
          <Text style={styles.pdpSectionTitle}>Often bought together</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {RELATED_PRODUCTS.map((rel) => (
              <TouchableOpacity
                key={rel.id}
                style={styles.relatedMiniCard}
                activeOpacity={0.88}
                onPress={() => router.push(`/products/${rel.id}` as any)}
              >
                <Image source={{ uri: rel.image }} style={styles.relatedImg} />
                <Text style={styles.relatedTitle} numberOfLines={1}>
                  {rel.name}
                </Text>
                <View style={styles.relatedPriceRow}>
                  <Text style={styles.relatedPrice}>₹{rel.price}</Text>
                  <TouchableOpacity
                    style={sMiniPlusBtn}
                    onPress={() =>
                      addToCart({
                        id: rel.id,
                        name: rel.name,
                        price: rel.price,
                        image: rel.image,
                        restaurantId: 'market-hub',
                        restaurantName: 'Campus Mart',
                      })
                    }
                  >
                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#FFF' }}>+</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* ZONE 6 — RATINGS & REVIEWS                                            */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <View style={styles.pdpSectionBox}>
          <View style={styles.ratingsHeaderRow}>
            <View>
              <Text style={styles.ratingNumber}>{product.rating || '4.5'}</Text>
              <Text style={styles.ratingStars}>⭐⭐⭐⭐⭐</Text>
              <Text style={styles.ratingCountText}>{product.ratingCount || 42} reviews</Text>
            </View>
          </View>

          {/* Snippets */}
          {product.reviews?.map((rev: any) => (
            <View key={rev.id} style={styles.reviewCard}>
              <View style={styles.reviewUserRow}>
                <Text style={styles.reviewUserName}>{rev.name}</Text>
                <Text style={styles.reviewTime}>{rev.time}</Text>
              </View>
              <Text style={{ fontSize: 10, color: COLORS.accent, marginBottom: 4 }}>{'⭐'.repeat(rev.rating)}</Text>
              <Text style={styles.reviewComment}>{rev.comment}</Text>
            </View>
          ))}

          <TouchableOpacity style={styles.seeAllReviewsBtn}>
            <Text style={styles.seeAllReviewsText}>See all {product.ratingCount || 42} reviews</Text>
          </TouchableOpacity>
        </View>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* ZONE 7 — SPONSORED AD SLOT                                            */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <View style={{ paddingHorizontal: 16 }}>
          <AdSlot placement="pdp_footer" />
        </View>
      </ScrollView>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* ZONE 3 — STICKY BOTTOM BAR                                            */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <View style={styles.stickyBottomBar}>
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
              addToCart({
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
              addToCart({
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

      {/* Verified Shops Modal */}
      <Modal visible={showShopsModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>✓ Verified Campus Prices</Text>
            <Text style={styles.modalSub}>Price matched across these verified shops near your block:</Text>
            {product.verifiedShops?.map((shop: string, i: number) => (
              <View key={i} style={styles.shopRow}>
                <Text style={styles.shopName}>🏪 {shop}</Text>
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
  width: 24,
  height: 24,
  borderRadius: 12,
  backgroundColor: COLORS.primary,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ZONE 1: IMAGE GALLERY
  imageGalleryContainer: {
    width: SW,
    height: SW * 0.9,
    position: 'relative',
    backgroundColor: '#F8FAFC',
  },
  galleryImage: {
    width: SW,
    height: SW * 0.9,
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
  productNameTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.ink,
    lineHeight: 24,
    marginBottom: 12,
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
    backgroundColor: COLORS.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  priceDiscountChipText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.accent,
  },
  verifiedPriceChip: {
    backgroundColor: COLORS.trustSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  verifiedPriceChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.trust,
  },

  // PDP SECTIONS
  pdpSectionBox: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(20, 19, 31, 0.05)',
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
    width: 120,
    backgroundColor: '#FFF',
    borderRadius: RADIUS.lg,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(20, 19, 31, 0.06)',
    ...SHADOWS.cardElevated,
  },
  relatedImg: {
    width: '100%',
    height: 80,
    borderRadius: RADIUS.md,
    marginBottom: 6,
  },
  relatedTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.ink,
  },
  relatedPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  relatedPrice: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.ink,
    fontVariant: ['tabular-nums'],
  },

  // RATINGS & REVIEWS
  ratingsHeaderRow: {
    marginBottom: 12,
  },
  ratingNumber: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.ink,
  },
  ratingStars: {
    fontSize: 12,
    marginVertical: 2,
  },
  ratingCountText: {
    fontSize: 10,
    color: COLORS.inkMuted,
  },
  reviewCard: {
    backgroundColor: 'rgba(20, 19, 31, 0.03)',
    borderRadius: RADIUS.md,
    padding: 10,
    marginBottom: 10,
  },
  reviewUserRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  reviewUserName: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.ink,
  },
  reviewTime: {
    fontSize: 9,
    color: COLORS.inkMuted,
  },
  reviewComment: {
    fontSize: 11,
    color: COLORS.ink,
    lineHeight: 15,
  },
  seeAllReviewsBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    marginTop: 6,
  },
  seeAllReviewsText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.primary,
  },

  // STICKY BOTTOM BAR
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
    paddingHorizontal: 12,
    fontVariant: ['tabular-nums'],
  },
  primaryAddBasketBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    ...SHADOWS.cardElevated,
  },
  primaryAddBasketBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },

  // MODAL STYLES
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderRadius: RADIUS.xl,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.trust,
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 11,
    color: COLORS.inkMuted,
    marginBottom: 14,
  },
  shopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  shopName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
  },
  shopPrice: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.ink,
    fontVariant: ['tabular-nums'],
  },
  modalCloseBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    marginTop: 16,
  },
  modalCloseBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFF',
  },
});
