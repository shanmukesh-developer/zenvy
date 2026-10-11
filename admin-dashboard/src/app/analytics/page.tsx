"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/utils/useAdminAuth';
import { API_URL } from '@/lib/config';

// ─── Shapes returned by /api/admin/stats, /stats/volume, /health, /reviews ───
interface DashboardStats {
  revenue: string;
  activeRevenue: string;
  orderActivity: string;
  activeFleet: string;
  activeOrders: string;
  localVendorCount: string;
}

interface VolumePoint { hour: string; count: number; timestamp?: string | null }

/** Label in the admin's own time zone when the backend sends an ISO timestamp. */
const pointLabel = (p: VolumePoint) => {
  if (p.timestamp) {
    const d = new Date(p.timestamp);
    if (!Number.isNaN(d.getTime())) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return p.hour;
};

interface Health { database?: string; persistence?: string; timestamp?: string }

interface Review {
  id: string;
  _id?: string;
  user?: { name?: string; phone?: string } | null;
  restaurantName?: string;
  rating: number | null;
  review: string | null;
  createdAt: string;
}

type Section<T> = { data: T | null; error: string | null };

const POLL_MS = 60000;

/** fetch + JSON with friendly errors (never shows raw server internals). */
async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', ...init });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = res.status < 500 && body && typeof body.message === 'string' ? body.message : null;
    throw new Error(msg || (res.status >= 500 ? 'The server ran into a problem. Please try again.' : `Request failed (${res.status}).`));
  }
  return body as T;
}

const settle = async <T,>(p: Promise<T>): Promise<Section<T>> => {
  try { return { data: await p, error: null }; }
  catch (err) { return { data: null, error: err instanceof Error ? err.message : 'Could not load.' }; }
};

const reviewId = (r: Review) => String(r.id || r._id || '');

const ErrorLine = ({ text, onRetry }: { text: string; onRetry: () => void }) => (
  <div className="py-8 text-center">
    <p className="text-xs text-red-400 font-bold">{text}</p>
    <button onClick={onRetry} className="mt-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase text-gray-300 hover:text-white">Try again</button>
  </div>
);

