import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

const { width: SW } = Dimensions.get('window');

interface ServicePillar {
  id: string;
  icon: string;
  title: string;
  category: string;
  tagline: string;
  howToAccess: string;
  keyFeatures: string[];
  image: string;
  accentColor: string;
}

const CAMPUS_SERVICES_MAP: ServicePillar[] = [
  {
    id: 'food',
    icon: '🍔',
    title: 'Canteen & Food Delivery',
    category: 'FOOD & DINING',
    tagline: '15-Minute Doorstep Delivery to Hostel Rooms',
    howToAccess: 'Home Tab ➔ Browse campus food outlets, roadside stalls & late night canteens.',
    keyFeatures: [
      'SRM Canteen & Local Food Stalls',
      'Late-Night Delivery until 3:00 AM',
      'Live GPS Rider Tracking & OTP Delivery'
    ],
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80',
    accentColor: '#EF4444',
  },
  {
    id: 'grocery',
    icon: '🛒',
    title: 'Hostel Mega Basket & Essentials',
    category: 'GROCERIES & DAILY NEEDS',
    tagline: 'Snacks, Dairy, Beverages & Exam Stationery',
    howToAccess: 'Others Tab ➔ "Food & Basket" or Basket Icon in bottom bar.',
    keyFeatures: [
      'Instant Noodles, Snacks & Beverages',
      'Lab Stationery, Engineering Tools & Notebooks',
      'Hostel Cleaning & Personal Hygiene Kits'
    ],
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80',
    accentColor: '#10B981',
  },
  {
    id: 'repairs',
    icon: '💻',
    title: 'Doorstep Laptop & Phone Fix',
    category: 'TECH & HARDWARE',
    tagline: 'Certified Hardware Diagnostic & Overhaul',
    howToAccess: 'Others Tab ➔ "Tech & Repairs" ➔ Select Hardware Service.',
    keyFeatures: [
      'Thermal Paste Overhaul & Fan De-dusting',
      'Laptop Screen, Hinge & Keyboard Replacement',
      'SSD & RAM Upgrades with 4-Hour SLA'
    ],
    image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&q=80',
    accentColor: '#3B82F6',
  },
  {
    id: 'tailoring',
    icon: '🪡',
    title: 'Campus Tailoring & Alterations',
    category: 'CLOTHING & REPAIRS',
    tagline: 'Room Pickup for Uniforms, Lab Coats & Fitting',
    howToAccess: 'Others Tab ➔ "Tech & Repairs" ➔ "Campus Tailoring".',
    keyFeatures: [
      'Jeans & Trouser Length Shortening (Starts ₹60)',
      'Lab Coat & Blazer Fitting Adjustments',
      'Preferred Pickup Slot & Doorstep Room Pickup'
    ],
    image: 'https://images.unsplash.com/photo-1528458909336-e7a0adfed0a5?w=600&q=80',
    accentColor: '#F97316',
  },
  {
    id: 'print',
    icon: '🖨️',
    title: '24/7 Laser Print & Thesis Binding',
    category: 'DOCUMENT SERVICES',
    tagline: 'High-Res Assignment Prints Delivered to Room',
    howToAccess: 'Others Tab ➔ "Tech & Repairs" ➔ "24/7 Printout".',
    keyFeatures: [
      'B&W (₹2/page) & Full Color (₹8/page) Laser Prints',
      'Spiral & Hardbound Project Thesis Binding',
      'CAD / Architecture Large Sheet Printing'
    ],
    image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&q=80',
    accentColor: '#8B5CF6',
  },
  {
    id: 'pg',
    icon: '🏢',
    title: 'Verified PG & Student Residences',
    category: 'ACCOMMODATION',
    tagline: 'Zero-Brokerage Stays with Direct WhatsApp Booking',
    howToAccess: 'Others Tab ➔ "PG Homes" ➔ Filter by Gender & Distance.',
    keyFeatures: [
      'Inspected WiFi, AC, Mess & Security Properties',
      'Detailed Room Tour, Distance to SRM & Food Menus',
      'Instant WhatsApp Booking Dispatch to 9391955674'
    ],
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&q=80',
    accentColor: '#06B6D4',
  },
  {
    id: 'coride',
    icon: '🏍️',
    title: 'Peer Co-Ride & Rapido Connect',
    category: 'CAMPUS TRANSIT',
    tagline: 'Student Fuel-Split Commute & Station Cabs',
    howToAccess: 'Others Tab ➔ "Co-Ride & Rapido" ➔ Post or Join Ride.',
    keyFeatures: [
      'Peer Fuel Split between SRM, Vijayawada & Guntur',
      'Verified University Student ID Validation',
      'Fixed-Fare Airport & Railway Station Cabs'
    ],
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600&q=80',
    accentColor: '#EAB308',
  },
  {
    id: 'rewards',
    icon: '🎁',
    title: 'Daily Rewards, Spin & Campus Vault',
    category: 'PERKS & LOYALTY',
    tagline: 'Free Meals, Cashback Scratch Cards & Coins',
    howToAccess: 'Others Tab ➔ "Offers & Perks" ➔ Spin Fortune Wheel.',
    keyFeatures: [
      'Daily Fortune Spin Wheel for Discounts',
      'Cashback Scratch Cards on Every Order',
      'Hostel Block Leaderboards & Zenvy Coins'
    ],
    image: 'https://images.unsplash.com/photo-1596451190630-186aff535bf2?w=600&q=80',
    accentColor: '#EC4899',
  }
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function CampusServicesMapModal({ visible, onClose }: Props) {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const [selectedPillar, setSelectedPillar] = useState<string>('food');

  const bg = isDark ? '#141416' : '#FFFFFF';
  const cardBg = isDark ? '#1E1E22' : '#F8FAFC';
  const txt = colors.text;
  const txtSec = colors.textSecondary;
  const border = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';

  const activePillar = CAMPUS_SERVICES_MAP.find(p => p.id === selectedPillar) || CAMPUS_SERVICES_MAP[0];

  const handleGoToSignup = () => {
    onClose();
    router.push('/register' as any);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={[s.sheetContainer, { backgroundColor: bg, borderColor: border }]}>
          {/* Header Handle */}
          <View style={s.handle} />

          {/* Top Header */}
          <View style={[s.topHeader, { borderBottomColor: border }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: txt }}>
                  Campus Services Guide 🗺️
                </Text>
                <View style={s.liveBadge}>
                  <Text style={s.liveBadgeText}>8 SERVICES</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: txtSec, fontWeight: '600', marginTop: 2 }}>
                Everything you need for effortless SRM AP campus life
              </Text>
            </View>
            <TouchableOpacity style={[s.closeBtn, { backgroundColor: isDark ? '#2A2A2E' : '#F1F5F9' }]} onPress={onClose}>
              <Ionicons name="close" size={20} color={txt} />
            </TouchableOpacity>
          </View>

          {/* Service Pillar Category Chips */}
          <View style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {CAMPUS_SERVICES_MAP.map((item) => {
                const active = selectedPillar === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      s.chip,
                      {
                        backgroundColor: active ? item.accentColor : (isDark ? '#222226' : '#F1F5F9'),
                        borderColor: active ? item.accentColor : border,
                      }
                    ]}
                    onPress={() => setSelectedPillar(item.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 13, marginRight: 5 }}>{item.icon}</Text>
                    <Text style={[s.chipText, { color: active ? '#FFF' : txtSec }]}>
                      {item.title.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Main Detail Content */}
          <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
            {/* Active Service Showcase Card */}
            <View style={[s.detailCard, { backgroundColor: cardBg, borderColor: border }]}>
              <Image source={{ uri: activePillar.image }} style={s.pillarImage} />
              
              <View style={s.pillarCardContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={[s.pillarCategory, { color: activePillar.accentColor }]}>
                    {activePillar.category}
                  </Text>
                  <View style={{ backgroundColor: `${activePillar.accentColor}20`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                    <Text style={{ color: activePillar.accentColor, fontSize: 9, fontWeight: '900' }}>
                      SRM AP 24/7
                    </Text>
                  </View>
                </View>

                <Text style={[s.pillarTitle, { color: txt }]}>
                  {activePillar.icon} {activePillar.title}
                </Text>
                <Text style={[s.pillarTagline, { color: txtSec }]}>
                  {activePillar.tagline}
                </Text>

                {/* How to Access Box */}
                <View style={[s.howToBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#EFF6FF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#BFDBFE' }]}>
                  <Text style={[s.howToLabel, { color: activePillar.accentColor }]}>
                    📍 HOW TO ACCESS IN THE APP:
                  </Text>
                  <Text style={[s.howToText, { color: txt }]}>
                    {activePillar.howToAccess}
                  </Text>
                </View>

                {/* Key Features List */}
                <Text style={[s.featuresLabel, { color: txtSec }]}>
                  WHAT'S INCLUDED:
                </Text>
                {activePillar.keyFeatures.map((feat, idx) => (
                  <View key={idx} style={s.featureRow}>
                    <Ionicons name="checkmark-circle" size={15} color={activePillar.accentColor} />
                    <Text style={[s.featureText, { color: txt }]}>{feat}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Quick Summary Grid */}
            <View style={s.allServicesSummary}>
              <Text style={[s.summaryHeader, { color: txtSec }]}>
                COMPLETE PLATFORM MAP AT A GLANCE
              </Text>
              <View style={s.gridContainer}>
                {CAMPUS_SERVICES_MAP.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      s.gridItem,
                      {
                        backgroundColor: cardBg,
                        borderColor: selectedPillar === item.id ? item.accentColor : border,
                        borderWidth: selectedPillar === item.id ? 1.5 : 1
                      }
                    ]}
                    onPress={() => setSelectedPillar(item.id)}
                  >
                    <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                    <Text style={[s.gridItemTitle, { color: txt }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[s.gridItemCat, { color: item.accentColor }]} numberOfLines={1}>
                      {item.category.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Bottom Action Footer (Takes to Signup Page) */}
          <View style={[s.footer, { backgroundColor: bg, borderTopColor: border }]}>
            <TouchableOpacity
              style={s.signupCtaBtn}
              onPress={handleGoToSignup}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.signupBtnGradient}
              >
                <Text style={s.signupBtnText}>CREATE ACCOUNT & GET STARTED 🚀</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '92%',
    borderWidth: 1,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(150,150,150,0.4)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  liveBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveBadgeText: {
    color: '#EF4444',
    fontSize: 9,
    fontWeight: '900',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  detailCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 16,
    ...SHADOWS.card,
  },
  pillarImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  pillarCardContent: {
    padding: 16,
  },
  pillarCategory: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  pillarTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  pillarTagline: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 12,
  },
  howToBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  howToLabel: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  howToText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  featuresLabel: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  featureText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  allServicesSummary: {
    marginBottom: 20,
  },
  summaryHeader: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: (SW - 48) / 2,
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
    gap: 4,
  },
  gridItemTitle: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  gridItemCat: {
    fontSize: 8,
    fontWeight: '900',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
  },
  signupCtaBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    ...SHADOWS.redGlow,
  },
  signupBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
