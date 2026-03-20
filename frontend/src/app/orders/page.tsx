"use client";
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';

interface OrderRecord {
  _id: string;
  totalPrice: number;
  status: string;
  createdAt: string;
  items: { name?: string; quantity: number; priceAtOrder: number }[];
}

// Skeleton loading component
function OrderSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="glass-card p-6 rounded-[28px]">
          <div className="flex items-center justify-between mb-3">
            <div className="skeleton h-4 w-28 rounded-lg" />
            <div className="skeleton h-3 w-16 rounded-lg" />
          </div>
          <div className="flex items-center justify-between">
            <div className="skeleton h-3 w-32 rounded-lg" />
            <div className="skeleton h-4 w-12 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const touchStartX = useRef(0);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem('token');
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const res = await fetch(`${API_URL}/api/orders/myorders`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setOrders(data);
        }
      } catch (err) {
        console.error('Failed to fetch orders:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setSwipedId(null);
  };

  const handleTouchEnd = (e: React.TouchEvent, id: string) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 80) setSwipedId(id); // Swipe left reveals reorder
    if (diff < -40) setSwipedId(null); // Swipe right hides
  };

  const statusColor = (s: string) => {
    if (s === 'Delivered') return 'text-emerald-400';
    if (s === 'Cancelled') return 'text-red-400';
    return 'text-primary-yellow';
  };

  const statusIcon = (s: string) => {
    if (s === 'Delivered') return '✓';
    if (s === 'Cancelled') return '✕';
    return '◎';
  };

  return (
    <main className="min-h-screen bg-background text-white p-6 relative overflow-hidden">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-[#C9A84C]/[0.03] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-10 pt-6">
          <Link href="/profile" className="w-10 h-10 glass-card rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-black uppercase tracking-[0.15em]">My Orders</h1>
          <div className="w-10" />
        </div>

        {loading ? (
          <OrderSkeleton />
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 glass-card rounded-full flex items-center justify-center text-4xl mb-6">🍽️</div>
            <h2 className="text-xl font-black mb-2">No Orders Yet</h2>
            <p className="text-secondary-text text-sm mb-8 max-w-[250px]">Your culinary journey awaits. Place your first order today.</p>
            <Link href="/" className="btn-yellow">
              Browse Restaurants
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[9px] font-bold text-secondary-text uppercase tracking-[0.2em] mb-2">← Swipe to reorder</p>
            {orders.map((order) => (
              <div key={order._id} className="relative overflow-hidden rounded-[28px]">
                {/* Reorder Action (behind card) */}
                <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#C9A84C] to-[#8B7332] flex items-center justify-center rounded-r-[28px]">
                  <span className="text-[9px] font-black text-black uppercase tracking-wider">Reorder</span>
                </div>

                {/* Card */}
                <div
                  className={`glass-card p-6 rounded-[28px] relative z-10 transition-transform duration-300 ${swipedId === order._id ? '-translate-x-24' : 'translate-x-0'}`}
                  onTouchStart={(e) => handleTouchStart(e)}
                  onTouchEnd={(e) => handleTouchEnd(e, order._id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${statusColor(order.status)}`}>{statusIcon(order.status)}</span>
                      <h3 className="text-sm font-black">Order #{order._id.slice(-5)}</h3>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${statusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-secondary-text font-bold">
                      {order.items?.length || 0} item{(order.items?.length || 0) > 1 ? 's' : ''} • {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                    <span className="text-sm font-black text-gold-gradient">₹{order.totalPrice}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
