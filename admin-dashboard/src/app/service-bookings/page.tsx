"use client";

import { useEffect, useRef, useState } from 'react';
import { API_URL } from '@/lib/config';
import { useAdminAuth } from '@/utils/useAdminAuth';
import { useAdminSocket } from '@/components/AdminSocketProvider';
import { useLiveSync } from '@/lib/useLiveSync';

interface ServiceBooking {
  id: string;
  userId: string;
  serviceType: string;
  title: string;
  description?: string;
  specifications?: Record<string, unknown>;
  attachmentUrl?: string;
  status: string;
  quotedAmount?: number;
  finalAmount?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  pickupSlot?: string;
  hostelBlock?: string;
  roomNumber?: string;
  deliveryAddress?: string;
  contactPhone?: string;
  assignedPartnerId?: string;
  driverDetails?: { name?: string; phone?: string } | null;
  trackingHistory?: { stage?: string; timestamp?: string; note?: string }[];
  createdAt: string;
  updatedAt: string;
}

const STATUSES = ['', 'REQUESTED', 'DIAGNOSED_QUOTED', 'CONFIRMED', 'IN_PROGRESS', 'READY_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'];
// Same list as ServiceBooking.serviceType on the backend.
const SERVICE_TYPES = ['', 'LAPTOP_REPAIR', 'PHONE_REPAIR', 'MOBILE_REPAIR', 'TAILORING', 'PRINTOUT', 'LAUNDRY', 'ROOM_SHIFTING', 'AUTO_RIDE', 'BIKE_TAXI', 'STATION_CAB', 'CLEANING', 'PG_BOOKING', 'MATTRESS_DELIVERY', 'ELECTRONICS_DELIVERY', 'GROCERY_DELIVERY', 'PHARMACY_DELIVERY', 'GENERAL'];
const CLOSED_STATUSES = ['COMPLETED', 'CANCELLED'];

const money = (value?: number) => (value ? `₹${Number(value).toLocaleString('en-IN')}` : null);
const formatDate = (value?: string) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';
};
const specLabel = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

async function readError(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) return 'Your session has expired. Please sign in again.';
  if (response.status >= 500) return `${fallback} (server error ${response.status}). Please try again.`;
  return (data && typeof data.message === 'string' && data.message) || `${fallback} (${response.status}).`;
}

const labelFor = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());

