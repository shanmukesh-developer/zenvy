"use client";
import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';

interface Rider {
  _id: string;
  name: string;
  phone: string;
  isApproved: boolean;
  isOnline: boolean;
  vehicleType?: string;
}

export default function FleetManagement() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newRider, setNewRider] = useState({ name: '', phone: '', password: 'password123', vehicleType: 'Bike' });

  useEffect(() => {
    fetchRiders();
  }, []);

  const fetchRiders = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/riders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setRiders(data);
    } catch (err) {
      console.error('[FLEET_FETCH_ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleApproval = async (id: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/riders/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isApproved: !currentStatus })
      });
      if (res.ok) fetchRiders();
    } catch (err) { console.error('[FLEET_APPROVE_ERROR]', err); }
  };

  const handleCreateRider = async () => {
    try {
      const res = await fetch(`${API_URL}/api/delivery/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRider)
      });
      if (res.ok) {
        setIsAdding(false);
        fetchRiders();
      }
    } catch (err) { console.error('[CREATE_RIDER_ERROR]', err); }
  };

  return (
    <div className="space-y-10 animate-fade-in relative pb-20">
      <header className="flex justify-between items-center bg-white/5 p-8 rounded-[40px] border border-white/5 glass">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Nexus Fleet <span className="text-blue-500">Recruitment</span></h2>
          <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">Personnel Onboarding & Approval Terminal</p>
        </div>
        <div className="flex gap-4">
           <button onClick={() => setIsAdding(true)} className="px-8 py-3 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]">
              Recruit New Node
           </button>
        </div>
      </header>

      {isAdding && (
        <div className="glass-card p-10 border-blue-500/30">
           <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8">Onboard New Personnel</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <input placeholder="Personnel Name" className="admin-input" value={newRider.name} onChange={(e) => setNewRider({...newRider, name: e.target.value})} />
              <input placeholder="Phone Number" className="admin-input" value={newRider.phone} onChange={(e) => setNewRider({...newRider, phone: e.target.value})} />
              <select className="admin-input" value={newRider.vehicleType} onChange={(e) => setNewRider({...newRider, vehicleType: e.target.value})}>
                 <option value="Bike">Bike (Standard)</option>
                 <option value="Electric">Electric (Eco)</option>
                 <option value="Cycle">Bicycle (Hostel Internal)</option>
                 <option value="Car">Car (Group Delivery)</option>
              </select>
              <input placeholder="Password" type="password" className="admin-input" value={newRider.password} onChange={(e) => setNewRider({...newRider, password: e.target.value})} />
           </div>
           <div className="flex gap-4 mt-10">
              <button 
                onClick={handleCreateRider}
                className="flex-1 py-5 bg-blue-600 text-white font-black uppercase tracking-[0.3em] rounded-3xl text-xs"
              >
                Confirm Onboarding
              </button>
              <button 
                onClick={() => setIsAdding(false)}
                className="px-10 py-5 bg-white/5 text-gray-500 font-black uppercase tracking-widest rounded-3xl text-xs hover:bg-white/10"
              >
                Cancel
              </button>
           </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.03] border-b border-white/5">
              <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Personnel ID</th>
              <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Full Name</th>
              <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Contact Node</th>
              <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Status</th>
              <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02] text-white">
            {loading ? (
              <tr><td colSpan={5} className="px-8 py-20 text-center text-gray-600 animate-pulse font-black uppercase tracking-widest">Scanning Grid for Personnel...</td></tr>
            ) : riders.map((rider) => (
              <tr key={rider._id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-8 py-6">
                  <span className="text-xs font-black text-blue-500/50 group-hover:text-blue-400 transition-colors">#{rider._id.slice(-6)}</span>
                </td>
                <td className="px-8 py-6 text-sm font-bold text-white uppercase tracking-tight">
                  {rider.name}
                  {rider.vehicleType && <span className="ml-2 text-[8px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md">{rider.vehicleType}</span>}
                </td>
                <td className="px-8 py-6 text-xs text-gray-400 font-mono tracking-tighter">{rider.phone}</td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${rider.isApproved ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
                    <span className={`text-[9px] font-black uppercase tracking-widest ${rider.isApproved ? 'text-emerald-500' : 'text-red-500'}`}>
                      {rider.isApproved ? 'Approved' : 'Pending'}
                    </span>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <button onClick={() => handleToggleApproval(rider._id, rider.isApproved)} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${rider.isApproved ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                    {rider.isApproved ? 'Deactivate' : 'Hire'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style jsx>{`
        .admin-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 1.25rem; border-radius: 1.5rem; color: white; font-weight: 900; outline: none; }
        .admin-input:focus { border-color: rgba(37, 99, 235, 0.5); }
      `}</style>
    </div>
  );
}

