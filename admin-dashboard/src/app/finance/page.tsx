"use client";
import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/utils/useAdminAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';

interface Transaction {
  _id: string;
  orderId: string;
  restaurantName: string;
  totalAmount: number;
  commissionEarned: number;
  deliveryFee: number;
  timestamp: string;
}

export default function FinanceConsole() {
  const isAuthed = useAdminAuth();
  const [report, setReport] = useState<{ transactions: Transaction[], totalRevenue: number, totalCommission: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const fetchFinanceData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/finance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setReport(data);
    } catch (err) {
      console.error('[FINANCE_FETCH_ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthed) return <div className="p-20 text-center font-black text-white uppercase tracking-widest animate-pulse">Authenticating...</div>;

  return (
    <div className="space-y-10 animate-fade-in relative pb-20">
      <header className="flex justify-between items-center bg-white/5 p-8 rounded-[40px] border border-white/5 glass">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Nexus <span className="text-emerald-500">Finance</span> Trace</h2>
          <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">Revenue Splitting & Tactical Income Tracing</p>
        </div>
        <div className="flex gap-4">
           <div className="glass px-10 py-4 rounded-3xl border border-white/10 flex flex-col">
              <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">Total Admin Take</span>
              <span className="text-3xl font-black text-white tracking-tighter">₹{report?.totalCommission.toLocaleString() || '0'}</span>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="glass-card p-8 bg-blue-600/5">
           <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">Ecosystem GMV</p>
           <h4 className="text-2xl font-black text-white">₹{report?.totalRevenue.toLocaleString() || '0'}</h4>
        </div>
        <div className="glass-card p-8 bg-emerald-600/5">
           <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2">Active Commission</p>
           <h4 className="text-2xl font-black text-white">₹{( (report?.totalCommission || 0) * 0.4 ).toFixed(0)}</h4>
        </div>
        <div className="glass-card p-8 bg-[#C9A84C]/5">
           <p className="text-[9px] font-black text-[#C9A84C] uppercase tracking-widest mb-2">Delivery Fees</p>
           <h4 className="text-2xl font-black text-white">₹{( (report?.totalCommission || 0) * 0.6 ).toFixed(0)}</h4>
        </div>
        <div className="glass-card p-8 bg-white/5">
           <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Status</p>
           <h4 className="text-2xl font-black text-white uppercase">Live Trace</h4>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
           <h4 className="text-lg font-black text-white uppercase tracking-tight">Income Transaction Log</h4>
           <div className="flex gap-2">
              <button 
                onClick={fetchFinanceData}
                className="nexus-badge bg-blue-500/10 border-blue-500/20 text-blue-400 px-6 py-2 hover:bg-blue-500/20 transition-all font-black"
              >
                RE-SCAN FLOWS
              </button>
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.03]">
                <th className="px-8 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">Trace ID</th>
                <th className="px-8 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">Origin Partner</th>
                <th className="px-8 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">Total GMV</th>
                <th className="px-8 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">Admin Take (Comm + Fee)</th>
                <th className="px-8 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">Settled Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {loading ? (
                <tr><td colSpan={5} className="py-20 text-center text-gray-600 animate-pulse font-black uppercase tracking-widest">Tracing Monetary Flows...</td></tr>
              ) : report?.transactions.length === 0 ? (
                <tr><td colSpan={5} className="py-20 text-center text-gray-500 uppercase font-black text-xs tracking-widest">Zero Settled Flows Detected</td></tr>
              ) : report?.transactions.map((tx) => (
                <tr key={tx._id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-8 py-6 text-xs font-mono text-blue-500/80 group-hover:text-blue-400">#TR-{tx.orderId}</td>
                  <td className="px-8 py-6 text-sm font-bold text-white uppercase tracking-tight">{tx.restaurantName}</td>
                  <td className="px-8 py-6 text-sm font-black text-white">₹{tx.totalAmount}</td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                       <span className="text-sm font-black text-emerald-400">₹{tx.commissionEarned + tx.deliveryFee}</span>
                       <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">₹{tx.commissionEarned} comm + ₹{tx.deliveryFee} fee</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest">{new Date(tx.timestamp).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