export default function ServiceBookingsPage() {
  const { isAuthed } = useAdminAuth();
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [status, setStatus] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [hostelBlock, setHostelBlock] = useState('');
  const [search, setSearch] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { socket } = useAdminSocket();

  // The block filter is free text: query the server once typing pauses, not on every keystroke.
  const [blockQuery, setBlockQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setBlockQuery(hostelBlock.trim()), 400);
    return () => clearTimeout(t);
  }, [hostelBlock]);

  // Live reloads: the legacy socket events and `admin:changed` both fire for one change, so bursts are
  // coalesced into one quiet reload (no spinner) instead of one full reload per event.
  const quietReload = useRef(false);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveRefresh = useRef(() => {});
  liveRefresh.current = () => {
    if (liveTimer.current) return;
    liveTimer.current = setTimeout(() => {
      liveTimer.current = null;
      quietReload.current = true;
      setRefreshCount(count => count + 1);
    }, 800);
  };
  useEffect(() => () => { if (liveTimer.current) clearTimeout(liveTimer.current); }, []);

  // Reload when a booking is created or cancelled by a customer.
  useEffect(() => {
    if (!socket) return;
    const onChange = () => liveRefresh.current();
    socket.on('newServiceBooking', onChange);
    socket.on('serviceCancelled', onChange);
    socket.on('serviceQuoteAccepted', onChange);
    return () => {
      socket.off('newServiceBooking', onChange);
      socket.off('serviceCancelled', onChange);
      socket.off('serviceQuoteAccepted', onChange);
    };
  }, [socket]);

  // Realtime sync: the backend sends `admin:changed` { type: 'service_booking' } for bookings.
  useLiveSync(['service_booking'], () => liveRefresh.current(), { enabled: isAuthed });

  const replaceBooking = (updated: ServiceBooking) => setBookings(prev => prev.map(b => (b.id === updated.id ? { ...b, ...updated } : b)));

  useEffect(() => {
    const controller = new AbortController();
    const quiet = quietReload.current;
    quietReload.current = false;
    const loadBookings = async () => {
      if (!quiet) {
        setLoading(true);
        setError('');
      }
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (serviceType) params.set('serviceType', serviceType);
      if (blockQuery) params.set('hostelBlock', blockQuery);
      try {
        const response = await fetch(`${API_URL}/api/services/admin/all?${params.toString()}`, {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await readError(response, 'Could not load bookings'));
        const data = await response.json().catch(() => ({}));
        setBookings(Array.isArray(data.bookings) ? data.bookings : []);
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof TypeError ? 'Could not reach the server. Check your connection and try again.' : loadError instanceof Error ? loadError.message : 'Could not load service bookings.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadBookings();
    return () => controller.abort();
  }, [status, serviceType, blockQuery, refreshCount]);

  const filtered = bookings.filter(booking => {
    const query = search.trim().toLowerCase();
    return !query || [booking.id, booking.title, booking.serviceType, booking.hostelBlock, booking.contactPhone, booking.userId]
      .some(value => value != null && String(value).toLowerCase().includes(query));
  });

  if (!isAuthed) return <div className="p-10 text-center text-sm text-gray-400" role="status">Checking your admin session…</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 text-white md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Campus Operations</p>
          <h1 className="mt-1 text-2xl font-black">Service Bookings</h1>
          <p className="mt-2 text-sm text-gray-400">Review repair, laundry, printout, ride and campus service requests, send quotes and move them through their stages. All bookings are cash on delivery.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{filtered.length} of {bookings.length} bookings</span>
          <button type="button" onClick={() => setRefreshCount(value => value + 1)} disabled={loading} className="border border-white/10 px-4 py-2 text-sm font-bold text-gray-300 hover:text-white disabled:opacity-50">{loading ? 'Refreshing...' : 'Refresh'}</button>
        </div>
      </header>

      <section className="grid gap-3 border border-white/10 bg-white/[0.02] p-4 md:grid-cols-4" aria-label="Booking filters">
        <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-gray-400">Status
          <select value={status} onChange={event => setStatus(event.target.value)} className="mt-1 w-full border border-white/10 bg-[#111318] p-2.5 text-sm text-white">
            <option value="">All statuses</option>{STATUSES.filter(Boolean).map(value => <option key={value} value={value}>{labelFor(value)}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-gray-400">Service type
          <select value={serviceType} onChange={event => setServiceType(event.target.value)} className="mt-1 w-full border border-white/10 bg-[#111318] p-2.5 text-sm text-white">
            <option value="">All service types</option>{SERVICE_TYPES.filter(Boolean).map(value => <option key={value} value={value}>{labelFor(value)}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-gray-400">Hostel block
          <input value={hostelBlock} onChange={event => setHostelBlock(event.target.value)} placeholder="Any block" className="mt-1 w-full border border-white/10 bg-[#111318] p-2.5 text-sm font-normal text-white placeholder:text-gray-600" />
        </label>
        <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-gray-400">Search
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Title, phone, ID" className="mt-1 w-full border border-white/10 bg-[#111318] p-2.5 text-sm font-normal text-white placeholder:text-gray-600" />
        </label>
      </section>

      {error && <div role="alert" className="flex items-center justify-between gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}<button type="button" onClick={() => setRefreshCount(value => value + 1)} className="font-bold underline">Retry</button></div>}

      {loading ? <div role="status" className="border border-white/10 p-8 text-sm text-gray-400">Loading service bookings...</div> : filtered.length === 0 ? (
        <div className="border border-white/10 p-10 text-center"><h2 className="font-bold">No matching service bookings</h2><p className="mt-2 text-sm text-gray-400">Requests will appear here when students book a campus service.</p></div>
      ) : (
        <section className="divide-y divide-white/10 border border-white/10" aria-label="Service booking list">
          {filtered.map(booking => (
            <article key={booking.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold">{booking.title}</h2>
                    <span className="border border-sky-400/20 bg-sky-400/5 px-2 py-1 text-xs font-bold text-sky-300">{labelFor(booking.serviceType)}</span>
                    <span className="border border-white/10 px-2 py-1 text-xs font-bold text-gray-300">{labelFor(booking.status)}</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">#{booking.id.slice(-8).toUpperCase()} · {formatDate(booking.createdAt)}</p>
                </div>
                <button type="button" aria-expanded={expandedId === booking.id} onClick={() => setExpandedId(current => current === booking.id ? null : booking.id)} className="border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 hover:text-white">{expandedId === booking.id ? 'Hide details' : 'View details'}</button>
              </div>
              <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="text-xs uppercase tracking-wider text-gray-500">Student</p><p className="mt-1">{booking.contactPhone || booking.userId}</p></div>
                <div><p className="text-xs uppercase tracking-wider text-gray-500">Pickup</p><p className="mt-1">{[booking.hostelBlock, booking.roomNumber].filter(Boolean).join(' · ') || booking.deliveryAddress || 'Not specified'}</p></div>
                <div><p className="text-xs uppercase tracking-wider text-gray-500">Slot</p><p className="mt-1">{booking.pickupSlot || 'Not specified'}</p></div>
                <div><p className="text-xs uppercase tracking-wider text-gray-500">Estimate / final</p><p className="mt-1">{money(booking.quotedAmount) || 'Quote pending'} / {money(booking.finalAmount) || '—'}</p></div>
              </div>
              {expandedId === booking.id && (
                <div className="mt-5 grid gap-5 border-t border-white/10 pt-5 lg:grid-cols-2">
                  <div className="space-y-3 text-sm">
                    <div><p className="text-xs uppercase tracking-wider text-gray-500">Description</p><p className="mt-1 whitespace-pre-wrap text-gray-200">{booking.description || 'No description provided.'}</p></div>
                    <div><p className="text-xs uppercase tracking-wider text-gray-500">Payment</p><p className="mt-1">{booking.paymentMethod && booking.paymentMethod !== 'COD' ? `${booking.paymentMethod} (legacy)` : 'Cash on delivery'} · {booking.paymentStatus || 'Pending'}</p></div>
                    <div><p className="text-xs uppercase tracking-wider text-gray-500">Assigned partner</p><p className="mt-1">{booking.driverDetails?.name || booking.assignedPartnerId || 'Unassigned'}</p></div>
                    {booking.attachmentUrl && <Attachment url={booking.attachmentUrl} id={booking.id} />}
                  </div>
                  <div className="space-y-3">
                    <div><p className="text-xs uppercase tracking-wider text-gray-500">Specifications</p>{Object.entries(booking.specifications || {}).filter(([key, value]) => key !== 'catalogueItemId' && value !== null && value !== '' && typeof value !== 'object').length ? (
                      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border border-white/10 bg-black/20 p-3 text-xs">
                        {Object.entries(booking.specifications || {}).filter(([key, value]) => key !== 'catalogueItemId' && value !== null && value !== '' && typeof value !== 'object').map(([key, value]) => (
                          <div key={key} className="contents"><dt className="text-gray-500">{specLabel(key)}</dt><dd className="text-gray-200">{String(value)}</dd></div>
                        ))}
                      </dl>
                    ) : <p className="mt-1 text-xs text-gray-500">None</p>}</div>
                    <div><p className="text-xs uppercase tracking-wider text-gray-500">Tracking history</p><ol className="mt-2 space-y-2">{(booking.trackingHistory || []).map((event, index) => <li key={`${event.timestamp || ''}-${index}`} className="border-l border-emerald-400/40 pl-3 text-xs"><span className="font-bold text-emerald-300">{event.stage || 'Update'}</span><span className="ml-2 text-gray-500">{formatDate(event.timestamp)}</span><p className="mt-1 text-gray-400">{event.note || ''}</p></li>)}{!booking.trackingHistory?.length && <li className="text-xs text-gray-500">No tracking events recorded.</li>}</ol></div>
                  </div>
                </div>
              )}
              {/* keyed by updatedAt: a live change (customer cancel / quote accepted) resets the form to the real stage */}
              {expandedId === booking.id && <BookingActions key={`${booking.id}-${booking.updatedAt}`} booking={booking} onUpdated={replaceBooking} />}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
/**
 * The customer app sends photos inline as data: URLs. Browsers block opening a data: URL in a new tab,
 * so show the photo here and offer a download instead.
 */
function Attachment({ url, id }: { url: string; id: string }) {
  const isDataImage = /^data:image\//i.test(url);
  const isHttp = /^https?:\/\//i.test(url);
  if (isDataImage) {
    const ext = (/^data:image\/(\w+)/i.exec(url)?.[1] || 'jpg').toLowerCase();
    return (
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-gray-500">Attachment</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} loading="lazy" decoding="async" alt="Photo attached by the customer" className="max-h-64 rounded border border-white/10 object-contain" />
        <a className="inline-block font-bold text-emerald-300 underline" href={url} download={`booking-${id.slice(-8)}.${ext === 'jpeg' ? 'jpg' : ext}`}>Download photo</a>
      </div>
    );
  }
  if (isHttp) return <a className="inline-block font-bold text-emerald-300 underline" href={url} target="_blank" rel="noreferrer">Open attachment</a>;
  return null;
}

/** Admin update: stage, quote / final amount and a note for the customer (PATCH /api/services/:id/status). */
function BookingActions({ booking, onUpdated }: { booking: ServiceBooking; onUpdated: (b: ServiceBooking) => void }) {
  const [nextStatus, setNextStatus] = useState(booking.status);
  const [quoted, setQuoted] = useState(booking.quotedAmount ? String(booking.quotedAmount) : '');
  const [finalAmount, setFinalAmount] = useState(booking.finalAmount ? String(booking.finalAmount) : '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const closed = CLOSED_STATUSES.includes(booking.status);

  const amount = (value: string, label: string) => {
    if (value.trim() === '') return { value: undefined };
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 100000) return { error: `${label} must be between ₹0 and ₹1,00,000.` };
    return { value: Math.round(n * 100) / 100 };
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const q = amount(quoted, 'Quote');
    const f = amount(finalAmount, 'Final amount');
    if (q.error || f.error) return setMessage({ kind: 'error', text: (q.error || f.error) as string });
    const statusChanged = nextStatus !== booking.status;
    const quoteChanged = q.value !== undefined && q.value !== (booking.quotedAmount || 0);
    const finalChanged = f.value !== undefined && f.value !== (booking.finalAmount || 0);
    if (!statusChanged && !quoteChanged && !finalChanged && !note.trim()) return setMessage({ kind: 'error', text: 'Nothing to update.' });
    if (nextStatus === 'CANCELLED' && statusChanged && !window.confirm('Cancel this booking? The customer will see it as cancelled.')) return;
    if (nextStatus === 'DIAGNOSED_QUOTED' && statusChanged && !(q.value || booking.quotedAmount)) return setMessage({ kind: 'error', text: 'Enter the quote before sending it to the customer.' });

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_URL}/api/services/${booking.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(statusChanged ? { status: nextStatus } : {}),
          ...(quoteChanged ? { quotedAmount: q.value } : {}),
          ...(finalChanged ? { finalAmount: f.value } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Could not update the booking'));
      const data = await response.json().catch(() => ({}));
      if (data?.booking) onUpdated(data.booking);
      setNote('');
      setMessage({ kind: 'ok', text: 'Booking updated. Customers with the app open see the change right away.' });
    } catch (updateError) {
      setMessage({ kind: 'error', text: updateError instanceof TypeError ? 'Could not reach the server. Check your connection and try again.' : updateError instanceof Error ? updateError.message : 'Could not update the booking.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="mt-5 border-t border-white/10 pt-5" aria-label="Update booking">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Update booking</p>
      {closed && <p className="mb-3 text-xs text-gray-500">This booking is {labelFor(booking.status).toLowerCase()}. You can still correct the amounts or add a note.</p>}
      <div className="grid gap-3 md:grid-cols-4">
        <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-gray-400">Stage
          <select value={nextStatus} onChange={event => setNextStatus(event.target.value)} className="mt-1 w-full border border-white/10 bg-[#111318] p-2.5 text-sm text-white">
            {STATUSES.filter(Boolean).map(value => <option key={value} value={value}>{labelFor(value)}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-gray-400">Quote (₹)
          <input inputMode="decimal" value={quoted} onChange={event => setQuoted(event.target.value)} placeholder="Quote pending" className="mt-1 w-full border border-white/10 bg-[#111318] p-2.5 text-sm font-normal text-white placeholder:text-gray-600" />
        </label>
        <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-gray-400">Final amount (₹)
          <input inputMode="decimal" value={finalAmount} onChange={event => setFinalAmount(event.target.value)} placeholder="Set when completed" className="mt-1 w-full border border-white/10 bg-[#111318] p-2.5 text-sm font-normal text-white placeholder:text-gray-600" />
        </label>
        <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-gray-400">Note to customer
          <input value={note} maxLength={300} onChange={event => setNote(event.target.value)} placeholder="Optional" className="mt-1 w-full border border-white/10 bg-[#111318] p-2.5 text-sm font-normal text-white placeholder:text-gray-600" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className="bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50">{saving ? 'Saving…' : 'Save update'}</button>
        {message && <span role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${message.kind === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{message.text}</span>}
      </div>
    </form>
  );
}
