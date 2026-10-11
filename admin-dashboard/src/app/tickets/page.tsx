"use client";

import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '@/utils/useAdminAuth';
import { API_URL } from '@/lib/config';

type TicketStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: string;
  slaBreachAt: string | null;
  createdAt: string;
  orderId?: string | null;
  adminResponse?: string | null;
  user?: { name: string | null; phone: string | null } | null;
}

const STATUSES: TicketStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];
type Filter = 'active' | 'all' | TicketStatus;

// Quick replies reflect how Zenvy works today: COD + Wallet only, and the delivery PIN lives in the customer's app.
const QUICK_REPLIES = [
  { label: 'Expedited', text: 'Sorry for the delay. We have flagged your order as urgent with our campus delivery team.' },
  { label: 'Wallet refund', text: 'We have reviewed your order and refunded the amount to your Zenvy Wallet. You can see it in the Wallet section of the app.' },
  { label: 'Rider at gate', text: 'Your delivery partner is waiting at the hostel gate. Please share the delivery PIN shown on your order tracking screen to receive the order.' },
  { label: 'Need details', text: 'Thanks for reaching out. Could you share a few more details (order time, item names, a photo if relevant) so we can sort this out?' },
];

async function readError(res: Response, fallback: string): Promise<string> {
  if (res.status === 401) return 'Your session has expired. Please sign in again.';
  if (res.status === 403) return 'You do not have permission to do that.';
  if (res.status >= 500) return 'The server had a problem. Please try again in a moment.';
  const data = await res.json().catch(() => null);
  return data && typeof data.message === 'string' && data.message.length < 200 ? data.message : fallback;
}

const errorText = (err: unknown, fallback: string) =>
  err instanceof TypeError ? 'Could not reach the server. Check your connection.' : (err as Error)?.message || fallback;

