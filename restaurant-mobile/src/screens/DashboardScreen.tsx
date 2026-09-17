import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Switch,
  LayoutAnimation,
  Platform,
  UIManager,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSocket } from '../services/socket';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://hostelbites-backend-jwmt.onrender.com';

type OrderStage = 'ALL' | 'NEW' | 'PREPARING' | 'READY' | 'PICKED_UP';

// ── Live Elapsed Kitchen Timer Component ───────────────────────
const ElapsedTimer = memo(({ createdAt }: { createdAt?: string }) => {
  const [elapsedSecs, setElapsedSecs] = useState<number>(() => {
    if (!createdAt) return 0;
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    return diff > 0 ? diff : 0;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      if (!createdAt) return;
      const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
      setElapsedSecs(diff > 0 ? diff : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, [createdAt]);

  const mins = Math.floor(elapsedSecs / 60);
  const secs = elapsedSecs % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  // Urgency logic: Green < 8 mins, Amber 8-15 mins, Red > 15 mins
  const isUrgent = mins >= 15;
  const isModerate = mins >= 8 && mins < 15;
  const badgeBg = isUrgent
    ? 'rgba(239, 79, 95, 0.2)'
    : isModerate
    ? 'rgba(245, 158, 11, 0.2)'
    : 'rgba(16, 185, 129, 0.15)';
  const badgeColor = isUrgent ? COLORS.coral : isModerate ? COLORS.amber : COLORS.emerald;

  return (
    <View style={[styles.timerBadge, { backgroundColor: badgeBg }]}>
      <Ionicons
        name={isUrgent ? 'flame' : 'stopwatch-outline'}
        size={13}
        color={badgeColor}
      />
      <Text style={[styles.timerText, { color: badgeColor }]}>
        {timeStr} {isUrgent ? 'URGENT' : 'PREP'}
      </Text>
    </View>
  );
});

// ── Interactive Kitchen Order Card ─────────────────────────────
const OrderCard = memo(
  ({
    item,
    onUpdateStatus,
    onOpenReceipt,
  }: {
    item: any;
    onUpdateStatus: (id: string, status: string) => void;
    onOpenReceipt: (order: any) => void;
  }) => {
    const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

    const isPending = item.status === 'Pending';
    const isAccepted = item.status === 'Accepted';
    const isPreparing = item.status === 'Preparing';
    const isReady = item.status === 'ReadyForPickup' || item.status === 'Ready for Pickup';
    const isPickedUp = item.status === 'PickedUp' || item.status === 'Picking';

    const orderIdRaw = item._id || item.id || '';
    const orderId = String(orderIdRaw).slice(-6).toUpperCase();

    const toggleItemCheck = (idx: number) => {
      Haptics.selectionAsync();
      setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
    };

    const statusColor = isPending
      ? COLORS.amber
      : isAccepted || isPreparing
      ? COLORS.blue
      : isReady
      ? COLORS.emerald
      : COLORS.textMuted;

    return (
      <View
        style={[
          styles.orderCard,
          isPending && styles.cardPending,
          (isAccepted || isPreparing) && styles.cardAccepted,
          isReady && styles.cardReady,
        ]}
      >
        {/* Header Bar */}
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.orderId}>#{orderId}</Text>
            <ElapsedTimer createdAt={item.createdAt} />
          </View>

          <View style={[styles.statusCapsule, { borderColor: statusColor }]}>
            <Text style={[styles.orderStatus, { color: statusColor }]}>
              {isReady
                ? 'READY'
                : isPreparing
                ? 'COOKING'
                : item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Customer & Location */}
        <View style={styles.customerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="person" size={13} color={COLORS.gold} />
            <Text style={styles.customerName}>
              {item.userId?.name || item.customer || 'Campus Student'}
            </Text>
          </View>
          {item.drop && (
            <Text style={styles.dropText} numberOfLines={1}>
              📍 {item.drop}
            </Text>
          )}
        </View>

        <View style={styles.divider} />

        {/* Item-Level Tap Checklist */}
        <Text style={styles.checklistHint}>TAP ITEMS TO CHECK OFF (PLATED)</Text>
        <ScrollView style={styles.itemsList} nestedScrollEnabled={true}>
          {item.items?.map((i: any, idx: number) => {
            const isChecked = !!checkedItems[idx];
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.itemRow, isChecked && styles.itemRowChecked]}
                onPress={() => toggleItemCheck(idx)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkBox, isChecked && styles.checkBoxActive]}>
                  {isChecked && <Ionicons name="checkmark" size={12} color="#09090B" />}
                </View>
                <Text style={[styles.itemQty, isChecked && styles.itemTextStrikethrough]}>
                  {i.quantity}x
                </Text>
                <Text style={[styles.itemText, isChecked && styles.itemTextStrikethrough]}>
                  {i.menuItem?.name || i.name || 'Campus Dish'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.divider} />

        {/* Price & Receipt Details Button */}
        <View style={styles.footerRow}>
          <View>
            <Text style={styles.totalLabel}>TOTAL VALUE</Text>
            <Text style={styles.price}>₹{item.totalPrice || item.finalPrice || 0}</Text>
          </View>

          <TouchableOpacity
            style={styles.receiptBtn}
            onPress={() => onOpenReceipt(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="receipt-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.receiptBtnText}>TICKET</Text>
          </TouchableOpacity>
        </View>

        {/* Action Controls */}
        <View style={styles.actions}>
          {isPending && (
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => onUpdateStatus(orderIdRaw, 'Accepted')}
              activeOpacity={0.7}
            >
              <Text style={styles.btnText}>⚡ ACCEPT & START</Text>
            </TouchableOpacity>
          )}

          {isAccepted && (
            <View style={{ flexDirection: 'row', gap: 8, flex: 1 }}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]}
                onPress={() => onUpdateStatus(orderIdRaw, 'Preparing')}
                activeOpacity={0.7}
              >
                <Text style={styles.btnText}>🍳 COOKING</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: COLORS.emerald }]}
                onPress={() => onUpdateStatus(orderIdRaw, 'ReadyForPickup')}
                activeOpacity={0.7}
              >
                <Text style={styles.btnText}>✅ PACKED / READY</Text>
              </TouchableOpacity>
            </View>
          )}

          {isPreparing && (
            <TouchableOpacity
              style={styles.readyBtn}
              onPress={() => onUpdateStatus(orderIdRaw, 'ReadyForPickup')}
              activeOpacity={0.7}
            >
              <Text style={styles.btnText}>📦 MARK READY FOR PICKUP</Text>
            </TouchableOpacity>
          )}

          {isReady && (
            <View style={styles.readyBanner}>
              <Ionicons name="hourglass-outline" size={14} color={COLORS.emerald} />
              <Text style={styles.readyBannerText}>WAITING FOR RIDER PICKUP</Text>
            </View>
          )}

          {isPickedUp && (
            <View style={[styles.readyBanner, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
              <Ionicons name="bicycle-outline" size={14} color={COLORS.textSecondary} />
              <Text style={[styles.readyBannerText, { color: COLORS.textSecondary }]}>
                DISPATCHED WITH RIDER
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }
);

// ── Main Dashboard Screen Component ───────────────────────────
export default function DashboardScreen() {
  const { socket, isConnected } = useSocket();
  const navigation = useNavigation<any>();

  const [orders, setOrders] = useState<any[]>([]);
  const [autoAccept, setAutoAccept] = useState(false);
  const [audioAlerts, setAudioAlerts] = useState(true);
  const [restaurantData, setRestaurantData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Filter & Search States
  const [selectedStage, setSelectedStage] = useState<OrderStage>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('restaurant_data').then((data) => {
      if (data) {
        const parsed = JSON.parse(data);
        setRestaurantData(parsed);
        fetchOrders(parsed.id || parsed._id);
      } else {
        setLoading(false);
      }
    });
  }, []);

  const fetchOrders = async (restId: string) => {
    try {
      const token = await AsyncStorage.getItem('restaurant_token');
      const res = await fetch(`${API_URL}/api/restaurants/${restId}/orders`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.log('Error fetching orders:', e);
    } finally {
      setLoading(false);
    }
  };

  // Socket setup for real-time kitchen dispatch
  useEffect(() => {
    const effectiveRestId = restaurantData.id || restaurantData._id;
    if (!socket || !effectiveRestId) return;

    socket.emit('joinRestaurant', effectiveRestId);

    const handleNewOrder = (order: any) => {
      if (audioAlerts) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      if (autoAccept) {
        socket.emit('updateOrderStatus', {
          orderId: order.id || order._id,
          status: 'Accepted',
        });
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setOrders((prev) => {
        const id = order.id || order._id;
        if (prev.some((o) => (o.id || o._id) === id)) return prev;
        return [order, ...prev];
      });
    };

    socket.on('restaurant_newOrder', handleNewOrder);
    socket.on('statusUpdated', (data: any) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setOrders((prev) =>
        prev.map((o) => ((o.id || o._id) === data.id ? { ...o, status: data.status } : o))
      );
    });

    return () => {
      socket.off('restaurant_newOrder', handleNewOrder);
      socket.off('statusUpdated');
    };
  }, [socket, restaurantData, autoAccept, audioAlerts]);

  const updateStatus = async (orderId: string, status: string) => {
    const normalizedStatus = status === 'Ready for Pickup' ? 'ReadyForPickup' : status;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOrders((prev) =>
      prev.map((o) => ((o.id || o._id) === orderId ? { ...o, status: normalizedStatus } : o))
    );

    try {
      if (socket) {
        socket.emit('updateOrderStatus', { orderId, status: normalizedStatus });
      }
      const token = await AsyncStorage.getItem('restaurant_token');
      await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: normalizedStatus }),
      });
    } catch (e) {
      console.error('[STATUS_UPDATE_ERROR]', e);
    }
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await AsyncStorage.removeItem('restaurant_token');
    await AsyncStorage.removeItem('restaurant_data');
    navigation.replace('Login');
  };

  // Fetch Menu items for Out-of-Stock (86 Items) Drawer
  const handleOpenMenuManager = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuModalVisible(true);
    setMenuLoading(true);

    const restId = restaurantData.id || restaurantData._id;
    try {
      const res = await fetch(`${API_URL}/api/restaurants/${restId}/menu`);
      if (res.ok) {
        const data = await res.json();
        setMenuItems(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Menu fetch error:', err);
    } finally {
      setMenuLoading(false);
    }
  };

  // Toggle dish availability (Sold Out vs Available)
  const handleToggleItemAvailability = async (itemId: string, currentVal: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMenuItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, isAvailable: !currentVal } : item))
    );

    try {
      const token = await AsyncStorage.getItem('restaurant_token');
      await fetch(`${API_URL}/api/restaurants/menu/${itemId}/toggle`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.warn('Item toggle failed:', err);
    }
  };

  // Counts for pipeline tabs
  const pendingCount = orders.filter((o) => o.status === 'Pending').length;
  const preparingCount = orders.filter((o) => o.status === 'Accepted' || o.status === 'Preparing').length;
  const readyCount = orders.filter((o) => o.status === 'ReadyForPickup' || o.status === 'Ready for Pickup').length;
  const pickedUpCount = orders.filter((o) => o.status === 'PickedUp' || o.status === 'Picking').length;

  // Shift Revenue
  const shiftRevenue = orders
    .filter((o) => o.status !== 'Cancelled')
    .reduce((sum, o) => sum + (o.totalPrice || o.finalPrice || 0), 0);

  // Filter & Search logic
  const filteredOrders = orders.filter((order) => {
    // Stage Filter
    if (selectedStage === 'NEW' && order.status !== 'Pending') return false;
    if (selectedStage === 'PREPARING' && !['Accepted', 'Preparing'].includes(order.status)) return false;
    if (selectedStage === 'READY' && !['ReadyForPickup', 'Ready for Pickup'].includes(order.status)) return false;
    if (selectedStage === 'PICKED_UP' && !['PickedUp', 'Picking', 'Delivered'].includes(order.status)) return false;

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const id = String(order.id || order._id || '').toLowerCase();
      const cust = String(order.userId?.name || order.customer || '').toLowerCase();
      const itemsMatch = order.items?.some((i: any) =>
        (i.menuItem?.name || i.name || '').toLowerCase().includes(q)
      );
      if (!id.includes(q) && !cust.includes(q) && !itemsMatch) return false;
    }

    return true;
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ── TOP CONTROL BAR ── */}
      <View style={styles.topBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={styles.brandIconBox}>
            <Text style={{ fontSize: 16 }}>🍳</Text>
          </View>
          <View>
            <Text style={styles.restaurantName}>
              {(restaurantData.name || 'KITCHEN TERMINAL').toUpperCase()}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={[
                  styles.connectionDot,
                  { backgroundColor: isConnected ? COLORS.emerald : COLORS.amber },
                ]}
              />
              <Text style={styles.connectionText}>
                {isConnected ? 'LIVE RADAR CONNECTED' : 'CONNECTING DISPATCH...'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRightControls}>
          {/* Audio Chime Toggle */}
          <TouchableOpacity
            style={[styles.iconControlBtn, audioAlerts && styles.iconControlBtnActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setAudioAlerts(!audioAlerts);
            }}
          >
            <Ionicons
              name={audioAlerts ? 'volume-high' : 'volume-mute'}
              size={18}
              color={audioAlerts ? COLORS.emerald : COLORS.textDisabled}
            />
          </TouchableOpacity>

          {/* 86 Dishes Menu Drawer */}
          <TouchableOpacity
            style={styles.menuManageBtn}
            onPress={handleOpenMenuManager}
          >
            <Ionicons name="list" size={14} color={COLORS.gold} />
            <Text style={styles.menuManageBtnText}>86 ITEMS</Text>
          </TouchableOpacity>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.coral} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── KITCHEN SHIFT METRICS BAR ── */}
      <View style={styles.metricsBar}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>ACTIVE COOKING</Text>
          <Text style={[styles.metricValue, { color: COLORS.emerald }]}>
            {pendingCount + preparingCount}
          </Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>READY FOR PICKUP</Text>
          <Text style={[styles.metricValue, { color: COLORS.blue }]}>{readyCount}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>SHIFT REVENUE</Text>
          <Text style={[styles.metricValue, { color: COLORS.gold }]}>₹{shiftRevenue}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.autoAcceptToggle}>
          <Text style={styles.metricLabel}>AUTO ACCEPT</Text>
          <Switch
            value={autoAccept}
            onValueChange={setAutoAccept}
            trackColor={{ false: '#27272A', true: COLORS.emeraldDark }}
            thumbColor={autoAccept ? COLORS.emerald : '#71717A'}
          />
        </View>
      </View>

      {/* ── SEARCH BAR ── */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={16} color={COLORS.textDisabled} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Order #, Student name, or dish..."
            placeholderTextColor={COLORS.textDisabled}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={16} color={COLORS.textDisabled} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── PIPELINE KANBAN TABS ── */}
      <View style={styles.pipelineBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(
            [
              { key: 'ALL', label: `ALL (${orders.length})` },
              { key: 'NEW', label: `🔥 NEW (${pendingCount})` },
              { key: 'PREPARING', label: `🍳 IN KITCHEN (${preparingCount})` },
              { key: 'READY', label: `📦 READY (${readyCount})` },
              { key: 'PICKED_UP', label: `🛵 DISPATCHED (${pickedUpCount})` },
            ] as { key: OrderStage; label: string }[]
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.stageTab, selectedStage === tab.key && styles.stageTabActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedStage(tab.key);
              }}
            >
              <Text
                style={[
                  styles.stageTabText,
                  selectedStage === tab.key && styles.stageTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── ORDERS LIST ── */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.emerald} />
          <Text style={styles.loadingText}>Syncing Kitchen Telemetry...</Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>🍽️</Text>
          <Text style={styles.emptyTitle}>NO ORDERS IN THIS STAGE</Text>
          <Text style={styles.emptySub}>
            New customer orders placed in campus apps will appear here live with audio alerts.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => String(item._id || item.id || Math.random())}
          renderItem={({ item }) => (
            <OrderCard
              item={item}
              onUpdateStatus={updateStatus}
              onOpenReceipt={setActiveTicket}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── MODAL: 86 DISHES / MENU STOCK MANAGEMENT ── */}
      <Modal
        visible={menuModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMenuModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>86 DISHES • STOCK AVAILABILITY</Text>
                <Text style={styles.modalSub}>
                  Toggle items sold out in real-time to prevent customer orders
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setMenuModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            {menuLoading ? (
              <ActivityIndicator size="large" color={COLORS.gold} style={{ marginVertical: 40 }} />
            ) : menuItems.length === 0 ? (
              <Text style={styles.noMenuText}>No menu items found for this restaurant.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                {menuItems.map((item) => (
                  <View key={item.id} style={styles.menuItemRow}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.menuItemName}>{item.name}</Text>
                      <Text style={styles.menuItemPrice}>₹{item.price} • {item.category || 'General'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Switch
                        value={item.isAvailable !== false}
                        onValueChange={() =>
                          handleToggleItemAvailability(item.id, item.isAvailable !== false)
                        }
                        trackColor={{ false: '#EF4F5F', true: COLORS.emeraldDark }}
                        thumbColor={item.isAvailable !== false ? COLORS.emerald : '#FFF'}
                      />
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: '800',
                          color: item.isAvailable !== false ? COLORS.emerald : COLORS.coral,
                        }}
                      >
                        {item.isAvailable !== false ? 'AVAILABLE' : 'SOLD OUT (86)'}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── MODAL: DETAILED KITCHEN RECEIPT TICKET ── */}
      <Modal
        visible={!!activeTicket}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setActiveTicket(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.receiptSheet}>
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptTitle}>KITCHEN DISPATCH SLIP</Text>
              <Text style={styles.receiptOrderNum}>
                #{String(activeTicket?._id || activeTicket?.id || '').slice(-6).toUpperCase()}
              </Text>
            </View>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMetaKey}>CUSTOMER:</Text>
              <Text style={styles.receiptMetaVal}>
                {activeTicket?.userId?.name || activeTicket?.customer || 'Campus Student'}
              </Text>
            </View>

            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMetaKey}>LOCATION:</Text>
              <Text style={styles.receiptMetaVal}>{activeTicket?.drop || 'Hostel Campus'}</Text>
            </View>

            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMetaKey}>STATUS:</Text>
              <Text style={[styles.receiptMetaVal, { color: COLORS.emerald }]}>
                {activeTicket?.status}
              </Text>
            </View>

            <View style={styles.receiptDivider} />

            <Text style={styles.receiptSectionTitle}>ITEMS ORDERED:</Text>
            <ScrollView style={{ maxHeight: 180, marginVertical: 8 }}>
              {activeTicket?.items?.map((item: any, i: number) => (
                <View key={i} style={styles.receiptItemLine}>
                  <Text style={styles.receiptItemQty}>{item.quantity}x</Text>
                  <Text style={styles.receiptItemName}>{item.menuItem?.name || item.name}</Text>
                  <Text style={styles.receiptItemPrice}>₹{item.price * (item.quantity || 1)}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptTotalRow}>
              <Text style={styles.receiptTotalLabel}>TOTAL COLLECTABLE:</Text>
              <Text style={styles.receiptTotalVal}>
                ₹{activeTicket?.totalPrice || activeTicket?.finalPrice || 0}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.receiptCloseBtn}
              onPress={() => setActiveTicket(null)}
            >
              <Text style={styles.receiptCloseBtnText}>CLOSE TICKET</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },

  // Top Bar
  topBar: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#111318',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  brandIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1F222E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  restaurantName: { fontSize: 14, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: 1 },
  connectionDot: { width: 6, height: 6, borderRadius: 3 },
  connectionText: { fontSize: 8, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 0.8 },
  headerRightControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconControlBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconControlBtnActive: {
    borderColor: COLORS.emerald,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  menuManageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212, 175, 122, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
  },
  menuManageBtnText: { fontSize: 10, fontWeight: '900', color: COLORS.gold, letterSpacing: 0.8 },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 79, 95, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 79, 95, 0.3)',
  },

  // Metrics Bar
  metricsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141417',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  metricItem: { alignItems: 'center' },
  metricLabel: { fontSize: 8, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 0.8 },
  metricValue: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  metricDivider: { width: 1, height: 24, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  autoAcceptToggle: { alignItems: 'center' },

  // Search
  searchRow: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141417',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchInput: { flex: 1, paddingVertical: 10, color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },

  // Pipeline Tabs
  pipelineBar: { paddingHorizontal: 16, paddingVertical: 8 },
  stageTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#141417',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  stageTabActive: {
    backgroundColor: COLORS.emerald,
    borderColor: COLORS.emerald,
  },
  stageTabText: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary },
  stageTabTextActive: { color: '#09090B' },

  // Order Card
  listContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 6 },
  orderCard: {
    backgroundColor: '#141417',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardPending: { borderColor: COLORS.amber },
  cardAccepted: { borderColor: COLORS.blue },
  cardReady: { borderColor: COLORS.emerald },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  orderId: { fontSize: 16, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: 1 },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timerText: { fontSize: 10, fontWeight: '900' },
  statusCapsule: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  orderStatus: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  customerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  customerName: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  dropText: { fontSize: 11, color: COLORS.textSecondary, maxWidth: 160 },
  divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', marginVertical: 10 },
  checklistHint: { fontSize: 8, fontWeight: '800', color: COLORS.textDisabled, letterSpacing: 1, marginBottom: 6 },
  itemsList: { maxHeight: 120 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  itemRowChecked: { backgroundColor: 'rgba(255, 255, 255, 0.03)' },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxActive: { backgroundColor: COLORS.emerald, borderColor: COLORS.emerald },
  itemQty: { fontSize: 13, fontWeight: '900', color: COLORS.emerald, width: 28 },
  itemText: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, flex: 1 },
  itemTextStrikethrough: { textDecorationLine: 'line-through', color: COLORS.textDisabled },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  totalLabel: { fontSize: 8, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 1 },
  price: { fontSize: 18, fontWeight: '900', color: COLORS.gold, marginTop: 1 },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  receiptBtnText: { fontSize: 10, fontWeight: '800', color: COLORS.textSecondary },
  actions: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    flex: 1,
    backgroundColor: COLORS.amber,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyBtn: {
    flex: 1,
    backgroundColor: COLORS.emerald,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 13, fontWeight: '900', color: '#09090B', letterSpacing: 0.8 },
  readyBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingVertical: 12,
    borderRadius: 12,
  },
  readyBannerText: { fontSize: 11, fontWeight: '900', color: COLORS.emerald, letterSpacing: 0.8 },

  // Center States
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { fontSize: 13, color: COLORS.textSecondary, marginTop: 12, fontWeight: '600' },
  emptyTitle: { fontSize: 14, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: 1 },
  emptySub: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 18 },

  // Modal Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#141417',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 14, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: 1 },
  modalSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMenuText: { color: COLORS.textSecondary, textAlign: 'center', marginVertical: 24 },
  menuItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  menuItemName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  menuItemPrice: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },

  // Receipt Modal
  receiptSheet: {
    backgroundColor: '#18181B',
    borderRadius: 20,
    margin: 24,
    padding: 20,
    alignSelf: 'center',
    width: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  receiptHeader: { alignItems: 'center' },
  receiptTitle: { fontSize: 12, fontWeight: '900', color: COLORS.gold, letterSpacing: 2 },
  receiptOrderNum: { fontSize: 24, fontWeight: '900', color: COLORS.textPrimary, marginTop: 4 },
  receiptDivider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)', marginVertical: 12 },
  receiptMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  receiptMetaKey: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  receiptMetaVal: { fontSize: 11, fontWeight: '800', color: COLORS.textPrimary },
  receiptSectionTitle: { fontSize: 10, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 1 },
  receiptItemLine: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  receiptItemQty: { width: 28, fontSize: 12, fontWeight: '900', color: COLORS.emerald },
  receiptItemName: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },
  receiptItemPrice: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  receiptTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  receiptTotalLabel: { fontSize: 12, fontWeight: '900', color: COLORS.textPrimary },
  receiptTotalVal: { fontSize: 20, fontWeight: '900', color: COLORS.gold },
  receiptCloseBtn: {
    marginTop: 16,
    backgroundColor: COLORS.emerald,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  receiptCloseBtnText: { fontSize: 12, fontWeight: '900', color: '#09090B', letterSpacing: 1 },
});
