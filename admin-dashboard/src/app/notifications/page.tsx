"use client";
import { useState } from 'react';
import api from '@/lib/api';

const BROADCAST_PRESETS = [
  {
    id: 'flash-drop',
    label: '⚡ 60% Flash Drop',
    title: '⚡ FLASH DROP LIVE: 60% OFF for 20 Mins!',
    body: 'Midnight cravings unlocked! Grab Cheese Maggi & Cold Coffee at 60% OFF before timer runs out.',
    category: 'flash_drop',
  },
  {
    id: 'room-pool',
    label: '👥 Zero Fee Room Party',
    title: '👥 Room Cart Party Active • ₹0 Delivery Fee!',
    body: 'Pool your cart with roommates in your block tonight and enjoy ₹0 delivery fee on all food orders.',
    category: 'room_pool',
  },
  {
    id: 'night-owl',
    label: '🌙 Late Night Kitchen Alert',
    title: '🌙 Night Mess Express Delivery: 12 Mins Flat',
    body: 'Kitchen is operating at peak speed tonight. Fresh hot rolls and sandwiches dispatched immediately.',
    category: 'announcement',
  },
  {
    id: 'challenge',
    label: '🏆 Hostel Leaderboard Update',
    title: '🏆 Campus Challenge Alert: Boost Your Block!',
    body: 'Kaveri Block has taken the #1 lead with 74 orders! Place an order now to earn points for your hostel.',
    category: 'challenge',
  },
];

const HOSTEL_BLOCKS = [
  'All Campus Blocks',
  'Aryabhata Block',
  'Kaveri Block',
  'Ganga Block',
  'Vedavathi Block',
  'Sarvepalli Block',
  'Yamuna Block',
  'Girls Hostels (All)',
];

export default function NotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetBlock, setTargetBlock] = useState('All Campus Blocks');
  const [category, setCategory] = useState('announcement');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const applyPreset = (preset: typeof BROADCAST_PRESETS[0]) => {
    setTitle(preset.title);
    setBody(preset.body);
    setCategory(preset.category);
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) {
      setStatus({ type: 'error', message: 'Title and Body are required.' });
      return;
    }

    try {
      setSending(true);
      setStatus(null);
      const res = await api.post('/admin/broadcast-push', { 
        title, 
        body,
        targetBlock: targetBlock === 'All Campus Blocks' ? undefined : targetBlock,
        category,
      });
      setStatus({ 
        type: 'success', 
        message: res.data.message || `Broadcast sent successfully to ${targetBlock}!` 
      });
      setTitle('');
      setBody('');
    } catch (err: any) {
      console.error('Failed to send notification:', err);
      setStatus({ 
        type: 'error', 
        message: err.response?.data?.message || err.message || 'Failed to send broadcast push notification.' 
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto text-white">
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase tracking-widest text-emerald-400">
          Campus Notification Command Center
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Broadcast real-time push notifications, flash drop tickers, and emergency announcements to student devices.
        </p>
      </div>

      {/* Preset Pills */}
      <div className="mb-6">
        <label className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2 block">
          Quick 1-Tap Presets
        </label>
        <div className="flex flex-wrap gap-2">
          {BROADCAST_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              className="bg-white/5 hover:bg-emerald-500/20 hover:border-emerald-500/50 border border-white/10 px-4 py-2 rounded-xl text-xs font-bold text-gray-200 transition-all flex items-center gap-1.5"
            >
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-2 bg-[#141416] border border-white/10 rounded-3xl p-8">
          <form onSubmit={handleSendNotification} className="flex flex-col gap-5">
            {status && (
              <div className={`p-4 rounded-xl border font-bold text-sm ${status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                {status.message}
              </div>
            )}

            {/* Target Hostel Block */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-300 tracking-wider">Target Audience</label>
              <select
                value={targetBlock}
                onChange={(e) => setTargetBlock(e.target.value)}
                className="bg-black/50 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-emerald-500 transition-colors"
              >
                {HOSTEL_BLOCKS.map((b) => (
                  <option key={b} value={b} className="bg-[#141416] text-white">
                    📍 {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-300 tracking-wider">Notification Title</label>
              <input 
                type="text" 
                placeholder="e.g., ⚡ Midnight Flash Drop: 60% OFF!" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                className="bg-black/50 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-gray-600"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-300 tracking-wider">Notification Body</label>
              <textarea 
                placeholder="e.g., Aryabhata & Kaveri Blocks: Order Double Cheese Maggi for ₹29 before midnight!" 
                value={body} 
                onChange={(e) => setBody(e.target.value)} 
                className="bg-black/50 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-emerald-500 transition-colors min-h-[120px] placeholder:text-gray-600"
                required
              />
            </div>

            <div className="pt-4 border-t border-white/10 mt-2 flex justify-end">
              <button 
                type="submit" 
                disabled={sending}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2"
              >
                <span>{sending ? 'Broadcasting...' : `Broadcast to ${targetBlock} 🚀`}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Live Device Preview Column */}
        <div className="flex flex-col gap-4">
          <div className="text-xs font-black uppercase tracking-wider text-gray-400">
            📱 Mobile Lock Screen Preview
          </div>

          <div className="bg-[#181A22] border border-white/10 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-red-500 to-amber-500 flex items-center justify-center text-[10px] font-black text-white">
                  Z
                </div>
                <span className="text-xs font-extrabold tracking-wide text-white">ZENVY CAMPUS</span>
              </div>
              <span className="text-[10px] text-gray-400">Just now</span>
            </div>

            <div className="text-xs font-black text-white mb-1">
              {title || '⚡ Flash Drop Alert / Campus Update'}
            </div>
            <div className="text-[11px] text-gray-300 line-clamp-3">
              {body || 'Your broadcast text will appear here on students\' lock screens and heads-up banners.'}
            </div>

            <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                Target: {targetBlock}
              </span>
              <span className="text-[9px] text-gray-500">Tap to open app</span>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 text-xs text-blue-200">
            <h4 className="font-bold text-blue-400 mb-1 flex items-center gap-1.5">
              <span>ℹ️</span> Multi-Channel Delivery
            </h4>
            <p className="opacity-85 leading-relaxed text-[11px]">
              This broadcast triggers:
              <br />• <b>FCM Cloud Push</b> to active student device tokens
              <br />• <b>WebSockets live toast</b> for students currently in the app
              <br />• <b>Campus Live Radar ticker</b> update across hostel blocks
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
