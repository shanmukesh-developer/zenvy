'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import api from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, UtensilsCrossed, CheckCircle, Clock } from 'lucide-react';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  totalPrice: number;
  items: OrderItem[];
  status: string;
  createdAt: string;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  isAvailable: boolean;
}

interface Announcement {
  message: string;
  type: 'info' | 'warning' | 'promo' | 'emergency';
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'menu'>('orders');
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('restaurantToken');
    const restaurantId = localStorage.getItem('restaurantId');
    
    if (!token || !restaurantId) {
      router.push('/login');
      return;
    }

    // Fetch initial orders
    api.get(`/restaurants/${restaurantId}/orders`)
      .then(res => setOrders(res.data))
      .catch(err => console.error(err));

    // Fetch menu
    api.get(`/restaurants/${restaurantId}/menu`)
      .then(res => setMenu(res.data))
      .catch(err => console.error(err));

    // Connect socket
    const s = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005');
    
    s.on('connect', () => {
      console.log('Connected to socket');
      s.emit('joinRoom', restaurantId.toString());
    });

    s.on('restaurant_newOrder', () => {
      api.get(`/restaurants/${restaurantId}/orders`).then(res => setOrders(res.data));
    });

    s.on('statusUpdated', () => {
       api.get(`/restaurants/${restaurantId}/orders`).then(res => setOrders(res.data));
    });

    s.on('global_announcement', (data: Announcement) => {
      setAnnouncement(data);
      if (data.type !== 'emergency') {
        setTimeout(() => setAnnouncement(null), 8000);
      }
    });

    return () => {
      s.disconnect();
    };
  }, [router]);

  const handleAccept = async (orderId: string) => {
    try {
      await api.put(`/orders/${orderId}/restaurant-accept`);
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: 'Accepted' } : o));
    } catch (error) {
      console.error(error);
      alert('Failed to accept order');
    }
  };

  const toggleAvailability = async (itemId: string) => {
    try {
      const res = await api.put(`/restaurants/menu/${itemId}/toggle`);
      setMenu(menu.map(item => item.id === itemId ? { ...item, isAvailable: res.data.isAvailable } : item));
    } catch (error) {
      console.error(error);
      alert('Failed to update availability');
    }
  };

  const activeOrders = orders.filter(o => ['Pending', 'Accepted', 'Preparing'].includes(o.status));
  const pastOrders = orders.filter(o => ['Delivered', 'Cancelled', 'PickedUp'].includes(o.status));

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans p-6">
      <header className="flex items-center justify-between border-b border-zinc-800 pb-6 mb-8">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <UtensilsCrossed className="text-orange-500" size={28} />
            <h1 className="text-2xl font-bold tracking-tight">Zenvy Partners</h1>
          </div>

          <AnimatePresence>
            {announcement && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl border shadow-2xl flex items-center gap-3 backdrop-blur-md min-w-[300px] ${
                  announcement.type === 'emergency' ? 'bg-red-500 border-red-400 text-white animate-pulse' :
                  announcement.type === 'warning' ? 'bg-amber-500 border-amber-400 text-black' :
                  announcement.type === 'promo' ? 'bg-emerald-500 border-emerald-400 text-white' :
                  'bg-blue-600 border-blue-400 text-white'
                }`}
              >
                <span className="text-xl">
                  {announcement.type === 'emergency' ? '🚨' : announcement.type === 'warning' ? '⚠️' : announcement.type === 'promo' ? '🎉' : '📢'}
                </span>
                <p className="text-xs font-black uppercase tracking-widest">{announcement.message}</p>
                <button onClick={() => setAnnouncement(null)} className="ml-auto hover:scale-110 px-2 font-black">✕</button>
              </motion.div>
            )}
          </AnimatePresence>
          
          <nav className="flex gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button 
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'orders' ? 'bg-orange-500 text-white shadow-lg' : 'text-zinc-400 hover:text-white'}`}
            >
              Orders
            </button>
            <button 
              onClick={() => setActiveTab('menu')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'menu' ? 'bg-orange-500 text-white shadow-lg' : 'text-zinc-400 hover:text-white'}`}
            >
              Menu
            </button>
          </nav>
        </div>
        
        <button 
          onClick={() => {
            localStorage.clear();
            router.push('/login');
          }}
          className="text-sm text-zinc-500 hover:text-white transition-colors"
        >
          Logout
        </button>
      </header>

      {activeTab === 'orders' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Incoming/Active Orders */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Clock className="text-orange-500" /> Live Feed
            </h2>
            
            <AnimatePresence mode="popLayout">
              {activeOrders.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-zinc-500 italic p-12 rounded-2xl border border-zinc-900 border-dashed text-center bg-zinc-900/20">
                  Waiting for new orders...
                </motion.div>
              ) : (
                activeOrders.map(order => (
                  <motion.div 
                    key={order.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                           <span className="text-xs text-zinc-500 font-mono">#{order.id.slice(0,8)}</span>
                           {order.status === 'Pending' && <span className="animate-pulse w-2 h-2 rounded-full bg-orange-500" />}
                        </div>
                        <h3 className="text-xl font-bold">₹{order.totalPrice}</h3>
                        <p className="text-zinc-500 text-sm">{order.items.length} items • {new Date(order.createdAt).toLocaleTimeString()}</p>
                      </div>
                      
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${order.status === 'Pending' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                        {order.status}
                      </span>
                    </div>

                    <div className="space-y-3 mb-8 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                      {order.items.map((item, i: number) => (
                        <div key={i} className="flex justify-between text-sm items-center">
                          <span className="text-zinc-300 font-medium">
                            <span className="text-orange-500/80 mr-3 tabular-nums">{item.quantity}x</span> 
                            {item.name}
                          </span>
                          <span className="text-zinc-500 tabular-nums">₹{item.price * item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {order.status === 'Pending' && (
                      <button 
                        onClick={() => handleAccept(order.id)}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-orange-500/20"
                      >
                        <CheckCircle size={20} /> Accept & Start Preparing
                      </button>
                    )}
                    {order.status === 'Accepted' && (
                      <div className="w-full bg-zinc-800 text-zinc-400 font-bold py-4 rounded-xl flex items-center justify-center gap-3">
                         <div className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                         Rider Dispatch Pending...
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar / Past Orders */}
          <div>
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-zinc-400">
              <Package size={20} /> Recent History
            </h2>
            <div className="space-y-4">
              {pastOrders.slice(0, 8).map(order => (
                <div key={order.id} className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 hover:bg-zinc-900 transition-colors">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-tighter">ORD-{order.id.slice(0,8)}</span>
                    <span className="text-[10px] text-zinc-600">{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{order.items.length} items</span>
                    <span className={`font-bold ${order.status === 'Cancelled' ? 'text-red-500' : 'text-green-400'}`}>₹{order.totalPrice}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Menu Management View */
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <UtensilsCrossed className="text-orange-500" /> Menu Inventory
            </h2>
            <p className="text-zinc-500 text-sm">Toggle items off if they are out of stock.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {menu.map((item) => (
              <div 
                key={item.id} 
                className={`p-6 rounded-2xl border transition-all flex items-center justify-between ${item.isAvailable ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-950 border-zinc-900 opacity-60'}`}
              >
                <div>
                  <h3 className={`font-bold transition-all ${item.isAvailable ? 'text-white' : 'text-zinc-600 line-through'}`}>{item.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1">₹{item.price} • {item.category}</p>
                </div>

                <button 
                  onClick={() => toggleAvailability(item.id)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${item.isAvailable ? 'bg-orange-500' : 'bg-zinc-800'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${item.isAvailable ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
