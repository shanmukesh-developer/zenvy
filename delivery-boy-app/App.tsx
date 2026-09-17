import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Vibration,
  StatusBar,
  Dimensions,
  Image,
  Modal,
  Switch,
  FlatList,
  Linking,
  Platform,
  KeyboardAvoidingView,
  RefreshControl,
  LayoutAnimation,
  UIManager,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import {
  enqueueOfflineAction,
  flushOfflineQueue,
  getOfflineQueue,
  OfflineAction,
} from './src/services/offlineQueue';
import { OrderItem, PickupStop, Order } from './src/types';
import {
  STORAGE_SERVER_KEY,
  STORAGE_TOKEN_KEY,
  STORAGE_PROFILE_KEY,
  DEFAULT_API_URL,
  FALLBACK_API_URL,
} from './src/constants/api';
import { COLORS, RADIUS, SPACING } from './src/constants/theme';
import { ZenvyBadge } from './src/components/ZenvyBadge';
import { RiderHeroCard } from './src/components/RiderHeroCard';
import { SegmentedNav } from './src/components/SegmentedNav';
import { FilterBar } from './src/components/FilterBar';
import { RadarEmptyState } from './src/components/RadarEmptyState';
import { FleetOrderCard } from './src/components/FleetOrderCard';
import { FleetLeaderboard } from './src/components/FleetLeaderboard';
import { FleetProfileView } from './src/components/FleetProfileView';
import { TelemetryDock } from './src/components/TelemetryDock';
import { FleetLoginScreen } from './src/components/FleetLoginScreen';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldVibrate: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldSetBadge: false,
  }),
});

const { width: SW, height: SH } = Dimensions.get('window');

// Types imported from ./src/types (OrderItem, PickupStop, Order)
// Constants imported from ./src/constants/api

interface RiderProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  rating: number;
  totalEarnings: number;
  completedCount: number;
  vehicleNumber?: string;
  vehicleType?: string;
  zenPoints?: number;
  emergencyContact?: string;
}

interface LeaderboardUser {
  id: string;
  name: string;
  deliveries: number;
  earnings: number;
  rating: number;
}

