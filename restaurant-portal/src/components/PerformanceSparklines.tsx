import React from 'react';
import { motion } from 'framer-motion';

export function PerformanceSparklines({ orders }: { orders: any[] }) {
  // Mock data for sparklines based on order counts today
  const today = new Date().toDateString();
  const todaysOrders = orders.filter(o => new Date(o.createdAt).toDateString() === today);
  
  const revenue = todaysOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  
  // Create a 7-point mock sparkline based on hours
  const sparklineData = [30, 45, 25, 60, 85, 40, revenue > 0 ? 100 : 20];

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 mb-6">
      <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-4">Today's Performance</h3>
      <div className="flex justify-between items-end mb-6">
        <div>
          <p className="text-3xl font-black text-white tracking-tighter">₹{revenue}</p>
          <p className="text-xs font-bold text-emerald-500 mt-1">+{todaysOrders.length} Orders Today</p>
        </div>
        
        {/* Simple SVG Sparkline */}
        <div className="w-24 h-12 flex items-end justify-between gap-1">
          {sparklineData.map((val, i) => (
            <motion.div 
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${val}%` }}
              transition={{ delay: i * 0.1, duration: 0.8, ease: 'easeOut' }}
              className={`w-full rounded-t-sm ${i === 6 ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]' : 'bg-zinc-700'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
