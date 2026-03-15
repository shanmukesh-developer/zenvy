"use client";
import { useState, useEffect } from 'react';
import { useTracking } from '@/hooks/useTracking';

interface Order {
  id: string;
  restaurant: string;
  drop: string;
  earnings: string;
}

export default function DeliveryHome() {
  const [isOnline, setIsOnline] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [orderStatus, setOrderStatus] = useState<'idle' | 'accepted' | 'picked_up' | 'delivered'>('idle');

  // Link tracking to the active order and get socket instance
  const { socket } = useTracking(activeOrder?.id || '', 'Rahul Mishra');

  const [availableOrders, setAvailableOrders] = useState<Order[]>([
    { id: '1025', restaurant: 'Dominos Pizza', drop: 'Hostel A, Room 204', earnings: '₹45' },
    { id: '1026', restaurant: 'Biryani Hub', drop: 'Hostel B, Room 112', earnings: '₹35' },
  ]);

  // Handle Real-time Order Sync
  useEffect(() => {
    if (socket) {
      socket.on('newOrder', (newOrder: Order) => {
        setAvailableOrders(prev => [newOrder, ...prev]);
        // Simple notification sound/alert hint
        console.log("New Order Received:", newOrder);
      });
    }
    return () => {
      if (socket) socket.off('newOrder');
    };
  }, [socket]);

  const acceptOrder = (order: Order) => {
    setActiveOrder(order);
    setOrderStatus('accepted');
  };

  const pickUpOrder = () => {
    setOrderStatus('picked_up');
  };

  const deliverOrder = () => {
    alert('Order Delivered! Earnings added to your wallet. 💰');
    setActiveOrder(null);
    setOrderStatus('idle');
  };

  const declineOrder = () => {
    setActiveOrder(null);
    setOrderStatus('idle');
  };

  const contactCustomer = () => {
    alert('Initiating call to customer...');
  };

  return (
    <main className="min-h-screen p-6 max-w-lg mx-auto pb-32">
      {/* Header */}
      <div className="flex justify-between items-center mb-10 bg-slate-800/50 p-6 rounded-3xl border border-white/5">
        <div>
          <h1 className="text-xl font-bold">HostelBites Rider</h1>
          <p className="text-sm text-gray-400">SRM University AP</p>
        </div>
        <div 
          onClick={() => setIsOnline(!isOnline)}
          className={`relative w-16 h-8 rounded-full cursor-pointer transition-colors ${isOnline ? 'bg-emerald-500' : 'bg-slate-700'}`}
        >
          <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${isOnline ? 'translate-x-8' : 'translate-x-0'}`} />
        </div>
      </div>

      {!isOnline ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center text-4xl mb-6 grayscale text-gray-400">
            🛵
          </div>
          <h2 className="text-2xl font-bold mb-2">You&apos;re Offline</h2>
          <p className="text-gray-400">Go online to start receiving orders.</p>
        </div>
      ) : activeOrder ? (
        <div className="space-y-6">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-[40px]">
            <p className="text-emerald-500 font-bold uppercase text-xs mb-2">Order in Progress</p>
            <h2 className="text-2xl font-bold mb-4">{activeOrder.restaurant}</h2>
            <div className="space-y-4 mb-8">
               <div className="flex space-x-3">
                  <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-xs">P</div>
                  <div>
                    <p className="font-bold text-sm">Pick up</p>
                    <p className="text-xs text-gray-400">Vijayawada High Street</p>
                  </div>
               </div>
               <div className="flex space-x-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs">D</div>
                  <div>
                    <p className="font-bold text-sm">Drop to</p>
                    <p className="text-xs text-gray-400">{activeOrder.drop}</p>
                  </div>
               </div>
            </div>
            <button 
              onClick={orderStatus === 'accepted' ? pickUpOrder : deliverOrder}
              className={`w-full py-4 rounded-2xl font-bold transition-all ${orderStatus === 'accepted' ? 'bg-emerald-600 neon-border-green' : 'bg-blue-600 neon-border-blue'}`}
            >
               {orderStatus === 'accepted' ? 'Confirm Pick Up' : 'Confirm Delivery'}
            </button>
          </div>

          <div className="glass p-6 rounded-3xl flex justify-between items-center">
             <div>
                <p className="text-xs text-gray-400">Customer OTP</p>
                <p className="text-2xl font-black">4921</p>
             </div>
             <button 
               onClick={contactCustomer}
               className="px-5 py-3 glass rounded-2xl text-sm font-bold"
             >
                Contact
             </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">New Requests (Nearby)</h3>
            <span className="bg-emerald-500 text-black text-[10px] font-black px-2 py-1 rounded">LIVE</span>
          </div>

          <div className="space-y-4">
            {availableOrders.map((order) => (
              <div key={order.id} className="glass p-6 rounded-3xl hover:bg-white/5 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold">{order.restaurant}</h4>
                    <p className="text-xs text-gray-400">{order.drop}</p>
                  </div>
                  <span className="text-emerald-400 font-bold">{order.earnings}</span>
                </div>
                <div className="flex space-x-3">
                  <button 
                    onClick={() => acceptOrder(order)}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 transition-all rounded-xl font-bold text-sm"
                  >
                    Accept
                  </button>
                  <button 
                    onClick={declineOrder}
                    className="px-5 py-3 glass rounded-xl text-sm font-bold"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Bottom Bar */}
      <div className="fixed bottom-8 left-6 right-6 glass p-6 rounded-[32px] flex justify-around shadow-2xl backdrop-blur-3xl">
         <div className="text-center">
            <p className="text-xs text-gray-400 uppercase font-bold tracking-tighter">Orders</p>
            <p className="text-lg font-bold">12</p>
         </div>
         <div className="h-8 w-px bg-white/10" />
         <div className="text-center">
            <p className="text-xs text-gray-400 uppercase font-bold tracking-tighter">Today</p>
            <p className="text-lg font-bold text-emerald-400">₹420</p>
         </div>
         <div className="h-8 w-px bg-white/10" />
         <div className="text-center">
            <p className="text-xs text-gray-400 uppercase font-bold tracking-tighter">Duty</p>
            <p className="text-lg font-bold">4.5h</p>
         </div>
      </div>
    </main>
  );
}
