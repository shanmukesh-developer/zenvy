"use client";

import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '@/utils/useAdminAuth';
import api from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';

const getImageUrl = (url: string | null) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

interface WallEvent {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  status: string;
  couponCode: string | null;
  couponValue: number;
  bannerText: string;
  bannerGradient: string;
  winnerUserId: string | null;
  createdAt: string;
  totalSubmissions?: number;
  approvedSubmissions?: number;
  pendingSubmissions?: number;
}

interface WallSubmission {
  id: string;
  eventId: string;
  userId: string;
  imageUrl: string;
  likeCount: number;
  isApproved: boolean;
  createdAt: string;
  user?: { id: string; name: string; profileImage: string | null };
  event?: { id: string; title: string; status: string };
}

const GRADIENT_OPTIONS = [
  { value: 'fire', label: '🔥 Fire', css: 'from-orange-500 via-red-500 to-yellow-500' },
  { value: 'ocean', label: '🌊 Ocean', css: 'from-cyan-500 via-blue-500 to-indigo-500' },
  { value: 'aurora', label: '🌌 Aurora', css: 'from-green-400 via-teal-500 to-purple-500' },
  { value: 'sunset', label: '🌅 Sunset', css: 'from-pink-500 via-orange-400 to-yellow-400' },
  { value: 'neon', label: '💜 Neon', css: 'from-purple-500 via-pink-500 to-blue-500' },
  { value: 'gold', label: '✨ Gold', css: 'from-amber-400 via-yellow-500 to-orange-400' },
];

