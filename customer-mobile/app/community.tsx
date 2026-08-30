import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Dimensions, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Animated, Easing, Vibration } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SHADOWS } from '../constants/theme';
import { ENDPOINTS, API_URL } from '../constants/api';
import { apiFetch } from '../utils/auth';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { StaggeredSection, FloatingPulse, BounceIn, PulseGlow } from '../components/AnimatedSection';
import DopaminePressable, { CardPressable, ActionPressable } from '../components/DopaminePressable';
import { LinearGradient } from 'expo-linear-gradient';
import { connectSocket } from '../utils/socket';

const { width: SW, height: SH } = Dimensions.get('window');

const getImageUrl = (url: string | null) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

// ── Confetti Particle (Pure Native Drivers, Zero-Lag) ──
const ConfettiParticle = ({ delay }: { delay: number }) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 3500 + Math.random() * 2500,
          delay: delay,
          useNativeDriver: true,
          easing: Easing.linear,
        })
      ])
    ).start();
  }, []);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, SH + 60]
  });

  const translateX = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      Math.random() * SW,
      Math.random() * SW,
      Math.random() * SW
    ]
  });

  const rotate = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${Math.random() * 360}deg`]
  });

  const colors = ['#FF69B4', '#FFD700', '#FF4500', '#00FFFF', '#ADFF2F', '#FF00FF'];
  const color = colors[Math.floor(Math.random() * colors.length)];

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 8 + Math.random() * 8,
        height: 8 + Math.random() * 8,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? 4 : 0,
        transform: [{ translateY }, { translateX }, { rotate }],
        opacity: 0.8,
        zIndex: 999
      }}
    />
  );
};

const ConfettiCannon = () => {
  const particles = Array.from({ length: 45 });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((_, i) => (
        <ConfettiParticle key={i} delay={i * 100} />
      ))}
    </View>
  );
};

// ── Crazy Animated Moving Ticker Banner ──
const GRADIENT_THEMES: Record<string, string[]> = {
  fire: ['#FF4500', '#FF8C00', '#FFD700', '#FF1493'],
  neon: ['#00F5D4', '#7B2CBF', '#F72585', '#4CC9F0'],
  gold: ['#B8860B', '#FFD700', '#DAA520', '#FFF8DC'],
  cyberpunk: ['#F72585', '#7209B7', '#3A0CA3', '#4361EE'],
  emerald: ['#059669', '#10B981', '#34D399', '#6EE7B7']
};

const CrazyMovingBanner = ({ text, theme = 'fire' }: { text: string; theme?: string }) => {
  const scrollX = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    scrollX.setValue(0);
    const anim = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -1,
        duration: 16000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [text]);

  const translateX = scrollX.interpolate({
    inputRange: [-1, 0],
    outputRange: [-600, 0]
  });

  const colors = GRADIENT_THEMES[theme] || GRADIENT_THEMES.fire;

  return (
    <View style={{ height: 40, borderRadius: 14, overflow: 'hidden', marginVertical: 10, borderWidth: 1, borderColor: 'rgba(255,215,0,0.4)', shadowColor: colors[0], shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 }}>
      <LinearGradient colors={colors as unknown as readonly [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ backgroundColor: '#0D0D15', paddingHorizontal: 12, height: '100%', justifyContent: 'center', zIndex: 20, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.2)' }}>
          <Text style={{ fontSize: 10, fontWeight: '900', color: '#FFD700', letterSpacing: 0.8 }}>📢 LIVE EVENT</Text>
        </View>
        <View style={{ flex: 1, overflow: 'hidden', height: '100%', justifyContent: 'center', paddingHorizontal: 6 }}>
          <Animated.View style={{ flexDirection: 'row', alignItems: 'center', transform: [{ translateX }] }}>
            <Text 
              numberOfLines={1}
              style={{ 
                fontSize: 11, 
                fontWeight: '900', 
                color: '#FFF', 
                paddingRight: 60,
                ...(Platform.OS === 'web' ? { whiteSpace: 'nowrap' as any } : {})
              }}
            >
              {text} &nbsp;&nbsp;•&nbsp;&nbsp; {text} &nbsp;&nbsp;•&nbsp;&nbsp; {text}
            </Text>
          </Animated.View>
        </View>
      </View>
    </View>
  );
};

interface PostType {
  id: string;
  parentId: string | null;
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
  imageUrl: string | null;
  likes: number;
  likedBy: string[];
  replyCount: number;
  createdAt: string;
  expiresAt?: string | null;
  replies?: PostType[];
  postType?: 'post' | 'review';
  starRating?: number;
  restaurantName?: string;
  productName?: string;
}

export default function CommunityScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDark } = useTheme();
  
  const txt = isDark ? '#FFF' : '#3e2723';
  const txtSec = isDark ? '#AAA' : '#666';
  const bg = isDark ? '#0A0A0C' : '#f4f1ea';
  const cardBg = isDark ? '#141416' : '#fdfcf0';
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(139,90,43,0.1)';
  const DEFAULT_COMMUNITY_POSTS: PostType[] = [
    {
      id: 'post-seed-1',
      parentId: null,
      userId: 'u-101',
      userName: 'Kavya Sharma (Hostel 3)',
      userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      content: 'Terrace chai & late-night revision circle before end-sems! ❤️ Unforgettable campus memories with the best hostel roommates ever ✨',
      imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80',
      likes: 54,
      likedBy: ['u-1', 'u-2'],
      replyCount: 8,
      createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
      postType: 'post',
      replies: [
        {
          id: 'rep-1',
          parentId: 'post-seed-1',
          userId: 'u-102',
          userName: 'Aarav Patel',
          userAvatar: null,
          content: 'That sunset from the terrace was unreal! Let’s meet again tomorrow ☕🌅',
          imageUrl: null,
          likes: 6,
          likedBy: [],
          replyCount: 0,
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        }
      ]
    },
    {
      id: 'post-seed-2',
      parentId: null,
      userId: 'u-103',
      userName: 'Vikram Reddy (CSE 4th Yr)',
      userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
      content: '24-Hour Hackathon finals sprint! Team code survived 4 coffee refills and a 4 AM bug fix. Demo day here we come! 💻⚡🏆',
      imageUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&auto=format&fit=crop&q=80',
      likes: 72,
      likedBy: ['u-3'],
      replyCount: 14,
      createdAt: new Date(Date.now() - 3600000 * 7).toISOString(),
      postType: 'post',
    },
    {
      id: 'post-seed-rev-1',
      parentId: null,
      userId: 'u-107',
      userName: 'Ananya Roy (Hostel 1)',
      userAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80',
      content: 'Midnight biryani craving hits different! 🌶️ Delivered steaming hot in 12 mins to Gate 2. Juicy chicken and aromatic rice! 10/10 recommendation! ⭐',
      imageUrl: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=800&auto=format&fit=crop&q=80',
      likes: 83,
      likedBy: ['u-1'],
      replyCount: 11,
      createdAt: new Date(Date.now() - 3600000 * 9).toISOString(),
      postType: 'review',
      starRating: 5,
      restaurantName: 'Royal Handi Biryani',
      productName: 'Special Dum Chicken Biryani'
    },
    {
      id: 'post-seed-rev-2',
      parentId: null,
      userId: 'u-108',
      userName: 'Devansh Roy (Block B)',
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
      content: 'Best woodfired cheese crust on campus! 🍕 Truffle aroma is insane and crust is super crispy. Must try during group study nights!',
      imageUrl: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=800&auto=format&fit=crop&q=80',
      likes: 67,
      likedBy: [],
      replyCount: 9,
      createdAt: new Date(Date.now() - 3600000 * 16).toISOString(),
      postType: 'review',
      starRating: 5,
      restaurantName: 'Artisanal Pizza Lab',
      productName: 'Truffle Mushroom Overload'
    },
    {
      id: 'post-seed-3',
      parentId: null,
      userId: 'u-104',
      userName: 'Sneha Roy (Music Society)',
      userAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80',
      content: 'Annual Fest rock band night at the amphitheatre was electric! 🎸🔥 The whole campus was singing along!',
      imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80',
      likes: 89,
      likedBy: [],
      replyCount: 12,
      createdAt: new Date(Date.now() - 3600000 * 20).toISOString(),
      postType: 'post',
    },
    {
      id: 'post-seed-4',
      parentId: null,
      userId: 'u-105',
      userName: 'Rohan Mehra (Sports Captain)',
      userAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80',
      content: 'Inter-Hostel Football Champions 2026! ⚽🥇 Huge shoutout to the defense line for keeping the clean sheet!',
      imageUrl: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800&auto=format&fit=crop&q=80',
      likes: 95,
      likedBy: ['u-4'],
      replyCount: 19,
      createdAt: new Date(Date.now() - 3600000 * 25).toISOString(),
      postType: 'post',
    },
    {
      id: 'post-seed-lost',
      parentId: null,
      userId: 'u-109',
      userName: 'Aditya Varma (Hostel 4)',
      userAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop&q=80',
      content: '🔍 LOST: Blue lanyard with Hostel 4 Room 212 keys and College ID card left near Central Library lawns. If found, please drop at Security Gate 1! 🙏',
      imageUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&auto=format&fit=crop&q=80',
      likes: 41,
      likedBy: [],
      replyCount: 5,
      createdAt: new Date(Date.now() - 3600000 * 28).toISOString(),
      postType: 'post',
    }
  ];

  const DEFAULT_WALL_EVENT = {
    id: 'wall-active-1',
    title: 'Campus Food Photography Clash 🔥',
    description: 'Vote for the best food snaps on campus! Winner gets ₹200 off their next Zenvy order.',
    endTime: new Date(Date.now() + 3600000 * 18).toISOString(),
    couponValue: 200,
    couponCode: 'WALL200',
    bannerText: '🔥 LIVE PHOTO CONTEST: Vote for your favourite food photos & win instant discount coupons! 📸✨',
    bannerGradient: 'fire'
  };

  const DEFAULT_WALL_SUBMISSIONS = [
    {
      id: 'wall-sub-1',
      imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80',
      likeCount: 84,
      user: { name: 'Aarav Malhotra (Hostel 2)' },
      isApproved: true
    },
    {
      id: 'wall-sub-2',
      imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&q=80',
      likeCount: 62,
      user: { name: 'Pooja Reddy (Block C)' },
      isApproved: true
    },
    {
      id: 'wall-sub-3',
      imageUrl: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800&q=80',
      likeCount: 45,
      user: { name: 'Devansh Roy' },
      isApproved: true
    },
    {
      id: 'wall-sub-4',
      imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=800&q=80',
      likeCount: 31,
      user: { name: 'Tanvi Joshi' },
      isApproved: true
    },
    {
      id: 'wall-sub-5',
      imageUrl: 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=800&q=80',
      likeCount: 27,
      user: { name: 'Karthik Nair' },
      isApproved: true
    },
    {
      id: 'wall-sub-6',
      imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=800&q=80',
      likeCount: 19,
      user: { name: 'Ananya Roy' },
      isApproved: true
    }
  ];

  const DEFAULT_WALL_HISTORY = [
    {
      event: {
        id: 'wall-hist-1',
        title: 'Midnight Biryani Clash 👑',
        endTime: new Date(Date.now() - 86400000 * 5).toISOString(),
        couponCode: 'CHAMP150',
        couponValue: 150
      },
      winner: {
        name: 'Aarav Malhotra (Hostel 2)'
      },
      winningSubmission: {
        imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80',
        likeCount: 142
      }
    },
    {
      event: {
        id: 'wall-hist-2',
        title: 'Artisan Pizza Masters 🍕',
        endTime: new Date(Date.now() - 86400000 * 12).toISOString(),
        couponCode: 'PIZZAWIN',
        couponValue: 200
      },
      winner: {
        name: 'Pooja Reddy (Block C)'
      },
      winningSubmission: {
        imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&q=80',
        likeCount: 118
      }
    },
    {
      event: {
        id: 'wall-hist-3',
        title: 'Monster BBQ Showdown 🍔',
        endTime: new Date(Date.now() - 86400000 * 19).toISOString(),
        couponCode: 'BURGER200',
        couponValue: 200
      },
      winner: {
        name: 'Devansh Roy (Hostel 3)'
      },
      winningSubmission: {
        imageUrl: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800&q=80',
        likeCount: 96
      }
    },
    {
      event: {
        id: 'wall-hist-4',
        title: 'Aesthetic Cold Brews ☕',
        endTime: new Date(Date.now() - 86400000 * 26).toISOString(),
        couponCode: 'COFFEESTAR',
        couponValue: 150
      },
      winner: {
        name: 'Tanvi Joshi (Architecture)'
      },
      winningSubmission: {
        imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=800&q=80',
        likeCount: 88
      }
    }
  ];

  const [posts, setPosts] = useState<PostType[]>(DEFAULT_COMMUNITY_POSTS);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'wall'>('all');
  const [feedCategory, setFeedCategory] = useState<'all' | 'memories' | 'reviews' | 'hacks' | 'lost_found'>('all');
  const [search, setSearch] = useState('');
  const [onlineCount] = useState(Math.floor(Math.random() * 20) + 8);

  // ── CAMPUS CLASH LIVE POLL STATE ──
  const [campusPoll, setCampusPoll] = useState({
    id: 'poll-1',
    question: '🔥 Best Late-Night Exam Fuel on Campus?',
    totalVotes: 348,
    userVotedOptionId: null as string | null,
    options: [
      { id: 'opt-1', text: '🍜 Steaming Maggi with Double Masala', votes: 148, emoji: '🍜' },
      { id: 'opt-2', text: '🍗 Handi Dum Biryani & Cold Drink', votes: 130, emoji: '🍗' },
      { id: 'opt-3', text: '☕ Canteen Filter Coffee & Bun Maska', votes: 70, emoji: '☕' }
    ]
  });

  const [claimedCoupon, setClaimedCoupon] = useState<string | null>(null);

  const handleVotePoll = (optionId: string) => {
    if (campusPoll.userVotedOptionId) return;
    Vibration.vibrate(50);
    setCampusPoll(prev => ({
      ...prev,
      totalVotes: prev.totalVotes + 1,
      userVotedOptionId: optionId,
      options: prev.options.map(opt => opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt)
    }));
    Alert.alert('Vote Registered! ⚡', 'Your campus poll vote has been counted live.');
  };

  const handleClaimCoupon = (code: string, value: number) => {
    setClaimedCoupon(code);
    Vibration.vibrate([0, 80, 40, 80]);
    Alert.alert(
      '🎉 COUPON UNLOCKED!',
      `Discount Code "${code}" for ₹${value} OFF is ready! Apply it at checkout for instant savings.`,
      [
        { text: 'Explore Restaurants 🍔', onPress: () => router.push('/' as any) },
        { text: 'Awesome', style: 'cancel' }
      ]
    );
  };

  // ── THE WALL STATE ──
  const [wallSubTab, setWallSubTab] = useState<'live' | 'hof'>('live');
  const [activeWallEvent, setActiveWallEvent] = useState<any | null>(DEFAULT_WALL_EVENT);
  const [wallSubmissions, setWallSubmissions] = useState<any[]>(DEFAULT_WALL_SUBMISSIONS);
  const [userLikedWallSubmissionIds, setUserLikedWallSubmissionIds] = useState<string[]>([]);
  const [userWallSubmission, setUserWallSubmission] = useState<any | null>(null);
  const [wallHistory, setWallHistory] = useState<any[]>(DEFAULT_WALL_HISTORY);
  const [selectedHofWinner, setSelectedHofWinner] = useState<any | null>(null);
  const [loadingWall, setLoadingWall] = useState(false);
  const [wallTimeLeft, setWallTimeLeft] = useState<string>('');

  // Modals & Form
  const [showWallSubmitModal, setShowWallSubmitModal] = useState(false);
  const [wallSubmitImage, setWallSubmitImage] = useState<string | null>(null);
  const [submittingWallPhoto, setSubmittingWallPhoto] = useState(false);

  const [showWallAdminModal, setShowWallAdminModal] = useState(false);
  const [pendingWallSubmissions, setPendingWallSubmissions] = useState<any[]>([]);
  const [newWallTitle, setNewWallTitle] = useState('');
  const [newWallDesc, setNewWallDesc] = useState('');
  const [newWallHours, setNewWallHours] = useState('24');
  const [newWallCouponVal, setNewWallCouponVal] = useState('200');
  const [newWallCouponCode, setNewWallCouponCode] = useState('');
  const [newWallBannerText, setNewWallBannerText] = useState('🔥 LIVE PHOTO CONTEST: Vote for your favourite photos & win instant discount coupons! 📸✨');
  const [newWallBannerGradient, setNewWallBannerGradient] = useState('fire');
  const [submittingNewWallEvent, setSubmittingNewWallEvent] = useState(false);

  // Edit active event state
  const [editBannerText, setEditBannerText] = useState('');
  const [editBannerGradient, setEditBannerGradient] = useState('fire');
  const [editCouponVal, setEditCouponVal] = useState('200');
  const [editCouponCode, setEditCouponCode] = useState('');
  const [updatingActiveEvent, setUpdatingActiveEvent] = useState(false);
  
  // Composer states
  const [showComposer, setShowComposer] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftImage, setDraftImage] = useState<string | null>(null);
  const [customAuthorName, setCustomAuthorName] = useState(user?.name || '');
  const [isReviewDraft, setIsReviewDraft] = useState(false);
  const [starRating, setStarRating] = useState(5);
  const [restaurantName, setRestaurantName] = useState('');
  const [productName, setProductName] = useState('');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  
  const [replyingTo, setReplyingTo] = useState<PostType | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [posting, setPosting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // Disabled crop engine to prevent Android intent crashes
      aspect: [1, 1],
      quality: 0.1, // Drastically reduced to prevent OOM kills on Android
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      const b64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setDraftImage(b64);
    }
  };

  // ── BIRTHDAY CELEBRATIONS STATE ──
  interface BirthdayType {
    id: string;
    userId: string;
    candidateName: string;
    candidatePhotoUrl: string | null;
    birthdayDate: string;
    status: 'pending' | 'approved' | 'rejected' | 'expired';
    wishCount: number;
    approvedAt?: string;
    expiresAt?: string;
  }
  
  interface WishType {
    id: string;
    celebrationId: string;
    userId: string;
    userName: string;
    message: string;
    createdAt: string;
  }

  const DEFAULT_CAMPUS_CELEBRATIONS: BirthdayType[] = [
    {
      id: 'bday-1',
      userId: 'u-1',
      candidateName: 'Ananya R (CSE 3rd Yr)',
      candidatePhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
      birthdayDate: new Date().toISOString().split('T')[0],
      status: 'approved',
      wishCount: 28,
    },
    {
      id: 'bday-2',
      userId: 'u-2',
      candidateName: 'Rohit V (Block-A 204)',
      candidatePhotoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
      birthdayDate: new Date().toISOString().split('T')[0],
      status: 'approved',
      wishCount: 42,
    },
    {
      id: 'bday-3',
      userId: 'u-3',
      candidateName: 'Priya S (ECE Winner)',
      candidatePhotoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
      birthdayDate: new Date().toISOString().split('T')[0],
      status: 'approved',
      wishCount: 19,
    },
    {
      id: 'bday-4',
      userId: 'u-4',
      candidateName: 'Karthik N (Hostel Mess)',
      candidatePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
      birthdayDate: new Date().toISOString().split('T')[0],
      status: 'approved',
      wishCount: 35,
    }
  ];

  const [birthdays, setBirthdays] = useState<BirthdayType[]>(DEFAULT_CAMPUS_CELEBRATIONS);
  const [pendingBirthdays, setPendingBirthdays] = useState<BirthdayType[]>([]);
  const [selectedBirthday, setSelectedBirthday] = useState<BirthdayType | null>(null);
  const [selectedBirthdayWishes, setSelectedBirthdayWishes] = useState<WishType[]>([]);
  const [birthdayWishMessage, setBirthdayWishMessage] = useState('');
  
  // Modals
  const [showBirthdayWishModal, setShowBirthdayWishModal] = useState(false);
  const [showRegisterBirthdayModal, setShowRegisterBirthdayModal] = useState(false);
  const [showAdminPanelModal, setShowAdminPanelModal] = useState(false);
  const [submittingWish, setSubmittingWish] = useState(false);

  // New Birthday Nomination
  const [newBirthdayName, setNewBirthdayName] = useState('');
  const [newBirthdayDate, setNewBirthdayDate] = useState(new Date().toISOString().split('T')[0]);
  const [newBirthdayPhoto, setNewBirthdayPhoto] = useState<string | null>(null);
  const [submittingBirthday, setSubmittingBirthday] = useState(false);

  const fetchBirthdays = async () => {
    try {
      const res = await apiFetch((ENDPOINTS as any).birthdaysActive);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setBirthdays(data);
        } else {
          setBirthdays(DEFAULT_CAMPUS_CELEBRATIONS);
        }
      } else {
        setBirthdays(DEFAULT_CAMPUS_CELEBRATIONS);
      }
      if (user?.role?.toLowerCase() === 'admin') {
        const resPending = await apiFetch((ENDPOINTS as any).birthdaysPending);
        if (resPending.ok) {
          const dataPending = await resPending.json();
          setPendingBirthdays(dataPending);
        }
      }
    } catch (e) {
      setBirthdays(DEFAULT_CAMPUS_CELEBRATIONS);
      console.error('[FETCH_BIRTHDAYS_ERROR]', e);
    }
  };

  const submitBirthday = async () => {
    if (!newBirthdayName.trim()) {
      Alert.alert('Validation Error', 'Please enter the birthday candidate\'s name.');
      return;
    }
    setSubmittingBirthday(true);
    try {
      const res = await apiFetch((ENDPOINTS as any).birthdaysSubmit, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateName: newBirthdayName,
          birthdayDate: newBirthdayDate,
          candidatePhoto: newBirthdayPhoto
        })
      });

      if (res.ok) {
        Alert.alert('Nominated! 🎉', 'Nomination submitted to admin queue for approval.');
        setNewBirthdayName('');
        setNewBirthdayPhoto(null);
        setShowRegisterBirthdayModal(false);
        fetchBirthdays();
      } else {
        const err = await res.json();
        Alert.alert('Submission Failed', err.message || 'Something went wrong.');
      }
    } catch (e) {
      Alert.alert('Error', 'Network connection error.');
    } finally {
      setSubmittingBirthday(false);
    }
  };

  const pickBirthdayPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      aspect: [1, 1],
      quality: 0.1,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      const b64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setNewBirthdayPhoto(b64);
    }
  };

  const approveBirthday = async (id: string) => {
    try {
      const res = await apiFetch((ENDPOINTS as any).birthdaysApprove(id), { method: 'PUT' });
      if (res.ok) {
        Alert.alert('Approved! 🎂', 'Birthday is now live and a notification has been sent.');
        fetchBirthdays();
      } else {
        Alert.alert('Error', 'Failed to approve request.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const rejectBirthday = async (id: string) => {
    try {
      const res = await apiFetch((ENDPOINTS as any).birthdaysReject(id), { method: 'PUT' });
      if (res.ok) {
        Alert.alert('Rejected', 'Nomination rejected successfully.');
        fetchBirthdays();
      } else {
        Alert.alert('Error', 'Failed to reject request.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const DEFAULT_WISHES: Record<string, WishType[]> = {
    'bday-1': [
      { id: 'w-1', celebrationId: 'bday-1', userId: 'u-10', userName: 'Kavya Sharma', message: 'Happy Birthday Ananya! 🎂 Have the best year ahead! 🌟', createdAt: new Date(Date.now() - 3600000 * 2).toISOString() },
      { id: 'w-2', celebrationId: 'bday-1', userId: 'u-11', userName: 'Aarav Patel', message: 'HBD! Waiting for the party treat at cafeteria! 🍕🎉', createdAt: new Date(Date.now() - 3600000).toISOString() },
      { id: 'w-3', celebrationId: 'bday-1', userId: 'u-12', userName: 'Sneha Roy', message: 'Stay blessed and keep shining superstar! ✨❤️', createdAt: new Date(Date.now() - 1800000).toISOString() }
    ],
    'bday-2': [
      { id: 'w-4', celebrationId: 'bday-2', userId: 'u-13', userName: 'Vikram Reddy', message: 'Happy Birthday Rohit bro! Room 204 rocks! 🎂🔥', createdAt: new Date(Date.now() - 3600000 * 3).toISOString() },
      { id: 'w-5', celebrationId: 'bday-2', userId: 'u-14', userName: 'Rohan Mehra', message: 'HBD champion! Match win treat pending! 🏏🍔', createdAt: new Date(Date.now() - 3600000).toISOString() }
    ],
    'bday-3': [
      { id: 'w-6', celebrationId: 'bday-3', userId: 'u-15', userName: 'Pooja Reddy', message: 'Congratulations and Happy Birthday Priya! 🏆🎂', createdAt: new Date(Date.now() - 3600000 * 4).toISOString() }
    ],
    'bday-4': [
      { id: 'w-7', celebrationId: 'bday-4', userId: 'u-16', userName: 'Devansh Roy', message: 'Best wishes Karthik! Keep feeding us good vibes! 🎂🍰', createdAt: new Date(Date.now() - 3600000 * 2).toISOString() }
    ]
  };

  const openBirthdayDetail = async (birthday: BirthdayType) => {
    setSelectedBirthday(birthday);
    setBirthdayWishMessage('');
    const defaultList = DEFAULT_WISHES[birthday.id] || [
      { id: `w-init-${Date.now()}`, celebrationId: birthday.id, userId: 'u-init', userName: 'Campus Peer', message: 'Happy Birthday! 🎉🎂', createdAt: new Date().toISOString() }
    ];
    setSelectedBirthdayWishes(defaultList);
    setShowBirthdayWishModal(true);
    try {
      const res = await apiFetch((ENDPOINTS as any).birthdaysWishes(birthday.id));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSelectedBirthdayWishes(data);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const submitWish = async (presetText?: string) => {
    if (!selectedBirthday) return;
    const msg = (presetText || birthdayWishMessage || '').trim();
    if (!msg) return;

    const currentUserName = user?.name || 'You';
    const newWishItem: WishType = {
      id: `wish-${Date.now()}`,
      celebrationId: selectedBirthday.id,
      userId: user?.id || user?._id || 'u-you',
      userName: currentUserName,
      message: msg,
      createdAt: new Date().toISOString()
    };

    // Instant optimistic update
    setSelectedBirthdayWishes(prev => [newWishItem, ...prev]);
    setSelectedBirthday(prev => prev ? { ...prev, wishCount: (prev.wishCount || 0) + 1 } : null);
    setBirthdays(prev => prev.map(b => b.id === selectedBirthday.id ? { ...b, wishCount: (b.wishCount || 0) + 1 } : b));
    setBirthdayWishMessage('');

    setSubmittingWish(true);
    try {
      await apiFetch((ENDPOINTS as any).birthdaysWish(selectedBirthday.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
    } catch (e) {
      console.log('[WISH_OPTIMISTICALLY_SAVED]');
    } finally {
      setSubmittingWish(false);
    }
  };

  const fetchWallActive = async () => {
    try {
      setLoadingWall(true);
      const res = await apiFetch((ENDPOINTS as any).wallActive);
      if (res.ok) {
        const data = await res.json();
        setActiveWallEvent(data.activeEvent || DEFAULT_WALL_EVENT);
        setWallSubmissions(Array.isArray(data.submissions) && data.submissions.length > 0 ? data.submissions : DEFAULT_WALL_SUBMISSIONS);
        setUserLikedWallSubmissionIds(data.userLikedSubmissionIds || []);
        setUserWallSubmission(data.userSubmission || null);

        if (data.activeEvent) {
          setEditBannerText(data.activeEvent.bannerText || '🔥 LIVE PHOTO CONTEST: Vote for your favourite photos & win instant discount coupons! 📸✨');
          setEditBannerGradient(data.activeEvent.bannerGradient || 'fire');
          setEditCouponVal((data.activeEvent.couponValue || 200).toString());
          setEditCouponCode(data.activeEvent.couponCode || '');
        }
      } else {
        setActiveWallEvent(DEFAULT_WALL_EVENT);
        setWallSubmissions(DEFAULT_WALL_SUBMISSIONS);
      }
    } catch (e) {
      setActiveWallEvent(DEFAULT_WALL_EVENT);
      setWallSubmissions(DEFAULT_WALL_SUBMISSIONS);
      console.error('[FETCH_WALL_ERR]', e);
    } finally {
      setLoadingWall(false);
    }
  };

  const updateActiveWallEvent = async () => {
    if (!activeWallEvent) return;
    setUpdatingActiveEvent(true);
    try {
      const res = await apiFetch((ENDPOINTS as any).wallUpdateEvent(activeWallEvent.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bannerText: editBannerText,
          bannerGradient: editBannerGradient,
          couponValue: parseInt(editCouponVal || '200', 10),
          couponCode: editCouponCode || null
        })
      });
      if (res.ok) {
        Alert.alert('Success! 🎉', 'Live Event Banner & Coupon details updated!');
        fetchWallActive();
      } else {
        const err = await res.json();
        Alert.alert('Error', err.message || 'Failed to update event banner.');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error updating event details.');
    } finally {
      setUpdatingActiveEvent(false);
    }
  };

  const fetchWallHistory = async () => {
    try {
      const res = await apiFetch((ENDPOINTS as any).wallHistory);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setWallHistory(data);
        } else {
          setWallHistory(DEFAULT_WALL_HISTORY);
        }
      } else {
        setWallHistory(DEFAULT_WALL_HISTORY);
      }
    } catch (e) {
      setWallHistory(DEFAULT_WALL_HISTORY);
      console.error('[FETCH_WALL_HISTORY_ERR]', e);
    }
  };

  const fetchWallAdminPending = async () => {
    if (user?.role?.toLowerCase() !== 'admin') return;
    try {
      const res = await apiFetch((ENDPOINTS as any).wallAdminPending);
      if (res.ok) {
        const data = await res.json();
        setPendingWallSubmissions(data);
      }
    } catch (e) {
      console.error('[FETCH_WALL_PENDING_ERR]', e);
    }
  };

  const handleWallLike = async (submissionId: string) => {
    const isAlreadyLiked = userLikedWallSubmissionIds.includes(submissionId);
    setUserLikedWallSubmissionIds(prev =>
      isAlreadyLiked ? prev.filter(id => id !== submissionId) : [...prev, submissionId]
    );

    setWallSubmissions(prev =>
      prev.map(sub => {
        if (sub.id === submissionId) {
          return {
            ...sub,
            likeCount: isAlreadyLiked ? Math.max(0, sub.likeCount - 1) : sub.likeCount + 1
          };
        }
        return sub;
      })
    );

    try {
      await apiFetch((ENDPOINTS as any).wallLike(submissionId), { method: 'POST' });
    } catch (e) {
      console.log('[WALL_VOTE_LOCAL_SAVED]');
    }
  };

  const pickWallPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      aspect: [1, 1],
      quality: 0.15,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      const b64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setWallSubmitImage(b64);
    }
  };

  const submitWallPhoto = async () => {
    if (!activeWallEvent) return;
    if (!wallSubmitImage) {
      Alert.alert('Validation Error', 'Please select a photo to upload.');
      return;
    }

    setSubmittingWallPhoto(true);
    const newOptimisticWallSub = {
      id: `wall-sub-${Date.now()}`,
      imageUrl: wallSubmitImage,
      likeCount: 1,
      user: { name: user?.name || 'You (Campus Foodie)' },
      isApproved: true,
      createdAt: new Date().toISOString()
    };

    // Add to wall immediately
    setWallSubmissions(prev => [newOptimisticWallSub, ...prev]);
    setUserLikedWallSubmissionIds(prev => [...prev, newOptimisticWallSub.id]);
    setUserWallSubmission({ id: newOptimisticWallSub.id, isApproved: true, imageUrl: wallSubmitImage });
    
    const imagePayload = wallSubmitImage;
    setWallSubmitImage(null);
    setShowWallSubmitModal(false);
    Alert.alert('Photo Submitted! 📸', 'Your entry is live on The Wall! Peers can now vote for your photo.');

    try {
      await apiFetch((ENDPOINTS as any).wallSubmit(activeWallEvent.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: imagePayload })
      });
    } catch (e) {
      console.log('[WALL_PHOTO_LOCAL_SAVED]');
    } finally {
      setSubmittingWallPhoto(false);
    }
  };

  const approveWallSubmission = async (id: string) => {
    try {
      const res = await apiFetch((ENDPOINTS as any).wallApprove(id), { method: 'PUT' });
      if (res.ok) {
        Alert.alert('Approved! 📸', 'Photo is now live on The Wall!');
        fetchWallAdminPending();
        fetchWallActive();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const rejectWallSubmission = async (id: string) => {
    try {
      const res = await apiFetch((ENDPOINTS as any).wallReject(id), { method: 'PUT' });
      if (res.ok) {
        Alert.alert('Rejected', 'Submission removed from queue.');
        fetchWallAdminPending();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const createWallEvent = async () => {
    if (!newWallTitle.trim()) {
      Alert.alert('Validation Error', 'Please enter event title.');
      return;
    }

    setSubmittingNewWallEvent(true);
    try {
      const hrs = parseInt(newWallHours || '24', 10);
      const startTime = new Date();
      const endTime = new Date(Date.now() + hrs * 60 * 60 * 1000);

      const res = await apiFetch((ENDPOINTS as any).wallCreateEvent, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newWallTitle,
          description: newWallDesc,
          startTime,
          endTime,
          couponValue: parseInt(newWallCouponVal || '200', 10),
          couponCode: newWallCouponCode || null,
          bannerText: newWallBannerText,
          bannerGradient: newWallBannerGradient
        })
      });

      if (res.ok) {
        Alert.alert('Event Created! 📸', 'New Wall photo contest is live!');
        setNewWallTitle('');
        setNewWallDesc('');
        setShowWallAdminModal(false);
        fetchWallActive();
      } else {
        const err = await res.json();
        Alert.alert('Error', err.message || 'Failed to create Wall event.');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error creating Wall event.');
    } finally {
      setSubmittingNewWallEvent(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'wall') {
      fetchWallActive();
      fetchWallHistory();
      if (user?.role?.toLowerCase() === 'admin') {
        fetchWallAdminPending();
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (!activeWallEvent || !activeWallEvent.endTime) {
      setWallTimeLeft('');
      return;
    }

    const updateTimer = () => {
      const ms = new Date(activeWallEvent.endTime).getTime() - Date.now();
      if (ms <= 0) {
        setWallTimeLeft('CONTEST ENDED');
      } else {
        const hours = Math.floor(ms / 3600000);
        const mins = Math.floor((ms % 3600000) / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        setWallTimeLeft(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    const tInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(tInterval);
  }, [activeWallEvent]);

  useEffect(() => {
    fetchPosts();
    fetchBirthdays();

    const socket = connectSocket();

    const onNewPost = (newPost: any) => {
      if (newPost.parentId) {
        setPosts(prev => prev.map(p => {
          if (p.id === newPost.parentId) {
            const currentReplies = p.replies || [];
            if (currentReplies.some(r => r.id === newPost.id)) return p;
            return {
              ...p,
              replyCount: (p.replyCount || 0) + 1,
              replies: [...currentReplies, newPost]
            };
          }
          return p;
        }));
      } else {
        setPosts(prev => {
          if (prev.some(p => p.id === newPost.id)) return prev;
          const isReview = newPost.postType === 'review';
          if (activeTab === 'wall' && !isReview) return prev;
          return [newPost, ...prev];
        });
      }
    };

    const onPostLiked = (data: { id: string; likes: number; likedBy: string[] }) => {
      setPosts(prev => prev.map(p => {
        if (p.id === data.id) {
          return { ...p, likes: data.likes, likedBy: data.likedBy };
        }
        if (p.replies && p.replies.some(r => r.id === data.id)) {
          return {
            ...p,
            replies: p.replies.map(r => r.id === data.id ? { ...r, likes: data.likes, likedBy: data.likedBy } : r)
          };
        }
        return p;
      }));
    };

    const onPostDeleted = (data: { id: string; parentId: string | null }) => {
      if (data.parentId) {
        setPosts(prev => prev.map(p => {
          if (p.id === data.parentId) {
            return {
              ...p,
              replyCount: Math.max((p.replyCount || 1) - 1, 0),
              replies: (p.replies || []).filter(r => r.id !== data.id)
            };
          }
          return p;
        }));
      } else {
        setPosts(prev => prev.filter(p => p.id !== data.id));
      }
    };

    socket.on('community_new_post', onNewPost);
    socket.on('community_post_liked', onPostLiked);
    socket.on('community_post_deleted', onPostDeleted);

    const interval = setInterval(() => {
      fetchPosts();
      fetchBirthdays();
    }, 10000);

    return () => {
      clearInterval(interval);
      socket.off('community_new_post', onNewPost);
      socket.off('community_post_liked', onPostLiked);
      socket.off('community_post_deleted', onPostDeleted);
    };
  }, [activeTab]);

  const fetchPosts = async () => {
    try {
      const url = ENDPOINTS.communityPosts;
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        // Filter out system errors or validation errors
        const ERROR_PATTERNS = [
          /^INVALID\s/i, /^PAYMENT\s/i, /^ERROR:/i, /^FAILED:/i,
          /^DB\s/i, /^SQL/i, /^SEQUELIZE/i, /SequelizeValidation/i,
          /^TypeError/i, /^ReferenceError/i, /^UnhandledPromise/i
        ];
        const clean = (Array.isArray(data) ? data : []).filter((p: any) => {
          if (!p.content) return true;
          return !ERROR_PATTERNS.some(rx => rx.test(p.content.trim()));
        });
        if (clean.length > 0) {
          setPosts(clean);
        } else {
          setPosts(DEFAULT_COMMUNITY_POSTS);
        }
      } else {
        setPosts(DEFAULT_COMMUNITY_POSTS);
      }
    } catch (e) {
      setPosts(DEFAULT_COMMUNITY_POSTS);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const checkAuthAndRun = (action: () => void) => {
    if (!user) {
      // Allow seamless guest participation or prompt gracefully
      action();
      return;
    }
    action();
  };

  const handlePost = async () => {
    if (!draft.trim() && !draftImage) return;
    setPosting(true);

    const newOptimisticPost: PostType = {
      id: `post-${Date.now()}`,
      parentId: replyingTo ? replyingTo.id : null,
      userId: user?.id || user?._id || 'u-local',
      userName: customAuthorName || user?.name || 'Campus Foodie',
      userAvatar: user?.avatar || null,
      content: draft,
      imageUrl: draftImage,
      likes: 1,
      likedBy: [user?.id || user?._id || 'u-local'],
      replyCount: 0,
      createdAt: new Date().toISOString(),
      postType: isReviewDraft ? 'review' : 'post',
      starRating: isReviewDraft ? starRating : undefined,
      restaurantName: isReviewDraft ? restaurantName : undefined,
      productName: isReviewDraft ? productName : undefined,
    };

    setPosts(prev => [newOptimisticPost, ...prev]);
    const submittedDraft = draft;
    const submittedImage = draftImage;
    const submittedReplyingTo = replyingTo;
    const submittedReview = isReviewDraft;
    const submittedRating = starRating;
    const submittedRes = restaurantName;
    const submittedProd = productName;

    setDraft('');
    setDraftImage(null);
    setReplyingTo(null);
    setIsReviewDraft(false);
    setRestaurantName('');
    setProductName('');
    setShowComposer(false);

    try {
      const body: Record<string, any> = { content: submittedDraft };
      if (submittedImage) body.imageUrl = submittedImage;
      if (submittedReplyingTo) body.parentId = submittedReplyingTo.id;
      if (customAuthorName) body.authorName = customAuthorName;
      
      if (submittedReview && !submittedReplyingTo) {
        body.postType = 'review';
        body.starRating = submittedRating.toString();
        body.restaurantName = submittedRes;
        body.productName = submittedProd;
      }

      await apiFetch(ENDPOINTS.communityPosts, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (err) {
      console.log('[COMMUNITY_POST_LOCAL_SYNC]');
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (id: string) => {
    if (!user) {
      Alert.alert(
        'Authentication Required',
        'Sign in to your premium Zenvy account to post, reply, or like memories on the community wall.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/login' as any) }
        ]
      );
      return;
    }
    const userId = user ? (user.id || user._id || '') : '';
    if (!userId) return;
    
    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id === id) {
        const isLiked = p.likedBy.includes(userId);
        return {
          ...p,
          likes: isLiked ? Math.max(0, p.likes - 1) : p.likes + 1,
          likedBy: isLiked 
            ? p.likedBy.filter(u => u !== userId) 
            : [...p.likedBy, userId]
        };
      }
      return p;
    }));

    try {
      await apiFetch(ENDPOINTS.communityLike(id), { method: 'PUT' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Post', 'Are you sure you want to remove this memory?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await apiFetch(ENDPOINTS.communityDelete(id), { method: 'DELETE' });
            if (res.ok) {
              setPosts(prev => prev.filter(p => p.id !== id));
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
    ]);
  };

  const toggleThread = (id: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getTimeLeft = (expiresAt?: string | null) => {
    if (!expiresAt) return '48h';
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return 'Expired';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h === 0) return `${m}m left`;
    return `${h}h left`;
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  const filtered = posts.filter(p => {
    if (search) {
      const q = search.toLowerCase();
      const match = (p.content || '').toLowerCase().includes(q) || (p.userName || '').toLowerCase().includes(q) || (p.restaurantName || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (feedCategory === 'reviews') return p.postType === 'review';
    if (feedCategory === 'memories') return p.postType !== 'review';
    if (feedCategory === 'hacks') return (p.content || '').toLowerCase().includes('hack') || (p.content || '').toLowerCase().includes('code') || (p.content || '').toLowerCase().includes('study') || (p.content || '').toLowerCase().includes('fest') || (p.content || '').toLowerCase().includes('football');
    if (feedCategory === 'lost_found') return (p.content || '').toLowerCase().includes('lost') || (p.content || '').toLowerCase().includes('found') || (p.content || '').toLowerCase().includes('gate') || (p.content || '').toLowerCase().includes('library');
    return true;
  });

  const trending = [...posts]
    .sort((a, b) => (b.likes + b.replyCount * 2) - (a.likes + a.replyCount * 2))
    .slice(0, 3);

  const getBgHash = (id: string) => {
    const colors = [
      ['#FBBF24', '#F59E0B'], // amber-400 to orange-500
      ['#38BDF8', '#6366F1'], // sky-400 to indigo-500
      ['#34D399', '#0D9488'], // emerald-400 to teal-500
      ['#FB7185', '#EC4899'], // rose-400 to pink-500
    ];
    const code = id.charCodeAt(id.length - 1) || 0;
    return colors[code % colors.length];
  };

  return (
    <View style={[s.container, { backgroundColor: bg }]}>
      {/* ── HEADER ── */}
      <View style={[s.header, { borderBottomColor: border }]}>
        <View style={s.headerRow}>
          <TouchableOpacity 
            style={s.backBtn} 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              }
              // Force back to home just in case
              router.push('/' as any);
            }}
          >
            <Text style={[s.backText, { color: isDark ? COLORS.gold : '#8b5a2b' }]}>◀ HOME</Text>
          </TouchableOpacity>
          <View style={s.onlineBadge}>
            <View style={s.onlineDot} />
            <Text style={s.onlineText}>{onlineCount} LIVE</Text>
          </View>
        </View>

        <View style={s.titleRow}>
          <View style={[s.titleIcon, { backgroundColor: cardBg }]}><Text style={{ fontSize: 24 }}>📸</Text></View>
          <View>
            <Text style={[s.title, { color: txt }]}>Gallery Wall</Text>
            <Text style={[s.subtitle, { color: txtSec }]}>COMMUNITY MEMORIES</Text>
          </View>
        </View>

        {/* Tab Controls */}
        <View style={[s.tabContainer, { backgroundColor: cardBg, borderColor: border }]}>
          <DopaminePressable 
            style={[s.tabBtn, activeTab === 'all' && [s.tabBtnActive, { backgroundColor: isDark ? COLORS.gold : '#3e2723' }], { flex: 1 }]} 
            onPress={() => setActiveTab('all')}
            sound="tabSwitch"
            activeScale={0.96}
          >
            <Text style={[s.tabLabel, activeTab === 'all' && [s.tabLabelActive, { color: isDark ? '#000' : '#fff' }], { paddingVertical: 8 }]}>ALL POSTS</Text>
          </DopaminePressable>
          <DopaminePressable 
            style={[s.tabBtn, activeTab === 'wall' && [s.tabBtnActive, { backgroundColor: isDark ? COLORS.gold : '#3e2723' }], { flex: 1 }]} 
            onPress={() => setActiveTab('wall')}
            sound="tabSwitch"
            activeScale={0.96}
          >
            <Text style={[s.tabLabel, activeTab === 'wall' && [s.tabLabelActive, { color: isDark ? '#000' : '#fff' }], { paddingVertical: 8 }]}>📸 THE WALL</Text>
          </DopaminePressable>
        </View>

        {/* Search */}
        {activeTab === 'all' && (
          <TextInput 
            style={[s.searchBar, { backgroundColor: cardBg, borderColor: border, color: txt }]} 
            placeholder="Search stories..." 
            placeholderTextColor="#888" 
            value={search} 
            onChangeText={setSearch} 
          />
        )}
      </View>

      {activeTab === 'wall' ? (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
          {/* Wall Sub-Tab Selector */}
          <View style={{ flexDirection: 'row', backgroundColor: cardBg, borderRadius: 16, borderWidth: 1, borderColor: border, padding: 4, marginBottom: 14 }}>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: wallSubTab === 'live' ? (isDark ? COLORS.gold : '#3e2723') : 'transparent' }}
              onPress={() => setWallSubTab('live')}
            >
              <Text style={{ fontSize: 10, fontWeight: '900', color: wallSubTab === 'live' ? (isDark ? '#000' : '#fff') : txtSec, letterSpacing: 1 }}>📸 LIVE CONTEST</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: wallSubTab === 'hof' ? (isDark ? COLORS.gold : '#3e2723') : 'transparent' }}
              onPress={() => setWallSubTab('hof')}
            >
              <Text style={{ fontSize: 10, fontWeight: '900', color: wallSubTab === 'hof' ? (isDark ? '#000' : '#fff') : txtSec, letterSpacing: 1 }}>🏆 HALL OF FAME</Text>
            </TouchableOpacity>
          </View>

          {wallSubTab === 'live' ? (
            <View style={{ flex: 1 }}>
              {/* 🌟 HERO EVENT SPOTLIGHT CARD 🌟 */}
              {activeWallEvent && (
                <View style={{
                  borderRadius: 24,
                  overflow: 'hidden',
                  marginBottom: 16,
                  borderWidth: 1.5,
                  borderColor: isDark ? 'rgba(255, 215, 0, 0.4)' : 'rgba(139, 90, 43, 0.3)',
                  backgroundColor: isDark ? '#121215' : '#FFFDF6',
                  shadowColor: isDark ? '#FFD700' : '#8b5a2b',
                  shadowOpacity: 0.35,
                  shadowRadius: 16,
                  elevation: 8,
                }}>
                  <LinearGradient
                    colors={isDark ? ['rgba(255, 69, 0, 0.25)', 'rgba(255, 215, 0, 0.1)', 'rgba(0,0,0,0)'] : ['rgba(255, 140, 0, 0.15)', 'rgba(255, 215, 0, 0.05)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={{ padding: 18 }}>
                    {/* Top Tag Row */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF8C00', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
                        <Text style={{ fontSize: 12 }}>🔥</Text>
                        <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFF', letterSpacing: 1 }}>LIVE CONTEST</Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16, 185, 129, 0.15)', borderWidth: 1, borderColor: '#10B981', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                        <Text style={{ fontSize: 9, fontWeight: '900', color: '#10B981', letterSpacing: 0.5 }}>
                          {wallSubmissions.reduce((acc, curr) => acc + (curr.likeCount || 0), 0) + 156} VOTES TODAY
                        </Text>
                      </View>
                    </View>

                    {/* Main Title & Description */}
                    <Text style={{ fontSize: 19, fontWeight: '900', color: txt, letterSpacing: 0.5, marginBottom: 4 }}>
                      {activeWallEvent.title || 'Campus Food Photography Clash 🔥'}
                    </Text>
                    <Text style={{ fontSize: 11, color: txtSec, lineHeight: 16, marginBottom: 14 }}>
                      {activeWallEvent.description || 'Vote for the tastiest food snaps on campus & win instant discounts! Votes reshape the wall live in real-time.'}
                    </Text>

                    {/* Countdown & Reward Pills */}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.85)', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 18 }}>⏱️</Text>
                        <View>
                          <Text style={{ fontSize: 7.5, fontWeight: '900', color: txtSec, letterSpacing: 0.8 }}>COUNTDOWN CLASH</Text>
                          <Text style={{ fontSize: 13, fontWeight: '900', color: '#FF5A00' }}>{wallTimeLeft || '17:59:32'}</Text>
                        </View>
                      </View>

                      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.85)', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 18 }}>🎁</Text>
                        <View>
                          <Text style={{ fontSize: 7.5, fontWeight: '900', color: txtSec, letterSpacing: 0.8 }}>REWARD COUPON</Text>
                          <Text style={{ fontSize: 13, fontWeight: '900', color: '#10B981' }}>
                            ₹{activeWallEvent.couponValue || 200} {activeWallEvent.couponCode ? `(${activeWallEvent.couponCode})` : 'OFF'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* 1-Tap Claim Coupon Button */}
                    <TouchableOpacity
                      style={{
                        marginTop: 12,
                        backgroundColor: '#FF8C00',
                        paddingVertical: 10,
                        paddingHorizontal: 16,
                        borderRadius: 14,
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 8,
                        shadowColor: '#FF8C00',
                        shadowOpacity: 0.4,
                        shadowRadius: 8,
                        elevation: 4
                      }}
                      onPress={() => handleClaimCoupon(activeWallEvent.couponCode || 'WALL200', activeWallEvent.couponValue || 200)}
                    >
                      <Text style={{ fontSize: 13, color: '#FFF' }}>🎁</Text>
                      <Text style={{ fontSize: 10, fontWeight: '900', color: '#FFF', letterSpacing: 1 }}>
                        {claimedCoupon ? 'COUPON UNLOCKED & READY! 🎉' : `CLAIM ₹${activeWallEvent.couponValue || 200} DISCOUNT COUPON ➔`}
                      </Text>
                    </TouchableOpacity>

                    {userWallSubmission && (
                      <View style={{ marginTop: 12, padding: 8, borderRadius: 10, backgroundColor: userWallSubmission.isApproved ? 'rgba(74,222,128,0.1)' : 'rgba(250,204,21,0.1)', borderWidth: 1, borderColor: userWallSubmission.isApproved ? '#4ADE80' : '#FACC15', alignItems: 'center' }}>
                        <Text style={{ fontSize: 9, fontWeight: '900', color: userWallSubmission.isApproved ? '#4ADE80' : '#FACC15' }}>
                          {userWallSubmission.isApproved ? '✅ YOUR PHOTO IS LIVE ON THE WALL!' : '⏳ YOUR SUBMISSION IS PENDING ADMIN MODERATION'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Dynamic Masonry Mosaic Grid */}
              {loadingWall ? (
                <ActivityIndicator size="large" color={isDark ? COLORS.gold : '#8b5a2b'} style={{ marginVertical: 36 }} />
              ) : wallSubmissions.length === 0 ? (
                <View style={s.emptyState}>
                  <Text style={{ fontSize: 40, marginBottom: 8 }}>🖼️</Text>
                  <Text style={[s.emptyTitle, { color: isDark ? COLORS.gold : '#8b5a2b' }]}>THE WALL IS EMPTY</Text>
                  <Text style={[s.emptySubtitle, { color: txtSec }]}>Be the first student to upload a photo for this contest!</Text>
                </View>
              ) : (
                <View style={{ paddingBottom: 80, marginTop: 4 }}>
                  {/* #1 HERO LEADER CARD */}
                  {wallSubmissions.length > 0 && (() => {
                    const topSub = wallSubmissions[0];
                    const isLiked = userLikedWallSubmissionIds.includes(topSub.id);
                    return (
                      <View
                        key={topSub.id}
                        style={{
                          width: '100%',
                          height: 280,
                          borderRadius: 24,
                          backgroundColor: cardBg,
                          borderColor: '#FFD700',
                          borderWidth: 2,
                          shadowColor: '#FFD700',
                          shadowOpacity: 0.5,
                          shadowRadius: 16,
                          elevation: 10,
                          position: 'relative',
                          marginBottom: 14,
                          overflow: 'hidden'
                        }}
                      >
                        <TouchableOpacity activeOpacity={0.9} style={{ flex: 1 }} onPress={() => setSelectedImage(topSub.imageUrl)}>
                          <Image 
                            source={{ uri: getImageUrl(topSub.imageUrl) }} 
                            style={{ width: '100%', height: '100%' }} 
                            contentFit="cover"
                          />

                          {/* Leader Crown Badge Top-Left */}
                          <View style={{ position: 'absolute', top: 14, left: 14, backgroundColor: '#FF8C00', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, zIndex: 10 }}>
                            <Text style={{ fontSize: 14 }}>👑</Text>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFF', letterSpacing: 1 }}>CURRENT #1 LEADER</Text>
                          </View>

                          {/* Heart Vote Button Top-Right */}
                          <TouchableOpacity
                            style={{ position: 'absolute', top: 14, right: 14, backgroundColor: isLiked ? 'rgba(239,79,95,0.95)' : 'rgba(0,0,0,0.65)', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', zIndex: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
                            onPress={() => handleWallLike(topSub.id)}
                          >
                            <Text style={{ fontSize: 18 }}>{isLiked ? '❤️' : '🤍'}</Text>
                          </TouchableOpacity>

                          {/* Bottom Glassmorphic Overlay */}
                          <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.92)']}
                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}
                          >
                            <View style={{ flex: 1, paddingRight: 10 }}>
                              <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFD700', letterSpacing: 1, marginBottom: 2 }}>SPOTLIGHT ENTRY</Text>
                              <Text style={{ fontSize: 15, fontWeight: '900', color: '#FFF' }} numberOfLines={1}>
                                {topSub.user?.name || 'Student'}
                              </Text>
                            </View>
                            <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,215,0,0.5)' }}>
                              <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFD700' }}>❤️ {topSub.likeCount} Votes</Text>
                            </View>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    );
                  })()}

                  {/* RUNNER-UP 2-COLUMN GRID (#2, #3, #4, ...) */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}>
                    {wallSubmissions.slice(1).map((sub, index) => {
                      const rank = index + 2;
                      const isLiked = userLikedWallSubmissionIds.includes(sub.id);

                      return (
                        <View
                          key={sub.id}
                          style={{
                            width: '48%',
                            height: 180,
                            backgroundColor: cardBg,
                            borderColor: border,
                            borderWidth: 1,
                            borderRadius: 18,
                            overflow: 'hidden',
                            position: 'relative',
                            marginBottom: 4
                          }}
                        >
                          <TouchableOpacity activeOpacity={0.9} style={{ flex: 1 }} onPress={() => setSelectedImage(sub.imageUrl)}>
                            <Image 
                              source={{ uri: getImageUrl(sub.imageUrl) }} 
                              style={{ width: '100%', height: '100%' }} 
                              contentFit="cover"
                            />

                            {/* Rank Badge */}
                            <View style={{ position: 'absolute', top: 10, right: 48, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFF' }}>#{rank}</Text>
                            </View>

                            {/* Heart Vote Button */}
                            <TouchableOpacity
                              style={{ position: 'absolute', top: 10, right: 10, backgroundColor: isLiked ? 'rgba(239,79,95,0.95)' : 'rgba(0,0,0,0.6)', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 20 }}
                              onPress={() => handleWallLike(sub.id)}
                            >
                              <Text style={{ fontSize: 14 }}>{isLiked ? '❤️' : '🤍'}</Text>
                            </TouchableOpacity>

                            {/* Bottom User & Vote Count Gradient Overlay */}
                            <LinearGradient
                              colors={['transparent', 'rgba(0,0,0,0.88)']}
                              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 10, paddingVertical: 10, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}
                            >
                              <View style={{ flex: 1, paddingRight: 6 }}>
                                <Text style={{ fontSize: 11, fontWeight: '900', color: '#FFF' }} numberOfLines={1}>
                                  {sub.user?.name || 'Student'}
                                </Text>
                              </View>
                              <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={{ fontSize: 10, fontWeight: '900', color: '#FFD700' }}>❤️ {sub.likeCount}</Text>
                              </View>
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Bottom Votes Bar (Matching Mockup 1) */}
              <View style={{ paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: border, marginTop: 10 }}>
                <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? COLORS.gold : '#8b5a2b' }}>
                  Votes today: 3 of 5 used 🔥🔥
                </Text>
              </View>

              {/* Floating Submission Action Button (Matching Mockup 1 FAB) */}
              {activeWallEvent && (!userWallSubmission || user?.role?.toLowerCase() === 'admin') && (
                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    bottom: 20,
                    right: 16,
                    backgroundColor: '#FF8C00',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 25,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    shadowColor: '#FF8C00',
                    shadowOpacity: 0.6,
                    shadowRadius: 10,
                    elevation: 8,
                    zIndex: 99
                  }}
                  onPress={() => checkAuthAndRun(() => setShowWallSubmitModal(true))}
                >
                  <Text style={{ fontSize: 18, color: '#FFF' }}>📸</Text>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#FFF', letterSpacing: 1 }}>SUBMIT PHOTO</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            /* HALL OF FAME TIMELINE VIEW (Matching Mockup 2) */
            <View style={{ flex: 1, backgroundColor: '#080c1d', borderRadius: 24, padding: 16, paddingBottom: 40 }}>
              {/* Header Title */}
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#FFD700', letterSpacing: 1 }}>HALL OF FAME ⭐</Text>
                <Text style={{ fontSize: 8, fontWeight: '900', color: '#94A3B8', letterSpacing: 2, marginTop: 2 }}>PAST CHAMPIONS OF THE WALL</Text>
              </View>

              {wallHistory.length === 0 ? (
                <View style={s.emptyState}>
                  <Text style={{ fontSize: 40, marginBottom: 8 }}>🏛️</Text>
                  <Text style={[s.emptyTitle, { color: '#FFD700' }]}>HALL OF FAME EMPTY</Text>
                  <Text style={[s.emptySubtitle, { color: '#94A3B8' }]}>Past contest winners will be archived here once active events finish.</Text>
                </View>
              ) : (
                <View style={{ position: 'relative', width: '100%', paddingVertical: 10 }}>
                  {/* Central Vertical Gold Timeline Bar (Mockup 2) */}
                  <View style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, backgroundColor: 'rgba(255,215,0,0.5)', transform: [{ translateX: -1 }] }} />

                  <View style={{ gap: 28 }}>
                    {wallHistory.map((item, index) => {
                      const isEven = index % 2 === 0;
                      return (
                        <View
                          key={item.event.id}
                          style={{
                            width: '100%',
                            flexDirection: 'row',
                            justifyContent: isEven ? 'flex-start' : 'flex-end',
                            alignItems: 'center',
                            position: 'relative'
                          }}
                        >
                          {/* Timeline Node Avatar (Matching Laurel Wreath Gold Frame in Mockup 2) */}
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => setSelectedHofWinner(item)}
                            style={{
                              width: '45%',
                              alignItems: 'center',
                              padding: 10,
                              backgroundColor: 'rgba(15,23,42,0.85)',
                              borderRadius: 18,
                              borderWidth: 1.5,
                              borderColor: '#FFD700',
                              shadowColor: '#FFD700',
                              shadowOpacity: 0.4,
                              shadowRadius: 8
                            }}
                          >
                            {/* Crown on top of Avatar Circle */}
                            <View style={{ position: 'absolute', top: -10, zIndex: 10 }}>
                              <Text style={{ fontSize: 16 }}>👑</Text>
                            </View>

                            <View style={{ width: 60, height: 60, borderRadius: 30, overflow: 'hidden', borderWidth: 2, borderColor: '#FFD700', marginVertical: 4, backgroundColor: '#000' }}>
                              {item.winningSubmission?.imageUrl ? (
                                <Image source={{ uri: getImageUrl(item.winningSubmission.imageUrl) }} style={{ width: '100%', height: '100%' }} />
                              ) : (
                                <Text style={{ fontSize: 24, alignSelf: 'center', marginTop: 10 }}>🏆</Text>
                              )}
                            </View>

                            <Text style={{ fontSize: 8, fontWeight: '900', color: '#FFD700', letterSpacing: 1, marginTop: 2 }}>
                              {new Date(item.event.endTime).toLocaleString('default', { month: 'short', year: 'numeric' }).toUpperCase()}
                            </Text>

                            <Text style={{ fontSize: 10, fontWeight: '900', color: '#FFF', textAlign: 'center', marginTop: 2 }} numberOfLines={1}>
                              {item.winner?.name || 'Champion'}
                            </Text>

                            <Text style={{ fontSize: 8, color: '#94A3B8', marginTop: 2 }}>
                              ❤️ {item.winningSubmission?.likeCount || 0} Votes
                            </Text>

                            {item.event.couponCode && (
                              <View style={{ marginTop: 4, backgroundColor: 'rgba(74,222,128,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#4ADE80' }}>
                                <Text style={{ fontSize: 7, fontWeight: '900', color: '#4ADE80' }}>₹{item.event.couponValue || 150} ({item.event.couponCode})</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* 👥 SECURE FRIENDS UPLINK */}
        <DopaminePressable
          style={[
            s.friendsCard,
            {
              backgroundColor: cardBg,
              borderColor: isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 90, 43, 0.15)',
              shadowColor: isDark ? '#D4AF37' : '#8b5a2b',
            }
          ]}
          onPress={() => router.push('/friends' as any)}
          sound="click"
          activeScale={0.97}
        >
          <LinearGradient
            colors={isDark ? ['rgba(212, 175, 55, 0.08)', 'rgba(0, 0, 0, 0)'] : ['rgba(139, 90, 43, 0.04)', 'rgba(0, 0, 0, 0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.friendsGradient}
          />
          <View style={s.friendsCardHeader}>
            <View style={s.friendsIconContainer}>
              <Text style={{ fontSize: 20 }}>👥</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.friendsCardTitle, { color: txt }]}>Secure Friends Uplink</Text>
              <Text style={[s.friendsCardSub, { color: isDark ? COLORS.gold : '#8b5a2b' }]}>END-TO-END ENCRYPTED CHATS</Text>
            </View>
            <View style={s.streakPulseContainer}>
              <FloatingPulse color="#FF5A00">
                <Text style={{ fontSize: 10 }}>🔥</Text>
              </FloatingPulse>
            </View>
          </View>
          <Text style={[s.friendsCardBody, { color: txtSec }]}>
            Connect with campus friends, chat securely, and build daily fire streaks. Sync your contacts to see who is online!
          </Text>
          <View style={s.friendsFooter}>
            <Text style={[s.friendsFooterText, { color: isDark ? COLORS.gold : '#8b5a2b' }]}>ENTER THE SECURE VAULT →</Text>
          </View>
        </DopaminePressable>

        {/* ── BIRTHDAY CELEBRATIONS STORY ROW ── */}
        <View style={s.birthdaySection}>
          <View style={s.birthdaySectionHeader}>
            <Text style={[s.birthdaySectionTitle, { color: isDark ? COLORS.gold : '#8b5a2b' }]}>🎂 TODAY'S CELEBRATIONS</Text>
            {user?.role?.toLowerCase() === 'admin' && pendingBirthdays.length > 0 && (
              <TouchableOpacity onPress={() => setShowAdminPanelModal(true)}>
                <Text style={[s.adminBadgeText, { color: COLORS.red }]}>ADMIN QUEUE ({pendingBirthdays.length})</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} style={s.birthdayScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 14, alignItems: 'center' }}>
            {/* Nominate / Add Story */}
            <TouchableOpacity 
              style={s.birthdayStoryCard} 
              onPress={() => checkAuthAndRun(() => setShowRegisterBirthdayModal(true))}
            >
              <View style={[s.addBirthdayStoryCircle, { borderColor: border }]}>
                <Text style={{ fontSize: 22, color: txtSec }}>➕</Text>
              </View>
              <Text style={[s.birthdayStoryName, { color: txtSec }]} numberOfLines={1}>Nominate</Text>
            </TouchableOpacity>

            {/* Birthday Stories */}
            {birthdays.map(b => (
              <TouchableOpacity 
                key={b.id} 
                style={s.birthdayStoryCard} 
                onPress={() => openBirthdayDetail(b)}
              >
                <PulseGlow size={66} color="#FF69B4">
                  <View style={s.birthdayStoryCircle}>
                    {b.candidatePhotoUrl && !imageErrors[b.id] ? (
                      <Image 
                        source={{ uri: getImageUrl(b.candidatePhotoUrl) }} 
                        style={s.birthdayStoryImg} 
                        onError={() => {
                          setImageErrors(prev => ({ ...prev, [b.id]: true }));
                        }}
                      />
                    ) : (
                      <View style={[s.birthdayStoryTextImg, { backgroundColor: isDark ? '#1C161D' : '#FFF0F5' }]}>
                        <Text style={{ fontSize: 24 }}>🎂</Text>
                      </View>
                    )}
                  </View>
                </PulseGlow>
                <Text style={[s.birthdayStoryName, { color: txt }]} numberOfLines={1}>{b.candidateName}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── TRENDING ── */}
        {!search && trending.length > 0 && posts.length > 3 && (
          <View style={s.trendingSection}>
            <Text style={[s.trendingTitle, { color: isDark ? COLORS.gold : '#8b5a2b' }]}>🔥 TRENDING NOW</Text>
            <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} style={s.trendingScroll}>
              {trending.map(tp => (
                <View key={tp.id} style={[s.trendingCard, { backgroundColor: cardBg, borderColor: border }]}>
                  <View style={s.trendingUserRow}>
                    <View style={s.trendingAvatar}><Text style={s.avatarText}>{(tp.userName||'A').charAt(0)}</Text></View>
                    <Text style={[s.trendingUser, { color: txt }]} numberOfLines={1}>{tp.userName}</Text>
                  </View>
                  <Text style={[s.trendingContent, { color: txtSec }]} numberOfLines={2}>{tp.content}</Text>
                  <View style={s.trendingStats}>
                    <Text style={s.trendingStat}>♥ {tp.likes}</Text>
                    <Text style={s.trendingStat}>💬 {tp.replyCount}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── ⚡ CAMPUS CLASH LIVE POLL ── */}
        <View style={{
          marginHorizontal: 16,
          marginTop: 14,
          marginBottom: 16,
          borderRadius: 20,
          padding: 16,
          backgroundColor: cardBg,
          borderWidth: 1.5,
          borderColor: isDark ? 'rgba(255,215,0,0.35)' : 'rgba(139,90,43,0.2)',
          shadowColor: isDark ? '#FFD700' : '#8b5a2b',
          shadowOpacity: 0.15,
          shadowRadius: 10,
          elevation: 5
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,140,0,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#FF8C00' }}>
              <Text style={{ fontSize: 10 }}>⚡</Text>
              <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#FF8C00', letterSpacing: 1 }}>CAMPUS CLASH OF THE DAY</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
              <Text style={{ fontSize: 9, fontWeight: '900', color: '#10B981' }}>{campusPoll.totalVotes} VOTES</Text>
            </View>
          </View>

          <Text style={{ fontSize: 14, fontWeight: '900', color: txt, marginBottom: 12, letterSpacing: 0.2 }}>
            {campusPoll.question}
          </Text>

          <View style={{ gap: 8 }}>
            {campusPoll.options.map((opt) => {
              const percentage = campusPoll.totalVotes > 0 ? Math.round((opt.votes / campusPoll.totalVotes) * 100) : 0;
              const isSelected = campusPoll.userVotedOptionId === opt.id;

              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.85}
                  style={{
                    position: 'relative',
                    borderRadius: 12,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: isSelected ? (isDark ? COLORS.gold : '#8b5a2b') : border,
                    backgroundColor: isDark ? '#1C1B1F' : '#F9F8F4',
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    justifyContent: 'center'
                  }}
                  onPress={() => handleVotePoll(opt.id)}
                >
                  {/* Animated Progress Fill */}
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: 0,
                      width: `${percentage}%`,
                      backgroundColor: isSelected ? (isDark ? 'rgba(255,215,0,0.28)' : 'rgba(139,90,43,0.2)') : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                      borderRadius: 12
                    }}
                  />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: isSelected ? '900' : '700', color: isSelected ? (isDark ? COLORS.gold : '#8b5a2b') : txt }}>
                      {opt.text} {isSelected && '✓'}
                    </Text>
                    <Text style={{ fontSize: 10.5, fontWeight: '900', color: isSelected ? (isDark ? COLORS.gold : '#8b5a2b') : txtSec }}>
                      {percentage}%
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 🏷️ CATEGORY FILTER CHIPS ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 12 }}>
          {[
            { id: 'all', label: '✨ All Stories', count: posts.length },
            { id: 'memories', label: '📸 Campus Life', count: posts.filter(p => p.postType !== 'review').length },
            { id: 'reviews', label: '⭐ Food Reviews', count: posts.filter(p => p.postType === 'review').length },
            { id: 'hacks', label: '💻 Hostel Hacks', count: 3 },
            { id: 'lost_found', label: '🔍 Lost & Found', count: 1 }
          ].map(cat => {
            const isActive = feedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: isActive ? (isDark ? COLORS.gold : '#3e2723') : cardBg,
                  borderColor: isActive ? (isDark ? COLORS.gold : '#3e2723') : border,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 20
                }}
                onPress={() => setFeedCategory(cat.id as any)}
              >
                <Text style={{ fontSize: 10, fontWeight: '900', color: isActive ? (isDark ? '#000' : '#fff') : txtSec }}>
                  {cat.label}
                </Text>
                <View style={{ backgroundColor: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.06)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
                  <Text style={{ fontSize: 8, fontWeight: '900', color: isActive ? (isDark ? '#000' : '#fff') : txtSec }}>{cat.count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Hanging Rope String Indicator */}
        <View style={[s.stringLine, { backgroundColor: isDark ? 'rgba(212,175,122,0.3)' : 'rgba(139,90,43,0.15)' }]} />

        {/* ── POLAROID GALLERY ── */}
        {loading ? (
          <ActivityIndicator size="large" color={isDark ? COLORS.gold : '#8b5a2b'} style={{ marginVertical: 48 }} />
        ) : filtered.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🖼️</Text>
            <Text style={[s.emptyTitle, { color: isDark ? COLORS.gold : '#8b5a2b' }]}>BLANK CANVAS</Text>
            <Text style={[s.emptySubtitle, { color: txtSec }]}>Hang the first photo on the wall.</Text>
          </View>
        ) : (
          <View style={s.galleryGrid}>
            {filtered.map((post, idx) => {
              const bgGrad = getBgHash(post.id);
              const userId = user ? (user.id || user._id || '') : '';
              const isLiked = userId ? post.likedBy.includes(userId) : false;
              const rotation = (idx % 2 === 0 ? '-1.5deg' : '1.5deg');

              return (
                <StaggeredSection 
                  key={post.id} 
                  delay={50 + (idx % 6) * 50} 
                  direction="up"
                  style={[s.polaroidWrapper, { transform: [{ rotate: rotation }] }]}
                >
                  {/* Peg Wooden Clip */}
                  <View style={s.pegClip} />

                  {/* Polaroid Frame */}
                  <CardPressable 
                    style={[s.polaroidFrame, { backgroundColor: cardBg, borderColor: border }]} 
                    onPress={() => post.imageUrl ? setSelectedImage(post.imageUrl) : null} 
                    tilt={false} // Disabled 3D tilt to eliminate JS thread lag
                  >
                    {post.imageUrl && !imageErrors[post.id] ? (
                      <Image 
                        source={{ uri: post.imageUrl }} 
                        style={s.polaroidImg} 
                        onError={() => {
                          setImageErrors(prev => ({ ...prev, [post.id]: true }));
                        }}
                      />
                    ) : (
                      <View style={[s.textPostBg, { backgroundColor: bgGrad[0] }]}>
                        <Text style={s.textPostContent} numberOfLines={8}>{post.content || 'Memory Image unavailable'}</Text>
                      </View>
                    )}

                    {/* Footer Details */}
                    <View style={s.polaroidDetails}>
                      {post.imageUrl && post.content ? (
                        <Text style={[s.polaroidDesc, { color: txt }]} numberOfLines={3}>"{post.content}"</Text>
                      ) : null}

                      {/* Review details */}
                      {post.postType === 'review' && (
                        <View style={[s.reviewMeta, { backgroundColor: isDark ? '#1C1B1F' : 'rgba(139,90,43,0.04)', borderColor: border }]}>
                          <Text style={s.reviewStars}>{'★'.repeat(post.starRating || 5)}</Text>
                          {post.restaurantName ? (
                            <Text style={[s.reviewRestaurant, { color: isDark ? COLORS.gold : '#8b5a2b' }]} numberOfLines={1}>📍 {post.restaurantName.toUpperCase()}</Text>
                          ) : null}
                          {post.productName ? (
                            <Text style={[s.reviewProduct, { color: txtSec }]} numberOfLines={1}>🍽️ {post.productName}</Text>
                          ) : null}
                        </View>
                      )}

                      {/* User Row */}
                      <View style={[s.polaroidUserRow, { borderBottomColor: border }]}>
                        <View style={s.authorAvatar}>
                          <Text style={s.authorAvatarText}>{(post.userName||'A').charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.authorName, { color: txt }]} numberOfLines={1}>{post.userName.toUpperCase()}</Text>
                          <Text style={s.postTime}>{formatTime(post.createdAt)}</Text>
                        </View>
                        {post.postType !== 'review' && (
                          <View style={s.expiryBadge}>
                            <Text style={s.expiryText}>{getTimeLeft(post.expiresAt)}</Text>
                          </View>
                        )}
                      </View>

                      {/* Actions */}
                      <View style={s.actionsRow}>
                        <DopaminePressable style={s.actionBtn} onPress={() => handleLike(post.id)} sound="click" activeScale={0.88}>
                          <Text style={[s.actionText, isLiked && { color: COLORS.red }]}>
                            {isLiked ? '❤️' : '🤍'} {post.likes}
                          </Text>
                        </DopaminePressable>

                        <DopaminePressable style={s.actionBtn} onPress={() => {
                          checkAuthAndRun(() => {
                            setReplyingTo(post);
                            setShowComposer(true);
                          });
                        }} sound="click" activeScale={0.88}>
                          <Text style={s.actionText}>💬 {post.replyCount}</Text>
                        </DopaminePressable>

                        {user && post.userId === (user.id || user._id || '') ? (
                          <DopaminePressable style={s.actionBtn} onPress={() => handleDelete(post.id)} sound="click" activeScale={0.88}>
                            <Text style={[s.actionText, { color: COLORS.red }]}>🗑️</Text>
                          </DopaminePressable>
                        ) : null}
                      </View>

                      {/* Replies */}
                      {post.replies && post.replies.length > 0 ? (
                        <TouchableOpacity 
                          style={s.repliesTrigger} 
                          onPress={() => toggleThread(post.id)}
                        >
                          <Text style={[s.repliesTriggerText, { color: isDark ? COLORS.gold : '#8b5a2b' }]}>
                            {expandedThreads.has(post.id) ? 'HIDE REPLIES ▲' : `SHOW REPLIES (${post.replies.length}) ▼`}
                          </Text>
                        </TouchableOpacity>
                      ) : null}

                      {expandedThreads.has(post.id) && post.replies && (
                        <View style={[s.repliesBox, { borderTopColor: border }]}>
                          {post.replies.map(r => (
                            <View key={r.id} style={s.replyItem}>
                              <Text style={[s.replyUser, { color: txt }]}>{r.userName.toUpperCase()}:</Text>
                              <Text style={[s.replyText, { color: txtSec }]}>{r.content}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                    </View>
                  </CardPressable>
                </StaggeredSection>
              );
            })}
          </View>
        )}
      </ScrollView>
    )}

      {/* Floating Compose Button (Only on ALL POSTS tab) */}
      {activeTab === 'all' && (
        <FloatingPulse color={isDark ? COLORS.gold : '#8b5a2b'} style={s.composeFabWrap}>
          <ActionPressable 
            style={[s.composeFab, { backgroundColor: isDark ? COLORS.gold : '#8b5a2b' }]} 
            onPress={() => {
              checkAuthAndRun(() => {
                setReplyingTo(null);
                setShowComposer(true);
              });
            }}
            sound="click"
          >
            <Text style={{ fontSize: 24, color: '#fff' }}>+</Text>
          </ActionPressable>
        </FloatingPulse>
      )}
      <Modal visible={showComposer} animationType="slide" transparent={true}>
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setShowComposer(false); }}>
            <View style={s.composerOverlay}>
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                <View style={[s.composerContent, { backgroundColor: cardBg, maxHeight: '85%' }]}>
                  <View style={s.dragHandle} />

                  <ScrollView 
                    showsVerticalScrollIndicator={false} 
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                  >
                    {replyingTo && (
                      <View style={[s.replyBanner, { backgroundColor: isDark ? '#1C1B1F' : 'rgba(139,90,43,0.05)', borderColor: border }]}>
                        <Text style={[s.replyBannerText, { color: isDark ? COLORS.gold : '#8b5a2b' }]}>REPLYING TO {replyingTo.userName.toUpperCase()}</Text>
                        <Text style={[s.replyBannerSub, { color: txtSec }]} numberOfLines={1}>{replyingTo.content}</Text>
                      </View>
                    )}

                    <Text style={[s.composerTitle, { color: txt }]}>{replyingTo ? 'REPLY TO THREAD' : 'PIN NEW MEMORY'}</Text>
                    
                    <TextInput 
                      style={[s.composerInputName, { backgroundColor: isDark ? '#222' : '#fff', borderColor: border, color: txt }]} 
                      placeholder="Display Name..." 
                      placeholderTextColor="#888" 
                      value={customAuthorName} 
                      onChangeText={setCustomAuthorName} 
                    />

                    {!replyingTo && (
                      <View style={[s.reviewToggleRow, { backgroundColor: isDark ? '#222' : '#fff', borderColor: border }]}>
                        <Text style={[s.reviewToggleLabel, { color: txt }]}>POST AS FOOD REVIEW?</Text>
                        <TouchableOpacity 
                          style={[s.toggleBtn, isReviewDraft && [s.toggleBtnActive, { backgroundColor: isDark ? COLORS.gold : '#8b5a2b', borderColor: isDark ? COLORS.gold : '#8b5a2b' }]] as any}
                          onPress={() => setIsReviewDraft(!isReviewDraft)}
                        >
                          <Text style={[s.toggleBtnText, isReviewDraft && { color: isDark ? '#000' : '#fff' }]}>
                            {isReviewDraft ? 'YES' : 'NO'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {isReviewDraft && !replyingTo && (
                      <View style={[s.reviewFields, { backgroundColor: isDark ? '#1C1B1F' : 'rgba(139,90,43,0.04)', borderColor: border }]}>
                        <View style={s.ratingStarsRow}>
                          {[1, 2, 3, 4, 5].map(star => (
                            <DopaminePressable key={star} onPress={() => setStarRating(star)} sound="click" activeScale={0.88}>
                              <Text style={[s.starIcon, starRating >= star && { color: '#F59E0B' }]}>★</Text>
                            </DopaminePressable>
                          ))}
                        </View>
                        <TextInput style={[s.reviewInputField, { backgroundColor: isDark ? '#222' : '#fff', borderColor: border, color: txt }]} placeholder="Restaurant Name" placeholderTextColor="#999" value={restaurantName} onChangeText={setRestaurantName} />
                        <TextInput style={[s.reviewInputField, { backgroundColor: isDark ? '#222' : '#fff', borderColor: border, color: txt }]} placeholder="Dish Name" placeholderTextColor="#999" value={productName} onChangeText={setProductName} />
                      </View>
                    )}

                    {/* Mood Selector Chips */}
                    <View style={{ marginBottom: 12 }}>
                      <Text style={{ fontSize: 9, fontWeight: '900', color: txtSec, letterSpacing: 1, marginBottom: 6 }}>SELECT CAMPUS MOOD / TAG</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                        {['🌶️ Spicy Cravings', '🧀 Cheesy Pull', '💻 3 AM Hackathon', '🎸 Fest Vibes', '⚽ Sports Win', '📚 Exam Grind', '🎉 Room Party'].map(mood => {
                          const isSel = selectedMood === mood;
                          return (
                            <TouchableOpacity
                              key={mood}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 14,
                                backgroundColor: isSel ? (isDark ? COLORS.gold : '#3e2723') : (isDark ? '#222' : '#F5F5F0'),
                                borderWidth: 1,
                                borderColor: isSel ? (isDark ? COLORS.gold : '#3e2723') : border
                              }}
                              onPress={() => {
                                if (selectedMood === mood) {
                                  setSelectedMood(null);
                                } else {
                                  setSelectedMood(mood);
                                  if (!draft.includes(mood)) {
                                    setDraft(prev => prev ? `[${mood}] ${prev}` : `[${mood}] `);
                                  }
                                }
                              }}
                            >
                              <Text style={{ fontSize: 9.5, fontWeight: '800', color: isSel ? (isDark ? '#000' : '#fff') : txt }}>{mood}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    <TextInput 
                      style={[s.composerTextArea, { backgroundColor: isDark ? '#222' : '#fff', borderColor: border, color: txt }]} 
                      placeholder={replyingTo ? 'Write a reply...' : 'Write something beautiful...'} 
                      placeholderTextColor="#888" 
                      multiline 
                      numberOfLines={4} 
                      value={draft} 
                      onChangeText={setDraft} 
                    />

                    <TouchableOpacity 
                      style={[s.composerInputName, { backgroundColor: isDark ? '#222' : '#fff', borderColor: border, justifyContent: 'center', alignItems: 'center' }]} 
                      onPress={pickImage}
                    >
                      <Text style={{ color: txt, fontSize: 11, fontWeight: '700' }}>
                        {draftImage ? '🖼️ Image Selected (Tap to change)' : '📸 Upload Photo from Gallery'}
                      </Text>
                    </TouchableOpacity>

                    {draftImage ? (
                      <Image source={{ uri: draftImage }} style={s.composerImgPreview} />
                    ) : null}

                    <View style={s.composerActions}>
                      <DopaminePressable style={[s.composerCancel, { flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }]} onPress={() => setShowComposer(false)} sound="click">
                        <Text style={[s.cancelText, { color: txtSec }]}>CANCEL</Text>
                      </DopaminePressable>

                      <ActionPressable 
                        style={[s.composerSubmit, { backgroundColor: isDark ? COLORS.gold : '#8b5a2b' }, posting && { opacity: 0.5 }, { flex: 2 }] as any} 
                        onPress={handlePost} 
                        disabled={posting}
                        sound="success"
                      >
                        {posting ? (
                          <ActivityIndicator size="small" color={isDark ? '#000' : '#fff'} />
                        ) : (
                          <Text style={[s.submitText, { color: isDark ? '#000' : '#fff' }]}>{replyingTo ? 'REPLY 💬' : 'PIN POST 📌'}</Text>
                        )}
                      </ActionPressable>
                    </View>

                    {/* Extra padding so content is visible above keyboard */}
                    <View style={{ height: 20 }} />
                  </ScrollView>

                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── LIGHTBOX MODAL ── */}
      <Modal visible={!!selectedImage} transparent={true} animationType="fade">
        <TouchableOpacity 
          style={s.lightboxOverlay} 
          activeOpacity={1} 
          onPress={() => setSelectedImage(null)}
        >
          {selectedImage && (
            <Image source={{ uri: selectedImage }} style={s.lightboxImg} />
          )}
        </TouchableOpacity>
      </Modal>

      {/* ── BIRTHDAY WISHING MODAL ── */}
      <Modal visible={showBirthdayWishModal} transparent={true} animationType="slide">
        <View style={s.bdayOverlay}>
          {/* Confetti cannon! */}
          <ConfettiCannon />

          <TouchableWithoutFeedback onPress={() => setShowBirthdayWishModal(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
            style={s.bdayCardWrapper}
          >
            <View style={[s.bdayCard, { backgroundColor: isDark ? '#141416' : '#fff', maxHeight: SH * 0.85 }]}>
              <ScrollView 
                style={{ width: '100%' }}
                contentContainerStyle={{ alignItems: 'center' }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Card Header decoration */}
                <View style={s.bdayHeaderDecor}>
                  <Text style={{ fontSize: 24 }}>✨🎉🥳🎉✨</Text>
                </View>

                {/* Close Button */}
                <TouchableOpacity style={s.bdayCloseBtn} onPress={() => setShowBirthdayWishModal(false)}>
                  <Text style={{ fontSize: 18, color: txtSec }}>✕</Text>
                </TouchableOpacity>

                {selectedBirthday && (
                  <>
                    {/* Large Avatar container */}
                    <PulseGlow size={110} color="#FF69B4">
                      <View style={s.bdayLargeAvatarRing}>
                        {selectedBirthday.candidatePhotoUrl && !imageErrors[selectedBirthday.id] ? (
                          <Image 
                            source={{ uri: getImageUrl(selectedBirthday.candidatePhotoUrl) }} 
                            style={s.bdayLargeAvatarImg} 
                            onError={() => {
                              setImageErrors(prev => ({ ...prev, [selectedBirthday.id]: true }));
                            }}
                          />
                        ) : (
                          <Text style={{ fontSize: 44 }}>🎂</Text>
                        )}
                      </View>
                    </PulseGlow>

                    {/* Name and count */}
                    <Text style={[s.bdayCandidateName, { color: txt }]}>{selectedBirthday.candidateName}</Text>
                    <Text style={[s.bdayWishCountText, { color: isDark ? COLORS.gold : '#8b5a2b' }]}>
                      ❤️ {selectedBirthday.wishCount || 0} peer wishes received today!
                    </Text>

                    {/* Wishes Scroll View */}
                    <View style={[s.bdayWishesContainer, { borderColor: border }]}>
                      <ScrollView 
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled
                        style={{ flex: 1 }}
                      >
                        {selectedBirthdayWishes.length === 0 ? (
                          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                            <Text style={{ color: txtSec, fontSize: 10, fontWeight: '700' }}>No wishes yet. Be the first! 👇</Text>
                          </View>
                        ) : (
                          selectedBirthdayWishes.map((w, idx) => (
                            <View key={w.id || idx} style={[s.wishBubble, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                              <Text style={[s.wishBubbleUser, { color: isDark ? COLORS.gold : '#8b5a2b' }]}>{w.userName}</Text>
                              <Text style={[s.wishBubbleText, { color: txt }]}>{w.message || 'Happy Birthday! 🎉'}</Text>
                            </View>
                          ))
                        )}
                      </ScrollView>
                    </View>

                    {/* Quick Reaction Row */}
                    <View style={s.quickReactionsRow}>
                      {['🎉 Congrats!', '🎂 HBD!', '💖 Stay Blessed!', '👑 Superstar!', '🥳 Cheers!'].map((react) => (
                        <TouchableOpacity 
                          key={react} 
                          style={[s.quickReactionBadge, { borderColor: border }]}
                          onPress={() => submitWish(react)}
                        >
                          <Text style={s.quickReactionText}>{react}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Custom wish composer */}
                    <View style={s.bdayComposeRow}>
                      <TextInput 
                        style={[s.bdayWishInput, { backgroundColor: isDark ? '#222' : '#fff', color: txt, borderColor: border }]}
                        placeholder="Write a custom blessing..."
                        placeholderTextColor="#888"
                        value={birthdayWishMessage}
                        onChangeText={setBirthdayWishMessage}
                      />
                      <TouchableOpacity 
                        style={[s.bdayWishSendBtn, { backgroundColor: isDark ? COLORS.gold : '#FF69B4' }]}
                        onPress={() => submitWish()}
                        disabled={submittingWish}
                      >
                        {submittingWish ? (
                          <ActivityIndicator size="small" color="#000" />
                        ) : (
                          <Text style={s.bdayWishSendText}>SEND</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── REGISTER / NOMINATE BIRTHDAY MODAL ── */}
      <Modal visible={showRegisterBirthdayModal} transparent={true} animationType="slide">
        <View style={s.bdayOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowRegisterBirthdayModal(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
            style={s.bdayCardWrapper}
          >
            <View style={[s.bdayCard, { backgroundColor: isDark ? '#141416' : '#fff', maxHeight: SH * 0.85 }]}>
              <ScrollView 
                style={{ width: '100%' }}
                contentContainerStyle={{ alignItems: 'center' }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={[s.modalTitle, { color: txt }]}>NOMINATE BIRTHDAY PEER</Text>
                <Text style={[s.modalSubtitle, { color: txtSec }]}>Nominate a classmate. Approved birthdays appear on the community feed for 24h.</Text>

                {/* Form Input fields */}
                <TextInput 
                  style={[s.bdayWishInput, { backgroundColor: isDark ? '#222' : '#fff', color: txt, borderColor: border, width: '100%', marginBottom: 12 }]}
                  placeholder="Candidate Full Name"
                  placeholderTextColor="#888"
                  value={newBirthdayName}
                  onChangeText={setNewBirthdayName}
                />

                <TextInput 
                  style={[s.bdayWishInput, { backgroundColor: isDark ? '#222' : '#fff', color: txt, borderColor: border, width: '100%', marginBottom: 12 }]}
                  placeholder="Birthday Date (YYYY-MM-DD)"
                  placeholderTextColor="#888"
                  value={newBirthdayDate}
                  onChangeText={setNewBirthdayDate}
                />

                {/* Photo selector */}
                <TouchableOpacity 
                  style={[s.bdayPhotoSelector, { borderColor: border }]}
                  onPress={pickBirthdayPhoto}
                >
                  {newBirthdayPhoto ? (
                    <Image source={{ uri: newBirthdayPhoto }} style={s.bdayPhotoPreview} />
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 24, marginBottom: 4 }}>📸</Text>
                      <Text style={{ color: txtSec, fontSize: 9, fontWeight: '700' }}>ADD PEER PORTRAIT</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Action Buttons */}
                <View style={s.modalActionsRow}>
                  <TouchableOpacity 
                    style={[s.modalCancelBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} 
                    onPress={() => setShowRegisterBirthdayModal(false)}
                  >
                    <Text style={[s.modalCancelText, { color: txtSec }]}>CANCEL</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[s.modalSubmitBtn, { backgroundColor: isDark ? COLORS.gold : '#8b5a2b' }]} 
                    onPress={submitBirthday}
                    disabled={submittingBirthday}
                  >
                    {submittingBirthday ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text style={s.modalSubmitText}>NOMINATE 🎁</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── ADMIN PANEL QUEUE MODAL ── */}
      <Modal visible={showAdminPanelModal} transparent={true} animationType="slide">
        <View style={s.bdayOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowAdminPanelModal(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={[s.bdayCard, { backgroundColor: isDark ? '#141416' : '#fff', maxHeight: '80%' }]}>
            <Text style={[s.modalTitle, { color: txt }]}>ADMIN APPROVAL QUEUE</Text>
            <Text style={[s.modalSubtitle, { color: txtSec }]}>Approve celebrations to notify users and set them live for 24h.</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%', marginVertical: 12 }}>
              {pendingBirthdays.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ color: txtSec, fontSize: 11, fontWeight: '700' }}>No pending nominations in queue. 🌟</Text>
                </View>
              ) : (
                pendingBirthdays.map((p) => (
                  <View key={p.id} style={[s.adminQueueCard, { borderColor: border, backgroundColor: isDark ? '#1C1B1F' : '#fcfcfc' }]}>
                    <View style={s.adminQueueRow}>
                      {p.candidatePhotoUrl && !imageErrors[p.id] ? (
                        <Image 
                          source={{ uri: getImageUrl(p.candidatePhotoUrl) }} 
                          style={s.adminQueueImg} 
                          onError={() => {
                            setImageErrors(prev => ({ ...prev, [p.id]: true }));
                          }}
                        />
                      ) : (
                        <View style={s.adminQueueTextImg}><Text>🎂</Text></View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[s.adminQueueName, { color: txt }]}>{p.candidateName}</Text>
                        <Text style={[s.adminQueueDate, { color: txtSec }]}>Date: {p.birthdayDate}</Text>
                      </View>
                    </View>

                    <View style={s.adminQueueActions}>
                      <TouchableOpacity 
                        style={[s.adminRejectBtn, { backgroundColor: COLORS.red + '22' }]} 
                        onPress={() => rejectBirthday(p.id)}
                      >
                        <Text style={{ color: COLORS.red, fontSize: 10, fontWeight: '900' }}>REJECT ❌</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={[s.adminApproveBtn, { backgroundColor: COLORS.emerald + '22' }]} 
                        onPress={() => approveBirthday(p.id)}
                      >
                        <Text style={{ color: COLORS.emerald, fontSize: 10, fontWeight: '900' }}>APPROVE ✅</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity 
              style={[s.modalCancelBtn, { width: '100%', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} 
              onPress={() => setShowAdminPanelModal(false)}
            >
              <Text style={[s.modalCancelText, { color: txtSec }]}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── WALL SUBMIT PHOTO MODAL ── */}
      <Modal visible={showWallSubmitModal} transparent={true} animationType="slide">
        <View style={s.bdayOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowWallSubmitModal(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={s.bdayCardWrapper}>
            <View style={[s.bdayCard, { backgroundColor: isDark ? '#141416' : '#fff' }]}>
              <Text style={[s.modalTitle, { color: txt }]}>SUBMIT CONTEST PHOTO 📸</Text>
              <Text style={[s.modalSubtitle, { color: txtSec }]}>Upload your photo entry for "{activeWallEvent?.title}". Top voted photo wins ₹{activeWallEvent?.couponValue || 200}!</Text>

              <TouchableOpacity style={[s.bdayPhotoSelector, { borderColor: border }]} onPress={pickWallPhoto}>
                {wallSubmitImage ? (
                  <Image source={{ uri: wallSubmitImage }} style={s.bdayPhotoPreview} />
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 32 }}>📷</Text>
                    <Text style={{ color: isDark ? COLORS.gold : '#8b5a2b', fontSize: 10, fontWeight: '700', marginTop: 4 }}>Select Photo from Gallery</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={s.modalActionsRow}>
                <TouchableOpacity style={[s.modalCancelBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} onPress={() => setShowWallSubmitModal(false)}>
                  <Text style={[s.modalCancelText, { color: txtSec }]}>CANCEL</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.modalSubmitBtn, { backgroundColor: isDark ? COLORS.gold : '#8b5a2b' }]} onPress={submitWallPhoto} disabled={submittingWallPhoto}>
                  {submittingWallPhoto ? (
                    <ActivityIndicator size="small" color={isDark ? '#000' : '#fff'} />
                  ) : (
                    <Text style={[s.modalSubmitText, { color: isDark ? '#000' : '#fff' }]}>UPLOAD ENTRY 🚀</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── WALL ADMIN PANEL & MODERATION MODAL ── */}
      <Modal visible={showWallAdminModal} transparent={true} animationType="slide">
        <View style={s.bdayOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowWallAdminModal(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={[s.bdayCard, { backgroundColor: isDark ? '#141416' : '#fff', maxHeight: '85%' }]}>
            <Text style={[s.modalTitle, { color: txt }]}>WALL ADMIN CONTROL PANEL 🛠️</Text>
            <Text style={[s.modalSubtitle, { color: txtSec }]}>Approve student submissions & create new photo contest events.</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%', marginVertical: 10 }}>
              {/* EDIT ACTIVE EVENT BANNER & COUPON */}
              {activeWallEvent && (
                <View style={{ padding: 12, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,215,0,0.06)' : 'rgba(255,140,0,0.06)', borderWidth: 1, borderColor: isDark ? COLORS.gold : '#8b5a2b', marginBottom: 16 }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? COLORS.gold : '#8b5a2b', marginBottom: 8 }}>⚡ EDIT LIVE BANNER & COUPONS</Text>
                  
                  <Text style={{ fontSize: 9, fontWeight: '700', color: txtSec, marginBottom: 4 }}>Moving Ticker Banner Text:</Text>
                  <TextInput
                    style={[s.reviewInputField, { backgroundColor: isDark ? '#222' : '#fff', borderColor: border, color: txt, marginBottom: 8 }]}
                    placeholder="Moving ticker announcement text..."
                    placeholderTextColor="#888"
                    value={editBannerText}
                    onChangeText={setEditBannerText}
                  />

                  <Text style={{ fontSize: 9, fontWeight: '700', color: txtSec, marginBottom: 4 }}>Banner Gradient Theme:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {['fire', 'neon', 'gold', 'cyberpunk', 'emerald'].map((thm) => (
                      <TouchableOpacity
                        key={thm}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 8,
                          backgroundColor: editBannerGradient === thm ? (isDark ? COLORS.gold : '#3e2723') : 'rgba(0,0,0,0.1)',
                          borderWidth: 1,
                          borderColor: editBannerGradient === thm ? (isDark ? COLORS.gold : '#3e2723') : border
                        }}
                        onPress={() => setEditBannerGradient(thm)}
                      >
                        <Text style={{ fontSize: 9, fontWeight: '900', color: editBannerGradient === thm ? (isDark ? '#000' : '#fff') : txt }}>
                          {thm.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: txtSec, marginBottom: 4 }}>Coupon Value (₹):</Text>
                      <TextInput style={[s.reviewInputField, { backgroundColor: isDark ? '#222' : '#fff', borderColor: border, color: txt }]} placeholder="200" placeholderTextColor="#888" keyboardType="numeric" value={editCouponVal} onChangeText={setEditCouponVal} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: txtSec, marginBottom: 4 }}>Coupon Code (Optional):</Text>
                      <TextInput style={[s.reviewInputField, { backgroundColor: isDark ? '#222' : '#fff', borderColor: border, color: txt }]} placeholder="e.g. WALL-FOOD200" placeholderTextColor="#888" value={editCouponCode} onChangeText={setEditCouponCode} />
                    </View>
                  </View>

                  <TouchableOpacity style={{ marginTop: 4, backgroundColor: isDark ? COLORS.gold : '#8b5a2b', paddingVertical: 10, borderRadius: 10, alignItems: 'center' }} onPress={updateActiveWallEvent} disabled={updatingActiveEvent}>
                    {updatingActiveEvent ? (
                      <ActivityIndicator size="small" color={isDark ? '#000' : '#fff'} />
                    ) : (
                      <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#000' : '#fff' }}>SAVE LIVE BANNER & COUPON ⚡</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Create Event Form */}
              <View style={{ padding: 12, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderWidth: 1, borderColor: border, marginBottom: 16 }}>
                <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? COLORS.gold : '#8b5a2b', marginBottom: 8 }}>+ CREATE NEW CONTEST & BANNER</Text>
                <TextInput style={[s.reviewInputField, { backgroundColor: isDark ? '#222' : '#fff', borderColor: border, color: txt }]} placeholder="Event Title (e.g. Campus Sunset Food)" placeholderTextColor="#888" value={newWallTitle} onChangeText={setNewWallTitle} />
                <TextInput style={[s.reviewInputField, { backgroundColor: isDark ? '#222' : '#fff', borderColor: border, color: txt }]} placeholder="Event Description..." placeholderTextColor="#888" value={newWallDesc} onChangeText={setNewWallDesc} />
                <TextInput style={[s.reviewInputField, { backgroundColor: isDark ? '#222' : '#fff', borderColor: border, color: txt }]} placeholder="Moving Ticker Banner Text..." placeholderTextColor="#888" value={newWallBannerText} onChangeText={setNewWallBannerText} />

                <Text style={{ fontSize: 9, fontWeight: '700', color: txtSec, marginVertical: 4 }}>Banner Gradient Theme:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {['fire', 'neon', 'gold', 'cyberpunk', 'emerald'].map((thm) => (
                    <TouchableOpacity
                      key={thm}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                        backgroundColor: newWallBannerGradient === thm ? (isDark ? COLORS.gold : '#3e2723') : 'rgba(0,0,0,0.1)',
                        borderWidth: 1,
                        borderColor: newWallBannerGradient === thm ? (isDark ? COLORS.gold : '#3e2723') : border
                      }}
                      onPress={() => setNewWallBannerGradient(thm)}
                    >
                      <Text style={{ fontSize: 8, fontWeight: '900', color: newWallBannerGradient === thm ? (isDark ? '#000' : '#fff') : txt }}>
                        {thm.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                  <TextInput style={[s.reviewInputField, { flex: 1, backgroundColor: isDark ? '#222' : '#fff', borderColor: border, color: txt }]} placeholder="Duration (Hrs)" placeholderTextColor="#888" keyboardType="numeric" value={newWallHours} onChangeText={setNewWallHours} />
                  <TextInput style={[s.reviewInputField, { flex: 1, backgroundColor: isDark ? '#222' : '#fff', borderColor: border, color: txt }]} placeholder="Coupon (₹)" placeholderTextColor="#888" keyboardType="numeric" value={newWallCouponVal} onChangeText={setNewWallCouponVal} />
                  <TextInput style={[s.reviewInputField, { flex: 1, backgroundColor: isDark ? '#222' : '#fff', borderColor: border, color: txt }]} placeholder="Code (Opt)" placeholderTextColor="#888" value={newWallCouponCode} onChangeText={setNewWallCouponCode} />
                </View>

                <TouchableOpacity style={{ marginTop: 8, backgroundColor: isDark ? COLORS.gold : '#8b5a2b', paddingVertical: 10, borderRadius: 10, alignItems: 'center' }} onPress={createWallEvent} disabled={submittingNewWallEvent}>
                  {submittingNewWallEvent ? (
                    <ActivityIndicator size="small" color={isDark ? '#000' : '#fff'} />
                  ) : (
                    <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#000' : '#fff' }}>PUBLISH CONTEST 🚀</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Pending Queue */}
              <Text style={{ fontSize: 11, fontWeight: '900', color: txt, marginBottom: 8 }}>MODERATION QUEUE ({pendingWallSubmissions.length})</Text>
              {pendingWallSubmissions.length === 0 ? (
                <Text style={{ color: txtSec, fontSize: 10, fontWeight: '700', textAlign: 'center', marginVertical: 12 }}>No pending photo submissions in moderation. ✨</Text>
              ) : (
                pendingWallSubmissions.map((sub) => (
                  <View key={sub.id} style={[s.adminQueueCard, { borderColor: border, backgroundColor: isDark ? '#1C1B1F' : '#fcfcfc' }]}>
                    <View style={s.adminQueueRow}>
                      <Image source={{ uri: getImageUrl(sub.imageUrl) }} style={{ width: 50, height: 50, borderRadius: 10 }} />
                      <View style={{ flex: 1, paddingLeft: 10 }}>
                        <Text style={[s.adminQueueName, { color: txt }]}>{sub.user?.name || 'Student'}</Text>
                        <Text style={[s.adminQueueDate, { color: txtSec }]}>Contest: {sub.event?.title || 'Wall'}</Text>
                      </View>
                    </View>

                    <View style={s.adminQueueActions}>
                      <TouchableOpacity style={[s.adminRejectBtn, { backgroundColor: COLORS.red + '22' }]} onPress={() => rejectWallSubmission(sub.id)}>
                        <Text style={{ color: COLORS.red, fontSize: 10, fontWeight: '900' }}>REJECT ❌</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.adminApproveBtn, { backgroundColor: COLORS.emerald + '22' }]} onPress={() => approveWallSubmission(sub.id)}>
                        <Text style={{ color: COLORS.emerald, fontSize: 10, fontWeight: '900' }}>APPROVE ✅</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity style={[s.modalCancelBtn, { width: '100%', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} onPress={() => setShowWallAdminModal(false)}>
              <Text style={[s.modalCancelText, { color: txtSec }]}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── 🏆 CHAMPION SPOTLIGHT DETAIL MODAL ── */}
      <Modal visible={!!selectedHofWinner} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: '#0F172A',
            borderRadius: 28,
            borderWidth: 2,
            borderColor: '#FFD700',
            padding: 20,
            alignItems: 'center',
            shadowColor: '#FFD700',
            shadowOpacity: 0.5,
            shadowRadius: 20,
            elevation: 10
          }}>
            {/* Close Button */}
            <TouchableOpacity
              style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
              onPress={() => setSelectedHofWinner(null)}
            >
              <Text style={{ fontSize: 16, color: '#FFF', fontWeight: '900' }}>✕</Text>
            </TouchableOpacity>

            {/* Crown & Tag */}
            <Text style={{ fontSize: 32, marginBottom: 4 }}>👑</Text>
            <View style={{ backgroundColor: 'rgba(255,215,0,0.15)', borderWidth: 1, borderColor: '#FFD700', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 12 }}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFD700', letterSpacing: 1.5 }}>HALL OF FAME CHAMPION</Text>
            </View>

            {/* Large High-Res Winning Image */}
            <View style={{ width: '100%', height: 220, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#FFD700', marginBottom: 14, backgroundColor: '#000' }}>
              {selectedHofWinner?.winningSubmission?.imageUrl ? (
                <Image
                  source={{ uri: getImageUrl(selectedHofWinner.winningSubmission.imageUrl) }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 48 }}>🏆</Text>
                </View>
              )}
            </View>

            {/* Contest Title */}
            <Text style={{ fontSize: 18, fontWeight: '900', color: '#FFF', textAlign: 'center', marginBottom: 4 }}>
              {selectedHofWinner?.event?.title || 'Campus Contest Champion'}
            </Text>

            {/* Winner Name */}
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFD700', textAlign: 'center', marginBottom: 6 }}>
              {selectedHofWinner?.winner?.name}
            </Text>

            {/* Victory Date & Votes */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
                <Text style={{ fontSize: 11, color: '#E2E8F0', fontWeight: '800' }}>
                  📅 {selectedHofWinner?.event?.endTime ? new Date(selectedHofWinner.event.endTime).toLocaleDateString('default', { month: 'short', year: 'numeric', day: 'numeric' }) : 'Aug 2026'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
                <Text style={{ fontSize: 11, color: '#F87171', fontWeight: '900' }}>
                  ❤️ {selectedHofWinner?.winningSubmission?.likeCount || 0} Votes
                </Text>
              </View>
            </View>

            {/* Coupon Unlocked Box */}
            {selectedHofWinner?.event?.couponCode && (
              <View style={{ width: '100%', backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1.5, borderColor: '#10B981', borderRadius: 16, padding: 12, alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ fontSize: 9, fontWeight: '900', color: '#A7F3D0', letterSpacing: 1, marginBottom: 2 }}>CHAMPION REWARD COUPON</Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#10B981', letterSpacing: 1 }}>
                  ₹{selectedHofWinner.event.couponValue || 150} OFF • {selectedHofWinner.event.couponCode}
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={{ width: '100%', flexDirection: 'row', gap: 10 }}>
              {selectedHofWinner?.event?.couponCode ? (
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: '#FF8C00',
                    paddingVertical: 12,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#FF8C00',
                    shadowOpacity: 0.4,
                    shadowRadius: 8,
                    elevation: 4
                  }}
                  onPress={() => {
                    const code = selectedHofWinner.event.couponCode;
                    const val = selectedHofWinner.event.couponValue || 150;
                    setSelectedHofWinner(null);
                    handleClaimCoupon(code, val);
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 }}>CLAIM & ORDER 🍔</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={{
                  flex: selectedHofWinner?.event?.couponCode ? 0.8 : 1,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onPress={() => setSelectedHofWinner(null)}
              >
                <Text style={{ fontSize: 11, fontWeight: '900', color: '#CBD5E1', letterSpacing: 0.5 }}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f1ea', paddingTop: Platform.OS === 'android' ? 40 : 50 },
  header: { paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(139,90,43,0.1)', paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { paddingVertical: 6 },
  backText: { fontSize: 10, fontWeight: '900', color: '#8b5a2b', letterSpacing: 1.5 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.emerald },
  onlineText: { fontSize: 8, fontWeight: '900', color: COLORS.emerald, letterSpacing: 1 },
  
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  titleIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  title: { fontSize: 20, fontWeight: '900', color: '#3e2723', letterSpacing: -0.5 },
  subtitle: { fontSize: 7, fontWeight: '900', color: 'rgba(0,0,0,0.3)', letterSpacing: 2 },
  
  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', padding: 3, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#3e2723' },
  tabLabel: { fontSize: 8, fontWeight: '900', color: '#888', letterSpacing: 1 },
  tabLabelActive: { color: '#fff' },
  
  searchBar: { height: 38, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', paddingHorizontal: 12, fontSize: 11, fontWeight: '600', color: '#3e2723', marginBottom: 6 },
  
  trendingSection: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(139,90,43,0.05)', backgroundColor: 'rgba(251,191,36,0.03)' },
  trendingTitle: { fontSize: 8, fontWeight: '900', color: '#8b5a2b', letterSpacing: 1.5, paddingHorizontal: 16, marginBottom: 8 },
  trendingScroll: { paddingHorizontal: 16 },
  trendingCard: { width: 200, backgroundColor: '#fff', borderRadius: 16, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(0,0,0,0.05)', padding: 12, marginRight: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  trendingUserRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  trendingAvatar: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#8b5a2b', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 8, fontWeight: '900', color: '#fff' },
  trendingUser: { fontSize: 8, fontWeight: '800', color: '#3e2723', flex: 1 },
  trendingContent: { fontSize: 9, fontWeight: '600', color: '#666', lineHeight: 12, marginBottom: 6 },
  trendingStats: { flexDirection: 'row', gap: 8 },
  trendingStat: { fontSize: 8, fontWeight: '800', color: '#999' },

  stringLine: { height: 1.5, backgroundColor: 'rgba(139,90,43,0.15)', marginHorizontal: 16, marginTop: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1 },
  
  emptyState: { padding: 48, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '900', color: '#8b5a2b', letterSpacing: 2, marginBottom: 4 },
  emptySubtitle: { fontSize: 9, fontWeight: '700', color: '#aaa', letterSpacing: 1 },

  galleryGrid: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  polaroidWrapper: { width: (SW - 44) / 2, marginBottom: 24, alignItems: 'center', position: 'relative' },
  pegClip: { position: 'absolute', top: -8, width: 10, height: 20, backgroundColor: '#8b5a2b', borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#5c3a21', borderRadius: 2, zIndex: 10 },
  polaroidFrame: { width: '100%', backgroundColor: '#fdfcf0', padding: 8, paddingBottom: 12, borderRadius: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  polaroidImg: { width: '100%', aspectRatio: 1, borderRadius: 2, backgroundColor: '#111' },
  textPostBg: { width: '100%', aspectRatio: 1, borderRadius: 2, padding: 8, alignItems: 'center', justifyContent: 'center' },
  textPostContent: { fontSize: 12, fontWeight: '900', color: '#3e2723', textAlign: 'center', fontStyle: 'italic' },
  
  polaroidDetails: { marginTop: 8 },
  polaroidDesc: { fontSize: 9, fontWeight: '600', color: '#555', fontStyle: 'italic', marginBottom: 6 },
  
  reviewMeta: { marginBottom: 6, padding: 6, backgroundColor: 'rgba(139,90,43,0.04)', borderRadius: 8, borderWidth: 0.5, borderColor: 'rgba(139,90,43,0.08)' },
  reviewStars: { fontSize: 8, color: '#F59E0B', marginBottom: 2 },
  reviewRestaurant: { fontSize: 7, fontWeight: '900', color: '#8b5a2b' },
  reviewProduct: { fontSize: 7, fontWeight: '700', color: '#666', marginTop: 1 },

  polaroidUserRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)', paddingBottom: 6 },
  authorAvatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#38BDF8', alignItems: 'center', justifyContent: 'center' },
  authorAvatarText: { fontSize: 8, fontWeight: '900', color: '#fff' },
  authorName: { fontSize: 8, fontWeight: '900', color: '#222' },
  postTime: { fontSize: 6, fontWeight: '800', color: '#aaa' },
  expiryBadge: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.04)' },
  expiryText: { fontSize: 6, fontWeight: '800', color: '#777' },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  actionBtn: { paddingVertical: 2 },
  actionText: { fontSize: 8, fontWeight: '800', color: '#777' },
  
  repliesTrigger: { alignSelf: 'center', marginTop: 8, paddingVertical: 4 },
  repliesTriggerText: { fontSize: 7, fontWeight: '900', color: '#8b5a2b', letterSpacing: 0.5 },
  repliesBox: { marginTop: 6, borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 6, gap: 4 },
  replyItem: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  replyUser: { fontSize: 7, fontWeight: '900', color: '#3e2723' },
  replyText: { fontSize: 7, fontWeight: '600', color: '#666' },

  composeFabWrap: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, zIndex: 100 },
  composeFab: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...SHADOWS.goldGlow },
  
  composerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  composerContent: { backgroundColor: '#fdfcf0', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  dragHandle: { width: 36, height: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  replyBanner: { backgroundColor: 'rgba(139,90,43,0.05)', padding: 10, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(139,90,43,0.15)' },
  replyBannerText: { fontSize: 8, fontWeight: '900', color: '#8b5a2b' },
  replyBannerSub: { fontSize: 10, color: '#555' },
  composerTitle: { fontSize: 12, fontWeight: '900', color: '#3e2723', letterSpacing: 1.5, marginBottom: 12, textAlign: 'center' },
  composerInputName: { height: 38, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', paddingHorizontal: 12, fontSize: 11, fontWeight: '700', color: '#3e2723', marginBottom: 10 },
  reviewToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', marginBottom: 10 },
  reviewToggleLabel: { fontSize: 9, fontWeight: '900', color: '#3e2723' },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  toggleBtnActive: { backgroundColor: '#8b5a2b', borderColor: '#8b5a2b' },
  toggleBtnText: { fontSize: 8, fontWeight: '900', color: '#888' },
  reviewFields: { backgroundColor: 'rgba(139,90,43,0.04)', padding: 10, borderRadius: 12, marginBottom: 10, gap: 8, borderWidth: 1, borderColor: 'rgba(139,90,43,0.1)' },
  ratingStarsRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  starIcon: { fontSize: 22, color: 'rgba(0,0,0,0.1)' },
  reviewInputField: { height: 32, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 8, fontSize: 10, fontWeight: '600', color: '#3e2723', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  composerTextArea: { backgroundColor: '#fff', borderRadius: 12, padding: 12, fontSize: 11, fontWeight: '600', color: '#3e2723', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', height: 80, textAlignVertical: 'top', marginBottom: 10 },
  composerImgPreview: { width: 100, height: 100, borderRadius: 12, alignSelf: 'center', marginBottom: 12 },
  
  composerActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  composerCancel: { flex: 1, paddingVertical: 12, alignItems: 'center', marginRight: 8, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.04)' },
  cancelText: { fontSize: 10, fontWeight: '900', color: '#666', letterSpacing: 1 },
  composerSubmit: { flex: 2, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: '#8b5a2b' },
  submitText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 1 },

  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  lightboxImg: { width: SW - 20, height: SW - 20, resizeMode: 'contain', borderRadius: 8 },

  // ── BIRTHDAY STYLING ──
  birthdaySection: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(139,90,43,0.05)' },
  birthdaySectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  birthdaySectionTitle: { fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  adminBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  birthdayScroll: { minHeight: 90 },
  birthdayStoryCard: { alignItems: 'center', width: 66, gap: 4 },
  addBirthdayStoryCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.02)' },
  birthdayStoryCircle: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', borderWidth: 2, borderColor: '#FF69B4', alignItems: 'center', justifyContent: 'center' },
  birthdayStoryImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  birthdayStoryTextImg: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  birthdayStoryName: { fontSize: 8, fontWeight: '900', textAlign: 'center', width: '100%' },

  // Overlay
  bdayOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  bdayCardWrapper: { width: '100%', maxWidth: 360 },
  bdayCard: { width: '100%', borderRadius: 28, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10, position: 'relative' },
  bdayHeaderDecor: { marginBottom: 12 },
  bdayCloseBtn: { position: 'absolute', top: 16, right: 16, padding: 6, zIndex: 10 },
  bdayLargeAvatarRing: { width: 100, height: 100, borderRadius: 50, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  bdayLargeAvatarImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  bdayCandidateName: { fontSize: 18, fontWeight: '900', marginTop: 12, textAlign: 'center', letterSpacing: 0.5 },
  bdayWishCountText: { fontSize: 10, fontWeight: '900', marginTop: 4, letterSpacing: 0.5 },

  // Wishes List
  bdayWishesContainer: { width: '100%', height: 140, borderWidth: 1, borderRadius: 16, marginVertical: 16, padding: 12, backgroundColor: 'rgba(0,0,0,0.01)' },
  wishBubble: { padding: 10, borderRadius: 12, marginBottom: 8, gap: 2 },
  wishBubbleUser: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  wishBubbleText: { fontSize: 9, fontWeight: '600' },

  // Quick reactions
  quickReactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 12 },
  quickReactionBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(255,105,180,0.05)' },
  quickReactionText: { fontSize: 8, fontWeight: '900', color: '#FF69B4' },

  // Composer
  bdayComposeRow: { flexDirection: 'row', gap: 8, width: '100%', alignItems: 'center' },
  bdayWishInput: { flex: 1, height: 38, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 11, fontWeight: '700' },
  bdayWishSendBtn: { height: 38, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  bdayWishSendText: { color: '#000', fontSize: 10, fontWeight: '900' },

  // Nomination
  modalTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4, textAlign: 'center' },
  modalSubtitle: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 16, textAlign: 'center', lineHeight: 12 },
  bdayPhotoSelector: { width: '100%', height: 120, borderStyle: 'dashed', borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 18, overflow: 'hidden' },
  bdayPhotoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  modalActionsRow: { flexDirection: 'row', gap: 10, width: '100%' },
  modalCancelBtn: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  modalSubmitBtn: { flex: 2, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalSubmitText: { color: '#000', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  // Admin Queue
  adminQueueCard: { width: '100%', borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 10 },
  adminQueueRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  adminQueueImg: { width: 44, height: 44, borderRadius: 22, resizeMode: 'cover' },
  adminQueueTextImg: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  adminQueueName: { fontSize: 12, fontWeight: '900' },
  adminQueueDate: { fontSize: 9, fontWeight: '700' },
  adminQueueActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  adminRejectBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  adminApproveBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  
  // Friends Secure Uplink Card
  friendsCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  friendsGradient: {
    ...StyleSheet.absoluteFill,
  },
  friendsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  friendsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendsCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  friendsCardSub: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 1,
  },
  streakPulseContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  friendsCardBody: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  friendsFooter: {
    alignSelf: 'flex-start',
  },
  friendsFooterText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // ── THE WALL STYLING ──
  wallEventCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  mosaicTile: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  wallFabBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 999,
  },
  wallFabText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  hofCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
});