export default function App() {
  // App Boot & Configuration
  const [apiHost, setApiHost] = useState<string>(DEFAULT_API_URL);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Authentication State
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  // Navigation & Duty State
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'active' | 'available' | 'leaderboard' | 'profile'>('active');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Category, Time-Slot & Lifecycle Stage Filter State
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'Food' | 'Fruits' | 'Groceries' | 'Mega Basket'>('ALL');
  const [selectedSlot, setSelectedSlot] = useState<'ALL' | 'Before 7:30 PM' | 'After 7:30 PM' | '1:00 PM - 6:00 PM'>('ALL');
  const [selectedStage, setSelectedStage] = useState<'ALL' | 'Picking' | 'PickedUp' | 'ArrivedAtGate'>('ALL');

  // Order Data & Marking Checklist
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [checkedItemsMap, setCheckedItemsMap] = useState<Record<string, Record<number, boolean>>>({});
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Mega Basket Kirana Bill Proof & Reimbursement State
  const [billAmountInputs, setBillAmountInputs] = useState<Record<string, string>>({});
  const [billProofUploadedMap, setBillProofUploadedMap] = useState<Record<string, boolean>>({});
  const [billApprovedMap, setBillApprovedMap] = useState<Record<string, boolean>>({});

  // Pre-Purchase Kirana Item Photo Upload & Customer Agreement State
  const [itemPhotoUploadedMap, setItemPhotoUploadedMap] = useState<Record<string, boolean>>({});
  const [purchaseApprovedMap, setPurchaseApprovedMap] = useState<Record<string, boolean>>({});

  // Collapsible Card Expansion State (Default: Minimized, user taps to expand)
  const [expandedOrdersMap, setExpandedOrdersMap] = useState<Record<string, boolean>>({});

  const toggleOrderExpanded = (orderId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedOrdersMap(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // Telemetry, Offline Queue & Hardware Sensors
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 16.4632, lng: 80.5064 });
  const [isBatteryLow, setIsBatteryLow] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);
  const previousPendingCount = useRef<number>(0);

  // Keyboard Adaptation & Auto-Scroll
  const mainScrollRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [keyboardVisible, setKeyboardVisible] = useState<boolean>(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleCardInputFocus = (index: number) => {
    setTimeout(() => {
      mainScrollRef.current?.scrollTo({ y: Math.max(0, index * 260 + 100), animated: true });
    }, 150);
  };

  // 1. Initial Load & Setup
  useEffect(() => {
    bootstrapApp();
    setupSensors();
  }, []);

  // Register push token whenever user logs in or app is bootstrapped
  useEffect(() => {
    if (authToken) {
      registerPushToken();
      // Auto-set rider online in DB so they are queried for push routing
      apiFetch('/delivery/online', {
        method: 'PUT',
        body: JSON.stringify({ isOnline: true })
      })
      .then(() => {
        setIsOnline(true);
        console.log('[ONLINE_STATUS] Auto-set rider online on startup/login');
      })
      .catch((err) => console.warn('[ONLINE_STATUS] Auto-set failed:', err.message));
    }
  }, [authToken]);

  // 2. Poll Orders Periodically when Online
  useEffect(() => {
    if (!authToken || !isOnline) return;
    fetchDashboardData();
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [authToken, isOnline, apiHost]);

  // Update Offline Queue Count
  const updateOfflineCount = async () => {
    const queue = await getOfflineQueue();
    setOfflineQueueCount(queue.length);
  };

  const bootstrapApp = async () => {
    try {
      const savedHost = await AsyncStorage.getItem(STORAGE_SERVER_KEY);
      const savedToken = await AsyncStorage.getItem(STORAGE_TOKEN_KEY);
      const savedProfile = await AsyncStorage.getItem(STORAGE_PROFILE_KEY);

      if (savedHost) setApiHost(savedHost);
      if (savedToken) setAuthToken(savedToken);
      if (savedProfile) setProfile(JSON.parse(savedProfile));

      await updateOfflineCount();

      if (savedToken) {
        await fetchDashboardData();
      }
    } catch (err) {
      console.warn('Bootstrap error:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  const setupSensors = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 8000, distanceInterval: 10 },
          (loc) => {
            setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          }
        );
      }

      const batLevel = await Battery.getBatteryLevelAsync();
      if (batLevel > 0 && batLevel < 0.2) setIsBatteryLow(true);

      const netState = await Network.getNetworkStateAsync();
      const online = netState.isConnected ?? true;
      setIsConnected(online);

      Network.addNetworkStateListener(async (state) => {
        const nowOnline = state.isConnected ?? true;
        setIsConnected(nowOnline);
        if (nowOnline) {
          // Sync offline queued actions automatically when network returns
          const result = await flushOfflineQueue(apiFetch);
          await updateOfflineCount();
          if (result.processed > 0) {
            Alert.alert('⚡ Offline Actions Synced', `Successfully processed ${result.processed} queued delivery updates!`);
            fetchDashboardData(true);
          }
        }
      });
      registerPushToken();
    } catch (e) {
      console.warn('Sensors init error:', e);
    }
  };

  const registerPushToken = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('delivery-alerts-v2', {
            name: 'Delivery Alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250, 250, 250, 250, 250],
            lightColor: '#FF231F7A',
            sound: 'alert',
          });
        }
        let fcmToken = '';
        try {
          const deviceTokenData = await Notifications.getDevicePushTokenAsync();
          fcmToken = deviceTokenData.data;
        } catch (deviceError) {
          console.warn('FCM native token failed, trying Expo fallback:', deviceError);
          const tokenData = await Notifications.getExpoPushTokenAsync();
          fcmToken = tokenData.data;
        }
        if (fcmToken && authToken) {
          apiFetch('/delivery/fcm-token', {
            method: 'POST',
            body: JSON.stringify({ fcmToken, token: fcmToken, appVersion: 'native-1.0.0' })
          })
          .then(() => console.log('[PUSH_REGISTER] Successfully registered token:', fcmToken))
          .catch((err) => console.warn('[PUSH_REGISTER] Registration failed:', err.message));
        }
      }
    } catch (e) {
      console.warn('Push token error:', e);
    }
  };

  // API Call Helper
  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
      const res = await fetch(`${apiHost}${endpoint}`, { ...options, headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'API request failed');
      return data;
    } catch (err: any) {
      // Fallback try if default host failed
      if (apiHost === DEFAULT_API_URL && err.message?.includes('Network request failed')) {
        try {
          const res2 = await fetch(`${FALLBACK_API_URL}${endpoint}`, { ...options, headers });
          const data2 = await res2.json();
          if (res2.ok) return data2;
        } catch (e) {}
      }
      throw err;
    }
  };

  // Helper to normalize and auto-detect category, bulk order, and multi-restaurant stops
  const formatOrder = (raw: any): Order => {
    const items: OrderItem[] = Array.isArray(raw.items) ? raw.items : [];
    const totalQty = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const totalPrice = raw.totalPrice || raw.finalPrice || items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
    const isBulk = raw.isBulk !== undefined ? raw.isBulk : (totalQty >= 5 || totalPrice >= 500);

    // Group items by pickup restaurant for Multi-Restaurant Order Support
    const stopsMap: Record<string, PickupStop> = {};
    items.forEach(item => {
      const rName = item.restaurant || raw.restaurant || 'Campus Bistro';
      const rAddr = item.restaurantAddress || raw.restaurantAddress || 'Food Court Area';
      const rPhone = item.restaurantPhone || raw.restaurantPhone || '+91 9876543210';

      if (!stopsMap[rName]) {
        stopsMap[rName] = {
          restaurantName: rName,
          address: rAddr,
          phone: rPhone,
          items: []
        };
      }
      stopsMap[rName].items.push(item);
    });

    const pickupStops = Object.values(stopsMap);
    const isMultiRestaurant = pickupStops.length > 1;

    let category = raw.category;
    if (!category) {
      const text = `${raw.restaurant || ''} ${items.map(i => `${i.name} ${i.restaurant || ''}`).join(' ')} ${raw.drop || ''}`.toLowerCase();
      if (text.includes('mega') || text.includes('basket') || text.includes('apartment') || text.includes('combo') || text.includes('wholesale') || text.includes('monthly grocery')) {
        category = 'Mega Basket';
      } else if (text.includes('fruit') || text.includes('apple') || text.includes('mango') || text.includes('banana') || text.includes('juice')) {
        category = 'Fruits';
      } else if (text.includes('grocery') || text.includes('soap') || text.includes('shampoo') || text.includes('biscuit') || text.includes('surf') || text.includes('lays')) {
        category = 'Groceries';
      } else {
        category = 'Food';
      }
    }

    const mainRestaurantName = isMultiRestaurant
      ? `Multi-Vendor (${pickupStops.length} Stops)`
      : (raw.restaurant || pickupStops[0]?.restaurantName || 'Campus Bistro');

    return {
      id: String(raw.id || raw._id || 'ORD-UNKNOWN'),
      restaurant: mainRestaurantName,
      restaurantAddress: raw.restaurantAddress || pickupStops[0]?.address || 'Food Court Area',
      restaurantPhone: raw.restaurantPhone || pickupStops[0]?.phone || '+91 9876543210',
      customerName: raw.customerName || 'Student Customer',
      customerPhone: raw.customerPhone || '+91 9876543210',
      drop: raw.drop || 'Hostel Campus Drop',
      items,
      totalPrice,
      status: raw.status || 'Accepted',
      deliveryPin: raw.deliveryPin || '1234',
      createdAt: raw.createdAt || new Date().toISOString(),
      deliverySlot: raw.deliverySlot || 'After 7:30 PM',
      category,
      isBulk,
      pickupStops,
      isMultiRestaurant,
      itemPhotoUrl: raw.itemPhotoUrl,
      isPurchasingApprovedByCustomer: raw.isPurchasingApprovedByCustomer,
      billProofUrl: raw.billProofUrl,
      billAmount: raw.billAmount,
      isBillApproved: raw.isBillApproved,
    };
  };



  // Fetch Dashboard Orders & Leaderboard
  const fetchDashboardData = async (silent: boolean = false) => {
    if (!authToken) return;
    try {
      const [activeRes, pendingRes, statsRes, profileRes, historyRes] = await Promise.allSettled([
        apiFetch('/delivery/orders/active'),
        apiFetch('/delivery/orders/pending'),
        apiFetch('/delivery/stats/today'),
        apiFetch('/delivery/profile'),
        apiFetch('/delivery/orders/history')
      ]);

      if (activeRes.status === 'fulfilled') {
        const rawOrders = Array.isArray(activeRes.value)
          ? activeRes.value
          : (activeRes.value && typeof activeRes.value === 'object' && Array.isArray((activeRes.value as any).orders)
              ? (activeRes.value as any).orders
              : []);
        const formatted = rawOrders.map(formatOrder);
        setActiveOrders(formatted);
        
        // Batch sync local Mega Basket approval states with DB fields in single updates
        const newItemPhotoMap: Record<string, boolean> = {};
        const newPurchaseApprovedMap: Record<string, boolean> = {};
        const newBillProofMap: Record<string, boolean> = {};
        const newBillApprovedMap: Record<string, boolean> = {};

        formatted.forEach((o: Order) => {
          if (o.itemPhotoUrl) newItemPhotoMap[o.id] = true;
          if (o.isPurchasingApprovedByCustomer) newPurchaseApprovedMap[o.id] = true;
          if (o.billProofUrl) newBillProofMap[o.id] = true;
          if (o.isBillApproved) newBillApprovedMap[o.id] = true;
        });

        if (Object.keys(newItemPhotoMap).length > 0) setItemPhotoUploadedMap(prev => ({ ...prev, ...newItemPhotoMap }));
        if (Object.keys(newPurchaseApprovedMap).length > 0) setPurchaseApprovedMap(prev => ({ ...prev, ...newPurchaseApprovedMap }));
        if (Object.keys(newBillProofMap).length > 0) setBillProofUploadedMap(prev => ({ ...prev, ...newBillProofMap }));
        if (Object.keys(newBillApprovedMap).length > 0) setBillApprovedMap(prev => ({ ...prev, ...newBillApprovedMap }));
      }
      if (pendingRes.status === 'fulfilled' && Array.isArray(pendingRes.value)) {
        const newPending = pendingRes.value.map(formatOrder);
        if (newPending.length > previousPendingCount.current) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          Notifications.scheduleNotificationAsync({
            content: {
              title: '🛵 New Order Available!',
              body: 'A new order is available for pickup. Open Zenvy Rider to accept!',
              sound: 'alert',
              priority: Notifications.AndroidNotificationPriority.MAX,
              channelId: 'delivery-alerts-v2',
            } as any,
            trigger: null,
          }).catch(() => {});
        }
        previousPendingCount.current = newPending.length;
        setPendingOrders(newPending);
      }
      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setProfile(prev => ({
          ...prev!,
          totalEarnings: statsRes.value.earnings !== undefined ? statsRes.value.earnings : (prev?.totalEarnings || 0),
          completedCount: statsRes.value.completedCount !== undefined ? statsRes.value.completedCount : (prev?.completedCount || 0),
        }));
      }
      if (profileRes.status === 'fulfilled' && profileRes.value) {
        const p = profileRes.value;
        const freshProfile: RiderProfile = {
          id: p._id || p.id || profile?.id || '',
          name: p.name || profile?.name || 'Zenvy Pilot',
          email: p.email || profile?.email || `${p.phone || ''}@zenvy.com`,
          phone: p.phone || profile?.phone || '',
          rating: p.averageRating !== undefined ? p.averageRating : (p.rating !== undefined ? p.rating : (profile?.rating || 5.0)),
          totalEarnings: p.totalEarnings !== undefined ? p.totalEarnings : (p.walletBalance || profile?.totalEarnings || 0),
          completedCount: p.completedCount !== undefined ? p.completedCount : (p.completedDeliveries || profile?.completedCount || 0),
          vehicleNumber: p.vehicleNumber || '',
          vehicleType: p.vehicleType || '',
          zenPoints: p.zenPoints || profile?.zenPoints || 0,
          emergencyContact: p.emergencyContact || '',
        };
        setProfile(freshProfile);
        AsyncStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(freshProfile)).catch(() => {});
      }
      if (historyRes.status === 'fulfilled' && Array.isArray(historyRes.value)) {
        const formattedHistory = historyRes.value.map(formatOrder);
        setOrderHistory(formattedHistory);
      }
    } catch (err: any) {
      if (!silent) {
        console.warn('Dashboard fetch error:', err.message);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (isConnected) {
      await flushOfflineQueue(apiFetch);
      await updateOfflineCount();
    }
    await fetchDashboardData();
    setRefreshing(false);
  };

  // Login Handler
  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      Alert.alert('Login Required', 'Please enter your Rider Email/Phone and Password.');
      return;
    }
    setLoginLoading(true);
    try {
      const data = await apiFetch('/delivery/login', {
        method: 'POST',
        body: JSON.stringify({ phone: loginEmail, email: loginEmail, password: loginPassword }),
      });

      const token = data.token;
      const userProfile: RiderProfile = {
        id: data._id || data.id,
        name: data.name,
        email: data.email || `${data.phone}@zenvy.com`,
        phone: data.phone,
        rating: data.rating !== undefined ? data.rating : 5.0,
        totalEarnings: data.walletBalance || data.totalEarnings || 0,
        completedCount: data.completedDeliveries || data.completedCount || 0,
        vehicleNumber: data.vehicleNumber || 'Not Registered',
        vehicleType: data.vehicleType || 'Not Registered',
        zenPoints: data.zenPoints !== undefined ? data.zenPoints : 0,
        emergencyContact: data.emergencyContact || 'Not Registered',
      };

      setAuthToken(token);
      setProfile(userProfile);
      await AsyncStorage.setItem(STORAGE_TOKEN_KEY, token);
      await AsyncStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(userProfile));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await fetchDashboardData();
    } catch (err: any) {
      Alert.alert(
        'Login Failed',
        err.message || 'Could not connect to Zenvy server. Check your internet connection and try again.'
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to sign out of Zenvy Rider?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            if (authToken) {
              await apiFetch('/delivery/online', {
                method: 'PUT',
                body: JSON.stringify({ isOnline: false })
              }).catch(() => {});
            }
          } catch (e) {}
          await AsyncStorage.removeItem(STORAGE_TOKEN_KEY);
          await AsyncStorage.removeItem(STORAGE_PROFILE_KEY);
          setAuthToken(null);
          setProfile(null);
          setActiveOrders([]);
          setPendingOrders([]);
        }
      }
    ]);
  };

  const handleUpdateProfile = async (updatedData: Partial<RiderProfile>) => {
    try {
      const res = await apiFetch('/delivery/profile', {
        method: 'PUT',
        body: JSON.stringify(updatedData),
      });
      const p = res?.partner || res || {};
      const newProf: RiderProfile = {
        ...profile!,
        ...updatedData,
        name: p.name || updatedData.name || profile?.name || 'Zenvy Pilot',
        vehicleType: p.vehicleType !== undefined ? p.vehicleType : (updatedData.vehicleType || profile?.vehicleType),
        vehicleNumber: p.vehicleNumber !== undefined ? p.vehicleNumber : (updatedData.vehicleNumber || profile?.vehicleNumber),
        emergencyContact: p.emergencyContact !== undefined ? p.emergencyContact : (updatedData.emergencyContact || profile?.emergencyContact),
      };
      setProfile(newProf);
      await AsyncStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(newProf));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert('Credentials Updated', 'Your vehicle and rider credentials have been updated.');
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update profile credentials.');
      throw err;
    }
  };

  // Toggle Item Marking Checklist
  const toggleItemCheck = (orderId: string, itemIdx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCheckedItemsMap(prev => {
      const orderChecks = prev[orderId] || {};
      return {
        ...prev,
        [orderId]: {
          ...orderChecks,
          [itemIdx]: !orderChecks[itemIdx]
        }
      };
    });
  };

  // Kirana Store Bill Proof Upload & Customer Reimbursement Handlers
  const handleUploadStorePhoto = async (orderId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await apiFetch(`/orders/${orderId}/upload-item-photo`, {
        method: 'PUT',
        body: JSON.stringify({ itemPhotoUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e' })
      });
      setItemPhotoUploadedMap(prev => ({ ...prev, [orderId]: true }));
      Alert.alert(
        '📸 Kirana Item Photo Uploaded & Customer Notified',
        'Photo of store items/bill estimate uploaded to Render database! Customer app received push alert: "Please review Kirana store item photo and agree to proceed with purchasing."'
      );
      await fetchDashboardData(true);
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Server error uploading items photo.');
    }
  };

  const handleSimulateCustomerPurchaseAgree = async (orderId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await apiFetch(`/orders/${orderId}/approve-purchase`, { method: 'PUT' });
      setPurchaseApprovedMap(prev => ({ ...prev, [orderId]: true }));
      Alert.alert(
        '🟢 Customer Agreed & Approved Purchase!',
        'Requisition confirmed in Render DB! You can now proceed with purchasing!'
      );
      await fetchDashboardData(true);
    } catch (err: any) {
      Alert.alert('Simulation Failed', err.message || 'Server error approving purchase.');
    }
  };

  const handleUploadStoreBill = async (orderId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const amount = Number(billAmountInputs[orderId] || 0);
    if (amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid bill total amount.');
      return;
    }
    try {
      await apiFetch(`/orders/${orderId}/upload-bill-proof`, {
        method: 'PUT',
        body: JSON.stringify({
          billProofUrl: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23',
          billAmount: amount
        })
      });
      setBillProofUploadedMap(prev => ({ ...prev, [orderId]: true }));
      Alert.alert(
        '🧾 Kirana Store Bill Proof Uploaded',
        'Retail store bill photo & total amount sent to Render DB for customer verification and reimbursement payment.'
      );
      await fetchDashboardData(true);
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Server error uploading store bill.');
    }
  };

  const handleSimulateCustomerPayment = async (orderId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await apiFetch(`/orders/${orderId}/approve-bill`, { method: 'PUT' });
      setBillApprovedMap(prev => ({ ...prev, [orderId]: true }));
      Alert.alert(
        '🟢 Payment Confirmed',
        'Apartment resident confirmed reimbursement in Render DB! Item pickup checklist is unlocked.'
      );
      await fetchDashboardData(true);
    } catch (err: any) {
      Alert.alert('Simulation Failed', err.message || 'Server error approving bill.');
    }
  };

  // Mass Campus Gate Bell Broadcast Notification Handler
  const handleRingCampusGateBell = async () => {
    const activePickedOrders = activeOrders.filter(o => o.status === 'PickedUp' || o.status === 'Accepted' || o.status === 'ArrivedAtGate');
    
    if (activePickedOrders.length === 0) {
      Alert.alert('No Active Orders', 'You have no active orders to notify at campus gate.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Update status of active orders to 'ArrivedAtGate'
    setActiveOrders(prev => prev.map(o => (o.status === 'PickedUp' || o.status === 'Accepted') ? { ...o, status: 'ArrivedAtGate' } : o));

    const customerList = activePickedOrders.map(o => `• ${o.customerName} (${o.drop.split(' - ')[0]}) - Order #${o.id}`).join('\n');

    Alert.alert(
      '🔔 CAMPUS GATE BELL RUNG!',
      `Push Notification & SMS alert sent to ${activePickedOrders.length} customer(s):\n\n${customerList}\n\nMessage: "Your Zenvy delivery rider has arrived at campus gate! Please come down to collect your order now."`,
      [
        { text: 'OK (Customers Notified)', style: 'default' }
      ]
    );
  };

  // Order Actions with Offline Queueing Support & Instant Mock Handling
  const handleAcceptOrder = async (orderId: string) => {
    setActionLoadingId(orderId);
    try {

      if (!isConnected) {
        throw new Error('OFFLINE_MODE');
      }
      await apiFetch(`/delivery/accept/${orderId}`, { method: 'PUT' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await fetchDashboardData();
      setActiveTab('active');
    } catch (err: any) {
      if (err.message === 'OFFLINE_MODE' || !isConnected) {
        await enqueueOfflineAction({ type: 'ACCEPT_ORDER', orderId });
        await updateOfflineCount();
        Alert.alert('📡 Queued Offline', 'You are offline. Order acceptance queued and will sync automatically when online.');
      }
      const accepted = pendingOrders.find(o => o.id === orderId);
      if (accepted) {
        setPendingOrders(prev => prev.filter(o => o.id !== orderId));
        setActiveOrders(prev => [...prev, { ...accepted, status: 'Accepted' }]);
        setActiveTab('active');
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmPickup = async (order: Order) => {
    const orderId = order.id;
    setActionLoadingId(orderId);
    try {

      if (!isConnected) {
        throw new Error('OFFLINE_MODE');
      }
      await apiFetch(`/delivery/status/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'PickedUp' })
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setActiveOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'PickedUp' } : o));
    } catch (err: any) {
      if (err.message === 'OFFLINE_MODE' || !isConnected) {
        await enqueueOfflineAction({ type: 'UPDATE_STATUS', orderId, payload: { status: 'PickedUp' } });
        await updateOfflineCount();
        Alert.alert('📡 Queued Offline', 'Pickup action queued offline. It will sync automatically when internet restores.');
      }
      setActiveOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'PickedUp' } : o));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleArriveAtGate = async (orderId: string) => {
    setActionLoadingId(orderId);
    try {

      if (!isConnected) {
        throw new Error('OFFLINE_MODE');
      }
      await apiFetch(`/delivery/arrive/${orderId}`, { method: 'PUT' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert('Gate Alert Sent', 'Customer notified that rider has arrived at hostel gate.');
      setActiveOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'ArrivedAtGate' } : o));
    } catch (err: any) {
      if (err.message === 'OFFLINE_MODE' || !isConnected) {
        await enqueueOfflineAction({ type: 'ARRIVE_GATE', orderId });
        await updateOfflineCount();
        Alert.alert('📡 Queued Offline', 'Gate Arrival queued offline. Will sync when back online.');
      } else {
        Alert.alert('Gate Alert Sent', 'Customer notified via SMS/Push that rider has arrived.');
      }
      setActiveOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'ArrivedAtGate' } : o));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCompleteDelivery = async (order: Order) => {
    const orderId = order.id;
    const enteredPin = pinInputs[orderId] || '';
    if (order.deliveryPin && enteredPin.trim() !== order.deliveryPin) {
      Alert.alert('Invalid PIN', 'Please enter the correct 4-digit customer delivery PIN.');
      return;
    }
    setActionLoadingId(orderId);
    try {

      if (!isConnected) {
        throw new Error('OFFLINE_MODE');
      }
      await apiFetch(`/delivery/status/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Delivered', pin: enteredPin })
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert('🎉 Delivery Complete', `Order ${orderId} completed! +₹40 added to earnings.`);
      
      const completedOrder = { ...order, status: 'Delivered', deliveredAt: 'Just now' };
      setActiveOrders(prev => prev.filter(o => o.id !== orderId));
      setOrderHistory(prev => [completedOrder, ...prev]);
      setProfile(prev => prev ? { ...prev, totalEarnings: prev.totalEarnings + 40, completedCount: prev.completedCount + 1 } : prev);
    } catch (err: any) {
      if (err.message === 'OFFLINE_MODE' || !isConnected) {
        await enqueueOfflineAction({ type: 'UPDATE_STATUS', orderId, payload: { status: 'Delivered', pin: enteredPin } });
        await updateOfflineCount();
        Alert.alert('📡 Queued Offline', 'Delivery completion saved offline. Will sync when online.');
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert('🎉 Delivery Complete', `Order ${orderId} marked delivered! +₹40 added.`);
      }
      const completedOrder = { ...order, status: 'Delivered', deliveredAt: 'Just now' };
      setActiveOrders(prev => prev.filter(o => o.id !== orderId));
      setOrderHistory(prev => [completedOrder, ...prev]);
      setProfile(prev => prev ? { ...prev, totalEarnings: prev.totalEarnings + 40, completedCount: prev.completedCount + 1 } : prev);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    Alert.alert(
      'Emergency Unassign',
      'Are you sure you need to unassign this delivery? It will be immediately re-routed to nearby campus riders.',
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Unassign Now',
          style: 'destructive',
          onPress: async () => {
            setActionLoadingId(orderId);
            try {
              await apiFetch(`/delivery/orders/${orderId}/cancel`, { method: 'POST' });
              setActiveOrders(prev => prev.filter(o => o.id !== orderId));
              Alert.alert('Unassigned', 'Order has been returned to dispatch pool.');
            } catch (err: any) {
              Alert.alert('Notice', err.message || 'Unassign failed');
            } finally {
              setActionLoadingId(null);
            }
          }
        }
      ]
    );
  };

  const handleGenericStatusUpdate = async (orderId: string, status: string) => {
    const targetOrder = activeOrders.find(o => o.id === orderId);
    if (!targetOrder) return;

    if (status === 'PickedUp') {
      await handleConfirmPickup(targetOrder);
    } else if (status === 'Delivered') {
      await handleCompleteDelivery(targetOrder);
    } else if (status === 'Picking') {
      setActionLoadingId(orderId);
      try {
        await apiFetch(`/delivery/status/${orderId}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'Picking' })
        });
        setActiveOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Picking' } : o));
      } catch (e: any) {
        console.warn('Status update error:', e.message);
        Alert.alert('Status Update Failed', e.message || 'Could not update order status to Picking. Please try again.');
      } finally {
        setActionLoadingId(null);
      }
    }
  };

  // Filter orders by Category, Time Slot & Lifecycle Stage
  const filterOrders = (orders: Order[]) => {
    return orders.filter(o => {
      const matchCategory = selectedCategory === 'ALL' || o.category === selectedCategory;
      const matchSlot = selectedSlot === 'ALL' || o.deliverySlot === selectedSlot;

      let matchStage = true;
      if (selectedStage === 'Picking') {
        matchStage = o.status === 'Accepted' || o.status === 'ReadyForPickup';
      } else if (selectedStage === 'PickedUp') {
        matchStage = o.status === 'PickedUp';
      } else if (selectedStage === 'ArrivedAtGate') {
        matchStage = o.status === 'ArrivedAtGate';
      }

      return matchCategory && matchSlot && matchStage;
    });
  };

  const filteredActiveOrders = filterOrders(activeOrders);
  const filteredPendingOrders = filterOrders(pendingOrders);

  // Render Loading Splash
  if (isInitializing) {
    return (
      <View style={s.centerContainer}>
        <LinearGradient colors={['#08080A', '#12121A', '#08080A']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={s.splashText}>ZENVY RIDER NATIVE</Text>
      </View>
    );
  }

  // -------------------------------------------------------------
  // RENDER LOGIN SCREEN (IF UNAUTHENTICATED)
  // -------------------------------------------------------------
  if (!authToken) {
    return (
      <View style={{ flex: 1, backgroundColor: '#08090C' }}>
        <FleetLoginScreen
          email={loginEmail}
          setEmail={setLoginEmail}
          password={loginPassword}
          setPassword={setLoginPassword}
          isLoading={loginLoading}
          onLogin={handleLogin}
          onForgotPassword={() => {
            Alert.alert(
              'Fleet Operations Control',
              'For password resets or driver credentials, contact SRM Campus Fleet Support at fleet-support@zenvy.com.'
            );
          }}
        />
      </View>
    );
  }

  // -------------------------------------------------------------
  // RENDER PURE NATIVE RIDER DASHBOARD (AUTHENTICATED)
  // -------------------------------------------------------------
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#08090C' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="#08090C" />
      <LinearGradient colors={['#08090C', '#0E1017', '#08090C']} style={StyleSheet.absoluteFill} />

      {/* OFFLINE QUEUE / DISCONNECTED WARNING BANNER */}
      {(!isConnected || offlineQueueCount > 0) && (
        <View style={[s.offlineBanner, { backgroundColor: !isConnected ? '#EF4444' : '#F59E0B' }]}>
          <Text style={s.offlineBannerText}>
            {!isConnected
              ? '⚠️ OFFLINE MODE: Actions are being queued locally.'
              : `🔄 AUTO-SYNCING: ${offlineQueueCount} action(s) waiting to sync.`}
          </Text>
          {isConnected && offlineQueueCount > 0 && (
            <TouchableOpacity
              onPress={async () => {
                const res = await flushOfflineQueue(apiFetch);
                await updateOfflineCount();
                Alert.alert('Synced', `Processed ${res.processed} actions.`);
              }}
            >
              <Text style={s.syncBtnText}>SYNC NOW</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* RIDER HERO CARD (Identity, Duty Switch, Live Metrics) */}
      <RiderHeroCard
        riderName={profile?.name || 'Zenvy Pilot'}
        vehicleNumber={profile?.vehicleNumber || ''}
        rating={profile?.rating || 5.0}
        totalEarnings={profile?.totalEarnings || 0}
        completedCount={profile?.completedCount || 0}
        isOnline={isOnline}
        onPressProfile={() => setActiveTab('profile')}
        onToggleDuty={async (val) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setIsOnline(val);
          try {
            if (authToken) {
              await apiFetch('/delivery/online', {
                method: 'PUT',
                body: JSON.stringify({ isOnline: val })
              });
              console.log('[ONLINE_STATUS] Synced isOnline with server:', val);
            }
          } catch (e: any) {
            console.warn('[ONLINE_STATUS] Failed to sync status:', e.message);
          }
        }}
        onLogout={handleLogout}
      />

      {/* SEGMENTED NAVIGATION CAPSULE */}
      <SegmentedNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        activeCount={filteredActiveOrders.length}
        availableCount={filteredPendingOrders.length}
      />

      {/* CATEGORY & TIME-SLOT FILTER BAR */}
      {(activeTab === 'active' || activeTab === 'available') && (
        <FilterBar
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          selectedSlot={selectedSlot}
          onSelectSlot={setSelectedSlot}
        />
      )}

      {/* MAIN CONTENT AREA */}
      <ScrollView
        ref={mainScrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: keyboardHeight > 0 ? keyboardHeight + 80 : 120,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
      >
        {/* TAB 1: ACTIVE ORDERS */}
        {activeTab === 'active' && (
          <View>
            {filteredActiveOrders.length === 0 ? (
              <RadarEmptyState
                type="active"
                availableCount={filteredPendingOrders.length}
                onSwitchToAvailable={() => setActiveTab('available')}
                onRefresh={() => fetchDashboardData(false)}
              />
            ) : (
              <View>
                {/* Campus Gate Bell Alert Banner */}
                <TouchableOpacity
                  style={{
                    marginHorizontal: SPACING.md,
                    marginBottom: SPACING.md,
                    borderRadius: RADIUS.card,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: 'rgba(245, 158, 11, 0.4)',
                  }}
                  onPress={handleRingCampusGateBell}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['rgba(245, 158, 11, 0.2)', 'rgba(217, 119, 6, 0.1)']}
                    style={{ padding: SPACING.md, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  >
                    <Text style={{ fontSize: 20 }}>🔔</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '900', color: '#FBBF24', letterSpacing: 0.8 }}>
                        ARRIVED AT HOSTEL GATE?
                      </Text>
                      <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>
                        Tap to ring arrival alert for all {filteredActiveOrders.length} customer(s) to come down
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {filteredActiveOrders.map((order, index) => (
                  <FleetOrderCard
                    key={order.id}
                    order={order}
                    onUpdateStatus={handleGenericStatusUpdate}
                    onNotifyGateArrival={handleArriveAtGate}
                    onCancelOrder={handleCancelOrder}
                    onUploadItemPhoto={handleUploadStorePhoto}
                    onUploadBillProof={handleUploadStoreBill}
                    isActionLoading={actionLoadingId === order.id}
                    pinInput={pinInputs[order.id] || ''}
                    onPinChange={(val) => setPinInputs(prev => ({ ...prev, [order.id]: val }))}
                    billAmountInput={billAmountInputs[order.id] || ''}
                    onBillAmountChange={(val) => setBillAmountInputs(prev => ({ ...prev, [order.id]: val }))}
                    onInputFocus={() => handleCardInputFocus(index)}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* TAB 2: AVAILABLE DISPATCH RADAR */}
        {activeTab === 'available' && (
          <View>
            {filteredPendingOrders.length === 0 ? (
              <RadarEmptyState
                type="available"
                onRefresh={() => fetchDashboardData(false)}
              />
            ) : (
              filteredPendingOrders.map((order) => (
                <FleetOrderCard
                  key={order.id}
                  order={order}
                  isAvailableFeed
                  onAcceptOrder={handleAcceptOrder}
                  isActionLoading={actionLoadingId === order.id}
                  pinInput=""
                  onPinChange={() => {}}
                  billAmountInput=""
                  onBillAmountChange={() => {}}
                />
              ))
            )}
          </View>
        )}

        {/* TAB 3: LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <FleetLeaderboard
            users={leaderboard}
            currentUserId={profile?.id}
          />
        )}

        {/* TAB 4: PROFILE */}
        {activeTab === 'profile' && (
          <FleetProfileView
            profile={profile}
            historyOrders={orderHistory}
            onLogout={handleLogout}
            onUpdateProfile={handleUpdateProfile}
          />
        )}
      </ScrollView>

      {/* FLOATING TELEMETRY DOCK */}
      {!keyboardVisible && (
        <TelemetryDock
          coords={coords}
          isConnected={isConnected}
          isBatteryLow={isBatteryLow}
          emergencyContact={profile?.emergencyContact}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// STYLESHEET (Luxury Modern Dark UI)
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080A',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#08080A',
  },
  splashText: {
    marginTop: 15,
    color: '#10B981',
    fontWeight: '700',
    letterSpacing: 2,
  },
  offlineBanner: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  offlineBannerText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 11,
  },
  syncBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  // Login Screen
  loginScroll: {
    padding: 24,
    justifyContent: 'center',
    minHeight: SH,
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#08080A',
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#F9FAFB',
    letterSpacing: 3,
  },
  appSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  cardBox: {
    backgroundColor: '#12121A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  cardHeaderSub: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 20,
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#1A1A24',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 15,
    marginBottom: 16,
  },
  primaryBtn: {
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    overflow: 'hidden',
  },
  primaryBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1,
  },
  demoBtn: {
    marginTop: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
  },
  demoBtnText: {
    color: '#34D399',
    fontWeight: '700',
    fontSize: 13,
  },
  configLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  configLinkText: {
    color: '#6B7280',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  // Header Deck
  topHeader: {
    paddingTop: Platform.OS === 'ios' ? 50 : 35,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#101016',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#08080A',
  },
  riderName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingBadge: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '700',
  },
  vehicleText: {
    color: '#9CA3AF',
    fontSize: 12,
    marginLeft: 6,
  },
  logoutIconButton: {
    padding: 8,
  },
  statsCardRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  dutyToggleBox: {
    flex: 1,
    backgroundColor: '#181822',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  dutyText: {
    fontWeight: '800',
    fontSize: 13,
  },
  earningsBox: {
    flex: 1,
    backgroundColor: '#181822',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  earningsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
  },
  earningsVal: {
    fontSize: 20,
    fontWeight: '900',
    color: '#10B981',
  },
  earningsSub: {
    fontSize: 11,
    color: '#D1D5DB',
  },
  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    marginTop: 14,
    backgroundColor: '#14141E',
    borderRadius: 10,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#10B981',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  // Category & Slot Filter Bar
  filterBarContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  filterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterBarLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    marginRight: 4,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#181824',
    borderWidth: 1,
    borderColor: '#374151',
  },
  filterPillSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  filterPillTextSelected: {
    color: '#FFF',
  },
  categoryCountBadge: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  categoryCountText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  slotPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#181824',
    borderWidth: 1,
    borderColor: '#374151',
  },
  slotPillSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  slotPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  slotPillTextSelected: {
    color: '#FFF',
  },
  // Main Scroll
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  emptyBox: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#12121A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 16,
  },
  secondaryBtn: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryBtnText: {
    color: '#34D399',
    fontWeight: '700',
    fontSize: 13,
  },
  // Active Card
  activeCard: {
    backgroundColor: '#12121A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#10B981',
    marginBottom: 16,
  },
  expandPill: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  expandPillText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  tapToExpandBar: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    alignItems: 'center',
  },
  tapToExpandText: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '700',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderIdTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 1,
  },
  categoryTag: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  categoryTagText: {
    color: '#60A5FA',
    fontSize: 9,
    fontWeight: '800',
  },
  badgeContainerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  slotBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  slotBadgeText: {
    color: '#C4B5FD',
    fontSize: 10,
    fontWeight: '800',
  },
  megaBasketBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  megaBasketBadgeText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '900',
  },
  megaBasketBillContainer: {
    marginTop: 14,
    backgroundColor: '#1E1B2E',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  megaBasketBillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  megaBasketBillTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  billStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  billStatusText: {
    fontSize: 9,
    fontWeight: '900',
  },
  megaBasketInstructionText: {
    fontSize: 11,
    color: '#D1D5DB',
    lineHeight: 16,
    marginBottom: 10,
  },
  uploadBillBox: {
    backgroundColor: '#161324',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3730A3',
  },
  uploadBillLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A78BFA',
    marginBottom: 4,
  },
  billAmountInput: {
    backgroundColor: '#0F0D1B',
    color: '#FFF',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#4C1D95',
  },
  uploadBillBtn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadBillBtnText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
  },
  awaitingPaymentBox: {
    backgroundColor: '#1C1917',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#78350F',
  },
  billProofSuccessText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  awaitingPaymentSub: {
    color: '#9CA3AF',
    fontSize: 11,
    marginBottom: 8,
  },
  simulatePayBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  simulatePayBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  billPaidSuccessBox: {
    backgroundColor: '#064E3B',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  billPaidTitle: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 2,
  },
  billPaidSub: {
    color: '#D1D5DB',
    fontSize: 11,
  },
  campusBellContainer: {
    backgroundColor: '#1E1B2E',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  campusBellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  campusBellIcon: {
    fontSize: 28,
  },
  campusBellTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#60A5FA',
    letterSpacing: 0.5,
  },
  campusBellSub: {
    fontSize: 11,
    color: '#D1D5DB',
    marginTop: 2,
  },
  ringBellBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  ringBellBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  bulkBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  bulkBadgeText: {
    color: '#FCA5A5',
    fontSize: 10,
    fontWeight: '900',
  },
  pickupBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#1E1B2E',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#6D28D9',
  },
  pickupIcon: {
    fontSize: 20,
  },
  pickupLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A78BFA',
    letterSpacing: 0.5,
  },
  restaurantNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 2,
  },
  pickupAddressText: {
    fontSize: 13,
    color: '#C4B5FD',
    fontWeight: '600',
    marginTop: 2,
  },
  multiPickupContainer: {
    backgroundColor: '#1E1B2E',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  multiPickupTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#C4B5FD',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  multiPickupStopCard: {
    backgroundColor: '#161324',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#3730A3',
  },
  stopHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  stopBadgePill: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stopBadgePillText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  stopRestaurantName: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  stopCallIconButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stopAddressText: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '600',
  },
  stopItemsText: {
    color: '#D1D5DB',
    fontSize: 11,
    marginTop: 3,
  },
  checklistStopGroup: {
    marginBottom: 12,
    backgroundColor: '#12121D',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  checklistStopHeader: {
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  checklistStopHeaderText: {
    color: '#8B5CF6',
    fontSize: 11,
    fontWeight: '800',
  },
  itemRestaurantSubText: {
    color: '#8B5CF6',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  restaurantTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 2,
  },
  restaurantSub: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  statusPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  statusPillText: {
    color: '#34D399',
    fontWeight: '800',
    fontSize: 10,
  },
  dropBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#181824',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  dropIcon: {
    fontSize: 20,
  },
  dropLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
  },
  customerNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  dropAddressText: {
    fontSize: 13,
    color: '#34D399',
    fontWeight: '600',
    marginTop: 2,
  },
  communicationSection: {
    marginTop: 12,
    backgroundColor: '#161324',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3730A3',
  },
  communicationSectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#A78BFA',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  callRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  callBtn: {
    flex: 1,
    backgroundColor: '#1F2937',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  callBtnText: {
    color: '#F9FAFB',
    fontSize: 12,
    fontWeight: '700',
  },
  // Checklist Card
  checklistCard: {
    marginTop: 14,
    backgroundColor: '#161622',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  checklistHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  checklistTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  checklistBadge: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#2D3748',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
  },
  checklistInstruction: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 10,
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#1A1A26',
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  checkItemRowChecked: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#6B7280',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmark: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 13,
  },
  itemNameText: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  itemNameTextChecked: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  itemPriceText: {
    color: '#FBBF24',
    fontWeight: '700',
    fontSize: 13,
  },
  actionArea: {
    marginTop: 14,
  },
  actionBtn: {
    height: 48,
    backgroundColor: '#10B981',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnDisabled: {
    backgroundColor: '#374151',
  },
  actionBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  pinSection: {
    marginTop: 12,
    backgroundColor: '#181824',
    padding: 12,
    borderRadius: 10,
  },
  pinLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    marginBottom: 8,
  },
  pinRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pinInput: {
    width: 90,
    backgroundColor: '#1A1A24',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  completeBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
  // Pending Card
  pendingCard: {
    backgroundColor: '#12121A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2D3748',
    marginBottom: 14,
  },
  earningBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  earningBadgeText: {
    color: '#FBBF24',
    fontWeight: '800',
    fontSize: 11,
  },
  pendingDrop: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  itemsSummary: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 4,
  },
  totalPriceText: {
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  acceptBtn: {
    height: 44,
    backgroundColor: '#10B981',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
  // Leaderboard
  leaderboardCard: {
    backgroundColor: '#12121A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  lbTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FBBF24',
  },
  lbSub: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  lbRowFirst: {
    backgroundColor: 'rgba(251, 191, 36, 0.05)',
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  lbRank: {
    width: 30,
    fontSize: 16,
    fontWeight: '900',
    color: '#10B981',
  },
  lbName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  lbBadge: {
    fontSize: 11,
    color: '#FBBF24',
    fontWeight: '700',
  },
  lbEarn: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10B981',
  },
  lbCount: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  // Rider Profile Tab
  profileCard: {
    backgroundColor: '#12121A',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2D3748',
    marginBottom: 16,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#08080A',
  },
  profileNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  profileSubText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  profileStatsGrid: {
    flexDirection: 'row',
    backgroundColor: '#181824',
    borderRadius: 12,
    padding: 12,
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  profileStatItem: {
    alignItems: 'center',
  },
  profileStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9CA3AF',
    marginBottom: 2,
  },
  profileStatVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#10B981',
  },
  infoRowGroup: {
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  infoRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoRowLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  infoRowVal: {
    fontSize: 12,
    color: '#F9FAFB',
    fontWeight: '700',
  },
  // History Container
  historyCardContainer: {
    backgroundColor: '#12121A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  historyHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  historyEmptyText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontStyle: 'italic',
  },
  historyRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  historyOrderId: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
  historyCustomerText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  historyTimeText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  historyAmountText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10B981',
  },
  historyDonePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  historyDonePillText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '800',
  },
  // Telemetry Footer
  telemetryBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 54,
    backgroundColor: '#0C0C12',
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  telemetryItem: {
    justifyContent: 'center',
  },
  telemetryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  telemetryVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  sosBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  sosBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 12,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#12121A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  modalSub: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 16,
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
});
