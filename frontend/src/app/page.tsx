"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import { useCart } from '@/context/CartContext';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import RestaurantCard from '@/components/RestaurantCard';
import { motion, AnimatePresence } from 'framer-motion';
import SafeImage from '@/components/SafeImage';
import ConciergeDrawer from '@/components/ConciergeDrawer';
import SearchOverlay from '@/components/SearchOverlay';
import IntroOverlay from '@/components/IntroOverlay';
import ZenvyPulse from '@/components/ZenvyPulse';
import BlockWarsLeaderboard from '@/components/BlockWarsLeaderboard';
import ZenvyVault from '@/components/ZenvyVault';
import LiveOrderStatusBar from '@/components/LiveOrderStatusBar';
import ScrollProgressIndicator from '@/components/ScrollProgressIndicator';
import Magnetic from '@/components/Magnetic';
import { calculateRoadDistance } from '@/utils/logistics';
import SupportModal from '@/components/SupportModal';
import RatingModal from '@/components/RatingModal';
import ZenvyModal from '@/components/ZenvyModal';
import Tilt from '@/components/Tilt';
import socket from '@/utils/socket';
import { Restaurant, User } from '@/types';
import RewardsPanel from '@/components/RewardsPanel';
import NexusLeaderboard from '@/components/NexusLeaderboard';
// QRCodeSVG removed to resolve linting errors

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

interface RentalItem {
  id?: string;
  name?: string;
  price?: number;
  imageUrl?: string;
  tags?: string[];
  restaurantName?: string;
  category?: string;
  specs?: { engine?: string; topSpeed?: string; power?: string; fuel?: string };
  ownerName?: string;
  ownerPhone?: string;
}

interface Order {
  _id: string;
  id?: string;
  status: string;
  totalPrice?: number;
  items?: { name: string; quantity: number; image?: string }[];
  restaurant?: string;
  restaurantId?: string;
  deliverySlot?: string;
  cancelSecondsLeft?: number;
  createdAt?: string;
}