export default function AnalyticsIntel() {
  const { isAuthed } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Section<DashboardStats>>({ data: null, error: null });
  const [volume, setVolume] = useState<Section<VolumePoint[]>>({ data: null, error: null });
  const [health, setHealth] = useState<Section<Health>>({ data: null, error: null });
  const [reviews, setReviews] = useState<Section<Review[]>>({ data: null, error: null });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const deleting = useRef(false);

  const loadAll = useCallback(async (includeReviews: boolean) => {
    const [s, v, h, r] = await Promise.all([
      settle(requestJson<DashboardStats>(`${API_URL}/api/admin/stats`)),
      settle(requestJson<VolumePoint[]>(`${API_URL}/api/admin/stats/volume`)),
      settle(requestJson<Health>(`${API_URL}/api/admin/health`)),
      includeReviews ? settle(requestJson<Review[]>(`${API_URL}/api/admin/reviews`)) : Promise.resolve(null),
    ]);
    setStats(s);
    setVolume({ data: Array.isArray(v.data) ? v.data : v.data ? [] : null, error: v.error });
    setHealth(h);
    if (r) setReviews({ data: Array.isArray(r.data) ? r.data : r.data ? [] : null, error: r.error });
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  const loadReviews = useCallback(async () => {
    const r = await settle(requestJson<Review[]>(`${API_URL}/api/admin/reviews`));
    setReviews({ data: Array.isArray(r.data) ? r.data : r.data ? [] : null, error: r.error });
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    loadAll(true);
    const interval = setInterval(() => {
      if (!document.hidden) loadAll(false);
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [isAuthed, loadAll]);

  const deleteReview = async (rev: Review) => {
    if (deleting.current) return;
    const id = reviewId(rev);
    if (!id) return;
    if (!confirm(`Remove this ${rev.rating ?? ''}★ review by ${rev.user?.name || 'a customer'} for ${rev.restaurantName || 'the store'}? The rating and text are deleted. This cannot be undone.`)) return;
    deleting.current = true;
    setDeletingId(id);
    try {
      await requestJson(`${API_URL}/api/admin/reviews/${id}`, { method: 'DELETE' });
      setReviews(prev => ({ ...prev, data: (prev.data || []).filter(r => reviewId(r) !== id) }));
      setNotice({ kind: 'success', text: 'Review removed.' });
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not remove the review.' });
    } finally {
      deleting.current = false;
      setDeletingId(null);
    }
  };

  if (!isAuthed) return <div className="p-20 text-center font-black text-white uppercase tracking-widest animate-pulse">Checking access…</div>;

  const s = stats.data;
  const metrics = s ? [
    { label: 'Delivered revenue', value: s.revenue, sub: 'Order value of all delivered orders' },
    { label: 'In-progress value', value: s.activeRevenue, sub: `${s.activeOrders} orders not yet delivered or cancelled` },
    { label: 'Total orders', value: Number(s.orderActivity || 0).toLocaleString('en-IN'), sub: 'All orders ever placed' },
    { label: 'Approved riders', value: s.activeFleet, sub: `${s.localVendorCount} active local vendors listed` },
  ] : [];

  const points = volume.data || [];
  const maxCount = Math.max(1, ...points.map(p => p.count));
  const totalLast12h = points.reduce((sum, p) => sum + (p.count || 0), 0);
  const reviewList = reviews.data || [];

  return (
    <div className="space-y-10 animate-fade-in relative pb-20">
      <header className="flex flex-wrap gap-6 justify-between items-center bg-white/5 p-8 rounded-[40px] border border-white/5 glass">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Performance</h2>
          <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">Orders, riders and review moderation</p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && <span className="text-[10px] text-gray-500 font-bold">Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          <button onClick={() => loadAll(true)} className="px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-2xl text-[10px] font-black uppercase">↻ Refresh</button>
        </div>
      </header>

      {notice && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex justify-between items-start gap-4 ${notice.kind === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="text-gray-500 hover:text-white">✕</button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center font-black text-gray-500 animate-pulse tracking-widest uppercase text-xs">Loading metrics…</div>
      ) : (
        <>
          {stats.error ? (
            <div className="glass-card"><ErrorLine text={stats.error} onRetry={() => loadAll(false)} /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {metrics.map(m => (
                <div key={m.label} className="glass-card p-8">
                  <p className="stat-label tracking-[0.2em]">{m.label}</p>
                  <h4 className="text-3xl font-black text-white mt-2">{m.value}</h4>
                  <p className="text-[10px] font-bold text-gray-500 mt-2">{m.sub}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
            <div className="glass-card p-10 space-y-6 xl:col-span-2">
              <div className="flex justify-between items-baseline">
                <h3 className="text-xl font-black tracking-tighter uppercase text-white">Orders per hour</h3>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Last 12 hours · {totalLast12h} orders</span>
              </div>
              {volume.error ? (
                <ErrorLine text={volume.error} onRetry={() => loadAll(false)} />
              ) : points.length === 0 ? (
                <p className="py-16 text-center text-xs text-gray-500">No orders in the last 12 hours.</p>
              ) : (
                <>
                  <div className="h-48 flex items-end gap-2 pt-6">
                    {points.map((p, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${pointLabel(p)}: ${p.count} orders`}>
                        <span className="text-[9px] font-black text-gray-300">{p.count}</span>
                        <div className="w-full bg-blue-500/60 rounded-t-lg" style={{ height: `${Math.max(4, (p.count / maxCount) * 100)}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 text-[8px] font-black text-gray-500 uppercase tracking-widest">
                    {points.map((p, i) => <span key={i} className="flex-1 text-center">{pointLabel(p)}</span>)}
                  </div>
                  <p className="text-[9px] text-gray-600">Hours with no orders are not shown. Hour labels use the server clock.</p>
                </>
              )}
            </div>

            <div className="glass-card p-10 space-y-4">
              <h3 className="text-xl font-black tracking-tighter uppercase text-white">System</h3>
              {health.error ? (
                <ErrorLine text={health.error} onRetry={() => loadAll(false)} />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div>
                      <p className="text-sm font-bold text-white">API server</p>
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Responding</p>
                    </div>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-md border text-emerald-500 bg-emerald-500/10 border-emerald-500/20">Online</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div>
                      <p className="text-sm font-bold text-white">Database</p>
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{health.data?.database || 'Unknown'}</p>
                    </div>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${health.data?.persistence === 'PERSISTENT' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-500 bg-amber-500/10 border-amber-500/20'}`}>
                      {health.data?.persistence === 'PERSISTENT' ? 'Persistent' : 'Not persistent'}
                    </span>
                  </div>
                  {health.data?.persistence && health.data.persistence !== 'PERSISTENT' && (
                    <p className="text-[10px] text-amber-400">The server is running on a temporary database. Data will be lost on restart.</p>
                  )}
                  <Link href="/analytics/rewards" className="block p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20 text-xs font-bold text-blue-400 hover:bg-blue-500/10">
                    Rewards analytics →
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-10 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black tracking-tighter uppercase text-white">Recent reviews</h3>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-500 uppercase tracking-widest">{reviewList.length} latest written reviews</span>
                <button onClick={loadReviews} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase text-gray-300 hover:text-white">↻</button>
              </div>
            </div>

            {reviews.error ? (
              <ErrorLine text={reviews.error} onRetry={loadReviews} />
            ) : reviewList.length === 0 ? (
              <p className="text-xs text-gray-500 py-10 text-center">No written reviews yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reviewList.map(rev => {
                  const id = reviewId(rev);
                  return (
                    <div key={id} className="p-5 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-3">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2 gap-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                          {rev.user?.name || 'Customer'}
                          <span className="text-gray-500 ml-2">→ {rev.restaurantName || 'Store'}</span>
                        </span>
                        {rev.rating != null && <span className="text-amber-400 font-black text-sm whitespace-nowrap">★ {rev.rating}</span>}
                      </div>
                      <p className="text-sm text-gray-300 break-words">{rev.review}</p>
                      <div className="flex justify-between items-center pt-2 border-t border-white/5">
                        <span className="text-[9px] text-gray-500 font-mono">{new Date(rev.createdAt).toLocaleString()}</span>
                        <button
                          onClick={() => deleteReview(rev)}
                          disabled={deletingId !== null}
                          className="px-4 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-40"
                        >
                          {deletingId === id ? 'Removing…' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
