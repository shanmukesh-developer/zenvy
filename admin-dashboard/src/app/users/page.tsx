"use client";
import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

interface User {
  _id: string;
  name: string;
  email: string;
  phoneNumber: string;
  isElite: boolean;
  walletBalance: number;
}

interface AuditLog {
  _id: string;
  action: string;
  details: string;
  timestamp: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'roster' | 'audit'>('roster');

  useEffect(() => {
    fetchUsers();
    fetchLogs();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setUsers(data);
    } catch (err) { console.error('[USER_FETCH_ERROR]', err); } finally { setLoading(false); }
  };

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/audit`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setLogs(data);
    } catch (err) { console.error('[AUDIT_FETCH_ERROR]', err); }
  };

  const toggleElite = async (userId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/elite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isElite: !currentStatus })
      });
      if (res.ok) { fetchUsers(); fetchLogs(); }
    } catch (err) { console.error('[ELITE_TOGGLE_ERROR]', err); }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.phoneNumber?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-10 animate-fade-in relative pb-20">
      <header className="flex justify-between items-center bg-white/5 p-8 rounded-[40px] border border-white/5 glass">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Nexus <span className="text-[#C9A84C]">Residents</span></h2>
          <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">Campus Tiering & Absolute Student Governance</p>
        </div>
        <div className="flex gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5">
           <button onClick={() => setActiveTab('roster')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'roster' ? 'bg-[#C9A84C] text-black shadow-[0_0_20px_rgba(201,168,76,0.3)]' : 'text-gray-500 hover:text-white'}`}>Active Roster</button>
           <button onClick={() => setActiveTab('audit')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'audit' ? 'bg-[#C9A84C] text-black shadow-[0_0_20px_rgba(201,168,76,0.3)]' : 'text-gray-500 hover:text-white'}`}>Audit Intel</button>
        </div>
      </header>

      {activeTab === 'roster' ? (
        <div className="glass-card p-6">
          <div className="flex flex-col md:flex-row gap-6 mb-10">
             <input type="text" placeholder="Search by Name, Email or Phone..." className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-4 px-8 text-white font-black outline-none" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
             {loading ? <div className="col-span-full py-20 text-center animate-pulse text-gray-600 font-black uppercase">Initialising Node Scan...</div> : 
             filteredUsers.map((user) => (
               <div key={user._id} className="glass-card p-8 group relative overflow-hidden border-white/5 group hover:border-[#C9A84C]/30 transition-all">
                  <div className="flex items-start justify-between mb-8">
                     <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xl font-black text-white">{user.name[0]}</div>
                     <button onClick={() => toggleElite(user._id, user.isElite)} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${user.isElite ? 'bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/30' : 'bg-white/5 text-gray-500 border-white/10'}`}>
                       {user.isElite ? 'Elite Mode' : 'Standard'}
                     </button>
                  </div>
                  <h4 className="text-xl font-black text-white uppercase tracking-tight line-clamp-1">{user.name}</h4>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-6">{user.email}</p>
                  <div className="pt-6 border-t border-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-emerald-500">
                      <span>Verified Resident</span>
                      <span className="text-white">₹{user.walletBalance.toFixed(0)} Credits</span>
                  </div>
               </div>
             ))}
          </div>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
           <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5">
                  <th className="px-8 py-5 text-[9px] font-black text-gray-500 uppercase tracking-widest">Timestamp</th>
                  <th className="px-8 py-5 text-[9px] font-black text-gray-500 uppercase tracking-widest">Protocol</th>
                  <th className="px-8 py-5 text-[9px] font-black text-gray-500 uppercase tracking-widest">Operational Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02] text-white">
                 {logs.map((log) => (
                   <tr key={log._id} className="hover:bg-white/[0.01]">
                      <td className="px-8 py-5 text-[10px] font-bold text-gray-500">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="px-8 py-5"><span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded-md text-[9px] font-black uppercase">{log.action}</span></td>
                      <td className="px-8 py-5 text-sm font-bold text-gray-300 tracking-tight">{log.details}</td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}
    </div>
  );
}

