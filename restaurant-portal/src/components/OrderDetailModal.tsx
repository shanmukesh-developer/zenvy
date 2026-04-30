import React from 'react';
import { motion } from 'framer-motion';

export function OrderDetailModal({ order, onClose }: { order: any; onClose: () => void }) {
  if (!order) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
          <div>
            <h3 className="text-xl font-bold text-white">Order #{String(order.id || order._id).slice(-6).toUpperCase()}</h3>
            <p className="text-xs text-zinc-500 mt-1">{new Date(order.createdAt).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 text-white">
            ✕
          </button>
        </div>
        
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Order Items</h4>
            <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800/50 space-y-3">
              {order.items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-zinc-300">
                    <span className="text-orange-500 mr-2 font-bold">{item.quantity}x</span> 
                    {item.name}
                  </span>
                  <span className="text-zinc-500">₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2">Payment Details</h4>
              <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-zinc-500">Method</span>
                  <span className="text-xs font-bold text-white">{order.paymentMethod}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500">Total</span>
                  <span className="text-lg font-black text-orange-500">₹{order.totalPrice}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2">Delivery Partner</h4>
              <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800/50 h-[76px] flex flex-col justify-center">
                {order.deliveryPartnerName ? (
                  <span className="text-sm font-bold text-blue-400">{order.deliveryPartnerName}</span>
                ) : (
                  <span className="text-xs text-zinc-500 italic">Assigning...</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-white text-black font-bold rounded-xl text-sm hover:bg-zinc-200 transition-colors">
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