export default function Home() {
  const { cart } = useCart();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [filter, _setFilter] = useState<'all' | 'budget' | 'veg' | 'jain' | 'eggless' | 'rating' | 'fastest' | 'premium'>('all');
  const [liveRestaurants, setLiveRestaurants] = useState<Restaurant[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [userName, setUserName] = useState('');
  const [notifications, setNotifications] = useState<Array<{ id: number; title: string; message: string; time: string; type: 'promo' | 'info' | 'system' }>>([
    { id: 1, title: 'Welcome to Zenvy!', message: 'Explore the best gourmet picks in Amaravathi.', time: 'Just now', type: 'system' },
    { id: 2, title: 'Elite Membership', message: 'You are now a Verified Gourmet. Upgrade to Elite for free delivery!', time: '2h ago', type: 'promo' }
  ]);
  const [isAfter9] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showIntro, setShowIntro] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isElite, setIsElite] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activeCategory, _setActiveCategory] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRental, setSelectedRental] = useState<RentalItem | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [cancelSecondsLeft, setCancelSecondsLeft] = useState(0);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  // favorites moved down for grouping
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sortBy, _setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'rating' | 'fastest'>('default');
  const [favSort, setFavSort] = useState<'default' | 'price-asc' | 'price-desc' | 'name'>('default');
  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [showConcierge, setShowConcierge] = useState(false);
  const gymMode = false;
  
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    onConfirm?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const showModal = (
    title: string, 
    message: string, 
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    onConfirm?: () => void,
    confirmLabel?: string,
    cancelLabel?: string
  ) => {
    setModalConfig({ isOpen: true, title, message, type, onConfirm, confirmLabel, cancelLabel });
  };
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const CITY_CATEGORIES = [
    { emoji: '🍛', label: 'Biryani' },
    { emoji: '🍕', label: 'Pizza' },
    { emoji: '🥗', label: 'South Indian' },
    { emoji: '🍔', label: 'Burgers' },
    { emoji: '🧁', label: 'Sweets' },
    { emoji: '🥤', label: 'Drinks' },
    { emoji: '🍜', label: 'Chinese' },
    { emoji: '🥙', label: 'Rolls' },
    { emoji: '🍎', label: 'Fruits' },
    { emoji: '🚲', label: 'Rental' },
    { emoji: '🎁', label: 'Seasonal' },
    { emoji: '💪', label: 'Gym' },
    { emoji: '👔', label: 'Laundry' },
    { emoji: '💊', label: 'Pharmacy' },
    { emoji: '📚', label: 'Stationary' },
  ];

  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    
    setMounted(true);
    // Check if user has seen the cinematic intro this session
    const hasSeenIntro = sessionStorage.getItem('zenvy_intro_seen');
    setShowIntro(!hasSeenIntro);

    // Initial mount hydration
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Runtime Port Migration Guard: Patch legacy 5005 references in session
        if (parsed.profileImage && parsed.profileImage.includes(':5005')) {
          parsed.profileImage = parsed.profileImage.replace(':5005', ':5005');
          localStorage.setItem('user', JSON.stringify(parsed));
        }
        if (parsed.name) setUserName(parsed.name);
        setIsElite(parsed.isElite || false);
        setUser(parsed);
      }
      const storedFavs = localStorage.getItem('zenvy_favorites');
      if (storedFavs) setFavorites(JSON.parse(storedFavs));
    } catch { /* ignore */ }

    // Check backend mode and active orders
    const checkStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        await fetch(`${API_URL}/api/users/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (_err) {
        console.warn('[AUTH_CHECK] Background status check failed:', _err);
      }
    };

    checkStatus();
    
    // Asset Discovery Engine: Sync with Nexus Command Center
    const fetchLiveAssets = async () => {
      try {
        const res = await fetch(`${API_URL}/api/users/restaurants`);
        const data = await res.json();
        if (Array.isArray(data)) setLiveRestaurants(data);
      } catch (_err) {
        console.error('[ASSET_SYNC_ERROR]', _err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLiveAssets();
    
    // Simulate finding an active order (for UX demo)
    const storedOrder = localStorage.getItem('last_order');
    if (storedOrder) {
      const parsed = JSON.parse(storedOrder);
      setActiveOrder(parsed);
      // Calculate remaining cancellation window (2 min = 120s)
      if (parsed.createdAt) {
        const elapsed = (Date.now() - new Date(parsed.createdAt).getTime()) / 1000;
        const remaining = Math.max(0, 120 - Math.round(elapsed));
        setCancelSecondsLeft(remaining);
      } else {
        setCancelSecondsLeft(120);
      }
    }

    // Simulate loading for UX polish


    return () => {

    };
  }, []);

  useEffect(() => {
    if (activeOrder && cancelSecondsLeft > 0) {
      const timer = setInterval(() => {
        setCancelSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [activeOrder, cancelSecondsLeft]);
  useEffect(() => {
    if (!user) return;
    const handleEliteUpdate = (data: { type: string; data: { userId: string; isElite: boolean } }) => {
      const userId = user?._id || user?.id;
      if (data.type === 'USER_ELITE_STATUS' && data.data.userId === userId) {
         setIsElite(data.data.isElite);
         const stored = localStorage.getItem('user');
         if (stored) {
           const parsed = JSON.parse(stored);
           parsed.isElite = data.data.isElite;
           localStorage.setItem('user', JSON.stringify(parsed));
         }
      }
    };
    socket.on('systemUpdate', handleEliteUpdate);
    return () => { socket.off('systemUpdate', handleEliteUpdate); };
  }, [user]);

  // Tick down cancellation countdown removed from Home to avoid global re-renders

  const cancelActiveOrder = async () => {
    if (!activeOrder) return;
    
    // We compute elapsed inline rather than relying on heavy global state tick
    const elapsed = activeOrder.createdAt ? (Date.now() - new Date(activeOrder.createdAt).getTime()) / 1000 : 0;
    if (elapsed > 120) {
      showModal('Cannot Cancel', 'The 2-minute cancellation window has closed.', 'warning');
      return;
    }
    
    showModal(
      'Cancel Order?', 
      'Are you sure you want to cancel your current order? This action cannot be undone.',
      'warning',
      async () => {
        try {
          const token = localStorage.getItem('token');
          const orderId = activeOrder?._id || activeOrder?.id;
          if (orderId) {
            await fetch(`${API_URL}/api/orders/${orderId}/cancel`, {
              method: 'PUT',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
          }
        } catch (_err) {
          console.warn('[CANCEL_ORDER] Backend cancellation failed:', _err);
        }
        setActiveOrder(null);
        setCancelSecondsLeft(0);
        localStorage.removeItem('last_order');
      },
      'Yes, Cancel',
      'Keep Order'
    );
  };

  const handleRatingSubmit = async (rating: number, review: string) => {
    try {
      const token = localStorage.getItem('token');
      const orderId = activeOrder?._id || activeOrder?.id;
      if (!orderId) return;

      await fetch(`${API_URL}/api/orders/${orderId}/rate`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating, review })
      });

      // Update local wallet/points for UX
      if (user) {
        const updatedUser = { ...user, zenPoints: (user.zenPoints || 0) + 10 };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (_err) {
      console.error('[RATING_ERROR] Rating failed:', _err);
    }
  };

  const handleJoinElite = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login to join Zenvy Elite!');
        return;
      }

      const res = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ isElite: true })
      });
      const data = await res.json();
      if (res.ok) {
        setIsElite(true);
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
        showModal('Welcome to Elite! 💎', 'You have successfully joined Zenvy Elite. Enjoy unlimited free delivery on all orders.', 'success');
      }
    } catch (_err) {
      console.error('[ELITE_ERROR] Failed to join elite:', _err);
    }
  };

  // Lock body scroll when rental modal is open
  useEffect(() => {
    if (selectedRental) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedRental]);

  const handleIntroComplete = () => {
    sessionStorage.setItem('zenvy_intro_seen', 'true');
    setShowIntro(false);
  };

  const handlePrizeWin = (prize: { type: string; value: string | number }) => {
    if (prize.type === 'points') {
      const updatedUser = user ? { ...user, zenPoints: (user.zenPoints || 0) + (prize.value as number) } : null;
      if (updatedUser) {
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      showModal(`Congratulations! 🏆`, `You won ${prize.value} ZenPoints. Your new balance is ${updatedUser?.zenPoints || 0}.`, 'success');
    } else {
      showModal(`Exclusive Coupon! 🏷️`, `You've unlocked the code [${prize.value}]. It's been copied to your clipboard!`, 'success');
      navigator.clipboard.writeText(prize.value as string);
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      localStorage.setItem('zenvy_favorites', JSON.stringify(next));
      return next;
    });
  };

  // --- Smart Market Engine: Unified Tag-Based Catalog ---
  const allProducts = useMemo(() => {
    return liveRestaurants.flatMap(res => 
      (res.menu || []).map(item => {
        const itemPrice = Number(item.price) || 0;
        const isVeg = !!(item.isVegetarian || String(item.isVegetarian) === 'true' || Number(item.isVegetarian) === 1 || item.tags?.includes('veg') || item.tags?.includes('fruits'));
        
        return { 
          ...item, 
          price: itemPrice,
          isVegetarian: isVeg,
          restaurantName: res.name, 
          restaurantId: res._id || res.id,
          tags: Array.isArray(item.tags) ? item.tags : []
        };
      })
    ).filter(p => {
      // Apply Core Filters Globally
      if (filter === 'veg' && !p.isVegetarian) return false;
      if (filter === 'jain' && !p.tags?.includes('jain')) return false;
      if (filter === 'eggless' && !p.tags?.includes('eggless')) return false;
      if (filter === 'budget' && p.price > 150) return false;
      if (filter === 'premium' && !p.isEliteOnly && p.price < 500) return false;
      if (gymMode && !p.tags?.includes('healthy') && !p.tags?.includes('high-protein')) return false;
      if (p.isAvailable === false || String(p.isAvailable) === 'false') return false;
      return true;
    }).sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      return 0;
    });
  }, [liveRestaurants, filter, gymMode, sortBy]);

  // Grouped Collections Driven by Tags (Optimized Single-Pass Engine)
  const groupedCollections = useMemo(() => {
    const collections: Record<string, typeof allProducts> = {
      fruits: [], rentals: [], sweets: [], seasonal: [], drinks: [],
      gym: [], laundry: [], pharmacy: [], stationary: [], all: allProducts
    };

    allProducts.forEach(p => {
      const tags = p.tags || [];
      if (tags.includes('fruits')) collections.fruits.push(p);
      if (tags.includes('rental')) collections.rentals.push(p);
      if (tags.includes('sweets')) collections.sweets.push(p);
      if (tags.includes('seasonal')) collections.seasonal.push(p);
      if (tags.includes('drinks')) collections.drinks.push(p);
      if (tags.includes('gym') || tags.includes('high-protein')) collections.gym.push(p);
      if (tags.includes('laundry') || tags.includes('dry-wash')) collections.laundry.push(p);
      if (tags.includes('medicine') || tags.includes('pharmacy')) collections.pharmacy.push(p);
      if (tags.includes('stationary') || tags.includes('books') || tags.includes('print')) collections.stationary.push(p);
    });

    return collections;
  }, [allProducts]);
  
  const favoriteItems = useMemo(() => {
    return allProducts
      .filter(p => favorites.includes(p.id!))
      .sort((a, b) => {
        if (favSort === 'price-asc') return (a.price || 0) - (b.price || 0);
        if (favSort === 'price-desc') return (b.price || 0) - (a.price || 0);
        if (favSort === 'name') return (a.name || '').localeCompare(b.name || '');
        return 0;
      });
  }, [allProducts, favorites, favSort]);

  const chefPicks = useMemo(() => groupedCollections.all.slice(0, 8), [groupedCollections.all]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const filteredByCategory = useMemo(() => {
    return allProducts
      .filter(p => {
        if (!activeCategory) return false;
        const cat = activeCategory.toLowerCase();
        const tags = Array.isArray(p.tags) ? p.tags : [];
        return (
          (p.category || '').toLowerCase().includes(cat) ||
          tags.some(t => t.toLowerCase().includes(cat)) ||
          (p.name || '').toLowerCase().includes(cat)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return (a.price || 0) - (b.price || 0);
        if (sortBy === 'price-desc') return (b.price || 0) - (a.price || 0);
        return 0;
      });
  }, [allProducts, activeCategory, sortBy]);

  const displayRestaurants = useMemo(() => {
    let list = [...liveRestaurants];

    // Apply Hard Filters (Dietary/Type)
    if (filter === 'veg') list = list.filter(res => (res.menu || []).some(item => item.isVegetarian));
    if (filter === 'jain') list = list.filter(res => (res.menu || []).some(item => item.tags?.includes('jain')));
    if (filter === 'eggless') list = list.filter(res => (res.menu || []).some(item => item.tags?.includes('eggless')));
    if (filter === 'budget') list = list.filter(res => (res.menu || []).some(item => item.price < 150));
    if (filter === 'premium') list = list.filter(res => (res.menu || []).some(item => item.price > 500));

    if (gymMode) {
      list = list.filter(res => {
        const hasHealthyTags = res.tags?.includes('healthy') || res.tags?.includes('gym');
        if (hasHealthyTags) return true;
        return (res.menu || []).some(item => item.tags?.includes('healthy') || item.tags?.includes('high-protein'));
      });
    }

    if (restaurantSearch) {
      const query = restaurantSearch.toLowerCase();
      list = list.filter(res => {
        const matchesName = (res.name || '').toLowerCase().includes(query);
        const matchesMenu = (res.menu || []).some(i => (i.name || '').toLowerCase().includes(query));
        return matchesName || matchesMenu;
      });
    }

    const enrichedList = list.map(res => {
      let d = 5;
      let mins = 40;
      if (user?.defaultAddress || true) {
        try {
          const rCoords = { lat: Number(res.lat) || 16.4632, lon: Number(res.lon) || 80.5064 };
          const uCoords = { lat: 16.5062, lon: 80.6480 }; 
          d = calculateRoadDistance(rCoords.lat, rCoords.lon, uCoords.lat, uCoords.lon);
          mins = Math.round(d * 3 + 12);
        } catch (e) {
          console.error("Telemetry error:", e);
        }
      }
      
      const rating = Number(res.rating) || 4.0;
      const smartScore = (rating * 10) + (30 / (d + 1)) + (30 / (mins / 10 + 1));
      
      return { ...res, smartScore, calculatedTime: `${mins}-${mins+10} min`, distance: d, rating };
    });

    return enrichedList.sort((a, b) => {
      if (sortBy === 'price-asc') {
        const aMin = Math.min(...(a.menu || []).map(i => Number(i.price) || 9999), 9999);
        const bMin = Math.min(...(b.menu || []).map(i => Number(i.price) || 9999), 9999);
        return aMin - bMin;
      }
      if (sortBy === 'price-desc') {
        const aMax = Math.max(...(a.menu || []).map(i => Number(i.price) || 0), 0);
        const bMax = Math.max(...(b.menu || []).map(i => Number(i.price) || 0), 0);
        return bMax - aMax;
      }
      if (sortBy === 'rating') {
        return b.rating - a.rating;
      }
      if (sortBy === 'fastest') {
        const timeA = parseInt(String(a.calculatedTime || "40")) || 40;
        const timeB = parseInt(String(b.calculatedTime || "40")) || 40;
        return timeA - timeB;
      }
      
      return b.smartScore - a.smartScore;
    });
  }, [liveRestaurants, filter, gymMode, restaurantSearch, sortBy, user]);

  if (showIntro === null) return <div className="min-h-screen bg-black" />;

  return (
    <>
    <ScrollProgressIndicator />
    <main className={`min-h-screen text-white pb-32 relative overflow-hidden transition-colors duration-1000 ${isAfter9 ? 'bg-[#050507]' : 'bg-background'}`}>
      {showIntro && <IntroOverlay onComplete={handleIntroComplete} />}
      
      {/* Container for main content - only visible when intro is DONE */}
      <div className={`min-h-screen transition-opacity duration-1000 ${showIntro === false ? 'opacity-100' : 'opacity-0'} ${isAfter9 ? 'midnight-portal' : ''}`}>
        
        {/* Ambient Background Orbs (Lunar Shift - Unified Gold) */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className={`absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[120px] transition-colors duration-1000 ${isAfter9 ? 'bg-[#C9A84C]/[0.06]' : 'bg-[#C9A84C]/[0.04]'}`} />
          <div className={`absolute top-1/3 -left-32 w-80 h-80 rounded-full blur-[100px] transition-colors duration-1000 ${isAfter9 ? 'bg-[#C9A84C]/[0.05]' : 'bg-[#C9A84C]/[0.03]'}`} />
        </div>

        {/* Layout Grid: Content + Sidebar */}
        <div className="max-w-[1500px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 relative z-10">
          
          {/* Main Feed Content */}
          <div className="w-full px-6 pt-14 md:px-10 lg:px-14">
          {/* City Brand Header */}
          <motion.header 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="mb-6"
          >
            <div className="flex items-center justify-between mb-6">
              <Link href="/profile" className="flex items-center gap-2.5 group cursor-pointer">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#8B7332] flex items-center justify-center shadow-lg shadow-[#C9A84C]/20 group-hover:scale-105 transition-transform overflow-hidden relative">
                  {user?.profileImage ? (
                    <SafeImage 
                      src={user.profileImage} 
                      alt="Me" 
                      className="w-full h-full object-cover" 
                      priority
                    />
                  ) : (
                    <span className="text-[13px] font-black text-black">Z</span>
                  )}
                </div>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-[0.3em] text-gold-gradient block leading-none">Zenvy</span>
                  <span className="text-[7px] font-bold uppercase tracking-[0.4em] text-secondary-text block mt-0.5">Amaravathi, AP 📍</span>
                </div>
              </Link>
              <div className="flex items-center gap-3">

                <Magnetic>
                  <button onClick={() => setShowNotifications(true)} className="w-10 h-10 glass-card rounded-full flex items-center justify-center relative group overflow-hidden">
                    <div className="absolute inset-0 bg-[#C9A84C]/0 group-hover:bg-[#C9A84C]/10 transition-colors" />
                    <svg className="w-4 h-4 text-secondary-text group-hover:text-[#C9A84C] transition-colors relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {notifications.length > 0 && <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-primary-yellow rounded-full shadow-[0_0_8px_rgba(201,168,76,0.8)]" />}
                  </button>
                </Magnetic>
              </div>
            </div>
            <div className="flex justify-between items-end mb-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary-text">
                    {mounted ? getGreeting() : 'Welcome'}
                    {mounted && userName ? `, ${userName.split(' ')[0]}` : ''}
                  </p>
                  {mounted && isElite && (
                    <span className="bg-[#C9A84C]/10 text-[#C9A84C] text-[8px] font-black px-2 py-0.5 rounded-full border border-[#C9A84C]/20 tracking-tighter shadow-[0_0_10px_rgba(201,168,76,0.1)]">ELITE</span>
                  )}
                </div>
              </div>
              <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1.5 rounded-full">Live Delivery ✓</p>
            </div>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
               <div>
                  <h1 className={`text-4xl font-extrabold italic leading-tight tracking-tighter ${isAfter9 ? 'midnight-glow-text text-white' : 'text-gold-shimmer'}`} style={{ fontFamily: "'Syne', sans-serif" }}>
                    {isAfter9 ? 'MIDNIGHT NEXUS' : "LET'S CLEAR YOUR CRAVING"} 
                  </h1>
               </div>
              
              {/* 🎁 Minimalist Rewards Toolbar (Integrated Header Space) */}
              <div className="mb-2 md:mb-4">
                <RewardsPanel onWin={handlePrizeWin} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 status-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              <span className="text-[8px] font-black text-secondary-text uppercase tracking-widest opacity-60">Delivering across Amaravathi</span>
            </div>
          </motion.header>

          {/* User Requested Top Navigation Replica */}
          <nav className="flex items-center justify-around px-4 py-4 mb-6 bg-[#141416] border border-white/5 rounded-3xl z-40 relative shadow-2xl">
            <Link href="/" className="flex flex-col items-center gap-1.5 nav-icon-active">
              <div className="tab-pill">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest">Home</span>
            </Link>
            <Link href="/orders" className="flex flex-col items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
               <span className="text-[9px] font-bold">Orders</span>
            </Link>
            <Link href="/basket" className="flex flex-col items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity relative">
               <div className="relative">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                 {cartCount > 0 && (
                   <span className="absolute -top-2 -right-2 w-4 h-4 bg-primary-yellow text-black text-[8px] font-black rounded-full flex items-center justify-center shadow-sm">{cartCount > 9 ? '9+' : cartCount}</span>
                 )}
               </div>
               <span className="text-[9px] font-bold">Basket</span>
            </Link>
            <Link href="/profile" className="flex flex-col items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
               <span className="text-[9px] font-bold">Profile</span>
            </Link>
          </nav>

          <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
           <motion.div 
            whileTap={{ scale: 0.98 }}
            className="relative mb-6" 
            onClick={() => setIsSearchOpen(true)}
           >
            <Magnetic>
              <div className="w-full stardust-search py-4 pl-14 pr-4 text-xs text-white font-black uppercase tracking-widest cursor-pointer rounded-2xl group">
                 <span className="opacity-40 group-hover:opacity-100 transition-opacity">Search for dishes or restaurants...</span>
              </div>
            </Magnetic>
          </motion.div>

          {/* Restored Category Chips */}
          <section className="mb-10 px-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary-text">Explore Categories</h2>
              <span className="text-[9px] font-bold text-secondary-text uppercase tracking-wider">Swipe →</span>
            </div>
            <div className="flex gap-5 overflow-x-auto scrollbar-hide -mx-6 px-6 pb-4">
              {CITY_CATEGORIES.map((cat, i) => (
                <motion.button
                  key={cat.label}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.5 }}
                  onClick={() => {
                    setRestaurantSearch(cat.label);
                    setIsSearchOpen(true);
                  }}
                  className="flex flex-col items-center gap-3 shrink-0 group active:scale-95 transition-transform"
                >
                  <div className="w-16 h-16 rounded-[22px] bg-white/[0.03] border border-white/5 flex items-center justify-center text-2xl group-hover:bg-white/[0.08] group-hover:border-[#C9A84C]/30 transition-all duration-300 shadow-xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#C9A84C]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="relative z-10 group-hover:scale-110 transition-transform duration-300 filter group-hover:drop-shadow-[0_0_8px_rgba(201,168,76,0.3)]">
                      {cat.emoji}
                    </span>
                  </div>
                  <span className="text-[9px] font-black text-secondary-text uppercase tracking-[0.15em] group-hover:text-white transition-colors">
                    {cat.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </section>

          {/* 🔒 The Zenvy Vault (Daily FOMO Scarcity) */}
          <motion.section 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
             <ZenvyVault />
          </motion.section>

          <Tilt className={`mb-10 group cursor-pointer overflow-hidden rounded-[34px] relative border shadow-2xl transition-all duration-500 elite-card ${isElite ? 'border-[#C9A84C]/40' : 'border-[#C9A84C]/20'}`}>
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              onClick={!isElite ? handleJoinElite : undefined}
            >
                <div className="elite-hologram" />
                <div className="absolute inset-0 bg-gradient-to-br from-[#C9A84C]/20 to-[#8B7332]/20 z-0" />
                <SafeImage 
                  src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop" 
                  alt="Elite Promo" 
                  fill
                  className="relative z-10 object-cover w-full h-[140px] group-hover:scale-110 transition-transform duration-700 opacity-40 mix-blend-overlay"
                />
               <div className="absolute inset-0 z-20 p-6 flex flex-col justify-center">
                  <span className="text-[8px] font-black text-primary-yellow uppercase tracking-[0.3em] mb-2">{isElite ? 'Elite Member' : 'Exclusive Offer'}</span>
                  <h3 className="text-lg font-black text-white leading-tight mb-2">
                    {isElite ? <>Unlimited <br /> Free Delivery</> : <>Unlock Zero <br /> Delivery Fees</>}
                  </h3>
                  {isElite ? (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest" style={{ textShadow: '0 0 10px rgba(16,185,129,0.5)' }}>Premium Active</span>
                    </div>
                  ) : (
                    <Magnetic>
                      <button className="w-fit bg-primary-yellow text-black text-[9px] font-black px-6 py-2.5 rounded-full uppercase tracking-tighter shadow-lg shadow-primary-yellow/20">Join Elite for ₹199 →</button>
                    </Magnetic>
                  )}
               </div>
            </motion.section>
          </Tilt>

          <motion.div 
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeInOut" }}
            className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-12 origin-left"
          />

          {/* 🔄 Quick Re-order: Last Favorites */}
          {activeOrder && !isLoading && (
            <section className="mb-10 animate-fade-in">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary-text">Last Order</h2>
              </div>
              <div className="glass-card p-4 flex items-center justify-between border-white/[0.05]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#1A1A1C] flex items-center justify-center border border-white/5 overflow-hidden">
                      {activeOrder.items?.[0]?.image ? (
                        <SafeImage src={activeOrder.items[0].image} alt="last" fill className="object-cover" />
                      ) : (
                       <svg className="w-5 h-5 text-primary-yellow" fill="currentColor" viewBox="0 0 24 24"><path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/></svg>
                     )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{activeOrder.items?.[0]?.name || 'Delicious Meal'}</h4>
                    <p className="text-[9px] font-bold text-secondary-text uppercase tracking-widest">Re-order from last time</p>
                  </div>
                </div>
                <Link 
                  href={`/restaurants/${activeOrder.restaurantId || 'shakti-canteen'}`}
                  className="bg-white/5 hover:bg-white/10 text-primary-yellow text-[9px] font-black px-4 py-2 rounded-full uppercase tracking-tighter border border-white/5 transition-colors"
                >
                  Quick Add +
                </Link>
              </div>
            </section>
          )}

          {/* 💎 Gourmet Favorites Section */}
          <AnimatePresence>
            {favoriteItems.length > 0 && (
              <motion.section 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-10"
              >
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-yellow">Gourmet Favorites</h2>
                    <p className="text-[8px] font-bold text-secondary-text uppercase tracking-widest mt-1">{favoriteItems.length} Saved Discoveries</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select 
                      value={favSort} 
                      onChange={(e) => setFavSort(e.target.value as 'default' | 'price-asc' | 'price-desc' | 'name')}
                      className="text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 outline-none focus:border-[#C9A84C]/40 appearance-none pr-7 relative"
                      style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23C9A84C\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\' /%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', backgroundSize: '10px' }}
                    >
                      <option value="default" className="bg-[#141416]">Sort: Recent</option>
                      <option value="name" className="bg-[#141416]">Sort: Item Name</option>
                      <option value="price-asc" className="bg-[#141416]">Price: Low to High</option>
                      <option value="price-desc" className="bg-[#141416]">Price: High to Low</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
                  {favoriteItems.map((item) => (
                    <motion.div 
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      style={{ perspective: 1000 }}
                    >
                      <Tilt>
                        <Link href={`/products/${item.id}`} className="relative shrink-0 w-[240px] block group active:scale-95 transition-transform premium-card-hover rounded-[30px] animate-float">
                          <div className="aspect-[4/3] relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-primary-yellow/30 transition-colors">
                            <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill style={{ objectFit: 'cover' }} />
                            <button 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item.id!); }}
                              className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-all z-20 bg-primary-yellow text-black scale-110 shadow-lg"
                            >
                              <svg className="w-4.5 h-4.5" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
                            </button>
                          </div>
                          <div className="mt-3">
                            <h3 className="text-xs font-black text-white">{item.name}</h3>
                            <div className="flex justify-between items-start mt-1 gap-2 min-w-0 overflow-hidden">
                              <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</span>
                              <span className="text-[10px] font-black shrink-0 text-primary-yellow">₹{item.price}</span>
                            </div>
                          </div>
                        </Link>
                      </Tilt>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <section className="mb-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary-text">Chef&apos;s Picks</h2>
              <span className="text-[9px] font-bold text-secondary-text uppercase tracking-wider">Swipe →</span>
            </div>
            <motion.div 
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-100px" }}
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: { staggerChildren: 0.1 }
                }
              }}
              className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6"
            >
              {isLoading ? (
                [1,2,3].map(i => (
                  <div key={i} className="chef-card bg-[#141416] p-4">
                    <div className="aspect-[4/3] rounded-[30px] skeleton mb-4" />
                    <div className="h-4 w-3/4 skeleton mb-2" />
                    <div className="h-3 w-1/2 skeleton" />
                  </div>
                ))
              ) : (
                chefPicks.map((item) => (
                  <motion.div
                    key={item.id}
                    variants={{
                      hidden: { opacity: 0, x: 20 },
                      show: { opacity: 1, x: 0 }
                    }}
                  >
                    <Link href={`/products/${item.id}`}>
                      <Tilt className="chef-card bg-[#141416]">
                        <div className="aspect-[4/3] relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-primary-yellow/30 transition-colors">
                          <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill style={{ objectFit: 'cover' }} />
                        </div>
                        <div className="mt-3">
                          <h3 className="font-bold text-[15px] text-white mb-1">{item.name}</h3>
                          <div className="flex items-start justify-between gap-2 min-w-0 overflow-hidden mt-1">
                            <p className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</p>
                            <span className="text-[10px] font-black shrink-0 text-primary-yellow">₹{item.price}</span>
                          </div>
                        </div>
                      </Tilt>
                    </Link>
                  </motion.div>
                ))
              )}
            </motion.div>
          </section>

          <motion.div 
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeInOut" }}
            className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-14 origin-left"
          />

          {/* ⚔️ Zenvy Block Wars: Leaderboard */}
          <section className="mb-10 animate-slide-up" style={{ animationDelay: '0.3s' }}>
             <BlockWarsLeaderboard userBlock={user?.hostelBlock || null} />
          </section>

         



          {/* 📚 Stationary & Printing */}
          <section className="mb-14">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-[9px] font-black text-violet-400 uppercase tracking-[0.4em] mb-2">Academic Essentials</h2>
                <p className="text-xl font-black text-white">Stationary & Print</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
              {groupedCollections.stationary.length > 0 ? (
                groupedCollections.stationary.map((item) => (
                  <motion.div 
                     layout
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ duration: 0.3 }}
                     style={{ perspective: 1000 }}
                     key={item.id} 
                  >
                    <Tilt>
                    <Link href={`/products/${item.id}`} className="relative shrink-0 w-[240px] block group active:scale-95 transition-transform premium-card-hover rounded-[30px] animate-float">
                      <div className="aspect-[4/3] relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-violet-500/30 transition-colors">
                          <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill style={{ objectFit: 'cover' }} />
                          <button 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item.id!); }}
                              className={`absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-all z-20 ${favorites.includes(item.id!) ? 'bg-primary-yellow text-black scale-110 shadow-lg' : 'bg-black/40 text-white backdrop-blur-md hover:bg-black/60'}`}
                            >
                              <svg className="w-4.5 h-4.5" fill={favorites.includes(item.id!) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
                          </button>
                      </div>
                      <div className="mt-3">
                         <h3 className="text-xs font-black text-white">{item.name}</h3>
                         <div className="flex justify-between items-start mt-1 gap-2 min-w-0 overflow-hidden">
                           <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</span>
                            <span className="text-[10px] font-black shrink-0 text-violet-400">₹{item.price}</span>
                         </div>
                      </div>
                    </Link>
                    </Tilt>
                  </motion.div>
                ))
              ) : (
                <div className="w-full flex flex-col items-center justify-center py-10 px-6 border border-white/5 rounded-[30px] bg-white/[0.02]">
                   <span className="text-4xl mb-4 opacity-50">📚</span>
                   <p className="text-xs font-black text-secondary-text uppercase tracking-widest">No Active Stationary Shops</p>
                </div>
              )}
            </div>
          </section>

          {/* ❄️ Season Specials */}
          <section className="mb-10">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-[9px] font-black text-cyan-400 uppercase tracking-[0.4em] mb-2">Omni-Category</h2>
                <p className="text-xl font-black text-white">SEASON SPECIALS</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
              {groupedCollections.seasonal.map((item) => (
                <motion.div 
                  key={item.id}
                  whileHover={{ scale: 1.05, rotateY: 10, rotateX: -5 }}
                  style={{ perspective: 1000 }}
                >
                  <Link href={`/products/${item.id}`} className="relative shrink-0 w-[240px] block group active:scale-95 transition-transform">
                    <div className="aspect-[4/3] relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-cyan-500/30 transition-colors">
                        <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill style={{ objectFit: 'cover' }} />
                        <button 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item.id!); }}
                              className={`absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-all z-20 ${favorites.includes(item.id!) ? 'bg-primary-yellow text-black scale-110 shadow-lg' : 'bg-black/40 text-white backdrop-blur-md hover:bg-black/60'}`}
                            >
                              <svg className="w-4.5 h-4.5" fill={favorites.includes(item.id!) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
                         </button>
                    </div>
                    <div className="mt-3">
                       <h3 className="text-xs font-black text-white">{item.name}</h3>
                       <div className="flex justify-between items-start mt-1 gap-2 min-w-0 overflow-hidden">
                           <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</span>
                          <span className="text-[10px] font-black shrink-0 text-cyan-400">₹{item.price}</span>
                       </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>

          {/* 🥐 Sweets & Bakery */}
          <section className="mb-14">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-[9px] font-black text-rose-400 uppercase tracking-[0.4em] mb-2">Artisanal Treats</h2>
                <p className="text-xl font-black text-white uppercase">Sweets & Desserts</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
              {groupedCollections.sweets.map((item) => (
                <motion.div 
                  key={item.id}
                  whileHover={{ scale: 1.05, rotateY: 10, rotateX: -5 }}
                  style={{ perspective: 1000 }}
                >
                  <Link href={`/products/${item.id}`} className="relative shrink-0 w-[240px] block group active:scale-95 transition-transform">
                    <div className="aspect-[4/3] relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-rose-500/30 transition-colors">
                        <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill style={{ objectFit: 'cover' }} />
                        <button 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item.id!); }}
                              className={`absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-all z-20 ${favorites.includes(item.id!) ? 'bg-primary-yellow text-black scale-110 shadow-lg' : 'bg-black/40 text-white backdrop-blur-md hover:bg-black/60'}`}
                            >
                              <svg className="w-4.5 h-4.5" fill={favorites.includes(item.id!) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
                         </button>
                    </div>
                    <div className="mt-3">
                       <h3 className="text-xs font-black text-white">{item.name}</h3>
                       <div className="flex justify-between items-start mt-1 gap-2 min-w-0 overflow-hidden">
                           <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</span>
                          <span className="text-[10px] font-black shrink-0 text-rose-400">₹{item.price}</span>
                       </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>

          {/* 🍹 Refreshing Drinks */}
...
          {/* 🚲 Campus Rentals: Explorer */}
          <section className="mb-14">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-[9px] font-black text-amber-500 uppercase tracking-[0.4em] mb-2">Portal Mediator</h2>
                <p className="text-xl font-black text-white">Campus Rentals</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
              {groupedCollections.rentals.length > 0 ? (
                groupedCollections.rentals.map((item) => (
                  <motion.div 
                    key={item.id}
                    layout
                    style={{ perspective: 1000 }}
                  >
                    <Tilt>
                      <div 
                        onClick={() => setSelectedRental(item)}
                        className="relative shrink-0 w-[240px] block group active:scale-95 transition-transform premium-card-hover rounded-[30px] animate-float cursor-pointer"
                      >
                        <div className="aspect-[4/3] relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-amber-500/30 transition-colors">
                            <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill />
                            <div className="absolute top-4 left-4 bg-amber-500 text-black text-[7px] font-black px-2 py-1 rounded-md uppercase tracking-widest shadow-lg">Rental</div>
                        </div>
                        <div className="mt-3">
                           <h3 className="text-xs font-black text-white">{item.name}</h3>
                           <div className="flex justify-between items-start mt-1 gap-2">
                             <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate flex-1">{item.restaurantName}</span>
                             <span className="text-[10px] font-black shrink-0 text-amber-500">₹{item.price}/day</span>
                           </div>
                        </div>
                      </div>
                    </Tilt>
                  </motion.div>
                ))
              ) : (
                <div className="w-full flex flex-col items-center justify-center py-10 px-6 border border-white/5 rounded-[30px] bg-white/[0.02]">
                   <span className="text-4xl mb-4 opacity-50">🚲</span>
                   <p className="text-xs font-black text-secondary-text uppercase tracking-widest">No Active Rentals Currently</p>
                </div>
              )}
            </div>
          </section>

          {/* 🍎 Fresh Fruits: Vitality */}
          <section className="mb-14">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.4em] mb-2">Nexus Vitality</h2>
                <p className="text-xl font-black text-white">Fresh Fruits</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
              {groupedCollections.fruits.length > 0 ? (
                groupedCollections.fruits.map((item) => (
                  <motion.div 
                    key={item.id}
                    layout
                    style={{ perspective: 1000 }}
                  >
                    <Tilt>
                      <Link href={`/products/${item.id}`} className="relative shrink-0 w-[200px] block group active:scale-95 transition-transform premium-card-hover rounded-[30px]">
                        <div className="aspect-square relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-emerald-500/30 transition-colors">
                            <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill />
                            <button 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item.id!); }}
                              className={`absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-all z-20 ${favorites.includes(item.id!) ? 'bg-primary-yellow text-black scale-110 shadow-lg' : 'bg-black/40 text-white backdrop-blur-md hover:bg-black/60'}`}
                            >
                              <svg className="w-4.5 h-4.5" fill={favorites.includes(item.id!) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
                            </button>
                        </div>
                        <div className="mt-3">
                           <h3 className="text-xs font-black text-white">{item.name}</h3>
                           <div className="flex justify-between items-start mt-1 gap-2">
                             <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate flex-1">{item.restaurantName}</span>
                             <span className="text-[10px] font-black shrink-0 text-emerald-400">₹{item.price}</span>
                           </div>
                        </div>
                      </Link>
                    </Tilt>
                  </motion.div>
                ))
              ) : (
                <div className="w-full flex flex-col items-center justify-center py-10 px-6 border border-white/5 rounded-[30px] bg-white/[0.02]">
                   <span className="text-4xl mb-4 opacity-50">🍎</span>
                   <p className="text-xs font-black text-secondary-text uppercase tracking-widest">Scanning Vitality Nodes...</p>
                </div>
              )}
            </div>
          </section>

          {/* 💊 Pharmacy: Health Sync */}
          <section className="mb-14">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-[9px] font-black text-rose-400 uppercase tracking-[0.4em] mb-2">Nexus Health Sync</h2>
                <p className="text-xl font-black text-white">Pharmacy</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
              {groupedCollections.pharmacy.length > 0 ? (
                groupedCollections.pharmacy.map((item) => (
                  <motion.div 
                    key={item.id}
                    layout
                    style={{ perspective: 1000 }}
                  >
                    <Tilt>
                      <Link href={`/products/${item.id}`} className="relative shrink-0 w-[200px] block group active:scale-95 transition-transform premium-card-hover rounded-[30px]">
                        <div className="aspect-square relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-rose-500/30 transition-colors">
                            <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill />
                            <div className="absolute top-4 left-4 bg-rose-500 text-white text-[7px] font-black px-2 py-1 rounded-md uppercase tracking-widest shadow-lg">Pharmacy</div>
                        </div>
                        <div className="mt-3">
                           <h3 className="text-xs font-black text-white">{item.name}</h3>
                           <div className="flex justify-between items-start mt-1 gap-2">
                             <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate flex-1">{item.restaurantName}</span>
                             <span className="text-[10px] font-black shrink-0 text-rose-400">₹{item.price}</span>
                           </div>
                        </div>
                      </Link>
                    </Tilt>
                  </motion.div>
                ))
              ) : (
                <div className="w-full flex flex-col items-center justify-center py-10 px-6 border border-white/5 rounded-[30px] bg-white/[0.02]">
                   <span className="text-4xl mb-4 opacity-50">💊</span>
                   <p className="text-xs font-black text-secondary-text uppercase tracking-widest">Finding Pharmacy Nodes...</p>
                </div>
              )}
            </div>
          </section>

          {/* 🧺 Dry Wash: Laundry Operations */}
          <section className="mb-14">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-[9px] font-black text-blue-400 uppercase tracking-[0.4em] mb-2">Campus Logistics</h2>
                <p className="text-xl font-black text-white">Dry Wash & Laundry</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
              {groupedCollections.laundry.length > 0 ? (
                groupedCollections.laundry.map((item) => (
                  <motion.div 
                    key={item.id}
                    layout
                    style={{ perspective: 1000 }}
                  >
                    <Tilt>
                      <Link href={`/products/${item.id}`} className="relative shrink-0 w-[200px] block group active:scale-95 transition-transform premium-card-hover rounded-[30px]">
                        <div className="aspect-square relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-blue-500/30 transition-colors">
                            <SafeImage src={item.imageUrl || "/assets/placeholder.png"} alt={item.name} fill />
                            <div className="absolute top-4 left-4 bg-blue-500 text-white text-[7px] font-black px-2 py-1 rounded-md uppercase tracking-widest shadow-lg">Dry Wash</div>
                        </div>
                        <div className="mt-3">
                           <h3 className="text-xs font-black text-white">{item.name}</h3>
                           <div className="flex justify-between items-start mt-1 gap-2">
                             <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate flex-1">{item.restaurantName}</span>
                             <span className="text-[10px] font-black shrink-0 text-blue-400">₹{item.price}/kg</span>
                           </div>
                        </div>
                      </Link>
                    </Tilt>
                  </motion.div>
                ))
              ) : (
                <div className="w-full flex flex-col items-center justify-center py-10 px-6 border border-white/5 rounded-[30px] bg-white/[0.02]">
                   <span className="text-4xl mb-4 opacity-50">🧺</span>
                   <p className="text-xs font-black text-secondary-text uppercase tracking-widest">Optimizing Logistics Path...</p>
                </div>
              )}
            </div>
          </section>

          <section className="mb-10">
            <div className="flex items-center justify-between mb-5">
               <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A5B4FC]">Drinks & Beverages</h2>
               <span className="text-[9px] font-bold text-secondary-text uppercase tracking-wider">Swipe →</span>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
              {groupedCollections.drinks.map((item) => (
                <motion.div 
                  key={item.id}
                  whileHover={{ scale: 1.05, rotateY: 10, rotateX: -5 }}
                  style={{ perspective: 1000 }}
                >
                  <Link href={`/products/${item.id}`} className="relative shrink-0 w-[240px] block group active:scale-95 transition-transform">
                    <div className="aspect-[4/3] relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-[#A5B4FC]/30 transition-colors">
                       <SafeImage src={item.imageUrl || "/assets/placeholder_premium.png"} alt={item.name} fill style={{ objectFit: 'cover' }} />
                       <button 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item.id!); }}
                              className={`absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-all z-20 ${favorites.includes(item.id!) ? 'bg-primary-yellow text-black scale-110 shadow-lg' : 'bg-black/40 text-white backdrop-blur-md hover:bg-black/60'}`}
                            >
                              <svg className="w-4.5 h-4.5" fill={favorites.includes(item.id!) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
                         </button>
                    </div>
                    <div className="mt-3">
                       <h3 className="text-xs font-black text-white">{item.name}</h3>
                       <div className="flex justify-between items-start mt-1 gap-2 min-w-0 overflow-hidden">
                           <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</span>
                          <span className="text-[10px] font-black shrink-0 text-[#A5B4FC]">₹{item.price}</span>
                       </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>

          {/* 🏋️ Elite Performance: Gym Rats */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-5">
               <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C9A84C]">Gym & Protein</h2>
               <span className="text-[9px] font-bold text-secondary-text uppercase tracking-wider">Swipe →</span>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
              {groupedCollections.gym.map((item) => (
                <motion.div 
                  key={item.id}
                  whileHover={{ scale: 1.05, rotateY: 10, rotateX: -5 }}
                  style={{ perspective: 1000 }}
                >
                  <Link href={`/products/${item.id}`} className="relative shrink-0 w-[240px] block group active:scale-95 transition-transform">
                    <div className="aspect-[4/3] relative rounded-[30px] overflow-hidden border border-white/10 group-hover:border-[#C9A84C]/30 transition-colors">
                       <SafeImage src={item.imageUrl || "/assets/placeholder_premium.png"} alt={item.name} fill style={{ objectFit: 'cover' }} />
                       <button 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item.id!); }}
                              className={`absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-all z-20 ${favorites.includes(item.id!) ? 'bg-primary-yellow text-black scale-110 shadow-lg' : 'bg-black/40 text-white backdrop-blur-md hover:bg-black/60'}`}
                            >
                              <svg className="w-4.5 h-4.5" fill={favorites.includes(item.id!) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
                         </button>
                    </div>
                    <div className="mt-3">
                       <h3 className="text-xs font-black text-white">{item.name}</h3>
                       <div className="flex justify-between items-start mt-1 gap-2 min-w-0 overflow-hidden">
                           <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</span>
                          <span className="text-[10px] font-black shrink-0 text-[#C9A84C]">₹{item.price}</span>
                       </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>

          <motion.div 
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeInOut" }}
            className="h-px bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent my-14 origin-left"
          />

          {/* All Restaurants List & Advanced Filters */}
          <div className="mb-8 px-6">
              <div className="relative w-full group">
                <input 
                  type="text"
                  placeholder="Search for restaurant or dish"
                  value={restaurantSearch}
                  onChange={(e) => setRestaurantSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold tracking-wide outline-none focus:border-primary-yellow/40 transition-all placeholder:text-white/30 shadow-lg"
                />
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-primary-yellow/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>
          </div>

          <section className="pb-20">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary-text mb-6">Restaurants</h2>
            <div className="space-y-4">
              {displayRestaurants.map((res, index) => (
                <div key={res._id || res.id} className="animate-slide-up" style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'both' }}>
                  <Link href={`/restaurants/${res._id || res.id}`}>
                    <RestaurantCard 
                      name={res.name} 
                      rating={String(res.rating || "4.5")} 
                      time={res.calculatedTime || res.time || "30-50 min"}
                      imageUrl={res.imageUrl || "/assets/placeholder_premium.png"} 
                      imagePosition={index % 2 === 0 ? 'left' : 'right'} 
                    />
                  </Link>
                </div>
              ))}
            </div>
          </section>

        <footer className="fixed bottom-0 left-0 right-0 h-24 bg-[#0A0A0B]/90 backdrop-blur-2xl border-t border-white/[0.03] flex items-center justify-around px-6 z-[60]">
          <Magnetic>
            <Link href="/" className="flex flex-col items-center gap-1.5 nav-icon-active">
              <div className="tab-pill">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest">Home</span>
            </Link>
          </Magnetic>
          <Magnetic>
            <Link href="/orders" className="flex flex-col items-center gap-1.5 opacity-40">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
               <span className="text-[9px] font-bold">Orders</span>
            </Link>
          </Magnetic>
          <Magnetic>
            <Link href="/basket" className="flex flex-col items-center gap-1.5 opacity-40">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
               <span className="text-[9px] font-bold">Basket</span>
            </Link>
          </Magnetic>
          <Magnetic>
            <Link href="/profile" className="flex flex-col items-center gap-1.5 opacity-40">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <span className="text-[9px] font-bold">Profile</span>
            </Link>
          </Magnetic>
        </footer>

        {/* 🛵 Live Order Status Bar */}
        {activeOrder && (
          <LiveOrderStatusBar
            orderId={activeOrder._id || activeOrder.id || 'SRM_DEV_ORDER_1'}
            initialStatus={activeOrder.status || 'Pending'}
            cancelSecondsLeft={cancelSecondsLeft}
            onCancel={cancelActiveOrder}
            onDelivered={() => setIsRatingModalOpen(true)}
          />
        )}

        <RatingModal
          isOpen={isRatingModalOpen}
          onClose={() => setIsRatingModalOpen(false)}
          onSubmit={handleRatingSubmit}
        />

       <ZenvyModal 
          {...modalConfig} 
          onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))} 
        />

        {/* ─── Notification Drawer ─── */}
        {typeof document !== 'undefined' && showNotifications && createPortal(
          <div className="fixed inset-0 z-[1000] flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNotifications(false)} />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="w-full max-w-[320px] bg-[#0A0A0B] border-l border-white/5 h-full relative z-10 p-6 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-gold-gradient">Nexus Alerts</h3>
                <button onClick={() => setShowNotifications(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs">✕</button>
              </div>
              
              <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 opacity-20">
                    <span className="text-4xl mb-2">🔭</span>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-center leading-relaxed">System frequency clear.<br/>No pending alerts.</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className="glass-card p-4 border-white/5 hover:border-[#C9A84C]/20 transition-all group">
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${n.type === 'promo' ? 'bg-[#C9A84C]/10 text-[#C9A84C]' : 'bg-white/5 text-white/40'}`}>{n.type}</span>
                        <span className="text-[7px] font-bold text-white/20">{n.time}</span>
                      </div>
                      <h4 className="text-[11px] font-black text-white mb-1 group-hover:text-[#C9A84C] transition-colors">{n.title}</h4>
                      <p className="text-[9px] text-secondary-text leading-relaxed">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
              
              <button onClick={() => setNotifications([])} className="mt-6 w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/40 transition-all">Clear All</button>
            </motion.div>
          </div>
        , document.body)}

        {/* 🌀 Magical Social Pulse */}
        <ZenvyPulse userBlock={user?.hostelBlock || null} />

        {/* 👑 Priority Concierge FAB (Elite Only) */}
        <AnimatePresence>
          {isElite && (
            <motion.button
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowConcierge(true)}
              className="fixed bottom-32 right-6 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#C9A84C] via-[#E6C983] to-[#C9A84C] text-black shadow-[0_0_20px_rgba(201,168,76,0.5)] z-50 flex items-center justify-center border-2 border-white/20 group overflow-hidden"
            >
               <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-[-45deg]" />
               <span className="text-2xl relative z-10">👑</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* 🎯 Mobile-only Rewards Panel - REMOVED for Minimal Header Integration */}

        </div> {/* End Main Feed Content (Opened at 456) */}

        {/* 🏷️ Desktop Sidebar: Game Panel */}
        <aside className="hidden lg:block pt-14 pr-10 sticky top-0 h-screen overflow-y-auto scrollbar-hide space-y-8 animate-fade-in pb-20">
            <NexusLeaderboard />
            
            {/* Extra Desktop Side-space Polish */}
            <div className="glass-card p-6 rounded-[34px] border border-white/5 opacity-40 hover:opacity-100 transition-opacity">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary-text mb-2">Nexus Metrics</p>
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-black text-white">4.9/5</p>
                  <span className="text-[10px] text-emerald-400 font-black mb-1">↑ 2%</span>
                </div>
                <p className="text-[8px] font-bold text-secondary-text uppercase tracking-widest mt-1">Average Driver Rating</p>
            </div>
        </aside>

        </div> {/* End Layout Grid (Opened at 453) */}
      </div> {/* End Intro Visibility Wrapper (Opened at 444) */}
      
      </main>

      <ConciergeDrawer 
        isOpen={showConcierge} 
        onClose={() => setShowConcierge(false)} 
        user={user}
      />

      <SupportModal isOpen={showSupport} onClose={() => setShowSupport(false)} />

      {/* 🚗 Rental Mediator Modal */}
      {selectedRental && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 99998 }}
            onClick={() => setSelectedRental(null)}
          />
          {/* Card */}
          <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 99999, pointerEvents: 'none' }}>
            <div style={{ width: '100%', maxWidth: '380px', maxHeight: '88vh', overflowY: 'auto', background: '#141416', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '28px', padding: '24px', pointerEvents: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#141416', background: '#C9A84C', padding: '2px 8px', borderRadius: '4px' }}>Portal Mediator</span>
                    <span style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#9CA3AF' }}>{selectedRental?.category || 'Rental'}</span>
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'white', margin: 0, lineHeight: 1 }}>{selectedRental?.name}</h3>
                </div>
                <button
                  onClick={() => setSelectedRental(null)}
                  style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >✕</button>
              </div>

              {/* Image */}
              <div style={{ width: '100%', aspectRatio: '16/9', position: 'relative', borderRadius: '20px', overflow: 'hidden', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <SafeImage src={selectedRental?.imageUrl || "/assets/placeholder.png"} alt={selectedRental?.name || "Rental"} fill style={{ objectFit: 'cover' }} />
              </div>

              {/* Description & Mission */}
              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1.6', margin: 0 }}>
                  Zenvy acting as a <strong style={{ color: 'white' }}>Mediator</strong>. Please review the details below and interact directly with the owner to finalize your rental agreement.
                </p>
              </div>

              {/* Price Info */}
              <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.1)', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div>
                    <span style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 700, color: '#C9A84C', display: 'block', marginBottom: '2px' }}>Rental Rate</span>
                    <span style={{ fontSize: '24px', fontWeight: 900, color: 'white' }}>₹{selectedRental?.price}<span style={{ fontSize: '12px', color: '#9CA3AF', marginLeft: '4px' }}>/ day</span></span>
                 </div>
                 <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '8px', textTransform: 'uppercase', fontWeight: 700, color: '#9CA3AF', display: 'block', marginBottom: '2px' }}>Security Deposit</span>
                    <span style={{ fontSize: '14px', fontWeight: 900, color: 'white' }}>₹{Math.round((selectedRental?.price || 0) * 5)}</span>
                 </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setModalConfig({
                     isOpen: true,
                     title: 'Concierge Connecting',
                     message: `Connecting you to ${selectedRental?.restaurantName}...`,
                     type: 'info'
                  })}
                  style={{ flex: 2, background: '#C9A84C', color: 'black', fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '14px', borderRadius: '12px', border: 'none', cursor: 'pointer' }}
                >
                  Contact Owner
                </button>
                <button
                  onClick={() => setSelectedRental(null)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '14px', borderRadius: '12px', cursor: 'pointer' }}
                >Dismiss</button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

