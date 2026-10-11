'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/utils/useAdminAuth';
import { motion } from 'framer-motion';
import { API_URL } from '@/lib/config';

interface TopPerformer {
  name: string;
  completedOrders: number;
  zenPoints: number;
  tier: string;
}

interface AnalyticsData {
  totalSpinsEarned: number;
  totalSpinsUsed: number;
  totalZenPoints: number;
  activeRewardUsers: number;
  badgeDistribution: Record<string, number>;
  tierDistribution: Record<string, number>;
  topPerformers: TopPerformer[];
  redemptionRate: number | string;
}

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

export default function RewardsAnalytics() {
  const { isAuthed } = useAdminAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await requestJson<AnalyticsData>(`${API_URL}/api/admin/rewards-analytics`);
      setData({
        totalSpinsEarned: Number(d?.totalSpinsEarned || 0),
        totalSpinsUsed: Number(d?.totalSpinsUsed || 0),
        totalZenPoints: Number(d?.totalZenPoints || 0),
        activeRewardUsers: Number(d?.activeRewardUsers || 0),
        badgeDistribution: d?.badgeDistribution || {},
        tierDistribution: d?.tierDistribution || {},
        topPerformers: Array.isArray(d?.topPerformers) ? d.topPerformers : [],
        redemptionRate: d?.redemptionRate ?? 0,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load rewards analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthed) load();
  }, [isAuthed, load]);

  if (!isAuthed) return <div className="p-20 text-center font-black text-white uppercase tracking-widest animate-pulse">Checking access…</div>;

  if (loading && !data) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  if (!data) return (
    <div className="py-20 text-center">
      <p className="text-sm text-red-400 font-bold">{error || 'Could not load rewards analytics.'}</p>
      <button onClick={load} className="mt-4 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase text-gray-300 hover:text-white">Try again</button>
    </div>
  );

  const tierTotal = Object.values(data.tierDistribution).reduce((s, n) => s + (Number(n) || 0), 0);
  const badges = Object.entries(data.badgeDistribution);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap gap-4 justify-between items-end">
        <div className="flex flex-col gap-2">
          <h2 className="text-4xl font-black text-white tracking-tight">Rewards analytics</h2>
          <p className="text-gray-400 font-medium">ZenPoints, lucky spins, badges and tiers across all students.</p>
        </div>
        <button onClick={load} disabled={loading} className="px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-2xl text-[10px] font-black uppercase disabled:opacity-40">{loading ? 'Refreshing…' : '↻ Refresh'}</button>
      </div>
      {error && <p className="text-xs text-red-400 font-bold">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="ZenPoints held" value={data.totalZenPoints.toLocaleString('en-IN')} icon="💎" color="blue" />
        <StatCard title="Spins used / earned" value={`${data.totalSpinsUsed} / ${data.totalSpinsEarned}`} icon="🎡" color="amber" />
        <StatCard title="Students with orders" value={data.activeRewardUsers.toLocaleString('en-IN')} icon="👥" color="emerald" />
        <StatCard title="Spin redemption" value={`${data.redemptionRate}%`} icon="🔥" color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="glass p-8 rounded-3xl border border-white/5">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-blue-500">📊</span> Tier distribution
          </h3>
          {tierTotal === 0 ? (
            <p className="text-xs text-gray-500">No students yet.</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(data.tierDistribution).map(([tier, count]) => (
                <div key={tier} className="space-y-2">
                  <div className="flex justify-between text-xs font-black uppercase tracking-widest">
                    <span className={tier === 'None' ? 'text-gray-500' : 'text-slate-300'}>{tier === 'None' ? 'No tier yet' : tier}</span>
                    <span className="text-white">{count}</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(Number(count) / tierTotal) * 100}%` }}
                      className={`h-full ${getTierColor(tier)}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass p-8 rounded-3xl border border-white/5">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-yellow-500">🏆</span> Top customers by orders
          </h3>
          {data.topPerformers.length === 0 ? (
            <p className="text-xs text-gray-500">No completed orders yet.</p>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                    <th className="pb-4">Student</th>
                    <th className="pb-4">Orders</th>
                    <th className="pb-4">Points</th>
                    <th className="pb-4">Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.topPerformers.map((user, i) => (
                    <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="py-4"><p className="text-sm font-bold text-white">{user.name || 'Student'}</p></td>
                      <td className="py-4 text-sm text-slate-400 font-mono">{user.completedOrders || 0}</td>
                      <td className="py-4 text-sm text-blue-400 font-bold">{user.zenPoints || 0}</td>
                      <td className="py-4">
                        <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-tighter ${getTierBadgeStyle(user.tier)}`}>
                          {user.tier === 'None' ? '—' : user.tier}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="glass p-8 rounded-3xl border border-white/5">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <span className="text-rose-500">🎖️</span> Badges earned
        </h3>
        {badges.length === 0 ? (
          <p className="text-xs text-gray-500">No badges earned yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {badges.map(([badge, count]) => (
              <div key={badge} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col items-center justify-center text-center gap-2 group hover:border-blue-500/30 transition-all">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                  {getBadgeIcon(badge)}
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase leading-tight">{badge}</p>
                <p className="text-lg font-black text-white leading-none">{count}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string; icon: string; color: string }) {
  const colors = {
    blue: 'from-blue-600/20 to-transparent border-blue-500/20 text-blue-500',
    amber: 'from-amber-600/20 to-transparent border-amber-500/20 text-amber-500',
    emerald: 'from-emerald-600/20 to-transparent border-emerald-500/20 text-emerald-500',
    rose: 'from-rose-600/20 to-transparent border-rose-500/20 text-rose-500'
  };

  return (
    <div className={`glass p-6 rounded-3xl border bg-gradient-to-br ${colors[color as keyof typeof colors]}`}>
      <div className="flex justify-between items-start mb-4">
        <span className="text-2xl">{icon}</span>
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-3xl font-black text-white tracking-tighter">{value}</p>
      </div>
    </div>
  );
}

function getTierColor(tier: string) {
  switch (tier) {
    case 'Elite': return 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-[0_0_15px_rgba(147,51,234,0.5)]';
    case 'Diamond': return 'bg-gradient-to-r from-blue-400 to-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]';
    case 'Platinum': return 'bg-gradient-to-r from-slate-300 to-slate-100 shadow-[0_0_15px_rgba(255,255,255,0.3)]';
    case 'Gold': return 'bg-gradient-to-r from-amber-500 to-yellow-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]';
    case 'Silver': return 'bg-gradient-to-r from-slate-500 to-slate-400';
    case 'Bronze': return 'bg-gradient-to-r from-orange-700 to-orange-600';
    default: return 'bg-white/10';
  }
}

function getTierBadgeStyle(tier: string) {
    switch (tier) {
      case 'Elite': return 'bg-purple-500/20 text-purple-400 border border-purple-500/20';
      case 'Diamond': return 'bg-blue-400/20 text-blue-400 border border-blue-400/20';
      case 'Platinum': return 'bg-slate-200/20 text-slate-100 border border-slate-200/20';
      case 'Gold': return 'bg-amber-500/20 text-amber-500 border border-amber-500/20';
      case 'Silver': return 'bg-slate-500/20 text-slate-400 border border-slate-500/20';
      case 'Bronze': return 'bg-orange-700/20 text-orange-600 border border-orange-700/20';
      default: return 'bg-gray-500/20 text-gray-500 border border-gray-500/20';
    }
}

function getBadgeIcon(badge: string) {
    if (badge.includes('Beginner') || badge.includes('Bat') || badge.includes('Believer')) return '🌑';
    if (badge.includes('Scaler') || badge.includes('Shadow') || badge.includes('Streaker')) return '🌙';
    if (badge.includes('Grafter') || badge.includes('Ghost') || badge.includes('Guardian')) return '🌕';
    if (badge.includes('Pro') || badge.includes('Phantom') || badge.includes('Persistence')) return '⭐';
    if (badge.includes('Devotee') || badge.includes('Drifter') || badge.includes('Dynamo')) return '💎';
    if (badge.includes('Eater')) return '⚡';
    return '🔰';
}
