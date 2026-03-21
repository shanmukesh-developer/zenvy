"use client";
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5001';

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
}

// ─── Campus Radar Component ──────────────────────────────────
function CampusRadar({ activeOrders }: { activeOrders: LiveOrder[] }) {
  return (
    <div className="glass-card h-[450px] relative overflow-hidden group">
      {/* Tactical Grid Overlay */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10" />
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
        <div className="w-[800px] h-[800px] border border-blue-500/50 rounded-full animate-pulse-soft" />
        <div className="absolute w-[600px] h-[600px] border border-blue-500/30 rounded-full" />
        <div className="absolute w-[400px] h-[400px] border border-blue-500/20 rounded-full" />
      </div>

      {/* Styled SRM Campus Map (Simplified Tactical SVG) */}
      <div className="absolute inset-0 flex items-center justify-center p-10">
        <svg viewBox="0 0 800 500" className="w-full h-full text-blue-500/20 fill-none opacity-60">
           {/* Perimeter Scanner Ring */}
           <rect x="50" y="50" width="700" height="400" rx="24" stroke="currentColor" strokeWidth="1" strokeDasharray="8 8" />
           <rect x="40" y="40" width="720" height="420" rx="32" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />

           {/* Tactical Interlink Matrix (Roads/Paths) */}
           <path d="M100 250 H700" stroke="currentColor" strokeWidth="1" strokeDasharray="6 6" />
           <path d="M400 70 V430" stroke="currentColor" strokeWidth="1" strokeDasharray="6 6" />
           <path d="M220 160 L580 340" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.4" />
           <path d="M220 340 L580 160" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.4" />

           {/* Concentric Scanner Rings from Center Node */}
           <circle cx="400" cy="250" r="60" stroke="currentColor" strokeWidth="1.5" className="animate-pulse-soft" />
           <circle cx="400" cy="250" r="100" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
           <circle cx="400" cy="250" r="150" stroke="currentColor" strokeWidth="0.3" opacity="0.1" />
           <circle cx="400" cy="250" r="4" fill="currentColor" />

           {/* Nodes with Indicators */}
           {[
             { x: 180, y: 140, label: "HOSTEL_A" },
             { x: 540, y: 140, label: "HOSTEL_B" },
             { x: 180, y: 300, label: "KITCHEN_MAIN" },
             { x: 540, y: 300, label: "GATE_SECURE" }
           ].map((node, i) => (
             <g key={i} transform={`translate(${node.x}, ${node.y})`}>
               <rect width="80" height="60" rx="12" stroke="currentColor" strokeWidth="1.2" fill="rgba(30, 41, 59, 0.4)" />
               <rect x="4" y="4" width="72" height="52" rx="8" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
               <text x="40" y="35" textAnchor="middle" fontSize="9" fontWeight="bold" fill="currentColor" opacity="0.6" className="tracking-widest">{node.label}</text>
               {/* Tiny indicator light */}
               <circle cx="12" cy="12" r="3" fill="currentColor" className="opacity-80" />
             </g>
           ))}

           {/* Corner accent details */}
           <path d="M60 60 H90 M60 60 V90" stroke="currentColor" strokeWidth="2" opacity="0.5" />
           <path d="M740 60 H710 M740 60 V90" stroke="currentColor" strokeWidth="2" opacity="0.5" />
           <path d="M60 440 H90 M60 440 V410" stroke="currentColor" strokeWidth="2" opacity="0.5" />
           <path d="M740 440 H710 M740 440 V410" stroke="currentColor" strokeWidth="2" opacity="0.5" />
        </svg>
      </div>

      {/* Live Order Pulse Nodes */}
      {activeOrders.map((order) => {
        // Deterministic positioning based on order ID for demo
        const x = (parseInt(order.id.slice(-2), 16) % 80) + 10;
        const y = (parseInt(order.id.slice(-4, -2), 16) % 60) + 20;

        return (
          <div 
            key={order.id} 
            className="absolute transition-all duration-1000"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <div className="relative group/node">
              <div className="absolute -inset-4 bg-blue-500/20 rounded-full animate-ping" />
              <div className={`w-3 h-3 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.8)] border-2 border-white/50 ${
                order.status === 'Cancelled' ? 'bg-red-500 shadow-red-500/50' :
                order.status === 'Delivered' ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-blue-500'
              }`} />
              
              {/* Tooltip on Hover */}
              <div className="absolute left-4 top-0 glass px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none border border-white/10 z-50">
                 <p className="text-[9px] font-black text-white">{order.customer}</p>
                 <p className="text-[8px] text-gray-400">{order.location}</p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Statistics Overlay */}
      <div className="absolute bottom-6 left-6 flex gap-4">
        <div className="glass px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
           <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.8)]" />
           <span className="text-[10px] font-black text-white uppercase tracking-wider">{activeOrders.length} LIVE OBJECTS</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminHome() {
  const [stats, setStats] = useState<AdminStat[]>([
    { label: 'Platform Revenue', value: '₹0', growth: '+0%', trend: 'neutral' },
    { label: 'Order Activity', value: '0', growth: '+0%', trend: 'neutral' },
    { label: 'Active Fleet', value: '0', growth: 'Initializing', trend: 'neutral' },
    { label: 'Zenvy Commission', value: '₹0', growth: 'Real-time', trend: 'up' },
  ]);

  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/admin/stats`, {
           headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
            setStats([
              { label: 'Platform Revenue', value: data.revenue, growth: 'Delivered', trend: 'up' },
              { label: 'Active Pipeline', value: data.activeRevenue, growth: `${data.activeOrders} Active`, trend: 'up' },
              { label: 'Active Fleet', value: data.activeFleet, growth: 'Verified', trend: 'neutral' },
              { label: 'Zenvy Commission', value: data.commission, growth: 'Projected', trend: 'up' },
            ]);
        }
      } catch (err) { console.error('[STATS_FETCH_ERROR]', err); }
    };

    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/orders`, {
           headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          const formatted = data.map((o: { _id: { toString: () => string }, userId?: { name: string }, hostelGateDelivery: boolean, status: string, finalPrice?: number, totalPrice: number, items?: { restaurantName: string }[], createdAt: string }) => ({
            id: o._id.toString(),
            customer: o.userId?.name || 'Student',
            location: o.hostelGateDelivery ? 'Hostel Gate' : 'Room Delivery',
            status: o.status,
            price: o.finalPrice || o.totalPrice,
            restaurant: o.items?.[0]?.restaurantName || 'Zenvy Kitchen',
            timestamp: new Date(o.createdAt)
          }));
          setLiveOrders(formatted);
        }
      } catch (_err) {
        console.error('[ADMIN_FETCH_ERROR]', _err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    fetchOrders();

    const socket = io(SOCKET_URL);
    
    socket.on('newOrder', (order: { id: string, drop: string, finalPrice?: number, totalPrice: number }) => {
      fetchStats(); // Refresh stats on new order
      setLiveOrders(prev => [{
        id: order.id,
        customer: 'Nexus Intel',
        location: order.drop,
        status: 'Pending',
        price: order.finalPrice || order.totalPrice,
        restaurant: 'Zenvy Elite',
        timestamp: new Date()
      }, ...prev].slice(0, 20));
    });

    socket.on('statusUpdated', (data: { id: string, status: string }) => {
      fetchStats(); // Refresh stats on status change
      setLiveOrders(prev => prev.map(o => o.id === data.id ? { ...o, status: data.status } : o));
    });

    socket.on('orderCancelled', ({ orderId }: { orderId: string }) => {
      setLiveOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Cancelled' } : o));
    });

    return () => { socket.disconnect(); };
  }, []);

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
        {/* ─── Campus Radar (Tactical View) ─── */}
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black tracking-tighter uppercase text-white">Campus Radar <span className="text-blue-500">Live</span></h3>
            <button className="nexus-badge bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 transition-all flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              Recenter HUD
            </button>
          </div>
          <CampusRadar activeOrders={liveOrders.filter(o => o.status !== 'Delivered')} />
        </div>

        {/* ─── Gourmet Feed (Recent Activity) ─── */}
        <div className="space-y-6">
           <h3 className="text-xl font-black tracking-tighter uppercase text-white">Operational <span className="text-[#C9A84C]">Feed</span></h3>
           <div className="glass-card h-[450px] overflow-y-auto p-6 space-y-4 scrollbar-hide border-white/10">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
                   <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                   <p className="text-[10px] uppercase font-black tracking-widest">Syncing Nodes...</p>
                </div>
              ) : liveOrders.length === 0 ? (
                <p className="text-center py-20 text-gray-600 text-xs italic tracking-wide">No movements detected in the last scan.</p>
              ) : (
                liveOrders.map((order) => (
                  <div key={order.id} className="group p-4 rounded-3xl bg-white/[0.015] border border-white/5 hover:border-white/10 transition-all duration-300">
                    <div className="flex justify-between items-start mb-2">
                       <div>
                          <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-0.5">{order.restaurant}</p>
                          <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{order.customer}</p>
                       </div>
                       <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${
                         order.status === 'Cancelled' ? 'bg-red-500/10 text-red-500' :
                         order.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-500' :
                         'bg-blue-500/10 text-blue-500'
                       }`}>
                         {order.status}
                       </span>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.03]">
                       <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">{order.location}</span>
                       <span className="text-xs text-white font-black tracking-tighter">₹{order.price.toFixed(0)}</span>
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
    </div>
  );
}

