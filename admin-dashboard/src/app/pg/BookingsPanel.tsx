"use client";
import { useCallback, useEffect, useState } from 'react';
import { FIELD, PGBooking, formatDate, pgRequest } from './pgApi';

const STATUS_STYLE: Record<string, string> = {
  Pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  Confirmed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  Cancelled: 'border-white/10 text-gray-400',
};

/** Booking requests from the app (GET /api/pg/admin/bookings). Confirming takes a bed; cancelling a confirmed one frees it. */
export function BookingsPanel({ onPendingCount }: { onPendingCount: (n: number) => void }) {
  const [status, setStatus] = useState('Pending');
  const [bookings, setBookings] = useState<PGBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = status === 'All' ? '' : `?status=${encodeURIComponent(status)}`;
      const data = await pgRequest<PGBooking[]>(`/api/pg/admin/bookings${query}`);
      const list = Array.isArray(data) ? data : [];
      setBookings(list);
      if (status === 'Pending') onPendingCount(list.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load booking requests.');
    } finally {
      setLoading(false);
    }
  }, [status, onPendingCount]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (booking: PGBooking, next: 'Confirmed' | 'Cancelled') => {
    if (busy[booking.id]) return;
    const who = booking.user?.name || 'the student';
    const where = `${booking.hostel?.name || 'this PG'}${booking.room ? `, room ${booking.room.roomNumber}` : ''}`;
    const question = next === 'Confirmed'
      ? `Confirm ${who}'s booking at ${where}?\n\nThis reserves one bed and notifies the student.`
      : `Cancel ${who}'s booking at ${where}?${booking.status === 'Confirmed' ? '\n\nThe reserved bed is released.' : ''} The student is notified.`;
    if (!window.confirm(question)) return;
    setBusy(prev => ({ ...prev, [booking.id]: true }));
    setNotice(null);
    try {
      const res = await pgRequest<{ message?: string; booking?: Partial<PGBooking> }>(`/api/pg/admin/bookings/${booking.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: next }),
      });
      setNotice({ kind: 'ok', text: res?.message || `Booking ${next.toLowerCase()}.` });
      await load();
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'Could not update the booking.' });
    } finally {
      setBusy(prev => ({ ...prev, [booking.id]: false }));
    }
  };

  return (
    <section className="space-y-4" aria-label="Booking requests">
      <div className="flex flex-wrap items-center gap-3">
        <select value={status} onChange={e => setStatus(e.target.value)} className={`${FIELD} w-auto`} aria-label="Status">
          <option value="Pending">Pending</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Cancelled">Cancelled</option>
          <option value="All">All</option>
        </select>
        <button type="button" disabled={loading} onClick={load} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white disabled:opacity-50">{loading ? 'Loading…' : 'Refresh'}</button>
        <p className="text-xs text-gray-500">Students also get a WhatsApp link to the housing desk when they request. Confirm here once you have spoken to them.</p>
      </div>

      {notice && (
        <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm ${notice.kind === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-semibold opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}<button type="button" onClick={load} className="font-bold underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div role="status" className="rounded-lg border border-white/10 p-8 text-sm text-gray-400">Loading booking requests…</div>
      ) : !error && bookings.length === 0 ? (
        <div className="rounded-lg border border-white/10 p-10 text-center">
          <h2 className="font-bold">No {status === 'All' ? '' : `${status.toLowerCase()} `}booking requests</h2>
          <p className="mt-2 text-sm text-gray-400">Requests appear here when students book a room in the app.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-gray-500">
              <tr><th className="p-3">Student</th><th className="p-3">PG & room</th><th className="p-3">Check-in</th><th className="p-3">Requested</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {bookings.map(b => (
                <tr key={b.id}>
                  <td className="p-3">
                    <p className="font-semibold text-white">{b.user?.name || 'Unknown student'}</p>
                    <p className="text-xs text-gray-500">{b.user?.phone || 'No phone'}{b.user?.email ? ` · ${b.user.email}` : ''}</p>
                  </td>
                  <td className="p-3">
                    <p className="text-gray-200">{b.hostel?.name || 'PG removed'}</p>
                    <p className="text-xs text-gray-500">{b.room ? `Room ${b.room.roomNumber} · ${b.room.sharingType} seater · ${b.room.availableBeds} free` : 'Room removed'}</p>
                  </td>
                  <td className="p-3 text-gray-300">{formatDate(b.checkInDate)}</td>
                  <td className="p-3 text-gray-400">{formatDate(b.createdAt, true)}</td>
                  <td className="p-3"><span className={`rounded border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[b.status] || STATUS_STYLE.Cancelled}`}>{b.status}</span></td>
                  <td className="p-3 text-right">
                    {b.status === 'Pending' && (
                      <button type="button" disabled={!!busy[b.id] || !b.room || b.room.availableBeds <= 0} title={b.room && b.room.availableBeds <= 0 ? 'No free beds in this room' : undefined} onClick={() => changeStatus(b, 'Confirmed')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40">Confirm</button>
                    )}
                    {b.status !== 'Cancelled' && (
                      <button type="button" disabled={!!busy[b.id]} onClick={() => changeStatus(b, 'Cancelled')} className="ml-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:border-red-500/40 hover:text-red-300 disabled:opacity-40">Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
