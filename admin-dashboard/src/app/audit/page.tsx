"use client";
import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/utils/useAdminAuth';
import { API_URL } from '@/lib/config';

interface AuditLog {
  id: string;
  adminId: string | null;
  targetId: string | null;
  action: string | null;
  details: string | null;
  timestamp: string;
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

const shortRef = (v: string | null) => {
  if (!v) return '—';
  return v.length > 12 ? `${v.slice(0, 8)}…` : v;
};

/** Pretty-print JSON details ({"code":"X"} → code: X) and leave plain text alone. */
const formatDetails = (raw: string | null) => {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ');
    }
  } catch { /* plain text */ }
  return raw;
};

const actionTone = (action: string) => {
  if (/DELETE|BAN|REJECT|REVOKE/.test(action)) return 'text-red-400 bg-red-400/5 border-red-400/10';
  if (/CREATE|APPROVE|SETTLED|REFUND/.test(action)) return 'text-emerald-400 bg-emerald-400/5 border-emerald-400/10';
  if (/UPDATE|CHANGE/.test(action)) return 'text-blue-400 bg-blue-400/5 border-blue-400/10';
  return 'text-amber-400 bg-amber-400/5 border-amber-400/10';
};

export default function AuditPage() {
  const { isAuthed, user } = useAdminAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async (nextPage = 1) => {
    setLoading(true);
    try {
      const data = await requestJson<AuditLog[] | { logs?: AuditLog[]; total?: number; pages?: number }>(`${API_URL}/api/admin/audit?page=${nextPage}`);
      const list = Array.isArray(data) ? data : Array.isArray(data?.logs) ? data.logs : [];
      setLogs(list);
      setTotal(!Array.isArray(data) && typeof data?.total === 'number' ? data.total : list.length);
      setPages(!Array.isArray(data) && typeof data?.pages === 'number' ? Math.max(1, data.pages) : 1);
      setPage(nextPage);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the audit log.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthed) fetchLogs(1);
  }, [isAuthed, fetchLogs]);

  if (!isAuthed) return <div className="p-20 text-center font-black text-white uppercase tracking-widest animate-pulse">Checking access…</div>;

  const q = search.trim().toLowerCase();
  const visible = logs.filter(log =>
    !q || [log.action, log.adminId, log.targetId, log.details].some(v => String(v || '').toLowerCase().includes(q))
  );
  const myId = user?.id ? String(user.id) : '';

  return (
    <div className="space-y-8 animate-fade-in relative pb-20">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-white uppercase">Audit log</h1>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">{total} admin actions (refunds, payouts, coupons, deletions…) · page {page} of {pages}</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Filter this page: action, admin, target…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-sm text-white outline-none focus:border-blue-500/50 transition-all w-72"
          />
          <button onClick={() => fetchLogs(page)} disabled={loading} className="px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-2xl text-[10px] font-black uppercase disabled:opacity-40">↻ Refresh</button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                {['Time', 'Action', 'Admin', 'Target', 'Details'].map(h => (
                  <th key={h} className="px-6 py-4 text-[10px] uppercase font-black tracking-widest text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-xs text-gray-500 animate-pulse">Loading audit log…</td></tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-xs text-red-400 font-bold">{error}</p>
                    <button onClick={() => fetchLogs(page)} className="mt-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase text-gray-300 hover:text-white">Try again</button>
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-xs text-gray-500">{q ? 'No entries on this page match your search.' : 'No admin actions recorded yet.'}</td></tr>
              ) : (
                visible.map((log) => {
                  const action = log.action || 'UNKNOWN';
                  const details = formatDetails(log.details);
                  return (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors align-top">
                      <td className="px-6 py-4 text-[11px] text-gray-400 font-medium whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase border whitespace-nowrap ${actionTone(action)}`}>{action.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-6 py-4 text-[10px] font-mono text-white/80" title={log.adminId || ''}>
                        {myId && log.adminId === myId ? 'You' : shortRef(log.adminId)}
                      </td>
                      <td className="px-6 py-4 text-[10px] font-mono text-gray-500" title={log.targetId || ''}>{shortRef(log.targetId)}</td>
                      <td className="px-6 py-4 text-[11px] text-gray-400 max-w-md break-words">{details || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-white/5 px-6 py-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button disabled={loading || page <= 1} onClick={() => fetchLogs(page - 1)} className="px-5 py-2 bg-black/40 border border-white/10 rounded-xl text-[10px] font-black uppercase text-gray-400 hover:text-white disabled:opacity-30">Newer</button>
              <button disabled={loading || page >= pages} onClick={() => fetchLogs(page + 1)} className="px-5 py-2 bg-black/40 border border-white/10 rounded-xl text-[10px] font-black uppercase text-gray-400 hover:text-white disabled:opacity-30">Older</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
