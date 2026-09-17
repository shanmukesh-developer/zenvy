import React, { useState, useEffect, memo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Switch, LayoutAnimation, Platform, UIManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSocket } from '../services/socket';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://hostelbites-backend-jwmt.onrender.com';

const OrderCard = memo(({ item, onUpdateStatus }: { item: any, onUpdateStatus: (id: string, status: string) => void }) => {
  const isPending = item.status === 'Pending';
  const isAccepted = item.status === 'Accepted';
  const orderIdRaw = item._id || item.id || '';
  const orderId = String(orderIdRaw).slice(-6).toUpperCase();

  const handleUpdate = (status: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUpdateStatus(orderIdRaw, status);
  };
  
  const statusColor = isPending ? COLORS.amber : isAccepted ? COLORS.blue : COLORS.emerald;

  return (
    <View style={[styles.orderCard, isPending ? styles.cardPending : isAccepted ? styles.cardAccepted : {}]}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
           <Ionicons name={isPending ? 'time-outline' : isAccepted ? 'flame-outline' : 'checkmark-circle-outline'} size={16} color={statusColor} />
           <Text style={styles.orderId}>#{orderId}</Text>
        </View>
        <Text style={[styles.orderStatus, { color: statusColor }]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.customerName}><Ionicons name="person-outline" size={12} /> {item.userId?.name || item.customer || 'Student'}</Text>
      <View style={styles.divider} />
      <ScrollView style={styles.itemsList} nestedScrollEnabled={true}>
        {item.items?.map((i: any, idx: number) => (
          <View key={idx} style={styles.itemRow}>
            <Text style={styles.itemQty}>{i.quantity}x</Text>
            <Text style={styles.itemText}>{i.menuItem?.name || i.name || 'Item'}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.divider} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={styles.totalLabel}>TOTAL</Text>
        <Text style={styles.price}>₹{item.totalPrice || item.finalPrice || 0}</Text>
      </View>

      <View style={styles.actions}>
        {isPending && (
          <TouchableOpacity style={styles.acceptBtn} onPress={() => handleUpdate('Accepted')} activeOpacity={0.7}>
            <Text style={styles.btnText}>ACCEPT ORDER</Text>
          </TouchableOpacity>
        )}
        {isAccepted && (
          <TouchableOpacity style={styles.readyBtn} onPress={() => handleUpdate('Ready for Pickup')} activeOpacity={0.7}>
            <Text style={styles.btnText}>MARK READY</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

export default function DashboardScreen() {
  const { socket, isConnected } = useSocket();
  const [orders, setOrders] = useState<any[]>([]);
  const [autoAccept, setAutoAccept] = useState(false);
  const [restaurantData, setRestaurantData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('restaurant_data').then(data => {
      if (data) {
        const parsed = JSON.parse(data);
        setRestaurantData(parsed);
        fetchOrders(parsed._id || parsed.id);
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
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        
        // MOCK INFO INJECTION FOR TESTING (As requested)
        if (data.length === 0) {
           console.log('Injecting mock orders for testing...');
           setOrders([
             { id: 'MOCK-1', status: 'Pending', totalPrice: 450, customer: 'Test User 1', items: [{ quantity: 2, name: 'Chicken Biryani' }] },
             { id: 'MOCK-2', status: 'Accepted', totalPrice: 150, customer: 'Test User 2', items: [{ quantity: 1, name: 'Paneer Butter Masala' }] }
           ]);
        } else {
           setOrders(data);
        }
      }
    } catch (e) {
      console.log('Error fetching orders:', e);
      // Fallback mock info
      setOrders([
         { id: 'MOCK-1', status: 'Pending', totalPrice: 450, customer: 'Mock Test 1', items: [{ quantity: 2, name: 'Chicken Biryani' }] }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const effectiveRestId = restaurantData.id || restaurantData._id;
    if (!socket || !effectiveRestId) return;

    socket.emit('joinRestaurant', effectiveRestId);

    const handleNewOrder = (order: any) => {
      if (autoAccept) {
        socket.emit('updateOrderStatus', { orderId: order._id || order.id, status: 'Accepted' });
      }
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setOrders(prev => {
        if (prev.some(o => (o._id || o.id) === (order._id || order.id))) return prev;
        return [order, ...prev];
      });
      if (!autoAccept) {
         Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    };

    socket.on('restaurant_newOrder', handleNewOrder);
    socket.on('statusUpdated', (data: any) => {
       LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
       setOrders(prev => prev.map(o => (o._id || o.id) === data.id ? { ...o, status: data.status } : o));
    });

    return () => {
      socket.off('restaurant_newOrder', handleNewOrder);
      socket.off('statusUpdated');
    };
  }, [socket, restaurantData, autoAccept]);

  const updateStatus = async (orderId: string, status: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOrders(prev => prev.map(o => (o._id || o.id) === orderId ? { ...o, status } : o));
    try {
      if (socket) {
        socket.emit('updateOrderStatus', { orderId, status });
      }
      const token = await AsyncStorage.getItem('restaurant_token');
      await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleAutoAccept = (val: boolean) => {
     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
     setAutoAccept(val);
  };

  const activeOrders = orders.filter(o => o.status === 'Pending' || o.status === 'Accepted');

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>KDS <Text style={{ color: COLORS.emerald }}>LIVE</Text></Text>
          <Text style={styles.subtitle} numberOfLines={1}>{restaurantData.name || 'Zenvy Elite Kitchen'}</Text>
        </View>
        <View style={styles.controls}>
          <View style={styles.networkBadge}>
             <View style={[styles.networkDot, { backgroundColor: isConnected ? COLORS.emerald : COLORS.coral }]} />
             <Text style={styles.networkText}>{isConnected ? 'SYNCED' : 'OFFLINE'}</Text>
          </View>
          <View style={styles.autoAcceptWrapper}>
            <Text style={styles.autoAcceptLabel}>AUTO-ACCEPT</Text>
            <Switch 
              value={autoAccept} 
              onValueChange={handleToggleAutoAccept}
              trackColor={{ false: COLORS.textDisabled, true: COLORS.emeraldMuted }}
              thumbColor={autoAccept ? COLORS.emerald : COLORS.textPrimary}
            />
          </View>
        </View>
      </View>

      {loading ? (
         <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Syncing Orders...</Text>
         </View>
      ) : activeOrders.length === 0 ? (
         <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={64} color={COLORS.borderActive} />
            <Text style={styles.emptyTitle}>Kitchen is Clear</Text>
            <Text style={styles.emptyText}>Waiting for new incoming orders.</Text>
         </View>
      ) : (
         <FlatList
           data={activeOrders}
           keyExtractor={item => String(item._id || item.id)}
           renderItem={({item}) => <OrderCard item={item} onUpdateStatus={updateStatus} />}
           contentContainerStyle={styles.grid}
           showsVerticalScrollIndicator={false}
         />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20, paddingTop: 60, backgroundColor: COLORS.bgCard, borderBottomWidth: 1, borderBottomColor: COLORS.borderStandard },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: 1 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '800', marginTop: 2, textTransform: 'uppercase', letterSpacing: 2 },
  controls: { alignItems: 'flex-end', gap: 12 },
  networkBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.borderSubtle, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  networkDot: { width: 6, height: 6, borderRadius: 3 },
  networkText: { color: COLORS.textSecondary, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  autoAcceptWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.borderSubtle, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderStandard },
  autoAcceptLabel: { color: COLORS.textPrimary, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  grid: { padding: 16, gap: 16 },
  orderCard: { backgroundColor: COLORS.bgCard, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.borderStandard, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 5 },
  cardPending: { borderColor: COLORS.amber, backgroundColor: COLORS.bgCardElevated },
  cardAccepted: { borderColor: COLORS.blue, backgroundColor: COLORS.bgCardElevated },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' },
  orderId: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  orderStatus: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  customerName: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  divider: { height: 1, backgroundColor: COLORS.borderStandard, marginVertical: 12 },
  itemsList: { maxHeight: 120 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 12 },
  itemQty: { color: COLORS.emerald, fontSize: 14, fontWeight: '900' },
  itemText: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600', flex: 1 },
  totalLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  price: { color: COLORS.emerald, fontSize: 24, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 12 },
  acceptBtn: { flex: 1, backgroundColor: COLORS.amber, paddingVertical: 16, borderRadius: 12, alignItems: 'center', shadowColor: COLORS.amber, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  readyBtn: { flex: 1, backgroundColor: COLORS.blue, paddingVertical: 16, borderRadius: 12, alignItems: 'center', shadowColor: COLORS.blue, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnText: { color: COLORS.bgDark, fontWeight: '900', fontSize: 14, letterSpacing: 2 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', opacity: 0.8 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: COLORS.textPrimary, marginTop: 16, letterSpacing: 1 },
  emptyText: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted, marginTop: 8 }
});
