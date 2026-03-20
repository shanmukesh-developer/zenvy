"use client";
import { useState, useEffect, useCallback } from 'react';
import { useTracking } from '@/hooks/useTracking';
import { io, Socket } from 'socket.io-client';
import ChatDrawer from '@/components/ChatDrawer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

// ─── Types ───────────────────────────────────────────────────
interface Order {
  id: string;
  restaurant: string;
  restaurantAddress?: string;
  customerName?: string;
  customerPhone?: string;
  drop: string;
  earnings: string;
  items?: { name: string; quantity: number; priceAtOrder: number }[];
  totalPrice?: number;
  finalPrice?: number;
}

interface Driver {
  _id: string;
  name: string;
  token: string;
  zenPoints?: number;
}

interface HistoryOrder {
  id: string;
  restaurant: string;
  drop: string;
  deliveredAt: string;
  earnings: string;
}

// ─── Login Screen Component ─────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (driver: Driver) => void }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!phone || !password) {
      setError('Please enter phone and password');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/delivery/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Login failed');
        return;
      }

      // Save auth data to localStorage
      localStorage.setItem('driverToken', data.token);
      localStorage.setItem('driver', JSON.stringify({ _id: data._id, name: data.name }));
      onLogin({ _id: data._id, name: data.name, token: data.token });
    } catch (err) {
      console.error('Login error:', err);
      setError('Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 border border-emerald-500/20">
            🛵
          </div>
          <h1 className="text-2xl font-bold">Zenvy Rider</h1>
          <p className="text-sm text-gray-400 mt-1">Sign in to start delivering</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 uppercase font-bold tracking-wider block mb-2">Username / Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter username or phone"
              className="w-full px-4 py-3 glass rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase font-bold tracking-wider block mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-3 glass rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-emerald-500/50 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className={`w-full py-4 rounded-2xl font-bold transition-all text-white ${
            loading
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 neon-border-green'
          }`}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </div>
    </main>
  );
}

// ─── Main Dashboard Component ────────────────────────────────
function Dashboard({ driver, onLogout }: { driver: Driver; onLogout: () => void }) {
  const [isOnline, setIsOnline] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [orderStatus, setOrderStatus] = useState<'idle' | 'accepted' | 'picked_up' | 'delivered'>('idle');
  const [globalSocket, setGlobalSocket] = useState<Socket | null>(null);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [todayStats, setTodayStats] = useState({ orders: 0, earnings: 0 });
  const [intelMessage, setIntelMessage] = useState<string>("Scanning campus trends...");
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [orderHistory, setOrderHistory] = useState<HistoryOrder[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [bottomNav, setBottomNav] = useState<'dashboard' | 'wallet'>('dashboard');
  const [weeklyEarnings, setWeeklyEarnings] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [orderTimers, setOrderTimers] = useState<Record<string, number>>({}); // orderId -> seconds remaining

  // 30-second countdown timer for each pending order
  useEffect(() => {
    if (availableOrders.length === 0) return;
    // Initialize timers for new orders
    setOrderTimers(prev => {
      const next = { ...prev };
      availableOrders.forEach(o => {
        if (next[o.id] === undefined) next[o.id] = 30;
      });
      return next;
    });

    const tick = setInterval(() => {
      setOrderTimers(prev => {
        const next = { ...prev };
        let hasExpired = false;
        Object.keys(next).forEach(id => {
          next[id] = Math.max(0, next[id] - 1);
          if (next[id] === 0) hasExpired = true;
        });
        if (hasExpired) {
          setAvailableOrders(prev => prev.filter(o => next[o.id] > 0));
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [availableOrders]);

  // Mock Intel Radar for Phase 4
  useEffect(() => {
    const messages = [
      "🔥 VEDAVATHI is surging in Block Wars! Position nearby.",
      "💎 HIGH DEMAND: 7:30 PM Batch filling up fast.",
      "⚡ GANGA block just had a massive Pulse!",
      "🛵 Prepare for 5:00 PM Post-Class rush."
    ];
    let idx = 0;
    const interval = setInterval(() => {
      setIntelMessage(messages[idx]);
      idx = (idx + 1) % messages.length;
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Persistence: Load stats on mount
  useEffect(() => {
    const savedStats = localStorage.getItem('todayStats');
    if (savedStats) {
      try { setTodayStats(JSON.parse(savedStats)); } catch (_e) {}
    }
    const savedActiveOrder = localStorage.getItem('activeOrder');
    if (savedActiveOrder) {
      try { setActiveOrder(JSON.parse(savedActiveOrder)); } catch (_e) {}
    }
    const savedStatus = localStorage.getItem('orderStatus');
    if (savedStatus) { setOrderStatus(savedStatus as 'idle' | 'accepted' | 'picked_up' | 'delivered'); }
    const savedWeekly = localStorage.getItem('weeklyEarnings');
    if (savedWeekly) {
      try { setWeeklyEarnings(JSON.parse(savedWeekly)); } catch (_e) {}
    }
  }, []);

  // Persistence: Save stats on change
  useEffect(() => {
    localStorage.setItem('todayStats', JSON.stringify(todayStats));
  }, [todayStats]);

  useEffect(() => {
    if (activeOrder) {
      localStorage.setItem('activeOrder', JSON.stringify(activeOrder));
    } else {
      localStorage.removeItem('activeOrder');
    }
  }, [activeOrder]);

  useEffect(() => {
    localStorage.setItem('orderStatus', orderStatus);
  }, [orderStatus]);

  // Link tracking to the active order using the real driver name
  useTracking(activeOrder?.id || '', driver.name, driver._id, globalSocket);

  // Authenticated fetch helper
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driver.token}`,
        ...(options.headers || {})
      }
    });
  }, [driver.token]);

  useEffect(() => {
    const s = io(SOCKET_URL);
    setGlobalSocket(s);
    return () => { s.disconnect(); };
  }, []);

  useEffect(() => {
    if (globalSocket) {
      globalSocket.on('newOrder', (newOrder: Order) => {
        if (isOnline && !activeOrder) {
          setAvailableOrders(prev => {
            if (prev.some(o => o.id === newOrder.id)) return prev;
            return [newOrder, ...prev];
          });
          // Fire browser push notification
          if (Notification.permission === 'granted') {
            const itemSummary = newOrder.items?.map(i => `${i.name} ×${i.quantity}`).join(', ') || 'New order';
            const n = new Notification('🛵 New Order! Tap to view', {
              body: `${newOrder.restaurant} → ${newOrder.drop}\n${itemSummary}`,
              icon: '/favicon.ico',
              tag: newOrder.id,
              requireInteraction: true,
            });
            n.onclick = () => { window.focus(); n.close(); };
          }
        }
      });

      globalSocket.on('orderCancelled', ({ orderId }) => {
        // 1. Remove from available orders
        setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
        
        // 2. If it was our active order, notify and clear
        if (activeOrder?.id === orderId) {
          setActiveOrder(null);
          setOrderStatus('idle');
          alert('🚨 The customer has cancelled this order.');
        }
      });
    }
    return () => { 
      if (globalSocket) {
        globalSocket.off('newOrder');
        globalSocket.off('orderCancelled');
      }
    };
  }, [globalSocket, isOnline, activeOrder]);

  // Request browser notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);


  // ─── Fetch pending orders when going online ────────────────
  const fetchPendingOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await authFetch(`${API_URL}/api/delivery/orders/pending`);
      const data = await res.json();
      if (res.ok) {
        setAvailableOrders(data);
      } else {
        console.error('Failed to fetch pending orders:', data.message);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, [authFetch]);

  // ─── Fetch order history ─────────────────────────────────────
  const fetchOrderHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await authFetch(`${API_URL}/api/delivery/orders/history`);
      const data = await res.json();
      if (res.ok) {
        setOrderHistory(data);
      } else {
        console.error('Failed to fetch history:', data.message);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [authFetch]);

  // Toggle fetch depending on activeTab
  useEffect(() => {
    if (isOnline && activeTab === 'pending') fetchPendingOrders();
    if (activeTab === 'history') fetchOrderHistory();
  }, [activeTab, isOnline, fetchPendingOrders, fetchOrderHistory]);

  // ─── Toggle online/offline ─────────────────────────────────
  const toggleOnline = async () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);

    try {
      await authFetch(`${API_URL}/api/delivery/online`, {
        method: 'PUT',
        body: JSON.stringify({ isOnline: newStatus })
      });
    } catch (err) {
      console.error('Failed to toggle online status:', err);
    }

    if (newStatus) {
      // Going online — fetch real pending orders
      fetchPendingOrders();
    } else {
      // Going offline — clear available orders
      setAvailableOrders([]);
    }
  };

  // ─── Accept Order via API ──────────────────────────────────
  const acceptOrder = async (order: Order) => {
    setActionLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/delivery/accept/${order.id}`, {
        method: 'PUT'
      });

      if (res.ok) {
        setActiveOrder(order);
        setOrderStatus('accepted');
        // Remove from available list
        setAvailableOrders(prev => prev.filter(o => o.id !== order.id));
        setTodayStats(prev => ({ ...prev, orders: prev.orders + 1 }));
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to accept order');
      }
    } catch (err) {
      console.error('Error accepting order:', err);
      alert('Network error while accepting order');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Pick Up Order via API ─────────────────────────────────
  const pickUpOrder = async () => {
    if (!activeOrder) return;
    setActionLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/delivery/status/${activeOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'PickedUp' })
      });

      if (res.ok) {
        setOrderStatus('picked_up');
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to update status');
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Deliver Order via API ─────────────────────────────────
  const deliverOrder = async () => {
    if (!activeOrder) return;
    setActionLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/delivery/status/${activeOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Delivered' })
      });

      if (res.ok) {
        const earningsAmount = parseInt(activeOrder.earnings.replace(/[^\d]/g, '')) || 0;
        setTodayStats(prev => {
          const updated = { orders: prev.orders + 1, earnings: prev.earnings + earningsAmount };
          localStorage.setItem('todayStats', JSON.stringify(updated));
          return updated;
        });
        // Also update weekly earnings for today (day index 6 = today)
        setWeeklyEarnings(prev => {
          const updated = [...prev];
          updated[6] = (updated[6] || 0) + earningsAmount;
          localStorage.setItem('weeklyEarnings', JSON.stringify(updated));
          return updated;
        });
        setActiveOrder(null);
        setOrderStatus('idle');
        setPhotoUploaded(false);
        fetchPendingOrders();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to deliver order');
      }
    } catch (err) {
      console.error('Error delivering order:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const declineOrder = (orderId: string) => {
    setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
  };

  return (
    <main className="min-h-screen p-6 max-w-lg mx-auto pb-32">
      {/* Header */}
      <div className="flex justify-between items-center mb-10 bg-slate-800/50 p-6 rounded-3xl border border-white/5">
        <div>
          <h1 className="text-xl font-bold">Zenvy Rider</h1>
          <p className="text-sm text-gray-400">{driver.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onLogout}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Logout
          </button>
          <div
            onClick={toggleOnline}
            className={`relative w-16 h-8 rounded-full cursor-pointer transition-colors ${isOnline ? 'bg-emerald-500' : 'bg-slate-700'}`}
          >
            <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${isOnline ? 'translate-x-8' : 'translate-x-0'}`} />
          </div>
        </div>
      </div>

      {!isOnline ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
          <div className="relative w-32 h-32 flex items-center justify-center mb-8">
             <div className="absolute inset-0 border-4 border-slate-700/50 rounded-full border-dashed animate-[spin_10s_linear_infinite]" />
             <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center text-4xl grayscale text-gray-400">
               🛵
             </div>
          </div>
          <h2 className="text-2xl font-black mb-2 tracking-tight text-white/50">SYSTEM OFFLINE</h2>
          <p className="text-gray-500 font-medium">Go online to connect to the Hostel Hub.</p>
        </div>
      ) : activeOrder ? (
        <div className="space-y-6 animate-slide-up">
          {/* GPS Broadcast Indicator */}
          <div className="bg-[#1A1A1C] border border-emerald-500/30 p-4 rounded-3xl flex items-center justify-between shadow-[0_0_30px_rgba(16,185,129,0.1)]">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                   <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping absolute" />
                   <div className="w-3 h-3 bg-emerald-500 rounded-full relative z-10" />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-0.5">GPS Broadcasting</p>
                   <p className="text-xs text-gray-400 font-medium">Customer is tracking you live.</p>
                </div>
             </div>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-[40px] relative overflow-hidden">
             <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none" />
             
            <p className="text-emerald-500 font-black uppercase tracking-[0.2em] text-[10px] mb-3">
              {orderStatus === 'accepted' ? 'Order Accepted' : 'Out for Delivery'}
            </p>
            <h2 className="text-2xl font-bold mb-4">{activeOrder.restaurant}</h2>

            {/* Order items */}
            {activeOrder.items && activeOrder.items.length > 0 && (
              <div className="mb-4 p-3 bg-white/5 rounded-2xl">
                <p className="text-xs text-gray-400 uppercase font-bold mb-2">Items</p>
                {activeOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm py-1">
                    <span>{item.name} × {item.quantity}</span>
                    <span className="text-gray-400">₹{item.priceAtOrder}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-6 mb-8">
               <div className="flex space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${orderStatus === 'accepted' ? 'bg-emerald-500 text-black' : 'bg-emerald-500/30 text-emerald-500'}`}>🏪</div>
                  <div>
                    <p className="font-black text-[10px] uppercase tracking-wider text-emerald-500/80 mb-0.5">Pick up from</p>
                    <p className="font-bold text-white text-sm">{activeOrder.restaurant}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{activeOrder.restaurantAddress}</p>
                  </div>
               </div>
               <div className="flex space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${orderStatus === 'picked_up' ? 'bg-blue-500 text-black' : 'bg-blue-500/30 text-blue-500'}`}>👤</div>
                  <div>
                    <p className="font-black text-[10px] uppercase tracking-wider text-blue-500/80 mb-0.5">Deliver to</p>
                    <p className="font-bold text-white text-sm">{activeOrder.customerName}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{activeOrder.drop}</p>
                  </div>
               </div>
            </div>

            {/* Quick Actions for Delivery */}
             <div className="flex gap-3 mb-6 animate-fade-in">
                <a href={`tel:${activeOrder.customerPhone}`} className="flex-1 glass py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/5 transition-all text-[10px] font-black uppercase tracking-widest border border-emerald-500/30 text-emerald-400">
                   📞 Call
                </a>
                <button 
                   onClick={() => setIsChatOpen(true)}
                   className="flex-1 glass py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/5 transition-all text-[10px] font-black uppercase tracking-widest border border-emerald-500/30 text-emerald-400"
                >
                   💬 Chat
                </button>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeOrder.drop || '')}+SRM+University`} target="_blank" rel="noreferrer" className="flex-1 glass py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/5 transition-all text-[10px] font-black uppercase tracking-widest border border-blue-500/30 text-blue-400">
                   🗺️ Nav
                </a>
             </div>

            {orderStatus === 'picked_up' && !photoUploaded ? (
               <div className="relative animate-slide-up">
                  <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" onChange={(e) => { if(e.target.files?.length) setPhotoUploaded(true); }} />
                  <button className="w-full py-4 rounded-2xl font-bold transition-all bg-slate-800 hover:bg-slate-700 border-2 border-slate-500 border-dashed flex items-center justify-center gap-2">
                     📸 Snap Delivery Photo
                  </button>
                  <p className="text-[10px] text-center mt-2 text-gray-400 tracking-widest uppercase font-bold">Required for Contactless Drop</p>
               </div>
            ) : (
               <div className="space-y-3">
                  {orderStatus === 'picked_up' && photoUploaded && (
                     <p className="text-xs text-emerald-400 text-center font-bold flex items-center justify-center gap-1 animate-fade-in">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        Photo Verified
                     </p>
                  )}
                  <button
                    onClick={orderStatus === 'accepted' ? pickUpOrder : deliverOrder}
                    disabled={actionLoading}
                    className={`w-full py-4 rounded-2xl font-bold transition-all ${
                      actionLoading
                        ? 'bg-gray-600 cursor-not-allowed'
                        : orderStatus === 'accepted'
                          ? 'bg-emerald-600 neon-border-green'
                          : 'bg-blue-600 neon-border-blue'
                    }`}
                  >
                     {actionLoading
                       ? 'Updating...'
                       : orderStatus === 'accepted'
                         ? 'Confirm Pick Up'
                         : 'Confirm Delivery'}
                  </button>
               </div>
            )}
            
          </div>

          <ChatDrawer
            orderId={activeOrder.id}
            userName={driver.name}
            userRole="rider"
            socket={globalSocket}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
          />

          <div className="glass p-6 rounded-3xl flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-400">Earnings</p>
              <p className="text-2xl font-black text-emerald-400">{activeOrder.earnings}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Order ID</p>
              <p className="text-sm font-mono text-gray-300">#{activeOrder.id.slice(-6)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Live Intel Radar */}
          <div className="bg-[#1A1A1C] border border-[#C9A84C]/30 p-4 rounded-3xl flex items-center gap-4 relative overflow-hidden group">
             <div className="w-10 h-10 rounded-full bg-[#C9A84C]/10 flex items-center justify-center shrink-0 relative">
                <svg className="w-5 h-5 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
             </div>
             <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-[#C9A84C] mb-1">Live Intel Radar</p>
                <p className="text-xs font-bold text-white tracking-wide">{intelMessage}</p>
             </div>
             <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#1A1A1C] to-transparent pointer-events-none" />
          </div>

          <div className="flex items-center justify-between mt-8">
            <h3 className="text-lg font-black uppercase tracking-wider">Hostel Hub</h3>
            <div className="flex bg-white/5 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab('pending')}
                className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-all ${activeTab === 'pending' ? 'bg-[#C9A84C] text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                Live Requests
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-all ${activeTab === 'history' ? 'bg-[#C9A84C] text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                24H History
              </button>
            </div>
            {activeTab === 'pending' && (
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500 text-black text-[10px] font-black px-2 py-1 rounded hidden sm:inline-block">LIVE</span>
                <button
                  onClick={fetchPendingOrders}
                  className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 glass rounded-lg"
                >
                  Refresh
                </button>
              </div>
            )}
          </div>

          {/* Surge Pricing Alert */}
          {isOnline && activeTab === 'pending' && availableOrders.length > 0 && (
             <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-2xl mb-6 flex flex-col items-center justify-center text-center animate-pulse">
                <span className="text-[10px] uppercase font-black tracking-widest text-red-500">🔥 Extreme Demand</span>
                <span className="text-red-200 text-sm font-bold mt-1">1.5x Peak Pricing Active in Main Campus</span>
             </div>
          )}

          {activeTab === 'pending' ? (
            loadingOrders ? (
              <div className="text-center py-12">
                <p className="text-gray-400 animate-pulse">Loading orders...</p>
              </div>
            ) : availableOrders.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-[#1A1A1C] rounded-full flex items-center justify-center text-3xl mx-auto mb-6 border border-white/5 shadow-[0_0_30px_rgba(255,255,255,0.02)]">
                  📡
                </div>
                <p className="text-gray-300 font-bold tracking-wide">Scanning for Batches...</p>
                <p className="text-gray-600 text-xs font-medium mt-2 uppercase tracking-widest">Connect to Block Wars Activity</p>
              </div>
            ) : (
              <div className="space-y-4">
                {availableOrders.map((order) => (
                  <div key={order.id} className="bg-[#1A1A1C] border border-white/5 p-5 rounded-3xl hover:border-emerald-500/20 transition-all">

                   {/* Restaurant + Timer */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-gray-500 font-black mb-0.5">Restaurant</p>
                        <h4 className="font-black text-white text-base">{order.restaurant}</h4>
                        <p className="text-[10px] text-gray-400 mt-0.5">{order.restaurantAddress}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-emerald-400 font-black text-lg">{order.earnings}</span>
                        {/* Countdown Timer */}
                        {orderTimers[order.id] !== undefined && (
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black ${
                            orderTimers[order.id] <= 10 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-white/5 text-gray-400'
                          }`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {orderTimers[order.id]}s
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Order Items */}
                    {order.items && order.items.length > 0 && (
                      <div className="bg-white/[0.03] border border-white/5 p-3 rounded-2xl mb-3">
                        <p className="text-[9px] uppercase tracking-widest text-gray-500 font-black mb-2">Order</p>
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                            <span className="text-sm text-white font-medium">{item.name} <span className="text-gray-500">×{item.quantity}</span></span>
                            <span className="text-xs text-gray-400">₹{item.priceAtOrder * item.quantity}</span>
                          </div>
                        ))}
                        <div className="flex justify-between mt-2 pt-1">
                          <span className="text-xs text-gray-500 font-bold uppercase">Total</span>
                          <span className="text-sm font-black text-white">₹{order.totalPrice}</span>
                        </div>
                      </div>
                    )}

                    {/* Customer */}
                    <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-2xl mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-emerald-500 font-black mb-0.5">Deliver to</p>
                        <p className="text-sm font-black text-white">{order.customerName}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{order.drop}</p>
                      </div>
                      <a href={`tel:${order.customerPhone}`} className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center text-lg hover:bg-emerald-500/20 transition-all border border-emerald-500/20">
                        📞
                      </a>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => acceptOrder(order)}
                        disabled={actionLoading}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 transition-all rounded-2xl font-black text-sm disabled:bg-gray-600 disabled:cursor-not-allowed"
                      >
                        {actionLoading ? 'Accepting...' : '✓ Accept Order'}
                      </button>
                      <button
                        onClick={() => declineOrder(order.id)}
                        className="px-5 py-3 glass rounded-2xl text-sm font-bold hover:bg-red-500/10 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

            )
          ) : (
            // History Tab
            loadingHistory ? (
              <div className="text-center py-12">
                <p className="text-gray-400 animate-pulse">Loading history...</p>
              </div>
            ) : orderHistory.length === 0 ? (
              <div className="text-center py-16 border border-[#2A2A2C] rounded-3xl bg-[#1A1A1C]/50">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-2xl mx-auto mb-4 border border-white/5">
                  📁
                </div>
                <p className="text-gray-400 font-bold">No completed orders yet.</p>
                <p className="text-gray-600 text-xs mt-1">Deliveries from the last 24H will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orderHistory.map((order: HistoryOrder) => (
                  <div key={order.id} className="bg-[#1A1A1C] border border-white/5 p-4 rounded-3xl flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity">
                    <div>
                      <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-black mb-1">Delivered</p>
                      <h4 className="font-bold text-sm text-white">{order.restaurant}</h4>
                      <p className="text-xs text-gray-400">{order.drop} • {new Date(order.deliveredAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-bold block">{order.earnings}</span>
                      <span className="text-[10px] font-mono text-gray-500">#{order.id.slice(-6)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Floating SOS Button */}
      {isOnline && (
         <button 
           onClick={() => alert("🚨 SOS TRIGGERED\nAdmin and Campus Security have been immediately notified of your location. Stay safe.")}
           className="fixed bottom-36 right-6 w-14 h-14 bg-red-600 rounded-full flex items-center justify-center text-2xl shadow-[0_0_30px_rgba(220,38,38,0.4)] border-2 border-red-400/50 hover:bg-red-500 hover:scale-105 transition-all z-50 animate-bounce"
         >
           🆘
         </button>
      )}

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-lg mx-auto px-6 pb-4">
          <div className="glass rounded-[32px] p-2 flex items-center shadow-2xl border border-white/10">
            <button
              onClick={() => setBottomNav('dashboard')}
              className={`flex-1 py-3 rounded-[24px] flex flex-col items-center gap-1 transition-all ${bottomNav === 'dashboard' ? 'bg-emerald-600 shadow-md' : 'hover:bg-white/5'}`}
            >
              <span className="text-lg">🛵</span>
              <span className={`text-[9px] font-black uppercase tracking-wide ${bottomNav === 'dashboard' ? 'text-white' : 'text-gray-400'}`}>Dashboard</span>
            </button>
            <div className="px-1 text-center min-w-[90px]">
              <p className="text-[8px] text-gray-500 uppercase font-bold">Today</p>
              <p className="text-sm font-black text-emerald-400">₹{todayStats.earnings}</p>
            </div>
            <button
              onClick={() => setBottomNav('wallet')}
              className={`flex-1 py-3 rounded-[24px] flex flex-col items-center gap-1 transition-all ${bottomNav === 'wallet' ? 'bg-[#C9A84C] shadow-md' : 'hover:bg-white/5'}`}
            >
              <span className="text-lg">💰</span>
              <span className={`text-[9px] font-black uppercase tracking-wide ${bottomNav === 'wallet' ? 'text-black' : 'text-gray-400'}`}>Wallet</span>
            </button>
          </div>
        </div>
      </div>

      {/* Wallet Overlay */}
      {bottomNav === 'wallet' && (
        <div className="fixed inset-0 z-30 bg-[#11111A] overflow-y-auto pb-32 pt-0 animate-fade-in">
          <div className="max-w-lg mx-auto p-6 pt-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#C9A84C] font-black mb-1">Zenvy Wallet</p>
                <h1 className="text-3xl font-black">₹{todayStats.earnings}</h1>
                <p className="text-xs text-gray-400 mt-1">Total earned today</p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center text-3xl">💰</div>
            </div>

            {/* ZenPoints Rewards */}
            <div className="glass-card p-4 rounded-3xl border border-[#C9A84C]/20 flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#C9A84C]/10 flex items-center justify-center text-xl">💎</div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">ZenPoints Rewards</p>
                <p className="text-xl font-black text-white">{driver.zenPoints || 0}</p>
              </div>
            </div>

            {/* Weekly Chart */}
            <div className="glass p-6 rounded-3xl mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-5">This Week</p>
              <div className="flex items-end justify-between gap-2 h-28">
                {['M','T','W','T','F','S','S'].map((day, i) => {
                  const maxVal = Math.max(...weeklyEarnings, 1);
                  const height = weeklyEarnings[i] > 0 ? Math.max((weeklyEarnings[i] / maxVal) * 100, 8) : 4;
                  const isToday = i === 6;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <p className="text-[10px] text-white font-bold">{weeklyEarnings[i] > 0 ? `₹${weeklyEarnings[i]}` : ''}</p>
                      <div className="w-full flex flex-col justify-end h-20">
                        <div
                          className={`w-full rounded-lg transition-all ${isToday ? 'bg-[#C9A84C]' : 'bg-white/10'}`}
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <p className={`text-[9px] font-black uppercase ${isToday ? 'text-[#C9A84C]' : 'text-gray-500'}`}>{day}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="glass p-4 rounded-2xl">
                <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest mb-1">Deliveries</p>
                <p className="text-2xl font-black">{todayStats.orders}</p>
                <p className="text-[9px] text-gray-500 mt-1">Today</p>
              </div>
              <div className="glass p-4 rounded-2xl">
                <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest mb-1">Avg Per Order</p>
                <p className="text-2xl font-black">₹{todayStats.orders > 0 ? Math.round(todayStats.earnings / todayStats.orders) : 0}</p>
                <p className="text-[9px] text-gray-500 mt-1">Earnings</p>
              </div>
            </div>

            {/* Weekly Total */}
            <div className="glass p-5 rounded-3xl mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">This Week Total</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">₹{weeklyEarnings.reduce((a, b) => a + b, 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Orders</p>
                <p className="text-2xl font-black mt-1">{todayStats.orders}</p>
              </div>
            </div>

            {/* Withdraw Button */}
            <button
              onClick={() => alert('🏦 Withdraw feature coming soon!\nYour earnings will be sent to your registered UPI ID within 24 hours.')}
              className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider bg-[#C9A84C] text-black hover:bg-yellow-400 transition-all shadow-lg"
            >
              Withdraw to UPI ₹{todayStats.earnings}
            </button>

            {/* Reset Today (for testing) */}
            <button
              onClick={() => {
                setTodayStats({ orders: 0, earnings: 0 });
                localStorage.removeItem('todayStats');
              }}
              className="w-full mt-3 py-3 rounded-2xl text-xs text-gray-600 hover:text-red-400 transition-colors font-bold uppercase tracking-widest"
            >
              Reset Today&apos;s Stats
            </button>
          </div>
        </div>
      )}
    </main>

  );
}

// ─── Root Component with Auth Routing ────────────────────────
export default function DeliveryHome() {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('driverToken');
    const driverStr = localStorage.getItem('driver');
    if (token && driverStr) {
      try {
        const parsed = JSON.parse(driverStr);
        setDriver({ _id: parsed._id, name: parsed.name, token });
      } catch {
        // Corrupted data — force login
        localStorage.removeItem('driverToken');
        localStorage.removeItem('driver');
      }
    }
    setCheckingAuth(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('driverToken');
    localStorage.removeItem('driver');
    setDriver(null);
  };

  if (checkingAuth) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading...</p>
      </main>
    );
  }

  if (!driver) {
    return <LoginScreen onLogin={setDriver} />;
  }

  return <Dashboard driver={driver} onLogout={handleLogout} />;
}