export default function SupportTickets() {
  const { isAuthed } = useAdminAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>('active');
  const [, setNow] = useState(0);

  const fetchTickets = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`${API_URL}/api/tickets/admin`, { cache: 'no-store' });
      if (!res.ok) throw new Error(await readError(res, 'Could not load support tickets.'));
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(errorText(err, 'Could not load support tickets.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    fetchTickets();
  }, [isAuthed, fetchTickets]);

  // Re-render every minute so SLA countdowns stay accurate.
  useEffect(() => {
    const t = setInterval(() => setNow(n => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const saveTicket = async (ticket: Ticket, body: { status?: TicketStatus; adminResponse?: string }) => {
    if (savingId) return false;
    setSavingId(ticket.id);
    setRowError(prev => ({ ...prev, [ticket.id]: '' }));
    try {
      const res = await fetch(`${API_URL}/api/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readError(res, 'Could not update this ticket.'));
      const updated = await res.json().catch(() => null);
      // Update only this ticket so unsent drafts on other tickets are kept.
      setTickets(prev => prev.map(t => (t.id === ticket.id
        ? { ...t, status: updated?.status ?? body.status ?? t.status, adminResponse: updated?.adminResponse ?? body.adminResponse ?? t.adminResponse }
        : t)));
      return true;
    } catch (err) {
      setRowError(prev => ({ ...prev, [ticket.id]: errorText(err, 'Could not update this ticket.') }));
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const updateStatus = (ticket: Ticket, status: TicketStatus) => {
    if (status === 'Closed' && !confirm(`Close "${ticket.subject}"? The customer will be notified.`)) return;
    if (status === 'Resolved' && !confirm(`Mark "${ticket.subject}" as resolved? The customer will be notified.`)) return;
    saveTicket(ticket, { status });
  };

  const sendReply = async (ticket: Ticket) => {
    const reply = replies[ticket.id]?.trim();
    if (!reply) return;
    const nextStatus: TicketStatus | undefined = ticket.status === 'Open' ? 'In Progress' : undefined;
    const ok = await saveTicket(ticket, { adminResponse: reply, ...(nextStatus ? { status: nextStatus } : {}) });
    if (ok) setReplies(prev => { const next = { ...prev }; delete next[ticket.id]; return next; });
  };

  const getSlaStatus = (breachAt: string | null) => {
    if (!breachAt) return { text: 'No SLA', color: 'text-zinc-500' };
    const diffMs = new Date(breachAt).getTime() - Date.now();
    if (diffMs < 0) return { text: 'BREACHED', color: 'text-red-500 font-bold bg-red-500/10 px-2 py-1 rounded border border-red-500/20' };
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return { text: `${hours}h ${mins}m left`, color: hours < 2 ? 'text-amber-500' : 'text-emerald-500' };
  };

  const priorityColors: Record<string, string> = {
    Critical: 'text-red-500',
    High: 'text-orange-400',
    Medium: 'text-amber-400',
    Low: 'text-emerald-500',
  };

  const isActive = (t: Ticket) => t.status === 'Open' || t.status === 'In Progress';
  const activeCount = tickets.filter(isActive).length;
  const visible = tickets.filter(t => (filter === 'all' ? true : filter === 'active' ? isActive(t) : t.status === filter));

  if (!isAuthed) return <div className="p-20 text-center font-black text-white uppercase tracking-widest animate-pulse">Checking access…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-white">Support Tickets</h1>
          <p className="text-[11px] text-gray-500 uppercase tracking-widest mt-1">
            {activeCount} Active &middot; {tickets.length} Total
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['active', 'all', ...STATUSES] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === f ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
            >
              {f === 'active' ? 'Active' : f === 'all' ? 'All' : f}
            </button>
          ))}
          <button onClick={() => { setLoading(true); fetchTickets(); }} disabled={loading} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40">Refresh</button>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-4 text-sm font-bold text-red-300">
          <span>{loadError}</span>
          <button onClick={() => { setLoading(true); fetchTickets(); }} className="text-xs uppercase tracking-widest text-white hover:underline">Retry</button>
        </div>
      )}

      <div className="grid gap-4">
        {loading && tickets.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 animate-pulse font-bold">Loading tickets…</div>
        ) : visible.map(ticket => {
          const sla = getSlaStatus(ticket.slaBreachAt);
          const saving = savingId === ticket.id;
          const draft = replies[ticket.id] ?? '';
          return (
            <div key={ticket.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col gap-4 hover:border-zinc-700 transition-colors">
              <div className="flex flex-wrap gap-3 justify-between items-start">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-white break-words">{ticket.subject}</h3>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    <span className="font-bold">{ticket.user?.name || 'Customer'}</span>
                    {ticket.user?.phone && (
                      <a href={`tel:${ticket.user.phone}`} className="text-sky-400 hover:text-sky-300 ml-2 font-mono text-xs">
                        {ticket.user.phone}
                      </a>
                    )}
                    <span className="text-zinc-600 font-mono ml-2 text-[10px]">#{ticket.id.slice(0, 8)}</span>
                    {ticket.orderId && <span className="text-zinc-500 font-mono ml-2 text-[10px]">Order #{ticket.orderId.slice(-6).toUpperCase()}</span>}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-1">Opened {new Date(ticket.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-[10px] uppercase tracking-widest font-black ${priorityColors[ticket.priority] || 'text-blue-500'}`}>
                    {ticket.priority} Priority
                  </span>
                  {isActive(ticket) && (
                    <span className={`text-[12px] uppercase tracking-widest ${sla.color}`}>SLA: {sla.text}</span>
                  )}
                </div>
              </div>

              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/50">
                <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">{ticket.description}</p>
              </div>

              {ticket.adminResponse && (
                <div className="bg-blue-500/5 p-4 rounded-xl border border-blue-500/20">
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-1">Last reply sent to customer</p>
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">{ticket.adminResponse}</p>
                </div>
              )}

              <div className="bg-zinc-950/60 border border-blue-500/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">Reply (customer gets a push notification)</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[8px] font-black uppercase text-zinc-500 tracking-wider">Quick insert:</span>
                    {QUICK_REPLIES.map(tpl => (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => setReplies(prev => ({ ...prev, [ticket.id]: tpl.text }))}
                        className="text-[9px] font-bold px-2 py-0.5 bg-white/5 hover:bg-white/10 text-zinc-300 rounded border border-white/10 transition-colors"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={draft}
                  onChange={e => setReplies(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                  placeholder="Type your response to the customer or pick a quick insert above…"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-blue-500/60 resize-none transition-all"
                />
                <button
                  onClick={() => sendReply(ticket)}
                  disabled={!!savingId || !draft.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                >
                  {saving ? 'Sending…' : 'Send reply'}
                </button>
              </div>

              {rowError[ticket.id] && <p role="alert" className="text-sm font-bold text-red-400">{rowError[ticket.id]}</p>}

              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-xs font-bold text-zinc-500">Status:</span>
                {STATUSES.map(status => (
                  <button
                    key={status}
                    onClick={() => updateStatus(ticket, status)}
                    disabled={ticket.status === status || !!savingId}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:cursor-not-allowed ${
                      ticket.status === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-50'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {!loading && !loadError && visible.length === 0 && (
          <div className="p-12 text-center text-zinc-500 bg-zinc-900/50 rounded-2xl border border-zinc-800/50">
            {tickets.length === 0 ? 'No support tickets yet.' : 'No tickets match this filter.'}
          </div>
        )}
      </div>
    </div>
  );
}
