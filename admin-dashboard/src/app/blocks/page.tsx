"use client";
import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/utils/useAdminAuth';
import { API_URL } from '@/lib/config';

interface BlockStats {
  name: string;
  count: number;
}

const REFRESH_MS = 30000;

export default function BlockWarsHUD() {
  const { isAuthed } = useAdminAuth();
  const [stats, setStats] = useState<BlockStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const fetchStats = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const res = await fetch(`${API_URL}/api/blocks/activity`, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status >= 500 ? 'The server had a problem loading block activity.' : `Could not load block activity (${res.status}).`);
      const data = await res.json();
      if (signal?.cancelled) return;
      setStats(Array.isArray(data) ? data.filter((s: any) => s && typeof s.name === 'string').map((s: any) => ({ name: s.name, count: Number(s.count) || 0 })) : []);
      setUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      if (signal?.cancelled) return;
      setError(err instanceof TypeError ? 'Could not reach the server. Check your connection.' : (err as Error).message);
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    const signal = { cancelled: false };
    fetchStats(signal);
    const timer = setInterval(() => fetchStats(signal), REFRESH_MS);
    return () => {
      signal.cancelled = true;
      clearInterval(timer);
    };
  }, [isAuthed, fetchStats]);

  const total = stats.reduce((acc, curr) => acc + curr.count, 0);
  const maxCount = Math.max(...stats.map(s => s.count), 1);
  const leader = total > 0 ? stats[0] : null;

  if (!isAuthed) return <div className="p-20 text-center font-black text-white uppercase tracking-widest animate-pulse">Checking access…</div>;

  return (
    <div className="space-y-10 animate-fade-in relative pb-20">
      <header className="flex flex-wrap gap-6 justify-between items-center bg-white/5 p-8 rounded-[40px] border border-white/5 glass">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Block <span className="text-blue-500">Wars</span></h2>
          <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">Delivered orders per hostel block · last 30 days</p>
          {updatedAt && <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-2">Updated {updatedAt.toLocaleTimeString()} · refreshes every 30s</p>}
        </div>
        <div className="glass px-10 py-4 rounded-3xl border border-white/10 flex flex-col items-center">
          <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Delivered orders (30d)</span>
          <span className="text-3xl font-black text-white tracking-tighter">{loading ? '—' : total}</span>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-4 text-sm font-bold text-red-300">
          <span>{error}{stats.length > 0 ? ' Showing the last loaded numbers.' : ''}</span>
          <button onClick={() => { setLoading(stats.length === 0); fetchStats(); }} className="text-xs uppercase tracking-widest text-white hover:underline">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="py-20 text-center font-black text-gray-500 animate-pulse tracking-widest uppercase">Loading block activity…</div>
        ) : stats.length === 0 ? (
          !error && <div className="py-20 text-center text-gray-500 font-bold">No hostel blocks configured.</div>
        ) : stats.map((block, i) => {
          const ranked = total > 0 && block.count > 0;
          return (
            <div key={block.name} className="glass-card p-10 relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-8">
                  <div className={`w-12 h-12 rounded-[1.5rem] flex items-center justify-center text-xl font-black ${
                    !ranked ? 'bg-white/5 text-gray-600' :
                    i === 0 ? 'bg-blue-600 text-white' :
                    i === 1 ? 'bg-slate-700 text-slate-300' :
                    i === 2 ? 'bg-amber-900/40 text-amber-600' : 'bg-white/5 text-gray-500'
                  }`}>
                    {ranked ? i + 1 : '–'}
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-white uppercase tracking-tight">{block.name}</h4>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Hostel block</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Orders delivered</span>
                  <span className="text-3xl font-black text-white">{block.count}</span>
                </div>
              </div>
              <div className="mt-8 w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${i === 0 && ranked ? 'bg-blue-500' : 'bg-white/20'}`}
                  style={{ width: `${(block.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {!loading && stats.length > 0 && (
        <div className="glass-card p-10 border-blue-500/20 bg-blue-500/[0.02]">
          <div className="flex items-center gap-6">
            <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-xl">🏆</div>
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wider">{leader ? `${leader.name} is leading` : 'No deliveries in the last 30 days'}</h4>
              <p className="text-xs text-gray-500 leading-relaxed max-w-2xl">
                {leader
                  ? 'Counts only delivered orders from users who saved a hostel block in their profile. Use Config to announce block-specific offers.'
                  : 'Rankings appear once delivered orders come in from users who have saved their hostel block.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
