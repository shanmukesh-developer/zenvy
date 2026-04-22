"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/utils/useAdminAuth';
import PaymentVerificationModal from '@/components/PaymentVerificationModal';
import Image from 'next/image';

const LiveFleetMap = dynamic(() => import('@/components/LiveFleetMap'), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || API_URL;

const CHECKPOINTS = [
  { name: 'Mangalagiri Jn', lat: 16.4422, lng: 80.5604 },
  { name: 'Neerukonda', lat: 16.4715, lng: 80.5055 },
  { name: 'SRM Main Gate', lat: 16.4673, lng: 80.5002 },
  { name: 'Academic Block', lat: 16.4635, lng: 80.5065 },
  { name: 'Hostel Sector', lat: 16.4618, lng: 80.5068 }
];

// ─── Types ───────────────────────────────────────────────────
interface AdminStat {
  label: string;
  value: string;
  growth: string;
  trend: 'up' | 'down' | 'neutral';
}

interface LiveOrder {
  id: string;
  customer: string;
  location: string;
  status: string;
  price: number;
  restaurant?: string;
  timestamp: Date;
  paymentMethod: string;
  upiStatus?: string;
  upiUTR?: string;
  upiScreenshot?: string;
  deliveryPartnerName?: string;
  deliveryPartnerPhoto?: string;
}

interface RiderPosition {
  riderId: string;
  riderName: string;
  photoUrl?: string;
  currentCheckpoint?: string;
  activeOrderCount: number;
  isOnline: boolean;
}

interface OperationalEvent {
  id: string;
  type: 'SOS' | 'ISSUE';
  senderRole: string;
  senderName?: string;
  issueType?: string;
  details: string;
  orderId?: string;
  timestamp: Date;
}


export default function AdminHome() {
  const router = useRouter();
  const isAuthed = useAdminAuth();

  const [stats, setStats] = useState<AdminStat[]>([
    { label: 'Platform Revenue', value: '₹0', growth: '+0%', trend: 'neutral' },
    { label: 'Order Activity', value: '0', growth: '+0%', trend: 'neutral' },
    { label: 'Active Fleet', value: '0', growth: 'Initializing', trend: 'neutral' },
    { label: 'Zenvy Commission', value: '₹0', growth: 'Real-time', trend: 'up' },
  ]);

  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  const [riders, setRiders] = useState<Record<string, RiderPosition>>({});
  const [operationalEvents, setOperationalEvents] = useState<OperationalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Megaphone
  const [megaMsg, setMegaMsg] = useState('');
  const [megaType, setMegaType] = useState<'info' | 'warning' | 'promo' | 'emergency'>('info');
  const [broadcasting, setBroadcasting] = useState(false);
  const [selectedUPIOrder, setSelectedUPIOrder] = useState<LiveOrder | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`${API_URL}/api/admin/stats`, {
         headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        console.warn(`[STATS_FETCH_WARN] Status ${res.status}`);
        return;
      }
      const data = await res.json();
      setStats([
        { label: 'Platform Revenue', value: data.revenue || '₹0', growth: 'Delivered', trend: 'up' },
        { label: 'Active Pipeline', value: data.activeRevenue || '₹0', growth: `${data.activeOrders || 0} Active`, trend: 'up' },
        { label: 'Active Fleet', value: data.activeFleet || '0', growth: 'Verified', trend: 'neutral' },
        { label: 'Zenvy Commission', value: data.commission || '₹0', growth: 'Projected', trend: 'up' },
      ]);
    } catch (err) { console.error('[STATS_FETCH_ERROR]', err); }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`${API_URL}/api/orders`, {
         headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        const formatted = data.map((o: Record<string, unknown>) => {
          const userIdObj = o.userId as Record<string, unknown> | undefined;
          const restaurantObj = o.restaurant as Record<string, unknown> | undefined;
          const deliveryPartnerObj = o.deliveryPartner as Record<string, unknown> | undefined;
          return {
            id: String(o._id || o.id),
            customer: userIdObj?.name || 'Student',
            location: (o.hostelGateDelivery as boolean) ? 'Hostel Gate' : 'Room Delivery',
            status: String(o.status),
            price: Number(o.finalPrice || o.totalPrice),
            restaurant: restaurantObj?.name || 'Zenvy Elite',
            timestamp: new Date(String(o.createdAt)),
            paymentMethod: String(o.paymentMethod),
            upiStatus: String(o.upiStatus),
            upiUTR: String(o.upiUTR),
            upiScreenshot: String(o.upiScreenshot),
            deliveryPartnerName: deliveryPartnerObj?.name,
            deliveryPartnerPhoto: deliveryPartnerObj?.photoUrl
          };
        });
        setLiveOrders(formatted);
      }
    } catch (_err) {
      console.error('[ADMIN_FETCH_ERROR]', _err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleVerifyUPI = async (orderId: string, isVerified: boolean) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`${API_URL}/api/orders/${orderId}/verify-payment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isVerified })
      });
      if (res.ok) {
        fetchOrders();
        fetchStats();
      }
    } catch (err) { console.error('Verification failed', err); }
  };

  useEffect(() => {
    fetchStats();
    fetchOrders();

    const socket = io(SOCKET_URL.replace(/\/$/, ""), {
      transports: ['websocket'],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;
    socket.emit('joinAdmin');
    
    socket.on('admin_newOrder', (order: { id: string, drop: string, finalPrice?: number, totalPrice: number, restaurant?: string, customer?: string, paymentMethod?: string }) => {
      fetchStats();
      setLiveOrders(prev => [{
        id: order.id,
        customer: order.customer || 'Student',
        location: order.drop || 'Unknown',
        status: 'Pending',
        price: order.finalPrice || order.totalPrice,
        restaurant: order.restaurant || 'Zenvy Elite',
        timestamp: new Date(),
        paymentMethod: order.paymentMethod || 'COD',
        upiStatus: 'Verified'
      }, ...prev].slice(0, 20));
    });

    socket.on('statusUpdated', (data: { id: string, status: string }) => {
      fetchStats();
      setLiveOrders(prev => prev.map(o => o.id === data.id ? { ...o, status: data.status } : o));
    });

    socket.on('orderCancelled', ({ orderId }: { orderId: string }) => {
      setLiveOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Cancelled' } : o));
    });

    socket.on('admin_rider_location', (data: RiderPosition) => {
      setRiders(prev => ({
        ...prev,
        [data.riderId]: {
          ...data,
          timestamp: new Date()
        }
      }));
    });

    socket.on('admin_rider_online', (data: { riderId: string, name: string }) => {
      setRiders(prev => ({
        ...prev,
        [data.riderId]: {
          ...(prev[data.riderId] || {}),
          riderId: data.riderId,
          riderName: data.name,
          isOnline: true,
          activeOrderCount: 0
        }
      }));
    });

    socket.on('admin_rider_offline', (data: { riderId: string }) => {
      setRiders(prev => {
        const next = { ...prev };
        if (next[data.riderId]) next[data.riderId].isOnline = false;
        return next;
      });
    });

    socket.on('rider_profile_updated', (data: Record<string, unknown>) => {
      setRiders(prev => {
        const riderId = String(data.riderId);
        if (prev[riderId]) {
          return {
            ...prev,
            [riderId]: {
              ...prev[riderId],
              riderName: String(data.name),
              photoUrl: String(data.photoUrl)
            }
          };
        }
        return prev;
      });
    });

    socket.on('sos_received', (data: Record<string, unknown>) => {
      setOperationalEvents(prev => [{
        id: `sos-${Date.now()}`,
        type: 'SOS' as const,
        senderRole: 'Rider',
        senderName: String(data.riderName),
        details: 'CRITICAL EMERGENCY: SOS Triggered',
        timestamp: new Date()
      }, ...prev].slice(0, 10));
    });

    socket.on('admin_issue_reported', (data: Record<string, unknown>) => {
      setOperationalEvents(prev => [{
        id: `issue-${Date.now()}`,
        type: 'ISSUE' as const,
        senderRole: String(data.senderRole) as 'Customer' | 'Rider',
        issueType: String(data.issueType),
        details: String(data.details),
        orderId: String(data.orderId),
        timestamp: new Date()
      }, ...prev].slice(0, 10));
    });

    return () => { socket.disconnect(); };
  }, [fetchStats, fetchOrders, router]);

  if (!isAuthed) {
    return <div className="p-20 text-center font-black text-white uppercase tracking-widest animate-pulse">Authenticating Command Terminal...</div>;
  }

  return (
    <div className="space-y-12 animate-fade-in relative pb-20">
      {/* ─── Hero Metrics ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="glass-card p-8 group overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/[0.03] blur-[40px] group-hover:bg-blue-600/[0.08] transition-all" />
            <p className="stat-label tracking-[0.2em]">{stat.label}</p>
            <div className="flex items-end justify-between">
              <h4 className="text-3xl font-black text-white">{stat.value}</h4>
              <span className={`text-[10px] font-black px-2 py-1 rounded-md border ${
                stat.trend === 'up' ? 'text-emerald-400 bg-emerald-400/5 border-emerald-400/20' :
                stat.trend === 'down' ? 'text-blue-400 bg-blue-400/5 border-blue-400/20' :
                'text-gray-500 bg-white/5 border-white/10'
              }`}>
                {stat.growth}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 items-start">
        {/* ─── Hybrid Campus Radar (Nodes on Map) ─── */}
        <div className="col-span-1 lg:col-span-2">
          <div className="glass-card p-2 border-white/5 relative overflow-hidden bg-slate-900/50 h-[550px]">
            <LiveFleetMap riders={riders} checkpoints={CHECKPOINTS} />
            
            {/* Status Intelligence Floor Overlay */}
            <div className="absolute bottom-6 left-6 right-6 z-[1000] px-6 py-4 glass-card border-white/10 bg-slate-900/80 backdrop-blur-md">
               <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                     <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Base Hub</p>
                     <p className="text-[10px] text-white font-black uppercase mt-1">Mangalagiri</p>
                  </div>
                  <div className="text-center">
                     <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Transit Logic</p>
                     <p className="text-[10px] text-blue-400 font-black uppercase mt-1">Neerukonda Node</p>
                  </div>
                  <div className="text-center">
                     <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Nexus Goal</p>
                     <p className="text-[10px] text-emerald-400 font-black uppercase mt-1">SRM Campus</p>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* ─── Gourmet Feed (Recent Activity) ─── */}
        <div className="space-y-6">
           <h3 className="text-xl font-black tracking-tighter uppercase text-white">Tactical <span className="text-[#C9A84C]">Ops Stream</span></h3>
           <div className="glass-card h-[450px] overflow-y-auto p-6 space-y-4 scrollbar-hide border-white/10">
              
              {/* Critical Alerts Priority */}
              {operationalEvents.map(event => (
                <div key={event.id} className={`p-4 rounded-3xl animate-pulse flex items-center gap-4 ${event.type === 'SOS' ? 'bg-red-600/20 border border-red-600' : 'bg-amber-600/20 border border-amber-600'}`}>
                  <div className="text-2xl">{event.type === 'SOS' ? '🚨' : '⚠️'}</div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase text-white tracking-widest">{event.type} Alert: {event.senderRole}</p>
                    <p className="text-xs font-black text-white">{event.issueType || event.details}</p>
                    {event.orderId && <p className="text-[8px] text-white/50 uppercase mt-1">Order ID: #{event.orderId.slice(-6)}</p>}
                  </div>
                  <span className="text-[8px] font-black text-white opacity-40">
                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}

              <div className="h-px bg-white/5 my-4" />

              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
                   <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                   <p className="text-[10px] uppercase font-black tracking-widest">Syncing Nodes...</p>
                </div>
              ) : liveOrders.length === 0 ? (
                <p className="text-center py-20 text-gray-600 text-xs italic tracking-wide">No movements detected in the last scan.</p>
              ) : (
                liveOrders.map((order) => (
                  <div 
                    key={order.id} 
                    onClick={() => {
                      if (order.paymentMethod === 'UPI' && order.upiStatus === 'Pending') {
                        setSelectedUPIOrder(order);
                      }
                    }}
                    className={`group p-4 rounded-3xl bg-white/[0.015] border border-white/5 hover:border-white/10 transition-all duration-300 ${order.paymentMethod === 'UPI' && order.upiStatus === 'Pending' ? 'cursor-pointer hover:bg-amber-500/5' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                       <div>
                          <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-0.5">{order.restaurant}</p>
                          <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{order.customer}</p>
                       </div>
                        <div className="flex gap-2">
                           {order.paymentMethod === 'UPI' && order.upiStatus === 'Pending' && (
                             <span className="text-[7px] font-black px-1.5 py-0.5 bg-amber-500 text-black rounded animate-pulse">UPI_PENDING</span>
                           )}
                           <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${
                             order.status === 'Cancelled' ? 'bg-red-500/10 text-red-500' :
                             order.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-500' :
                             'bg-blue-500/10 text-blue-500'
                           }`}>
                             {order.status}
                           </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.03]">
                       <div className="flex items-center gap-2">
                         {order.deliveryPartnerName ? (
                           <>
                             <div className="w-5 h-5 rounded-full overflow-hidden border border-white/10 bg-slate-800 flex items-center justify-center">
                                {order.deliveryPartnerPhoto ? (
                                  <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <Image src={order.deliveryPartnerPhoto} alt={order.deliveryPartnerName || 'Driver'} width={20} height={20} className="w-full h-full object-cover" />
                                  </>
                                ) : (
                                 <span className="text-[10px]">🛵</span>
                               )}
                             </div>
                             <span className="text-[9px] font-black text-gray-300 uppercase truncate max-w-[80px]">
                               {order.deliveryPartnerName}
                             </span>
                           </>
                         ) : (
                           <span className="text-[9px] text-gray-600 font-bold uppercase">Unassigned</span>
                         )}
                       </div>
                       <div className="text-right">
                         <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide block">{order.location}</span>
                         <span className="text-xs text-white font-black tracking-tighter">₹{order.price.toFixed(0)}</span>
                       </div>
                    </div>
                  </div>
                ))
              )}
           </div>
        </div>
      </div>

      {/* ─── Global Search & Batch Controls ─── */}
      <div className="glass-card p-10 flex flex-col md:flex-row items-center gap-10">
         <div className="flex-1 space-y-2">
            <h3 className="text-2xl font-black text-white tracking-tight">Tactically Informed Management</h3>
            <p className="text-sm text-gray-500 max-w-lg leading-relaxed">The Nexus Terminal provides absolute transparency over all campus movement. Every byte of data is verified through our SRM-Alpha nodes.</p>
         </div>
         <div className="flex gap-4">
            <button className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:bg-white/10 hover:text-white transition-all">
               Generate Intel PDF
            </button>
            <button className="px-8 py-4 bg-[#C9A84C] shadow-[0_0_30px_rgba(201,168,76,0.3)] rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-black hover:scale-105 transition-all">
               Override Global Batch
            </button>
         </div>
      </div>

      {/* ─── Tactical Megaphone Broadcast ─── */}
      <div className="glass-card p-8 border border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">📢</span>
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-widest">Tactical Broadcast</h3>
            <p className="text-[11px] text-gray-500">Push live alerts to all 3 portals instantly via WebSockets</p>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {(['info', 'warning', 'promo', 'emergency'] as const).map(t => (
              <button
                key={t}
                onClick={() => setMegaType(t)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                  megaType === t
                    ? t === 'emergency' ? 'bg-red-600 border-red-400 text-white' :
                      t === 'warning'   ? 'bg-amber-500 border-amber-400 text-black' :
                      t === 'promo'     ? 'bg-emerald-600 border-emerald-400 text-white' :
                                          'bg-blue-600 border-blue-400 text-white'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                }`}
              >
                { t === 'emergency' ? '🚨' : t === 'warning' ? '⚠️' : t === 'promo' ? '🎉' : '📢' } {t}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            value={megaMsg}
            onChange={e => setMegaMsg(e.target.value)}
            placeholder="Type your message (e.g. '🌧️ Rain alert! Deliveries delayed by 15 mins due to weather.')"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/40 resize-none transition-all"
          />
          <button
            disabled={!megaMsg.trim() || broadcasting}
            onClick={() => {
              if (!socketRef.current || !megaMsg.trim()) return;
              setBroadcasting(true);
              socketRef.current.emit('admin_announcement', { message: megaMsg.trim(), type: megaType });
              setTimeout(() => { setMegaMsg(''); setBroadcasting(false); }, 1500);
            }}
            className="self-end px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest bg-[#C9A84C] text-black hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {broadcasting ? '✓ Dispatched!' : 'Broadcast Now'}
          </button>
        </div>
      </div>

      <PaymentVerificationModal 
        isOpen={!!selectedUPIOrder}
        order={selectedUPIOrder}
        onClose={() => setSelectedUPIOrder(null)}
        onVerify={handleVerifyUPI}
      />
    </div>
  );
}
