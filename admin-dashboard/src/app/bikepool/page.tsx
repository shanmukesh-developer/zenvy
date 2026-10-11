"use client";

import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '@/utils/useAdminAuth';
import { adminRequest as apiRequest } from '@/lib/api';


interface BikePool {
  id: string;
  creatorRole: 'rider' | 'passenger';
  origin: string;
  destination: string;
  departureTime: string;
  splitAmount: number;
  estimatedFuelCost: number;
  genderPreference: string;
  status: 'Available' | 'Matched' | 'Completed' | 'Cancelled';
  paymentStatus: 'Unpaid' | 'Paid';
  vehicleType?: string;
  availableSeats?: number;
  creator?: { id: string; name: string; phone: string; gender: string };
  coRider?: { id: string; name: string; phone: string };
  createdAt: string;
}

const statusColors: Record<string, string> = {
  Available: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Matched: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Completed: 'text-gray-400 bg-white/5 border-white/10',
  Cancelled: 'text-red-400 bg-red-500/10 border-red-500/20',
};

/** fetch against the one backend; throws an Error carrying the server's friendly `message`. */
export default function BikePoolAdmin() {
  const { isAuthed } = useAdminAuth();
  const [pools, setPools] = useState<BikePool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const fetchPools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Admin-only list of every listing. No fallback to the public feed: it hides full and old rides.
      const data = await apiRequest<BikePool[]>('/api/bikepool/admin/all');
      setPools(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load co-ride listings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthed) fetchPools();
  }, [isAuthed, fetchPools]);

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr || '—';
    return d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const runAction = async (pool: BikePool, action: 'force-cancel' | 'mark-paid') => {
    if (busyId) return;
    const route = `${pool.origin} → ${pool.destination}`;
    const question = action === 'force-cancel'
      ? `Cancel the ride ${route} by ${pool.creator?.name || 'this student'}? Riders will no longer see it. This cannot be undone.`
      : `Mark the ride ${route} as paid? Only do this once the co-riders have settled up.`;
    if (!confirm(question)) return;
    setBusyId(pool.id);
    setError(null);
    setNotice(null);
    try {
      const res = await apiRequest<{ message?: string }>(`/api/bikepool/admin/${pool.id}/${action}`, { method: 'POST' });
      setNotice(res?.message || (action === 'force-cancel' ? 'Ride cancelled.' : 'Ride marked as paid.'));
      await fetchPools();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That action failed. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const stats = {
    total: pools.length,
    active: pools.filter(p => p.status === 'Available').length,
    matched: pools.filter(p => p.status === 'Matched').length,
    completed: pools.filter(p => p.status === 'Completed').length,
    cancelled: pools.filter(p => p.status === 'Cancelled').length,
  };

  const filtered = filter === 'all' ? pools : pools.filter(p => p.status === filter);

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <h1 className="text-3xl font-black tracking-tighter text-white">Co-Ride <span className="text-indigo-400">Monitor</span></h1>
        <p className="text-[11px] text-gray-500 uppercase tracking-widest mt-1">Every co-ride listing, newest first. Zenvy does not collect ride money; co-riders settle directly</p>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Available', value: stats.active, color: 'text-blue-400' },
          { label: 'Matched', value: stats.matched, color: 'text-emerald-400' },
          { label: 'Completed', value: stats.completed, color: 'text-gray-400' },
          { label: 'Cancelled', value: stats.cancelled, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="glass-card p-5">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">{s.label}</p>
            <p className={`text-3xl font-black mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-sm font-bold text-red-400 flex justify-between items-center gap-4">
          <span>{error}</span>
          <button onClick={fetchPools} className="text-[10px] font-black uppercase tracking-wider underline">Retry</button>
        </div>
      )}
      {notice && (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-sm font-bold text-emerald-400">{notice}</div>
      )}

      {/* Filter Bar */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'Available', 'Matched', 'Completed', 'Cancelled'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
              filter === f ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
            }`}
          >
            {f}
          </button>
        ))}
        <button onClick={fetchPools} disabled={loading} className="ml-auto disabled:opacity-50 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-400 hover:bg-white/10 transition-all">
          ↻ Refresh
        </button>
      </div>

      {/* Pool List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-600 text-xs italic">
          {error ? 'Listings could not be loaded.' : filter === 'all' ? 'No co-ride listings yet.' : `No ${filter.toLowerCase()} rides.`}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(pool => (
            <div key={pool.id} className="glass-card p-5 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${statusColors[pool.status] || 'text-gray-400'}`}>
                    {pool.status}
                  </span>
                  <span className="ml-2 text-[8px] font-black text-gray-500 uppercase border border-white/10 px-2 py-0.5 rounded-full">
                    {pool.creatorRole === 'rider' ? '🏍️ Rider' : '🎒 Passenger'}
                  </span>
                </div>
                <span className="text-emerald-400 font-black text-sm">{Number(pool.splitAmount) > 0 ? `₹${Number(pool.splitAmount)}/seat` : 'Free'}</span>
              </div>

              <div>
                <p className="text-white font-bold text-sm">{pool.origin} → {pool.destination}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Departs: {formatDateTime(pool.departureTime)}
                  {pool.vehicleType ? ` · ${pool.vehicleType}` : ''}
                  {typeof pool.availableSeats === 'number' ? ` · ${pool.availableSeats} seat${pool.availableSeats === 1 ? '' : 's'} left` : ''}
                </p>
              </div>

              <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-3 text-[10px]">
                <div>
                  <span className="text-gray-600 uppercase tracking-wider block">Creator</span>
                  <span className="text-white font-bold">{pool.creator?.name || 'Unknown'}</span>
                  {pool.creator?.phone && <span className="text-gray-500 block">{pool.creator.phone}</span>}
                </div>
                {pool.coRider && (
                  <div>
                    <span className="text-gray-600 uppercase tracking-wider block">Co-Rider</span>
                    <span className="text-white font-bold">{pool.coRider.name}</span>
                    {pool.coRider.phone && <span className="text-gray-500 block">{pool.coRider.phone}</span>}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center mt-2">
                <div className="flex gap-2 text-[8px] font-black uppercase">
                  <span className="border border-white/10 px-2 py-1 rounded text-gray-500">
                    Gender Pref: {pool.genderPreference || 'Any'}
                  </span>
                  <span className={`border px-2 py-1 rounded ${pool.paymentStatus === 'Paid' ? 'text-emerald-400 border-emerald-500/20' : 'text-amber-400 border-amber-500/20'}`}>
                    {pool.paymentStatus}
                  </span>
                </div>
                <div className="flex gap-2">
                  {pool.paymentStatus === 'Unpaid' && pool.status !== 'Cancelled' && Number(pool.splitAmount) > 0 && (
                    <button 
                      onClick={() => runAction(pool, 'mark-paid')}
                      disabled={busyId === pool.id}
                      className="disabled:opacity-50 px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 text-[8px] font-black uppercase"
                    >
                      ✓ Mark Paid
                    </button>
                  )}
                  {(pool.status === 'Available' || pool.status === 'Matched') && (
                    <button 
                      onClick={() => runAction(pool, 'force-cancel')}
                      disabled={busyId === pool.id}
                      className="disabled:opacity-50 px-2 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded hover:bg-red-500/20 text-[8px] font-black uppercase"
                    >
                      {busyId === pool.id ? '...' : '✕ Cancel Ride'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
