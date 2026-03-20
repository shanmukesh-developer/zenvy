"use client";
import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface VaultItem {
  _id: string;
  name: string;
  price: number;
  originalPrice: number;
  remainingCount: number;
  imageUrl: string;
  isActive: boolean;
}

export default function VaultTerminal() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVault();
  }, []);

  const fetchVault = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/vault`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setItems(data);
    } catch (err) {
      console.error('[VAULT_FETCH_ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpsert = async (item: Partial<VaultItem>) => {
    try {
      const token = localStorage.getItem('token');
      const id = item._id || 'new';
      const res = await fetch(`${API_URL}/api/admin/vault/${id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(item)
      });
      if (res.ok) fetchVault();
    } catch (err) {
      console.error('[VAULT_UPSERT_ERROR]', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/vault/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchVault();
    } catch (err) {
      console.error('[VAULT_DELETE_ERROR]', err);
    }
  };

  return (
    <div className="space-y-10 animate-fade-in relative pb-20">
      <header className="flex justify-between items-center bg-white/5 p-8 rounded-[40px] border border-white/5 glass">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Nexus <span className="text-[#C9A84C]">Vault</span> Terminal</h2>
          <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">Daily Scarcity & FOMO Management</p>
        </div>
        <button 
          onClick={() => handleUpsert({ name: 'New Secret Drop', price: 99, originalPrice: 199, remainingCount: 5, imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=400&auto=format&fit=crop' })}
          className="px-8 py-3 bg-[#C9A84C] text-black text-[10px] font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-all"
        >
          Initialize Item
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {loading ? (
            <div className="col-span-full py-20 text-center font-black text-gray-500 animate-pulse tracking-widest uppercase">Syncing with Secure Vault...</div>
        ) : items.map((item) => (
          <div key={item._id} className="glass-card p-8 group relative overflow-hidden">
             <div className="flex gap-8 relative z-10">
                <div className="w-32 h-32 rounded-3xl overflow-hidden border border-white/10 shrink-0">
                   <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                </div>
                <div className="flex-1 space-y-4">
                   <div className="flex justify-between items-start">
                      <h4 className="text-xl font-black text-white uppercase tracking-tight">{item.name}</h4>
                      <button onClick={() => handleDelete(item._id)} className="text-red-500 hover:scale-125 transition-all text-sm">❌</button>
                   </div>
                   <div className="grid grid-cols-3 gap-4">
                      <div>
                         <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest block mb-1">Live Price</label>
                         <input 
                           type="number" 
                           defaultValue={item.price}
                           className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-sm text-white font-black"
                           onBlur={(e) => handleUpsert({ ...item, price: Number(e.target.value) })}
                         />
                      </div>
                      <div>
                         <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest block mb-1">MSRP</label>
                         <input 
                           type="number" 
                           defaultValue={item.originalPrice}
                           className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-sm text-gray-400 font-bold"
                           onBlur={(e) => handleUpsert({ ...item, originalPrice: Number(e.target.value) })}
                         />
                      </div>
                      <div>
                         <label className="text-[8px] font-black text-[#C9A84C] uppercase tracking-widest block mb-1">Remaining</label>
                         <input 
                           type="number" 
                           defaultValue={item.remainingCount}
                           className="w-full bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-xl p-2 text-sm text-[#C9A84C] font-black"
                           onBlur={(e) => handleUpsert({ ...item, remainingCount: Number(e.target.value) })}
                         />
                      </div>
                   </div>
                   <div className="flex items-center gap-2 pt-2">
                       <div className={`w-2 h-2 rounded-full ${item.remainingCount > 0 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`} />
                       <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                         {item.remainingCount > 0 ? 'ACTIVE IN VAULT' : 'OUT OF STOCK / HIDDEN'}
                       </span>
                   </div>
                </div>
             </div>
             {/* Scarcity Progress Bar */}
             <div className="absolute bottom-0 left-0 h-1 bg-[#C9A84C]/50 shadow-[0_0_15px_rgba(201,168,76,0.3)] transition-all" style={{ width: `${(item.remainingCount / 10) * 100}%` }} />
          </div>
        ))}
      </div>

      <div className="glass-card p-10 flex items-center justify-between border-[#C9A84C]/20 bg-[#C9A84C]/[0.02]">
         <div className="flex items-center gap-6">
            <span className="text-3xl">🕯️</span>
            <div>
               <h4 className="text-sm font-black text-white uppercase tracking-wider">The Psychology of Scarcity</h4>
               <p className="text-[10px] text-gray-500 leading-relaxed uppercase tracking-wide">The Vault generates intensity through limited numbers. By updating these counts in real-time, you trigger the campus FOMO engine.</p>
            </div>
         </div>
      </div>
    </div>
  );
}
