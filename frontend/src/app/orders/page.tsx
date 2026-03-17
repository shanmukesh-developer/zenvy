"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface OrderRecord {
  _id: string;
  totalPrice: number;
  status: string;
  createdAt: string;
  items: { name?: string; quantity: number; priceAtOrder: number }[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://hostelbites-backend-exs6.onrender.com'}/api/orders/myorders`, {
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

  const statusColor = (s: string) => {
    if (s === 'Delivered') return 'text-emerald-400';
    if (s === 'Cancelled') return 'text-red-400';
    return 'text-primary-yellow';
  };

  return (
    <main className="min-h-screen bg-background text-white p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <Link href="/profile" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-black uppercase tracking-widest">My Orders</h1>
        <div className="w-10" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-secondary-text font-black animate-pulse">Loading Orders...</div>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-6xl mb-6">🍽️</div>
          <h2 className="text-xl font-black mb-2">No Orders Yet</h2>
          <p className="text-secondary-text text-sm mb-8">Your order history will appear here.</p>
          <Link href="/" className="btn-yellow px-8 py-4 text-xs uppercase tracking-widest">
            Browse Restaurants
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link 
              href={`/tracking?id=${order._id}`} 
              key={order._id} 
              className="block bg-card-bg p-6 rounded-[30px] border border-white/5 hover:border-white/10 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black uppercase">Order #{order._id.slice(-5)}</h3>
                <span className={`text-[10px] font-black uppercase tracking-widest ${statusColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-secondary-text font-bold">
                  {order.items?.length || 0} item{(order.items?.length || 0) > 1 ? 's' : ''} • {new Date(order.createdAt).toLocaleDateString()}
                </p>
                <span className="text-sm font-black text-primary-yellow">₹{order.totalPrice}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
