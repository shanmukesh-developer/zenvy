"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { OrderTimer } from './OrderUtils';

interface Order {
  id: string;
  restaurant: string;
  restaurantAddress?: string;
  customerName: string;
  customerPhone?: string;
  drop: string;
  items: { name: string; quantity: number; price?: number }[];
  totalAmount?: number;
  totalPrice?: number;
  finalPrice?: number;
  note?: string;
  createdAt?: string;
  status?: string;
}

interface ActiveOrderCardProps {
  order: Order;
  status: string;
  actionLoading: boolean;
  pinValue: string;
  onPinChange: (value: string) => void;
  onPickUp: (id: string) => void;
  onDeliver: (id: string) => void;
  onChatOpen: () => void;
  onReportIssue: (id: string, type: string) => void;
}

export default function ActiveOrderCard({ 
  order, 
  status, 
  actionLoading, 
  pinValue, 
  onPinChange, 
  onPickUp, 
  onDeliver,
  onChatOpen,
  onReportIssue
}: ActiveOrderCardProps) {
  const earnings = Math.round(((order.finalPrice || order.totalPrice || order.totalAmount || 0) * 0.1));
  const isAtPickup = status === 'Accepted';

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden group"
    >
      <div className="metric-card !p-8 relative z-10">
        
        {/* Header Section */}
        <div className="flex justify-between items-start mb-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${isAtPickup ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <p className="hud-title">
                {isAtPickup ? 'Arrive at Pickup' : 'Heading to Delivery'}
              </p>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight leading-tight">{order.restaurant}</h2>
          </div>
          
          <div className="text-right">
            {order.createdAt && <OrderTimer createdAt={order.createdAt} />}
            <div className="mt-2 text-emerald-500 font-bold text-xl tabular-nums">
              <span className="text-xs mr-1 opacity-60">₹</span>{earnings}
            </div>
          </div>
        </div>

        {/* Note / Instruction */}
        {order.note && (
          <div className="mb-8 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Internal Note</p>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">{order.note}</p>
          </div>
        )}

        {/* Route Logic */}
        <div className="space-y-8 relative mb-10">
          <div className="absolute left-[15px] top-6 bottom-6 w-[1px] bg-white/5" />

          {/* Pickup Address */}
          <div className={`flex gap-5 relative z-10 transition-all duration-500 ${!isAtPickup ? 'opacity-30 pb-4' : 'pb-4'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${isAtPickup ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white/5 border-white/10 text-slate-500'}`}>
               <span className="text-[10px] font-bold">A</span>
            </div>
            <div className="flex-1">
              <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mb-1">Pickup From</p>
              <h3 className="text-white font-bold text-sm tracking-tight">{order.restaurantAddress || 'Station Alpha'}</h3>
            </div>
          </div>

          {/* Delivery Address */}
          <div className={`flex gap-5 relative z-10 transition-all duration-500 ${isAtPickup ? 'opacity-30' : ''}`}>
             <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${!isAtPickup ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-white/5 border-white/10 text-slate-500'}`}>
               <span className="text-[10px] font-bold">B</span>
            </div>
            <div className="flex-1">
              <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Deliver To</p>
              <h3 className="text-white font-bold text-sm tracking-tight">{order.customerName}</h3>
              <p className="text-xs text-slate-500 mt-1">{order.drop}</p>
            </div>
          </div>
        </div>

        {/* Content Manifest */}
        <div className="bg-white/[0.02] rounded-2xl p-5 mb-8 border border-white/5">
           <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4">Payload Summary</p>
           <div className="space-y-3">
             {order.items?.map((item: { name: string; quantity: number }, i: number) => (
                <div key={i} className="flex justify-between items-center text-[13px] font-medium">
                  <span className="text-slate-300">
                    <span className="text-blue-500 font-bold mr-2">{item.quantity}×</span>
                    {item.name}
                  </span>
                </div>
             ))}
           </div>
        </div>

        {/* Action Controls */}
        <div className="mb-10">
           <button 
             onClick={onChatOpen}
             className="flex-1 h-[60px] flex items-center justify-center gap-2 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/10 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-all"
           >
             Contact Chat
           </button>
           <button 
             onClick={() => onReportIssue(order.id, 'Delayed')}
             className="flex-1 h-[60px] flex items-center justify-center gap-2 rounded-xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 text-[10px] font-bold uppercase tracking-widest text-red-500/60 hover:text-red-500 transition-all"
           >
             ⚠️ Issue Alert
           </button>
        </div>

        {/* Interaction Pad */}
        <div className="pt-8 border-t border-white/5">
          {isAtPickup ? (
            <button
              onClick={() => onPickUp(order.id)}
              disabled={actionLoading}
              className="w-full py-5 rounded-2xl bg-white text-black font-bold text-[11px] uppercase tracking-widest transition-all hover:bg-slate-200 disabled:opacity-50"
            >
              {actionLoading ? 'Processing...' : 'Confirm Pickup'}
            </button>
          ) : (
            <div className="space-y-6">
              <div className="bg-white/[0.02] p-6 rounded-2xl border border-white/5 flex flex-col items-center">
                 <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4">Verification Code</p>
                 <input 
                   type="tel" 
                   inputMode="numeric"
                   maxLength={4}
                   value={pinValue}
                   onChange={(e) => onPinChange(e.target.value.replace(/\D/g, ''))}
                   className="w-full bg-transparent text-4xl font-bold tracking-[0.5em] text-center text-white outline-none placeholder:text-white/5"
                   placeholder="0000"
                 />
              </div>
              <button
                onClick={() => onDeliver(order.id)}
                disabled={actionLoading || pinValue.length < 4}
                className={`w-full py-5 rounded-2xl font-bold text-[11px] uppercase tracking-widest transition-all ${
                  pinValue.length === 4 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                 {actionLoading ? 'Validating...' : 'Complete Fulfillment'}
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
