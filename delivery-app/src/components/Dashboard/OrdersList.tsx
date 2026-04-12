"use client";
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Order {
  id: string;
  restaurant: string;
  items: { name: string; quantity: number; priceAtOrder?: number }[];
  totalAmount?: number;
  totalPrice?: number;
  finalPrice?: number;
  earnings?: string;
  deliveredAt?: string;
  createdAt?: string;
}

interface TaskCardProps {
  order: Order;
  timer?: number;
  sequence?: number;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

export function TaskCard({ order, timer, sequence, onAccept, onDecline }: TaskCardProps) {
  const isUrgent = timer !== undefined && timer <= 10;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className={`metric-card relative overflow-hidden group border ${isUrgent ? 'border-red-500/30' : 'border-white/5'}`}
    >
      <div className="flex justify-between items-start mb-6">
        <div className="space-y-1">
          <p className="hud-title text-blue-500">
            {sequence ? `Priority Task #${sequence}` : 'Available Task'}
          </p>
          <h4 className="text-xl font-bold text-white tracking-tight">{order.restaurant}</h4>
        </div>
        
        {timer !== undefined && (
          <div className="flex flex-col items-end">
            <span className={`text-2xl font-bold tabular-nums ${isUrgent ? 'text-red-500' : 'text-blue-500'}`}>{timer}s</span>
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Expiring</span>
          </div>
        )}
      </div>

      <div className="bg-white/[0.02] rounded-2xl p-4 mb-8 border border-white/5">
         <div className="space-y-2">
            {order.items?.slice(0, 2).map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs font-medium">
                <span className="text-slate-400">
                  <span className="text-blue-500 font-bold mr-2">{item.quantity}×</span>
                  {item.name}
                </span>
              </div>
            ))}
            {(order.items?.length || 0) > 2 && (
               <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">+{(order.items?.length || 0) - 2} more entries</p>
            )}
         </div>
      </div>

      <div className="flex gap-4">
        <button 
          onClick={() => onDecline(order.id)}
          className="flex-1 py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-all"
        >
          Ignore
        </button>
        <button 
          onClick={() => onAccept(order.id)}
          className="flex-[2] py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest bg-white text-black hover:bg-blue-600 hover:text-white transition-all shadow-sm"
        >
          Accept Order
        </button>
      </div>

      {timer !== undefined && (
        <div className="absolute top-0 left-0 w-full h-1 bg-white/[0.03]">
           <motion.div 
             initial={{ width: '100%' }}
             animate={{ width: '0%' }}
             transition={{ duration: 30, ease: 'linear' }}
             className={`h-full ${isUrgent ? 'bg-red-500' : 'bg-blue-500'}`}
           />
        </div>
      )}
    </motion.div>
  );
}

export function HistoryCard({ order }: { order: Order }) {
  const date = order.deliveredAt ? new Date(order.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently';
  
  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="metric-card !p-5 flex items-center justify-between group"
    >
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-white/[0.03] flex items-center justify-center border border-white/5 text-xl">
          📦
        </div>
        <div>
          <h4 className="text-[13px] font-bold text-white uppercase tracking-tight">{order.restaurant}</h4>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.15em] mt-0.5">
            Success • {date}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-emerald-500 tabular-nums">+{order.earnings}</p>
        <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Earned</p>
      </div>
    </motion.div>
  );
}

interface OrdersListProps {
  orders: Order[];
  orderTimers: Record<string, number>;
  activeTab: 'pending' | 'history';
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onRefresh: () => void;
}

export default function OrdersList({ orders, orderTimers, activeTab, onAccept, onDecline, onRefresh }: OrdersListProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {activeTab === 'pending' ? 'Operational Queue' : 'Activity Archive'}
          </h2>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">
            {activeTab === 'pending' ? 'Real-time task synchronization' : 'Verified fulfillment history'}
          </p>
        </div>
        <button 
          onClick={onRefresh} 
          className="text-[9px] font-bold uppercase tracking-widest text-blue-500 hover:text-white transition-all px-4 py-2 rounded-xl bg-blue-500/5 hover:bg-blue-500/20"
        >
          {activeTab === 'pending' ? 'Fetch New' : 'Reload Logs'}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {orders.length === 0 ? (
          <motion.div 
            key="empty-state"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="metric-card py-20 text-center border-dashed opacity-60"
          >
             <div className="w-16 h-16 bg-white/[0.03] rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5 text-2xl">
                ⏳
             </div>
             <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
               {activeTab === 'pending' ? 'Awaiting New Logistics Tasks' : 'No fulfillment history available'}
             </p>
          </motion.div>
        ) : (
          <motion.div 
            key="list-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 gap-4"
          >
             {(() => {
                // Prioritize operational queue based on creation order timing (oldest first)
                const sortedOrders = activeTab === 'pending'
                  ? [...orders].sort((a, b) => {
                      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : Date.now();
                      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : Date.now();
                      return timeA - timeB; // 1 to N sequence
                    })
                  : orders;

                return sortedOrders.map((order, idx) => (
                  activeTab === 'pending' ? (
                    <TaskCard 
                      key={order.id} 
                      order={order} 
                      sequence={idx + 1}
                      timer={orderTimers[order.id]}
                      onAccept={onAccept}
                      onDecline={onDecline}
                    />
                  ) : (
                    <HistoryCard key={order.id} order={order} />
                  )
                ));
             })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