export default function WallAdmin() {
  const isAuthed = useAdminAuth();
  const [activeTab, setActiveTab] = useState<'events' | 'moderation' | 'fame'>('events');

  // Events state
  const [events, setEvents] = useState<WallEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<WallEvent | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create form
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formBannerText, setFormBannerText] = useState('🔥 LIVE PHOTO CONTEST: Vote for your favourite photos & win instant discount coupons! 📸✨');
  const [formGradient, setFormGradient] = useState('fire');
  const [formCouponCode, setFormCouponCode] = useState('');
  const [formCouponValue, setFormCouponValue] = useState<number>(100);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Moderation state
  const [pendingSubmissions, setPendingSubmissions] = useState<WallSubmission[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [moderatingId, setModeratingId] = useState<string | null>(null);

  // Hall of Fame state
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    if (isAuthed) {
      fetchEvents();
      fetchPending();
      fetchHistory();
    }
  }, [isAuthed]);

  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const res = await api.get('/wall/admin/events');
      setEvents(res.data);
    } catch (err) {
      console.error('[WALL_EVENTS_FETCH]', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchPending = async () => {
    setLoadingPending(true);
    try {
      const res = await api.get('/wall/admin/pending');
      setPendingSubmissions(res.data);
    } catch (err) {
      console.error('[WALL_PENDING_FETCH]', err);
    } finally {
      setLoadingPending(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get('/wall/events/history');
      setHistory(res.data);
    } catch (err) {
      console.error('[WALL_HISTORY_FETCH]', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ── Create Event ──
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formTitle.trim()) { setFormError('Title is required.'); return; }
    if (!formStart || !formEnd) { setFormError('Start and End times are required.'); return; }

    setFormSubmitting(true);
    try {
      await api.post('/wall/events', {
        title: formTitle.trim(),
        description: formDesc.trim(),
        startTime: new Date(formStart).toISOString(),
        endTime: new Date(formEnd).toISOString(),
        bannerText: formBannerText.trim(),
        bannerGradient: formGradient,
        couponCode: formCouponCode.trim() || `WALL-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        couponValue: formCouponValue
      });

      setShowCreateModal(false);
      resetForm();
      fetchEvents();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create event.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // ── Edit Event ──
  const handleEditEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    setFormError('');
    setFormSubmitting(true);

    try {
      await api.put(`/wall/events/${editingEvent.id}`, {
        title: formTitle.trim() || undefined,
        description: formDesc.trim(),
        bannerText: formBannerText.trim(),
        bannerGradient: formGradient,
        couponCode: formCouponCode.trim() || undefined,
        couponValue: formCouponValue,
        endTime: formEnd ? new Date(formEnd).toISOString() : undefined
      });

      setShowEditModal(false);
      setEditingEvent(null);
      resetForm();
      fetchEvents();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update event.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // ── End Event ──
  const handleEndEvent = async (eventId: string) => {
    if (!confirm('End this event now? The winner will be determined by highest votes.')) return;
    setActionLoading(eventId);
    try {
      await api.put(`/wall/events/${eventId}/end`);
      fetchEvents();
      fetchHistory();
    } catch (err: any) {
      alert(err.message || 'Failed to end event.');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Moderate Submissions ──
  const handleApprove = async (submissionId: string) => {
    setModeratingId(submissionId);
    try {
      await api.put(`/wall/admin/submissions/${submissionId}/approve`);
      setPendingSubmissions(prev => prev.filter(s => s.id !== submissionId));
      fetchEvents();
    } catch (err) {
      console.error('[APPROVE_ERR]', err);
    } finally {
      setModeratingId(null);
    }
  };

  const handleReject = async (submissionId: string) => {
    if (!confirm('Reject and permanently delete this submission?')) return;
    setModeratingId(submissionId);
    try {
      await api.put(`/wall/admin/submissions/${submissionId}/reject`);
      setPendingSubmissions(prev => prev.filter(s => s.id !== submissionId));
      fetchEvents();
    } catch (err) {
      console.error('[REJECT_ERR]', err);
    } finally {
      setModeratingId(null);
    }
  };

  const resetForm = () => {
    setFormTitle(''); setFormDesc(''); setFormStart(''); setFormEnd('');
    setFormBannerText('🔥 LIVE PHOTO CONTEST: Vote for your favourite photos & win instant discount coupons! 📸✨');
    setFormGradient('fire'); setFormCouponCode(''); setFormCouponValue(100); setFormError('');
  };

  const openEditModal = (evt: WallEvent) => {
    setEditingEvent(evt);
    setFormTitle(evt.title);
    setFormDesc(evt.description);
    setFormEnd(new Date(evt.endTime).toISOString().slice(0, 16));
    setFormBannerText(evt.bannerText || '');
    setFormGradient(evt.bannerGradient || 'fire');
    setFormCouponCode(evt.couponCode || '');
    setFormCouponValue(evt.couponValue || 100);
    setFormError('');
    setShowEditModal(true);
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return d; }
  };

  const getGradientCss = (value: string) => GRADIENT_OPTIONS.find(g => g.value === value)?.css || GRADIENT_OPTIONS[0].css;

  if (!isAuthed) return <div className="p-20 text-center font-black text-white uppercase tracking-widest animate-pulse">Authenticating...</div>;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <header className="flex justify-between items-center flex-wrap gap-4 bg-white/5 p-8 rounded-[40px] border border-white/5 glass">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-white uppercase">The <span className="text-amber-400">Wall</span> 📸</h1>
          <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-1">Photo Contest Events • Moving Banner • Coupon Management</p>
        </div>
        <div className="flex gap-2">
          {(['events', 'moderation', 'fame'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                activeTab === tab
                  ? 'bg-amber-600 border-amber-500 text-white shadow-[0_0_20px_rgba(217,119,6,0.4)]'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              {tab === 'events' && '📸 Events & Banners'}
              {tab === 'moderation' && <>🖼️ Moderation {pendingSubmissions.length > 0 && <span className="ml-1.5 px-2 py-0.5 text-[9px] bg-red-500 text-white rounded-full font-bold">{pendingSubmissions.length}</span>}</>}
              {tab === 'fame' && '🏆 Hall of Fame'}
            </button>
          ))}
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: Events & Banners */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'events' && (
        <div className="space-y-6">
          {/* Create Event Button */}
          <div className="flex justify-end">
            <button
              onClick={() => {
                resetForm();
                const now = new Date();
                setFormStart(now.toISOString().slice(0, 16));
                const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                setFormEnd(end.toISOString().slice(0, 16));
                setShowCreateModal(true);
              }}
              className="px-6 py-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(217,119,6,0.4)] transition-all flex items-center gap-2"
            >
              <span>✨</span> Launch New Event
            </button>
          </div>

          {/* Events Grid */}
          {loadingEvents ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <div className="py-16 text-center glass-card border border-white/5">
              <p className="text-gray-500 text-sm font-bold">No Wall events created yet.</p>
              <p className="text-gray-600 text-xs mt-1">Launch your first photo contest above!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {events.map(evt => {
                const isActive = evt.status === 'ACTIVE';
                const isEnded = evt.status === 'ENDED';
                const isLive = isActive && new Date(evt.endTime) > new Date();
                return (
                  <div
                    key={evt.id}
                    className={`glass-card p-6 space-y-4 border ${
                      isLive ? 'border-amber-500/30 bg-amber-500/5' : isEnded ? 'border-white/5 opacity-70' : 'border-white/10'
                    }`}
                  >
                    {/* Status + Title */}
                    <div className="flex justify-between items-start gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {isLive && (
                            <span className="px-2 py-0.5 bg-green-500/15 border border-green-500/25 text-green-400 text-[8px] font-black uppercase rounded-full tracking-wider flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> LIVE
                            </span>
                          )}
                          {isEnded && (
                            <span className="px-2 py-0.5 bg-gray-500/15 border border-gray-500/25 text-gray-400 text-[8px] font-black uppercase rounded-full tracking-wider">ENDED</span>
                          )}
                          {isActive && !isLive && (
                            <span className="px-2 py-0.5 bg-red-500/15 border border-red-500/25 text-red-400 text-[8px] font-black uppercase rounded-full tracking-wider">EXPIRED</span>
                          )}
                        </div>
                        <h3 className="text-lg font-black text-white tracking-tight">{evt.title}</h3>
                        {evt.description && <p className="text-xs text-gray-400 line-clamp-2">{evt.description}</p>}
                      </div>
                    </div>

                    {/* Moving Banner Preview */}
                    {evt.bannerText && (
                      <div className={`relative overflow-hidden rounded-xl h-8 bg-gradient-to-r ${getGradientCss(evt.bannerGradient)}`}>
                        <div className="absolute inset-0 flex items-center whitespace-nowrap animate-marquee">
                          <span className="text-[10px] font-black text-white uppercase tracking-wider px-4">
                            {evt.bannerText} &nbsp;&nbsp;&nbsp; {evt.bannerText}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Stats Row */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Total', value: evt.totalSubmissions ?? 0, color: 'text-blue-400' },
                        { label: 'Approved', value: evt.approvedSubmissions ?? 0, color: 'text-green-400' },
                        { label: 'Pending', value: evt.pendingSubmissions ?? 0, color: 'text-amber-400' },
                        { label: 'Coupon', value: `₹${evt.couponValue}`, color: 'text-purple-400' },
                      ].map(stat => (
                        <div key={stat.label} className="bg-white/[0.03] rounded-xl p-2.5 text-center border border-white/5">
                          <p className={`text-sm font-black ${stat.color}`}>{stat.value}</p>
                          <p className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">{stat.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Meta */}
                    <div className="flex justify-between items-center text-[10px] text-gray-500 border-t border-white/5 pt-3">
                      <div>
                        <span className="font-bold text-gray-400">📅</span> {formatDate(evt.startTime)} → {formatDate(evt.endTime)}
                      </div>
                      {evt.couponCode && (
                        <span className="font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[9px] font-bold">
                          {evt.couponCode}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    {!isEnded && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(evt)}
                          className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                        >
                          ✏️ Edit Banner & Coupon
                        </button>
                        <button
                          onClick={() => handleEndEvent(evt.id)}
                          disabled={actionLoading === evt.id}
                          className="py-2.5 px-4 bg-red-500/10 hover:bg-red-500 border border-red-500/25 text-red-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
                        >
                          {actionLoading === evt.id ? '...' : '🏁 End'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: Moderation Queue */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'moderation' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
              <span>🖼️</span> Pending Photo Submissions ({pendingSubmissions.length})
            </h3>
            <button
              onClick={fetchPending}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
            >
              🔄 Refresh
            </button>
          </div>

          {loadingPending ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
            </div>
          ) : pendingSubmissions.length === 0 ? (
            <div className="py-16 text-center glass-card border border-white/5">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-gray-500 text-sm font-bold">Moderation queue is clear!</p>
              <p className="text-gray-600 text-xs mt-1">All submissions have been reviewed.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pendingSubmissions.map(sub => (
                <div key={sub.id} className="glass-card border border-amber-500/15 overflow-hidden">
                  {/* Photo Preview */}
                  <div className="relative aspect-square bg-neutral-900">
                    <img
                      src={getImageUrl(sub.imageUrl)}
                      alt="Submission"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="%23111" width="200" height="200"/><text fill="%23333" x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40">📷</text></svg>'; }}
                    />
                    {/* Event Badge */}
                    {sub.event && (
                      <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg border border-white/10">
                        <span className="text-[8px] font-black text-white uppercase tracking-wider">{sub.event.title}</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {sub.user?.profileImage ? (
                          <img src={getImageUrl(sub.user.profileImage)} alt="" className="w-7 h-7 rounded-full object-cover border border-white/15" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">👤</div>
                        )}
                        <span className="text-xs font-bold text-white">{sub.user?.name || 'Unknown'}</span>
                      </div>
                      <span className="text-[9px] text-gray-500">{formatDate(sub.createdAt)}</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(sub.id)}
                        disabled={moderatingId === sub.id}
                        className="flex-1 py-2.5 bg-red-500/10 border border-red-500/25 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-500/20 transition-all disabled:opacity-50"
                      >
                        ✕ Reject
                      </button>
                      <button
                        onClick={() => handleApprove(sub.id)}
                        disabled={moderatingId === sub.id}
                        className="flex-[2] py-2.5 bg-green-600 hover:bg-green-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
                      >
                        ✓ Approve & Publish
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: Hall of Fame */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'fame' && (
        <div className="space-y-6">
          <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span>🏆</span> Hall of Fame — Past Events & Winners
          </h3>

          {loadingHistory ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="py-16 text-center glass-card border border-white/5">
              <p className="text-4xl mb-3">🏛️</p>
              <p className="text-gray-500 text-sm font-bold">No completed events yet.</p>
              <p className="text-gray-600 text-xs mt-1">Winners will appear here once an event ends.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {history.map((entry: any, i: number) => (
                <div key={entry.event?.id || i} className="glass-card border border-amber-500/10 overflow-hidden">
                  {/* Winner Photo */}
                  {entry.winningSubmission?.imageUrl && (
                    <div className="h-48 bg-neutral-900 relative">
                      <img
                        src={getImageUrl(entry.winningSubmission.imageUrl)}
                        alt="Winner"
                        className="w-full h-full object-cover opacity-80"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-4 flex items-center gap-2">
                        <span className="text-2xl">🏆</span>
                        <div>
                          <p className="text-xs font-black text-amber-400 uppercase tracking-wider">Winner</p>
                          <p className="text-sm font-bold text-white">{entry.winner?.name || 'Unknown'}</p>
                        </div>
                      </div>
                      <div className="absolute bottom-3 right-4 px-2 py-1 bg-black/50 backdrop-blur rounded-lg">
                        <span className="text-[10px] font-black text-red-400">❤️ {entry.winningSubmission?.likeCount || 0} votes</span>
                      </div>
                    </div>
                  )}

                  <div className="p-5 space-y-3">
                    <h4 className="text-md font-black text-white tracking-tight">{entry.event?.title || 'Untitled Event'}</h4>
                    <div className="flex gap-3 text-[10px] text-gray-500">
                      <span>📅 {formatDate(entry.event?.startTime)} → {formatDate(entry.event?.endTime)}</span>
                    </div>
                    {entry.event?.couponCode && (
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Prize Coupon:</span>
                        <span className="font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[10px] font-bold">
                          {entry.event.couponCode} (₹{entry.event.couponValue})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* Create Event Modal */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0D0D15] border border-white/10 rounded-[32px] w-full max-w-2xl overflow-hidden glass shadow-[0_0_50px_rgba(0,0,0,0.8)] max-h-[90vh] overflow-y-auto">
            <header className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02] sticky top-0 z-10">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">✨ Launch Wall Event</h3>
              <button
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center text-lg transition-all"
              >✕</button>
            </header>

            <form onSubmit={handleCreateEvent} className="p-8 space-y-6">
              {formError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs font-bold text-red-400">⚠️ {formError}</div>
              )}

              {/* Title */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Event Title</label>
                <input
                  type="text"
                  placeholder="e.g. Campus Food Aesthetics 📸"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-sm text-white placeholder-gray-600 outline-none focus:border-amber-500/50 transition-all"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Share your most aesthetic food photo..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-sm text-white placeholder-gray-600 outline-none focus:border-amber-500/50 transition-all resize-none"
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                />
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Start Time</label>
                  <input
                    type="datetime-local"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-sm text-white outline-none focus:border-amber-500/50 transition-all"
                    value={formStart}
                    onChange={e => setFormStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">End Time</label>
                  <input
                    type="datetime-local"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-sm text-white outline-none focus:border-amber-500/50 transition-all"
                    value={formEnd}
                    onChange={e => setFormEnd(e.target.value)}
                  />
                </div>
              </div>

              {/* Banner Section */}
              <div className="space-y-4 p-5 bg-white/[0.02] rounded-2xl border border-white/5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-400">🎠 Moving Banner Configuration</h4>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Banner Text</label>
                  <textarea
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-5 text-sm text-white placeholder-gray-600 outline-none focus:border-amber-500/50 transition-all resize-none"
                    value={formBannerText}
                    onChange={e => setFormBannerText(e.target.value)}
                  />
                </div>

                {/* Gradient Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Banner Gradient Style</label>
                  <div className="grid grid-cols-3 gap-2">
                    {GRADIENT_OPTIONS.map(g => (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setFormGradient(g.value)}
                        className={`py-2.5 rounded-xl text-[10px] font-black text-white uppercase tracking-wider transition-all bg-gradient-to-r ${g.css} ${
                          formGradient === g.value ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0D0D15] scale-105' : 'opacity-60 hover:opacity-90'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Preview */}
                {formBannerText && (
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-500">Live Preview</label>
                    <div className={`relative overflow-hidden rounded-xl h-9 bg-gradient-to-r ${getGradientCss(formGradient)}`}>
                      <div className="absolute inset-0 flex items-center whitespace-nowrap animate-marquee">
                        <span className="text-[10px] font-black text-white uppercase tracking-wider px-4">
                          {formBannerText} &nbsp;&nbsp;&nbsp; {formBannerText}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Coupon Section */}
              <div className="space-y-4 p-5 bg-white/[0.02] rounded-2xl border border-white/5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-400">🏷️ Winner Coupon Configuration</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Coupon Code</label>
                    <input
                      type="text"
                      placeholder="Auto-generated if empty"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-sm font-mono text-white placeholder-gray-600 outline-none focus:border-purple-500/50 transition-all uppercase"
                      value={formCouponCode}
                      onChange={e => setFormCouponCode(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Coupon Value (₹)</label>
                    <input
                      type="number"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-sm text-white outline-none focus:border-purple-500/50 transition-all"
                      value={formCouponValue}
                      onChange={e => setFormCouponValue(Number(e.target.value) || 0)}
                    />
                    <div className="flex gap-1.5">
                      {[50, 100, 150, 200].map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setFormCouponValue(v)}
                          className={`px-2 py-1 rounded text-[9px] font-bold transition-all ${
                            formCouponValue === v ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-gray-500 hover:text-white'
                          }`}
                        >
                          ₹{v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-4 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                >Cancel</button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 py-3.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(217,119,6,0.4)] transition-all"
                >{formSubmitting ? 'Launching...' : '🚀 Launch Event'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* Edit Event Modal */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showEditModal && editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0D0D15] border border-white/10 rounded-[32px] w-full max-w-2xl overflow-hidden glass shadow-[0_0_50px_rgba(0,0,0,0.8)] max-h-[90vh] overflow-y-auto">
            <header className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02] sticky top-0 z-10">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">✏️ Edit Event & Banner</h3>
              <button
                onClick={() => { setShowEditModal(false); setEditingEvent(null); resetForm(); }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center text-lg transition-all"
              >✕</button>
            </header>

            <form onSubmit={handleEditEvent} className="p-8 space-y-6">
              {formError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs font-bold text-red-400">⚠️ {formError}</div>
              )}

              {/* Title */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Event Title</label>
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-sm text-white outline-none focus:border-amber-500/50 transition-all"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                />
              </div>

              {/* Extend End Time */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Extend End Time</label>
                <input
                  type="datetime-local"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-sm text-white outline-none focus:border-amber-500/50 transition-all"
                  value={formEnd}
                  onChange={e => setFormEnd(e.target.value)}
                />
                <div className="flex gap-1.5">
                  {[
                    { label: '+6h', hours: 6 },
                    { label: '+12h', hours: 12 },
                    { label: '+1d', hours: 24 },
                    { label: '+3d', hours: 72 },
                  ].map(opt => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        const d = new Date(editingEvent.endTime);
                        d.setHours(d.getHours() + opt.hours);
                        setFormEnd(d.toISOString().slice(0, 16));
                      }}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded text-[9px] font-bold transition-all"
                    >{opt.label}</button>
                  ))}
                </div>
              </div>

              {/* Banner Config */}
              <div className="space-y-4 p-5 bg-white/[0.02] rounded-2xl border border-white/5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-400">🎠 Moving Banner</h4>
                <textarea
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-5 text-sm text-white outline-none focus:border-amber-500/50 transition-all resize-none"
                  value={formBannerText}
                  onChange={e => setFormBannerText(e.target.value)}
                />
                <div className="grid grid-cols-3 gap-2">
                  {GRADIENT_OPTIONS.map(g => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setFormGradient(g.value)}
                      className={`py-2 rounded-xl text-[10px] font-black text-white uppercase tracking-wider transition-all bg-gradient-to-r ${g.css} ${
                        formGradient === g.value ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0D0D15] scale-105' : 'opacity-60 hover:opacity-90'
                      }`}
                    >{g.label}</button>
                  ))}
                </div>
                {formBannerText && (
                  <div className={`relative overflow-hidden rounded-xl h-9 bg-gradient-to-r ${getGradientCss(formGradient)}`}>
                    <div className="absolute inset-0 flex items-center whitespace-nowrap animate-marquee">
                      <span className="text-[10px] font-black text-white uppercase tracking-wider px-4">
                        {formBannerText} &nbsp;&nbsp;&nbsp; {formBannerText}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Coupon Config */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Coupon Code</label>
                  <input
                    type="text"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-sm font-mono text-white outline-none focus:border-purple-500/50 transition-all uppercase"
                    value={formCouponCode}
                    onChange={e => setFormCouponCode(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Coupon Value (₹)</label>
                  <input
                    type="number"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-sm text-white outline-none focus:border-purple-500/50 transition-all"
                    value={formCouponValue}
                    onChange={e => setFormCouponValue(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-4 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingEvent(null); resetForm(); }}
                  className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                >Cancel</button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 py-3.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(217,119,6,0.4)] transition-all"
                >{formSubmitting ? 'Saving...' : '💾 Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Marquee Animation Style */}
      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 12s linear infinite;
        }
      `}</style>
    </div>
  );
}
