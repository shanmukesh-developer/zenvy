"use client";
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAdminAuth } from '@/utils/useAdminAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5005';

interface OrderItem {
  name: string;
  quantity: number;
  price?: number;
}

interface Order {
  _id: string;
  id: string; // From string Conversion
  userId?: { name: string; phone: string };
  restaurantId?: string; // or popluated?
  items: OrderItem[];
  totalPrice: number;
  finalPrice?: number;
  status: string;
  hostelGateDelivery: boolean;
  deliverySlot?: string;
  createdAt: string;
}

export default function OrdersPage() {
  const isAuthed = useAdminAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      setActionLoading(orderId + status);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (res.ok) await fetchOrders();
    } catch (err) {
      console.error('[ORDER_UPDATE_ERROR]', err);
    } finally {
      setActionLoading(null);
    }
  };

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
         setOrders(data);
      }
    } catch (err) {
      console.error('[ORDERS_FETCH_ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    const socket = io(SOCKET_URL, {
      transports: ['websocket']
    });
    
    socket.on('newOrder', () => { fetchOrders(); });
    socket.on('statusUpdated', () => { fetchOrders(); });
    socket.on('orderCancelled', () => { fetchOrders(); });

    return () => { socket.disconnect(); };
  }, []);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Accepted': return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'PickedUp': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'Delivered': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Cancelled': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in relative pb-20">
      <div className="flex items-center justify-between">
         <h1 className="text-3xl font-black tracking-tighter text-white uppercase">Live Orders <span className="text-blue-500">Trace</span></h1>
         <button onClick={fetchOrders} className="nexus-badge bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 transition-all flex items-center gap-2">
            🔄 Refresh
         </button>
      </div>

      <div className="glass-card overflow-hidden border-white/10">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                     <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Order ID</th>
                     <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Customer</th>
                     <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Items</th>
                     <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Total</th>
                     <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Drop Location</th>
                     <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Status</th>
                     <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Timestamp</th>
                     <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Actions</th>
                   </tr>
               </thead>
               <tbody className="divide-y divide-white/[0.03]">
                  {loading ? (
                     <tr>
                        <td colSpan={8} className="p-10 text-center">
                           <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
                              <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                              <p className="text-[10px] uppercase font-black tracking-widest">Syncing Nodes...</p>
                           </div>
                        </td>
                     </tr>
                  ) : orders.length === 0 ? (
                     <tr>
                        <td colSpan={8} className="p-10 text-center text-gray-500 text-xs italic">
                           No orders found in the system.
                        </td>
                     </tr>
                  ) : (
                     orders.map((order) => (
                        <tr key={order._id} className="hover:bg-white/[0.01] transition-colors">
                           <td className="p-4">
                              <span className="font-mono text-[10px] text-gray-400">#{order._id.slice(-6).toUpperCase()}</span>
                           </td>
                           <td className="p-4">
                              <p className="text-xs font-bold text-white">{order.userId?.name || 'Student'}</p>
                              <p className="text-[9px] text-gray-500">{order.userId?.phone || 'N/A'}</p>
                           </td>
                           <td className="p-4">
                              <p className="text-xs text-white max-w-[200px] truncate">
                                 {order.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}
                              </p>
                           </td>
                           <td className="p-4">
                              <span className="text-xs font-black text-white">₹{order.finalPrice || order.totalPrice}</span>
                           </td>
                           <td className="p-4">
                              <span className="text-[10px] font-bold text-gray-300">
                                 {order.hostelGateDelivery ? 'Hostel Gate' : 'Room Delivery'}
                              </span>
                              {order.deliverySlot && <p className="text-[8px] text-blue-400">{order.deliverySlot}</p>}
                           </td>
                           <td className="p-4">
                              <span className={`text-[9px] font-black px-2 py-1 rounded-md border uppercase tracking-wider ${getStatusStyle(order.status)}`}>
                                 {order.status}
                              </span>
                           </td>
                            <td className="p-4">
                               <span className="text-[10px] text-gray-500">
                                  {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                               </span>
                            </td>
                            <td className="p-4">
                               <div className="flex gap-2">
                                 {order.status === 'Pending' && (
                                   <button
                                     onClick={async () => {
                                       try {
                                         setActionLoading(order._id + 'Accept');
                                         const token = localStorage.getItem('token');
                                         const res = await fetch(`${API_URL}/api/orders/${order._id}/restaurant-accept`, {
                                           method: 'PUT',
                                           headers: { 'Authorization': `Bearer ${token}` }
                                         });
                                         if (res.ok) await fetchOrders();
                                       } catch { } finally { setActionLoading(null); }
                                     }}
                                     disabled={actionLoading === order._id + 'Accept'}
                                     className="px-3 py-1.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-sky-500/20 transition-all disabled:opacity-40"
                                   >
                                     {actionLoading === order._id + 'Accept' ? '...' : '▶ Dispatch'}
                                   </button>
                                 )}
                                 {order.status !== 'Delivered' && order.status !== 'Cancelled' && order.status !== 'Pending' && (
                                   <button
                                     onClick={() => updateOrderStatus(order._id, 'Delivered')}
                                     disabled={actionLoading === order._id + 'Delivered'}
                                     className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all disabled:opacity-40"
                                   >
                                     {actionLoading === order._id + 'Delivered' ? '...' : '✓ Deliver'}
                                   </button>
                                 )}
                                 {order.status !== 'Cancelled' && order.status !== 'Delivered' && (
                                   <button
                                     onClick={() => updateOrderStatus(order._id, 'Cancelled')}
                                     disabled={actionLoading === order._id + 'Cancelled'}
                                     className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-40"
                                   >
                                     {actionLoading === order._id + 'Cancelled' ? '...' : '✕ Cancel'}
                                   </button>
                                 )}
                                 {(order.status === 'Delivered' || order.status === 'Cancelled') && (
                                   <span className="text-[9px] text-gray-600 italic">—</span>
                                 )}
                               </div>
                            </td>
                         </tr>
                     ))
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}

