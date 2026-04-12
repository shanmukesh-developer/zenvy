"use client";
import React, { useState, useEffect, useRef } from 'react';

interface RiderProfilePageProps {
  driver: { _id: string; name: string; token: string };
  apiUrl: string;
  onClose: () => void;
  onUpdate?: (data: { name: string; photoUrl: string }) => void;
}

interface ProfileData {
  name: string;
  phone: string;
  vehicleType: string;
  vehicleNumber: string;
  bio: string;
  emergencyContact: string;
  photoUrl: string;
  totalEarnings: number;
  averageRating: number;
  totalRatings: number;
  zenPoints: number;
  isApproved: boolean;
}

export default function RiderProfilePage({ driver, apiUrl, onClose, onUpdate }: RiderProfilePageProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [form, setForm] = useState<Partial<ProfileData>>({});
  const photoRef = useRef<HTMLInputElement>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/delivery/profile`, {
        headers: { 'Authorization': `Bearer ${driver.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setForm(data);
      }
    } catch (err) { console.error('Profile fetch failed:', err); }
  };

  useEffect(() => { fetchProfile(); }, []);

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${apiUrl}/api/upload`, { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        setForm(prev => ({ ...prev, photoUrl: data.imageUrl }));
      }
    } catch { alert('Photo upload failed.'); }
    setUploadingPhoto(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/api/delivery/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${driver.token}` },
        body: JSON.stringify({
          name: form.name,
          vehicleType: form.vehicleType,
          vehicleNumber: form.vehicleNumber,
          bio: form.bio,
          emergencyContact: form.emergencyContact,
          photoUrl: form.photoUrl
        })
      });
      if (res.ok) {
        await fetchProfile();
        setEditing(false);
        if (onUpdate) onUpdate({ name: form.name || '', photoUrl: form.photoUrl || '' });
      } else {
        const d = await res.json();
        alert(d.message || 'Update failed.');
      }
    } catch { alert('Network error.'); }
    setSaving(false);
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  const displayPhoto = form.photoUrl || profile.photoUrl;

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white pb-32">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0A0A0B]/90 backdrop-blur-xl border-b border-white/5 px-5 py-4 flex items-center justify-between">
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-sm font-black uppercase tracking-widest">
          ← Back
        </button>
        <h1 className="text-sm font-black uppercase tracking-widest text-white">Rider Profile</h1>
        {editing ? (
          <button onClick={handleSave} disabled={saving} className="text-emerald-400 hover:text-emerald-300 text-sm font-black uppercase tracking-widest disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        ) : (
          <button onClick={() => setEditing(true)} className="text-emerald-400 hover:text-emerald-300 text-sm font-black uppercase tracking-widest">
            Edit
          </button>
        )}
      </div>

      <div className="max-w-lg mx-auto px-5 pt-8 space-y-6">
        {/* Photo */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-28 h-28 rounded-[28px] overflow-hidden border-2 border-emerald-500/30 bg-slate-800 shadow-2xl shadow-emerald-500/10">
              {displayPhoto ? (
                <img src={displayPhoto} alt="Rider" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl">🛵</div>
              )}
            </div>
            {editing && (
              <button
                onClick={() => photoRef.current?.click()}
                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm shadow-lg hover:bg-emerald-500 transition-all"
              >
                {uploadingPhoto ? '⏳' : '📷'}
              </button>
            )}
            <input ref={photoRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoCapture} />
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-white">{profile.name}</p>
            <div className="flex items-center gap-2 justify-center mt-1">
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${profile.isApproved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                {profile.isApproved ? '✅ Verified Rider' : '⏳ Pending Approval'}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/3 rounded-2xl p-4 text-center border border-white/5">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Rating</p>
            <p className="text-xl font-black text-yellow-400">⭐ {profile.averageRating?.toFixed(1)}</p>
            <p className="text-[9px] text-gray-600 mt-0.5">{profile.totalRatings} reviews</p>
          </div>
          <div className="bg-white/3 rounded-2xl p-4 text-center border border-white/5">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Earned</p>
            <p className="text-xl font-black text-emerald-400">₹{Math.round(profile.totalEarnings || 0)}</p>
            <p className="text-[9px] text-gray-600 mt-0.5">lifetime</p>
          </div>
          <div className="bg-white/3 rounded-2xl p-4 text-center border border-white/5">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">ZenPts</p>
            <p className="text-xl font-black text-blue-400">{profile.zenPoints || 0}</p>
            <p className="text-[9px] text-gray-600 mt-0.5">points</p>
          </div>
        </div>

        {/* Personal Info */}
        <div className="bg-[#111113] border border-white/5 rounded-[28px] p-5 space-y-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Personal Information</p>
          
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Full Name</label>
            {editing ? (
              <input value={form.name || ''} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold outline-none focus:border-emerald-500/50 transition-all" />
            ) : (
              <p className="text-white font-bold text-sm">{profile.name}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Mobile Number</label>
            <p className="text-white font-bold text-sm flex items-center gap-2">
              📱 {profile.phone}
              <span className="text-[9px] text-gray-600">(Contact your admin to change)</span>
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Emergency Contact</label>
            {editing ? (
              <input type="tel" value={form.emergencyContact || ''} onChange={(e) => setForm(p => ({ ...p, emergencyContact: e.target.value }))}
                placeholder="+91 XXXXX XXXXX"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold outline-none focus:border-emerald-500/50 transition-all placeholder:text-gray-600" />
            ) : (
              <p className="text-white font-bold text-sm">{profile.emergencyContact || '—'}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Bio / About</label>
            {editing ? (
              <textarea value={form.bio || ''} onChange={(e) => setForm(p => ({ ...p, bio: e.target.value }))}
                placeholder="e.g. 2 years of delivery experience, always on time!"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold outline-none focus:border-emerald-500/50 transition-all resize-none placeholder:text-gray-600" />
            ) : (
              <p className="text-gray-300 text-sm">{profile.bio || '—'}</p>
            )}
          </div>
        </div>

        {/* Vehicle Info */}
        <div className="bg-[#111113] border border-white/5 rounded-[28px] p-5 space-y-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Vehicle Information</p>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Vehicle Type</label>
            {editing ? (
              <select value={form.vehicleType || ''} onChange={(e) => setForm(p => ({ ...p, vehicleType: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold outline-none focus:border-emerald-500/50 transition-all">
                <option value="">Select type</option>
                <option value="Scooter">🛵 Scooter</option>
                <option value="Bike">🏍️ Bike</option>
                <option value="Cycle">🚲 Cycle</option>
                <option value="Auto">🛺 Auto</option>
                <option value="Car">🚗 Car</option>
              </select>
            ) : (
              <p className="text-white font-bold text-sm">{profile.vehicleType || '—'}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Vehicle Number</label>
            {editing ? (
              <input value={form.vehicleNumber || ''} onChange={(e) => setForm(p => ({ ...p, vehicleNumber: e.target.value.toUpperCase() }))}
                placeholder="AP 39 XX 0000"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold outline-none focus:border-emerald-500/50 transition-all placeholder:text-gray-600 tracking-widest" />
            ) : (
              <p className="text-white font-bold text-sm tracking-widest">{profile.vehicleNumber || '—'}</p>
            )}
          </div>
        </div>

        {/* Identity Card Preview — shown to customers during tracking */}
        <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/20 border border-emerald-500/20 rounded-[28px] p-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-4">Customer-Facing Identity Card</p>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-emerald-500/30 bg-slate-800 shrink-0">
              {displayPhoto ? (
                <img src={displayPhoto} alt="Rider" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">🛵</div>
              )}
            </div>
            <div>
              <p className="font-black text-white">{form.name || profile.name}</p>
              <p className="text-[10px] text-emerald-400 font-black">{form.vehicleType || profile.vehicleType || 'Rider'} · {form.vehicleNumber || profile.vehicleNumber || 'No plate'}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-yellow-400 text-xs">⭐</span>
                <span className="text-xs font-black text-white">{profile.averageRating?.toFixed(1)}</span>
                <span className="text-[9px] text-gray-500">({profile.totalRatings} ratings)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
