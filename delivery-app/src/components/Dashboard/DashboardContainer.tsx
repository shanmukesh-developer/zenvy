"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import RiderNavbar from './RiderNavbar';
import ActiveOrderCard from './ActiveOrderCard';
import OrdersList from './OrdersList';
import OfflineScreen from './OfflineScreen';
import LiveStatsBar from './LiveStatsBar';
import WeatherSignal from './WeatherSignal';
import SOSPanel from './SOSPanel';
import LiveLeaderboard from './LiveLeaderboard';
import RiderProfilePage from './RiderProfilePage';
import ChatDrawer from '@/components/ChatDrawer';



interface Driver {
  _id: string;
  name: string;
  token: string;
  photoUrl?: string;
}

interface Order {
  id: string;
  restaurant: string;
  restaurantAddress?: string;
  customerName: string;
  customerPhone?: string;
  drop: string;
  items: { name: string; quantity: number; price?: number; image?: string }[];
  totalAmount?: number;
  totalPrice?: number;
  finalPrice?: number;
  note?: string;
  createdAt?: string;
  status?: string;
}

interface DashboardContainerProps {
  driver: Driver;
  onLogout: () => void;
  apiUrl: string;
}

export default function DashboardContainer({ driver, onLogout, apiUrl }: DashboardContainerProps) {
  const [isOnline, setIsOnline] = useState(false);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [orderStatus, setOrderStatus] = useState<Record<string, string>>({});
  const [pinValues, setPinValues] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [currentDriver, setCurrentDriver] = useState(driver);
  const [activeIssue, setActiveIssue] = useState<{ issueType: string; details: string; senderRole: string } | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [orderTimers, setOrderTimers] = useState<Record<string, number>>({});
  const [todayStats, setTodayStats] = useState({ earnings: 0, orders: 0, zenPoints: 0, streak: 0 });
  const [showProfile, setShowProfile] = useState(false);
  const [driverPhoto, setDriverPhoto] = useState<string | undefined>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentCheckpoint, _setCurrentCheckpoint] = useState<string>('Mangalagiri Jn');
  const [showOrdersBrowse, setShowOrdersBrowse] = useState(false); // toggle to browse orders while active task

  const socketRef = useRef<Socket | null>(null);

  const { token: driverToken } = driver;

  // Fetch profile picture on mount
  useEffect(() => {
    const fetchPhoto = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/delivery/profile`, {
          headers: { 'Authorization': `Bearer ${driverToken}` }
        });
        if (res.status === 401) return onLogout();
        if (res.ok) {
          const data = await res.json();
          if (data.photoUrl) {
            setDriverPhoto(data.photoUrl);
            setCurrentDriver(prev => ({ ...prev, photoUrl: data.photoUrl }));
          }
        }
      } catch {}
    };
    fetchPhoto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, driverToken, onLogout]);

  // Restore state — and re-sync online status to backend on page load
  useEffect(() => {
    const syncOnlineStatus = async (status: boolean) => {
      try {
        await fetch(`${apiUrl}/api/delivery/partner/online`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${driverToken}`
          },
          body: JSON.stringify({ isOnline: status })
        });
      } catch (err) {
        console.error('[RT] Status sync failed:', err);
      }
    };

    const saved = localStorage.getItem('isOnline');
    if (saved) {
      try {
        const wasOnline = JSON.parse(saved);
        setIsOnline(wasOnline);
        // Re-sync online state to backend so server knows rider is back
        syncOnlineStatus(wasOnline);
      } catch {}
    }
    const savedStats = localStorage.getItem('todayStats');
    if (savedStats) { try { setTodayStats(JSON.parse(savedStats)); } catch {} }
  }, [apiUrl, driverToken, onLogout]);

  const fetchActiveOrders = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/delivery/orders/active`, {
        headers: { 'Authorization': `Bearer ${driverToken}` }
      });
      if (res.status === 401) return onLogout();
      if (res.ok) {
        const data = await res.json();
        const orders = data.orders || [];
        setActiveOrders(orders.map((o: { _id?: string; id?: string; status?: string }) => ({ ...o, id: String(o._id || o.id) })));
        const statusMap: Record<string, string> = {};
        orders.forEach((o: { _id?: string; id?: string; status?: string }) => { statusMap[String(o._id || o.id)] = o.status || 'Accepted'; });
        setOrderStatus(statusMap);
      }
    } catch (err) { console.error('[RT] Active orders fetch failed:', err); }
  }, [apiUrl, driverToken, onLogout]);

  const fetchPendingOrders = useCallback(async () => {
    if (!isOnline) return;
    try {
      const res = await fetch(`${apiUrl}/api/delivery/orders/pending`, {
        headers: { 'Authorization': `Bearer ${driverToken}` }
      });
      if (res.status === 401) return onLogout();
      if (res.ok) {
        const data = await res.json();
        setAvailableOrders(data.map((o: Record<string, unknown>) => ({ ...o, id: String(o._id || o.id) })));
      }
    } catch (err) { console.error('[RT] Pending fetch failed:', err); }
  }, [apiUrl, driverToken, isOnline, onLogout]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/delivery/orders/history`, {
        headers: { 'Authorization': `Bearer ${driverToken}` }
      });
      if (res.status === 401) return onLogout();
      if (res.ok) {
        const data = await res.json();
        setHistoryOrders(data.map((o: Record<string, unknown>) => ({ ...o, id: String(o._id || o.id) })));
      }
    } catch (err) { console.error('[RT] History fetch failed:', err); }
  }, [apiUrl, driverToken, onLogout]);

  const fetchTodayStats = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/delivery/stats/today`, {
        headers: { 'Authorization': `Bearer ${driverToken}` }
      });
      if (res.status === 401) return onLogout();
      if (res.ok) {
        const data = await res.json();
        setTodayStats(data);
        localStorage.setItem('todayStats', JSON.stringify(data));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, driverToken, onLogout]);

  useEffect(() => {
    fetchActiveOrders();
    fetchPendingOrders();
    fetchHistory();
    fetchTodayStats();
    const pollInterval = setInterval(() => {
      fetchActiveOrders();
      if (isOnline) fetchPendingOrders();
      fetchHistory();
    }, 15000);
    return () => clearInterval(pollInterval);
  }, [fetchActiveOrders, fetchPendingOrders, fetchHistory, fetchTodayStats, isOnline]);

  useEffect(() => {
    const socket = io(apiUrl.replace(/\/$/, ""), {
      auth: { token: driverToken, role: 'rider', driverId: currentDriver._id, name: currentDriver.name },
      transports: ['websocket'],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('rider_connected', { driverId: currentDriver._id, name: currentDriver.name });
      // Re-broadcast online state on every (re)connect so server is always up-to-date
      socket.emit('rider_status_change', {
        riderId: currentDriver._id,
        name: currentDriver.name,
        isOnline
      });
    });

    socket.on('newOrder', (order: Record<string, unknown>) => {
      if (!isOnline) return;
      const id = String(order._id || order.id);
      setAvailableOrders(prev => {
        if (prev.find(o => o.id === id)) return prev;
        return [{
          id,
          restaurant: String(order.restaurant || 'Zenvy'),
          customerName: String(order.customerName || 'Customer'),
          drop: String(order.drop || 'Delivery'),
          items: (order.items as Order['items']) || [],
          totalPrice: Number(order.totalPrice || 0),
          finalPrice: Number(order.finalPrice || 0),
          createdAt: String(order.createdAt || new Date().toISOString()),
          status: 'Pending'
        }, ...prev];
      });
      setOrderTimers(prev => ({ ...prev, [id]: 30 }));
    });

    socket.on('orderCancelled', ({ orderId }: { orderId: string }) => {
      setAvailableOrders(prev => prev.filter(o => o.id !== String(orderId)));
      setActiveOrders(prev => prev.filter(o => o.id !== String(orderId)));
    });

    socket.on('issue_alert', (data: { issueType: string; details: string; senderRole: string }) => {
      setActiveIssue(data);
      setTimeout(() => setActiveIssue(null), 15000);
    });

    return () => {
      socket.emit('rider_disconnected', { driverId: currentDriver._id });
      socket.disconnect();
    };
  }, [apiUrl, driverToken, currentDriver._id, currentDriver.name, isOnline]);

  useEffect(() => {
    if (!socketRef.current) return;
    activeOrders.forEach(order => {
      socketRef.current?.emit('updateLocation', {
        orderId: order.id,
        currentCheckpoint,
        riderId: currentDriver._id,
        riderName: currentDriver.name
      });
    });
    socketRef.current?.emit('rider_location_update', {
      riderId: currentDriver._id,
      riderName: currentDriver.name,
      currentCheckpoint,
      activeOrderCount: activeOrders.length,
      isOnline
    });
  }, [currentCheckpoint, activeOrders, currentDriver._id, currentDriver.name, isOnline]);

  useEffect(() => {
    const interval = setInterval(() => {
      setOrderTimers(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(id => {
          if (next[id] > 0) { next[id] -= 1; changed = true; }
          else { delete next[id]; changed = true; }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleOnline = async () => {
    const newStatus = !isOnline;
    try {
      const res = await fetch(`${apiUrl}/api/delivery/online`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${driverToken}` },
        body: JSON.stringify({ isOnline: newStatus })
      });
      if (res.ok) {
        setIsOnline(newStatus);
        localStorage.setItem('isOnline', JSON.stringify(newStatus));
        socketRef.current?.emit('rider_status_change', {
          riderId: currentDriver._id,
          name: currentDriver.name,
          isOnline: newStatus
        });
        if (newStatus) fetchPendingOrders();
        else setAvailableOrders([]);
      }
    } catch { alert('Network error. Could not update status.'); }
  };

  const acceptOrder = async (orderId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/delivery/accept/${orderId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${driverToken}` }
      });
      if (res.ok) {
        socketRef.current?.emit('joinOrder', orderId);
        socketRef.current?.emit('rider_accepted', {
          orderId,
          riderId: currentDriver._id,
          riderName: currentDriver.name
        });
        setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
        fetchActiveOrders();
        fetchHistory();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to accept order.');
      }
    } catch { alert('Network error during acceptance.'); }
    setActionLoading(false);
  };

  const pickUpOrder = async (orderId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/delivery/status/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${driverToken}` },
        body: JSON.stringify({ status: 'PickedUp' })
      });
      if (res.ok) {
        fetchActiveOrders();
        fetchTodayStats();
        fetchHistory();
        setPinValues(prev => ({ ...prev, [orderId]: '' }));
      }
    } catch { alert('Network error during pick-up.'); }
    setActionLoading(false);
  };

  const deliverOrder = async (orderId: string) => {
    const pin = pinValues[orderId] || '';
    setActionLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/delivery/status/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${driverToken}` },
        body: JSON.stringify({ status: 'Delivered', pin })
      });
      if (res.ok) {
        const orderData = activeOrders.find(o => o.id === orderId);
        const price = orderData?.finalPrice || orderData?.totalPrice || 0;
        const earned = Math.round(price * 0.1);
        setTodayStats(prev => {
          const next = {
            ...prev,
            earnings: prev.earnings + earned,
            orders: prev.orders + 1,
            streak: prev.streak + 1,
            zenPoints: prev.zenPoints + 5
          };
          localStorage.setItem('todayStats', JSON.stringify(next));
          return next;
        });
        setActiveOrders(prev => prev.filter(o => o.id !== orderId));
        setPinValues(prev => { const n = { ...prev }; delete n[orderId]; return n; });
        socketRef.current?.emit('rider_delivered', {
          orderId,
          riderId: currentDriver._id,
          riderName: currentDriver.name,
          earnings: earned
        });
        fetchPendingOrders();
        fetchHistory();
        fetchTodayStats();
      } else {
        const data = await res.json();
        alert(data.message || 'Delivery verification failed.');
      }
    } catch { alert('Network error during delivery.'); }
    setActionLoading(false);
  };

  const reportIssue = (orderId: string, issueType: string) => {
    socketRef.current?.emit('report_issue', {
      orderId,
      senderRole: 'rider',
      issueType,
      riderName: currentDriver.name,
      details: `Captain ${currentDriver.name} reported: ${issueType}`
    });
    alert('Issue reported to Customer & Dispatch');
  };

  if (showProfile) {
    return (
      <RiderProfilePage
        driver={driver}
        apiUrl={apiUrl}
        onClose={() => setShowProfile(false)}
        onUpdate={(data: { name: string; photoUrl?: string }) => {
          setCurrentDriver(prev => ({ ...prev, name: data.name, photoUrl: data.photoUrl }));
          localStorage.setItem('driver', JSON.stringify({ ...driver, name: data.name, photoUrl: data.photoUrl }));
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background font-outfit text-white selection:bg-blue-500/30 relative">
      <main className="max-w-4xl mx-auto p-4 md:p-8 pb-32">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <RiderNavbar
            driverName={currentDriver.name}
            driverPhoto={currentDriver.photoUrl || driverPhoto}
            isOnline={isOnline}
            toggleOnline={toggleOnline}
            onLogout={onLogout}
            onOpenProfile={() => setShowProfile(true)}
            currentEarnings={todayStats.earnings}
          />
        </motion.div>

        {!isOnline ? (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
            <OfflineScreen />
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-8">
            
            {/* Quick Insights Rail */}
            <div className="md:col-span-4 space-y-6">
               <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                  <LiveStatsBar
                    todayEarnings={todayStats.earnings}
                    todayOrders={todayStats.orders}
                    zenPoints={todayStats.zenPoints}
                    streak={todayStats.streak}
                  />
               </motion.div>

               <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                 <WeatherSignal />
               </motion.div>
               
               <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                 <LiveLeaderboard
                    apiUrl={apiUrl}
                    token={driverToken}
                    driverId={driver._id}
                  />
               </motion.div>
            </div>

            {/* Operational Focus Area */}
            <div className="md:col-span-8 space-y-6">
              
              {/* Tab Navigation */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface border border-white/5 rounded-2xl p-1.5 flex gap-1"
              >
                <button 
                  onClick={() => setActiveTab('pending')}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === 'pending' ? 'bg-white text-black' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Incoming
                </button>
                <button 
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === 'history' ? 'bg-white text-black' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Past Tasks
                </button>
              </motion.div>

              <AnimatePresence mode="wait">
                {activeOrders.length > 0 && !showOrdersBrowse ? (
                  <motion.div 
                    key="active-tasks"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    {/* Active Task Header with back button */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Active Task</p>
                        <p className="text-xs font-bold text-white">{activeOrders.length} order{activeOrders.length > 1 ? 's' : ''} in progress</p>
                      </div>
                      <button
                        onClick={() => setShowOrdersBrowse(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                      >
                        ← Browse Orders
                      </button>
                    </div>
                    {activeOrders.map((order) => (
                      <ActiveOrderCard
                        key={order.id}
                        order={order}
                        status={orderStatus[order.id] || order.status || 'Accepted'}
                        actionLoading={actionLoading}
                        pinValue={pinValues[order.id] || ''}
                        onPinChange={(val) => setPinValues(prev => ({ ...prev, [order.id]: val }))}
                        onPickUp={pickUpOrder}
                        onDeliver={deliverOrder}
                        onChatOpen={() => setIsChatOpen(true)}
                        onReportIssue={reportIssue}
                      />
                    ))}
                  </motion.div>
                ) : (
                  <motion.div 
                    key="pending-list"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {/* Back to active task banner */}
                    {activeOrders.length > 0 && showOrdersBrowse && (
                      <button
                        onClick={() => setShowOrdersBrowse(false)}
                        className="w-full mb-4 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-[9px] font-bold uppercase tracking-widest text-emerald-400 hover:bg-emerald-600/30 transition-all"
                      >
                        ↩ Return to Active Task
                      </button>
                    )}
                    <OrdersList
                      orders={activeTab === 'pending' ? availableOrders : historyOrders}
                      orderTimers={orderTimers}
                      activeTab={activeTab}
                      onAccept={acceptOrder}
                      onDecline={(id) => setAvailableOrders(prev => prev.filter(o => o.id !== id))}
                      onRefresh={activeTab === 'pending' ? fetchPendingOrders : fetchHistory}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>
        )}

        {/* Global Support Utilities */}
        <SOSPanel
          riderId={currentDriver._id}
          riderName={currentDriver.name}
          socket={socketRef.current}
        />
      </main>

      {/* Critical Status Overlay */}
      <AnimatePresence>
        {activeIssue && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md"
          >
             <div className="bg-red-500/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl flex items-center gap-5">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl">⚠️</div>
                <div className="flex-1">
                   <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest mb-1">System Alert</p>
                   <p className="text-sm font-bold text-white leading-tight">{activeIssue.issueType}</p>
                </div>
                <button onClick={() => setActiveIssue(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50">×</button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChatDrawer
        orderId={activeOrders[0]?.id || ''}
        userName={driver.name}
        userRole="rider"
        socket={socketRef.current}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
}
