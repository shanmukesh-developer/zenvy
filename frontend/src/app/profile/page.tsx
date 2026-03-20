"use client";
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import SuccessOverlay from '@/components/SuccessOverlay';

interface ProfileUser {
  id: string;
  _id?: string;
  name: string;
  phone: string;
  hostelBlock: string;
  roomNumber: string;
  isElite?: boolean;
  totalOrders?: number;
  walletBalance?: number;
}

export default function ProfilePage() {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', hostelBlock: '', roomNumber: '' });
  const [overlay, setOverlay] = useState<{ isOpen: boolean; title: string; message: string; type?: 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const fetchProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/users/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data);
        setEditData({ name: data.name, hostelBlock: data.hostelBlock, roomNumber: data.roomNumber });
      } else {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    } catch (_err) {
      console.error('Failed to fetch profile', _err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleUpdateProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editData)
      });

      if (response.ok) {
        const updated = await response.json();
        setUser((prev) => (prev ? { ...prev, ...updated } : updated));
        setIsEditing(false);
        setOverlay({
          isOpen: true,
          title: 'Profile Updated',
          message: 'Your gourmet credentials have been successfully updated.',
          type: 'success'
        });
        // Update local storage user data
        localStorage.setItem('user', JSON.stringify({ ...updated }));
      } else {
        setOverlay({
          isOpen: true,
          title: 'Update Failed',
          message: 'We could not update your profile at this time.',
          type: 'error'
        });
      }
    } catch (_err) {
      setOverlay({
        isOpen: true,
        title: 'Network Error',
        message: 'Unable to sync with Zenvy servers.',
        type: 'error'
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center font-black text-primary-yellow uppercase tracking-[0.5em]">Syncing...</div>;

  return (
    <main className="min-h-screen bg-background text-white p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <Link href="/" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-black uppercase tracking-widest">Profile</h1>
        <button 
          onClick={() => setIsEditing(true)}
          className="text-[9px] font-black uppercase tracking-widest text-primary-yellow"
        >
          Edit
        </button>
      </div>

      {/* Profile Info / Elite Card */}
      <div className="elite-card rounded-[40px] p-8 mb-12 shadow-2xl relative overflow-hidden group border border-[#C9A84C]/20">
        <div className="elite-hologram" />
        <div className="absolute inset-0 opacity-40 group-hover:opacity-60 transition-opacity">
          <Image 
            src="/assets/zenvy_elite_pass_card_1773840133324.png" 
            alt="Elite Pass" 
            fill 
            style={{ objectFit: 'cover' }} 
          />
        </div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-12">
            <div className="w-16 h-16 rounded-full border border-[#C9A84C]/30 p-1 bg-black/40 backdrop-blur-md">
               <div className="w-full h-full bg-gradient-to-br from-[#1C1C1E] to-black rounded-full flex items-center justify-center text-3xl">🧑‍🎓</div>
            </div>
            <div className="text-right">
               <span className="elite-tag text-[10px] bg-primary-yellow text-black px-3 py-1 rounded-full font-black">ZENVY ELITE</span>
               <p className="text-[8px] text-white/50 font-bold uppercase tracking-[0.3em] mt-2">Active Member</p>
            </div>
          </div>
          
          <div className="mb-8">
            <h2 className="text-3xl font-black mb-1">{user?.name}</h2>
            <p className="text-[10px] text-primary-yellow font-bold uppercase tracking-[0.4em]">SRM AP • {user?.hostelBlock} {user?.roomNumber}</p>
          </div>

          <div className="flex justify-between items-center bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/5">
              <div className="flex gap-4">
                <div className="text-center">
                   <p className="text-[7px] text-secondary-text font-bold uppercase tracking-[0.2em]">Orders</p>
                   <p className="text-xs font-black">{user?.totalOrders || 0}</p>
                </div>
                <div className="text-center">
                   <p className="text-[7px] text-secondary-text font-bold uppercase tracking-[0.2em]">Balance</p>
                   <p className="text-xs font-black text-primary-yellow">₹{user?.walletBalance || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-primary-yellow animate-pulse" />
                 <span className="text-[8px] font-black uppercase tracking-widest text-primary-yellow">Status: Active</span>
              </div>
          </div>
        </div>
      </div>

      {/* Account Gourmet Section */}
      <div className="space-y-4">
         <h3 className="text-[9px] font-black text-secondary-text uppercase tracking-[0.3em] pl-4 mb-4">Gourmet Details</h3>
         
         <div className="glass-card p-6 rounded-[34px] border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
               <div>
                  <p className="text-[8px] text-secondary-text font-bold uppercase tracking-widest mb-1">Phone Number</p>
                  <p className="text-sm font-black text-white">+91 {user?.phone}</p>
               </div>
               <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-40">📞</div>
            </div>
            <div className="h-[1px] bg-white/5 w-full" />
            <div className="flex items-center justify-between">
               <div>
                  <p className="text-[8px] text-secondary-text font-bold uppercase tracking-widest mb-1">Hostel Delivery Point</p>
                  <p className="text-sm font-black text-white">{user?.hostelBlock || 'Not Set'} • Room {user?.roomNumber || 'N/A'}</p>
               </div>
               <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-40 text-xs">🏠</div>
            </div>
         </div>

         <Link href="/orders" className="glass-card p-6 rounded-[34px] border border-white/5 flex items-center justify-between group hover:border-[#C9A84C]/20 transition-all mt-4">
            <div className="flex items-center gap-5">
               <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">🥡</div>
               <div>
                  <span className="font-black text-sm block">Order History</span>
                  <span className="text-[9px] text-secondary-text font-bold uppercase tracking-widest">Manage Past Orders</span>
               </div>
            </div>
            <span className="text-white/10 group-hover:text-[#C9A84C] transition-colors">→</span>
         </Link>
      </div>

      {/* Logout */}
      <div className="mt-16 flex flex-col items-center">
        <button 
          onClick={handleLogout}
          className="text-[9px] font-black uppercase tracking-[0.4em] text-red-500/40 hover:text-red-500 transition-all font-serif italic"
        >
           Terminate Session
        </button>
        <div className="mt-8 text-[8px] font-bold text-secondary-text uppercase tracking-[0.5em] opacity-30">
           Zenvy v2.5.0 — Core Architecture
        </div>
      </div>

      {/* Edit Modal (Portal Logic) */}
      {isEditing && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-[380px] space-y-8 animate-in slide-in-from-bottom-10 duration-500">
            <h3 className="text-3xl font-black uppercase tracking-widest text-center">Refine Profile</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-secondary-text uppercase tracking-widest ml-4">Full Name</label>
                <input 
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl h-14 px-6 font-bold outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-secondary-text uppercase tracking-widest ml-4">Block</label>
                  <input 
                    type="text"
                    value={editData.hostelBlock}
                    onChange={(e) => setEditData({ ...editData, hostelBlock: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl h-14 px-6 font-bold outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-secondary-text uppercase tracking-widest ml-4">Room</label>
                  <input 
                    type="text"
                    value={editData.roomNumber}
                    onChange={(e) => setEditData({ ...editData, roomNumber: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl h-14 px-6 font-bold outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <button 
                onClick={() => setIsEditing(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 py-5 rounded-2xl text-[10px] uppercase font-black tracking-widest transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateProfile}
                className="flex-1 bg-primary-yellow text-black py-5 rounded-2xl text-[10px] uppercase font-black tracking-widest shadow-xl shadow-primary-yellow/20 transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <SuccessOverlay 
        isOpen={overlay.isOpen}
        onClose={() => setOverlay(prev => ({ ...prev, isOpen: false }))}
        title={overlay.title}
        message={overlay.message}
        type={overlay.type}
      />
    </main>
  );
}
