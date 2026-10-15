"use client";

// Student vehicle rentals (peer to peer): listing review queue, driving licence verification,
// bookings and reports. Backend: /api/admin/rentals/* (backend/modules/rentals). Live via admin:changed.
import { useCallback, useEffect, useRef, useState } from 'react';
import { adminRequest } from '@/lib/api';
import { useAdminAuth } from '@/utils/useAdminAuth';
import { useLiveSync } from '@/lib/useLiveSync';

type Tab = 'listings' | 'licences' | 'bookings' | 'reports';

interface Summary { pendingListings: number; liveListings: number; pendingLicences: number; openReports: number; openBookings: number; enabled: boolean }
interface AdminListing {
  id: string; title: string; vehicleType: string; make: string | null; model: string | null; year: number | null; fuel: string | null;
  transmission: string | null; seats: number | null; registrationNumber: string | null; registrationDisplay: string | null; plateType: string | null;
  photos: string[]; documents: { rc: string | null; insurance: string | null; licence: string | null };
  pricePerHour: number | null; pricePerDay: number | null; securityDeposit: number; minHours: number; kmLimitPerDay: number | null; extraPerKm: number | null;
  fuelPolicy: string | null; pickupLocation: string | null; rules: string | null; helmetIncluded: boolean; status: string; rejectionReason: string | null;
  submittedAt: string | null; reviewedAt: string | null; createdAt: string | null; ratingAvg: number; ratingCount: number; tripCount: number;
  weeklyHours: Record<string, { start: string; end: string } | null>; blockedDates: { start: string; end: string }[];
  owner: { id: string; name: string; phone: string | null; email: string | null; isActive: boolean } | null;
}
interface AdminLicence {
  id: string; userId: string; status: string; licenceNumber: string | null; classes: string[]; verifiedClasses: string[] | null; expiresOn: string | null;
  frontImage: string | null; backImage: string | null; rejectionReason: string | null; submittedAt: string | null; reviewedAt: string | null;
  user: { id: string; name: string; phone: string | null; email: string | null } | null;
}
interface AdminBooking {
  id: string; status: string; listingId: string; vehicleTitle: string; vehicleType: string; registration: string | null; startAt: string; endAt: string;
  billableHours: number; rentAmount: number; depositAmount: number; payAtHandover: number; extraCharges: number; finalAmount: number | null;
  renterNote: string | null; declineReason: string | null; cancelReason: string | null; cancelledBy: string | null; createdAt: string;
  owner: { id: string; name?: string; phone?: string | null }; renter: { id: string; name?: string; phone?: string | null };
}
interface AdminReport {
  id: string; bookingId: string; category: string; description: string; photos: string[]; status: string; adminNote: string | null; reporterRole: string;
  reporter: { id: string; name?: string; phone?: string | null }; against: { id: string; name?: string; phone?: string | null } | null;
  booking: { id: string; status: string; vehicleTitle: string; startAt: string; endAt: string } | null; createdAt: string;
}

const LISTING_STATUSES = ['PENDING_REVIEW', 'APPROVED', 'PAUSED', 'REJECTED', 'DRAFT', 'DELETED', 'ALL'];
const LICENCE_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED', 'ALL'];
const BOOKING_STATUSES = ['', 'OPEN', 'REQUESTED', 'ACCEPTED', 'ACTIVE', 'RETURNED', 'COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED'];
const REPORT_STATUSES = ['ACTIVE', 'OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED', 'ALL'];
const LICENCE_CLASSES = ['MCWOG', 'MCWG', 'LMV', 'LMV-NT', 'TRANS'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const label = (v: string) => v.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const inr = (n?: number | null) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const when = (v?: string | null) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—';
};
const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const statusTone: Record<string, string> = {
  PENDING_REVIEW: 'text-amber-300 border-amber-400/30', PENDING: 'text-amber-300 border-amber-400/30', REQUESTED: 'text-amber-300 border-amber-400/30', OPEN: 'text-amber-300 border-amber-400/30',
  APPROVED: 'text-emerald-300 border-emerald-400/30', VERIFIED: 'text-emerald-300 border-emerald-400/30', ACCEPTED: 'text-emerald-300 border-emerald-400/30', COMPLETED: 'text-emerald-300 border-emerald-400/30', RESOLVED: 'text-emerald-300 border-emerald-400/30',
  ACTIVE: 'text-sky-300 border-sky-400/30', RETURNED: 'text-violet-300 border-violet-400/30', REVIEWING: 'text-sky-300 border-sky-400/30', PAUSED: 'text-indigo-300 border-indigo-400/30',
  REJECTED: 'text-red-300 border-red-400/30', DECLINED: 'text-red-300 border-red-400/30',
};
const Pill = ({ s }: { s: string }) => <span className={`border px-2 py-0.5 text-xs font-bold ${statusTone[s] || 'text-gray-300 border-white/10'}`}>{label(s)}</span>;

export default function RentalsAdminPage() {
  const { isAuthed } = useAdminAuth();
  const [tab, setTab] = useState<Tab>('listings');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [tick, setTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  // Live: any rentals queue change reloads quietly (coalesced).
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bump = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => { timer.current = null; setTick((t) => t + 1); }, 600);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useLiveSync(['rental_listing', 'rental_licence', 'rental_booking', 'rental_report'], (events) => {
    if (events.some((e) => e.action === 'created')) setToast(events.some((e) => e.type === 'rental_report' && e.action === 'created') ? 'New rental report' : 'New item in the rentals queue');
    bump();
  }, { enabled: isAuthed });
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  useEffect(() => {
    if (!isAuthed) return;
    let alive = true;
    adminRequest<Summary>('/api/admin/rentals/summary')
      .then((s) => { if (alive) { setSummary(s); setSummaryError(''); } })
      .catch((e) => { if (alive) setSummaryError(errText(e, 'Could not load the rentals summary.')); });
    return () => { alive = false; };
  }, [isAuthed, tick]);

  const toggle = async () => {
    if (!summary) return;
    const next = !summary.enabled;
    if (!next && !window.confirm('Pause student vehicle rentals? Students will not be able to browse, list or request. Existing trips keep working.')) return;
    try {
      const r = await adminRequest<{ enabled: boolean }>('/api/admin/rentals/settings', { method: 'PUT', body: JSON.stringify({ enabled: next }) });
      setSummary({ ...summary, enabled: r.enabled });
    } catch (e) {
      window.alert(errText(e, 'Could not change the setting.'));
    }
  };

  if (!isAuthed) return <div className="p-10 text-center text-sm text-gray-400" role="status">Checking your admin session…</div>;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'listings', label: 'Listings review', count: summary?.pendingListings },
    { key: 'licences', label: 'Driving licences', count: summary?.pendingLicences },
    { key: 'bookings', label: 'Bookings', count: summary?.openBookings },
    { key: 'reports', label: 'Reports', count: summary?.openReports },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 text-white md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sky-400">Campus Operations</p>
          <h1 className="mt-1 text-2xl font-black">Student Vehicle Rentals</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">Students rent bikes, scooters and cars to each other. Review listings and their RC / insurance, verify renters&apos; driving licences, and handle reports. Money is paid in cash between students; Zenvy does not hold it.</p>
        </div>
        <div className="flex items-center gap-3">
          {summary && <span className="text-sm text-gray-400">{summary.liveListings} live vehicles</span>}
          {summary && (
            <button type="button" onClick={toggle} className={`border px-4 py-2 text-sm font-bold ${summary.enabled ? 'border-emerald-400/30 text-emerald-300' : 'border-red-400/30 text-red-300'}`}>
              {summary.enabled ? 'Rentals ON · pause' : 'Rentals PAUSED · turn on'}
            </button>
          )}
        </div>
      </header>

      {summaryError && !summary && <div role="alert" className="border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{summaryError} The on/off switch and counts are unavailable until it loads.</div>}
      {toast && <div role="status" className="border border-sky-400/30 bg-sky-400/10 p-3 text-sm text-sky-200">{toast}</div>}

      <nav className="flex flex-wrap gap-2" aria-label="Rentals sections">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} aria-pressed={tab === t.key}
            className={`border px-4 py-2 text-sm font-bold ${tab === t.key ? 'border-sky-400 bg-sky-400/10 text-white' : 'border-white/10 text-gray-400 hover:text-white'}`}>
            {t.label}{t.count ? <span className="ml-2 bg-red-500 px-1.5 text-xs text-white">{t.count}</span> : null}
          </button>
        ))}
      </nav>

      {tab === 'listings' && <ListingsTab tick={tick} onChanged={bump} />}
      {tab === 'licences' && <LicencesTab tick={tick} onChanged={bump} />}
      {tab === 'bookings' && <BookingsTab tick={tick} />}
      {tab === 'reports' && <ReportsTab tick={tick} onChanged={bump} />}
    </div>
  );
}

function useLoader<T>(path: string, tick: number, pick: (d: any) => T[]) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(0);
  const pickRef = useRef(pick);
  pickRef.current = pick;
  const first = useRef(true);
  // A new filter shows the spinner; live / manual reloads refresh quietly. (Declared before the loader.)
  useEffect(() => { first.current = true; }, [path]);
  useEffect(() => {
    let alive = true;
    if (first.current) setLoading(true);
    adminRequest<any>(path)
      .then((d) => { if (alive) { setRows(pickRef.current(d)); setError(''); } })
      .catch((e) => { if (alive) setError(errText(e, 'Could not load.')); })
      .finally(() => { if (alive) { setLoading(false); first.current = false; } });
    return () => { alive = false; };
  }, [path, tick, manual]);
  return { rows, loading, error, reload: () => setManual((m) => m + 1) };
}

function Empty({ text }: { text: string }) {
  return <div className="border border-white/10 p-10 text-center text-sm text-gray-400">{text}</div>;
}
function ErrorBox({ text, retry }: { text: string; retry: () => void }) {
  return <div role="alert" className="flex items-center justify-between gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{text}<button type="button" onClick={retry} className="font-bold underline">Retry</button></div>;
}
function Select({ value, onChange, options, name }: { value: string; onChange: (v: string) => void; options: string[]; name: string }) {
  return (
    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">{name}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="ml-2 border border-white/10 bg-[#111318] p-2 text-sm text-white">
        {options.map((o) => <option key={o} value={o}>{o ? label(o) : 'All'}</option>)}
      </select>
    </label>
  );
}
/** Only http(s) or same-origin links are rendered as links/images (never javascript: or data: from user content). */
const safeUrl = (u: string | null | undefined) => {
  const v = String(u || '').trim();
  return /^https?:\/\//i.test(v) || (v.startsWith('/') && !v.startsWith('//')) ? v : null;
};
function Doc({ url: rawUrl, name }: { url: string | null; name: string }) {
  const url = safeUrl(rawUrl);
  if (!url) return <div className="flex h-32 items-center justify-center border border-dashed border-red-400/40 text-xs text-red-300">{name} missing</div>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block border border-white/10" title={`Open ${name}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={name} loading="lazy" className="h-32 w-full object-cover" />
      <span className="block bg-black/40 px-2 py-1 text-xs font-bold text-gray-200">{name} ↗</span>
    </a>
  );
}

// ── Listings ──────────────────────────────────────────────────────────────
function ListingsTab({ tick, onChanged }: { tick: number; onChanged: () => void }) {
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 400); return () => clearTimeout(t); }, [q]);
  const { rows, loading, error, reload } = useLoader<AdminListing>(`/api/admin/rentals/listings?status=${status}${query ? `&q=${encodeURIComponent(query)}` : ''}`, tick, (d) => d.listings || []);
  return (
    <section className="space-y-4" aria-label="Listings">
      <div className="flex flex-wrap items-center gap-4 border border-white/10 bg-white/[0.02] p-4">
        <Select name="Status" value={status} onChange={setStatus} options={LISTING_STATUSES} />
        <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Plate
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="AP07…" className="ml-2 border border-white/10 bg-[#111318] p-2 text-sm font-normal text-white" />
        </label>
        <span className="text-sm text-gray-500">{rows.length} listing{rows.length === 1 ? '' : 's'}</span>
      </div>
      {error && <ErrorBox text={error} retry={reload} />}
      {loading ? <div role="status" className="border border-white/10 p-8 text-sm text-gray-400">Loading listings…</div>
        : rows.length === 0 ? <Empty text={status === 'PENDING_REVIEW' ? 'No vehicles waiting for review.' : 'No listings with this status.'} />
          : rows.map((l) => <ListingCard key={`${l.id}-${l.status}`} l={l} onChanged={onChanged} />)}
    </section>
  );
}

function ListingCard({ l, onChanged }: { l: AdminListing; onChanged: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [state, setState] = useState(l.status);
  const act = async (kind: 'approve' | 'reject') => {
    if (kind === 'reject' && reason.trim().length < 5) return setMsg({ ok: false, text: 'Write a reason the student will see (at least 5 characters).' });
    if (kind === 'reject' && l.status === 'APPROVED' && !window.confirm('Take this live vehicle down? Pending requests will be declined.')) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminRequest<{ listing: AdminListing }>(`/api/admin/rentals/listings/${l.id}/${kind}`, { method: 'POST', body: JSON.stringify(kind === 'reject' ? { reason: reason.trim() } : {}) });
      setState(r.listing.status);
      setMsg({ ok: true, text: kind === 'approve' ? 'Approved. The vehicle is live and the owner was notified.' : 'Rejected. The owner sees your reason.' });
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: errText(e, 'Could not update the listing.') });
    } finally {
      setBusy(false);
    }
  };
  const weekly = Object.entries(l.weeklyHours || {}).filter(([, v]) => !!v) as [string, { start: string; end: string }][];
  return (
    <article className="border border-white/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">{l.title}{l.year ? ` · ${l.year}` : ''}</h2>
            <span className="border border-sky-400/20 px-2 py-0.5 text-xs font-bold text-sky-300">{label(l.vehicleType)}</span>
            <Pill s={state} />
            {l.plateType && <span className={`border px-2 py-0.5 text-xs font-bold ${l.plateType === 'PRIVATE' ? 'border-amber-400/40 text-amber-300' : 'border-emerald-400/40 text-emerald-300'}`}>Plate: {l.plateType === 'PRIVATE' ? 'Private (white)' : 'Commercial rental'}</span>}
          </div>
          <p className="mt-2 font-mono text-sm text-gray-200">{l.registrationDisplay || l.registrationNumber || 'No registration'}</p>
          <p className="mt-1 text-xs text-gray-500">Submitted {when(l.submittedAt)} · #{l.id.slice(-8).toUpperCase()}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-bold">{l.owner?.name || 'Unknown owner'}{l.owner && !l.owner.isActive ? ' (suspended)' : ''}</p>
          <p className="text-gray-400">{l.owner?.phone || ''}{l.owner?.email ? ` · ${l.owner.email}` : ''}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(l.photos || []).slice(0, 3).map((u, i) => <Doc key={u} url={u} name={`Photo ${i + 1}`} />)}
        <Doc url={l.documents?.rc ?? null} name="RC" />
        <Doc url={l.documents?.insurance ?? null} name="Insurance" />
        <Doc url={l.documents?.licence ?? null} name="Owner licence" />
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-xs uppercase tracking-wider text-gray-500">Price</dt><dd>{[l.pricePerHour ? `${inr(l.pricePerHour)}/hr` : null, l.pricePerDay ? `${inr(l.pricePerDay)}/day` : null].filter(Boolean).join(' · ') || '—'} · min {l.minHours} h</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-gray-500">Deposit / km</dt><dd>{inr(l.securityDeposit)} · {l.kmLimitPerDay ? `${l.kmLimitPerDay} km/day${l.extraPerKm ? `, ₹${l.extraPerKm}/km` : ''}` : 'no km limit'}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-gray-500">Vehicle</dt><dd>{[l.fuel, l.transmission, l.seats ? `${l.seats} seats` : null, l.vehicleType !== 'CAR' ? (l.helmetIncluded ? 'helmet incl.' : 'no helmet') : null].filter(Boolean).map((x) => label(String(x))).join(' · ')}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-gray-500">Pickup</dt><dd>{l.pickupLocation || '—'}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-gray-500">Hours</dt><dd>{weekly.length ? weekly.map(([d, w]) => `${DAYS[Number(d)]} ${w.start}-${w.end}`).join(', ') : 'Any time'}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-gray-500">Blocked</dt><dd>{l.blockedDates?.length ? l.blockedDates.map((b) => (b.start === b.end ? b.start : `${b.start}→${b.end}`)).join(', ') : '—'}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-gray-500">Track record</dt><dd>{l.tripCount} trips · {l.ratingCount ? `★ ${l.ratingAvg.toFixed(1)} (${l.ratingCount})` : 'no ratings'}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-gray-500">Fuel policy</dt><dd>{l.fuelPolicy || '—'}</dd></div>
      </dl>
      {l.rules && <p className="mt-3 whitespace-pre-wrap border-l border-white/10 pl-3 text-sm text-gray-300">{l.rules}</p>}
      {l.rejectionReason && <p className="mt-3 text-sm text-red-300">Last rejection: {l.rejectionReason}</p>}
      {['PENDING_REVIEW', 'APPROVED', 'PAUSED'].includes(state) && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
          {state === 'PENDING_REVIEW' && <button type="button" disabled={busy} onClick={() => act('approve')} className="bg-emerald-600 px-4 py-2 text-sm font-bold hover:bg-emerald-500 disabled:opacity-50">Approve</button>}
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder={state === 'PENDING_REVIEW' ? 'Reason to reject (sent to owner)' : 'Reason to take it down'} className="min-w-[260px] flex-1 border border-white/10 bg-[#111318] p-2 text-sm text-white" />
          <button type="button" disabled={busy} onClick={() => act('reject')} className="border border-red-400/40 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-50">{state === 'PENDING_REVIEW' ? 'Reject' : 'Take down'}</button>
        </div>
      )}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
    </article>
  );
}

// ── Licences ──────────────────────────────────────────────────────────────
function LicencesTab({ tick, onChanged }: { tick: number; onChanged: () => void }) {
  const [status, setStatus] = useState('PENDING');
  const { rows, loading, error, reload } = useLoader<AdminLicence>(`/api/admin/rentals/licences?status=${status}`, tick, (d) => d.licences || []);
  return (
    <section className="space-y-4" aria-label="Driving licences">
      <div className="flex flex-wrap items-center gap-4 border border-white/10 bg-white/[0.02] p-4">
        <Select name="Status" value={status} onChange={setStatus} options={LICENCE_STATUSES} />
        <span className="text-sm text-gray-500">Renters can request with a pending licence; owners can only accept once you verify it.</span>
      </div>
      {error && <ErrorBox text={error} retry={reload} />}
      {loading ? <div role="status" className="border border-white/10 p-8 text-sm text-gray-400">Loading licences…</div>
        : rows.length === 0 ? <Empty text="No licences here." /> : rows.map((l) => <LicenceCard key={`${l.id}-${l.status}-${l.submittedAt}`} l={l} onChanged={onChanged} />)}
    </section>
  );
}

function LicenceCard({ l, onChanged }: { l: AdminLicence; onChanged: () => void }) {
  const [classes, setClasses] = useState<string[]>(l.verifiedClasses || l.classes || []);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(l.status);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const act = async (kind: 'verify' | 'reject') => {
    if (kind === 'verify' && !classes.length) return setMsg({ ok: false, text: 'Tick at least one class printed on the licence.' });
    if (kind === 'reject' && reason.trim().length < 5) return setMsg({ ok: false, text: 'Write a reason (at least 5 characters).' });
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminRequest<{ licence: AdminLicence }>(`/api/admin/rentals/licences/${l.id}/${kind}`, { method: 'POST', body: JSON.stringify(kind === 'verify' ? { classes } : { reason: reason.trim() }) });
      setState(r.licence.status);
      setMsg({ ok: true, text: kind === 'verify' ? `Verified for ${classes.join(', ')}.` : 'Rejected. The student was notified.' });
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: errText(e, 'Could not update the licence.') });
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="grid gap-5 border border-white/10 p-5 lg:grid-cols-[1fr_1.4fr]">
      <div className="grid grid-cols-2 gap-3">
        <Doc url={l.frontImage} name="Front" />
        {l.backImage ? <Doc url={l.backImage} name="Back" /> : <div className="flex h-32 items-center justify-center border border-dashed border-white/10 text-xs text-gray-500">No back photo</div>}
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{l.user?.name || l.userId}</h2><Pill s={state} /></div>
        <p className="mt-1 text-sm text-gray-400">{l.user?.phone || ''}{l.user?.email ? ` · ${l.user.email}` : ''}</p>
        <p className="mt-3 font-mono text-base">{l.licenceNumber}</p>
        <p className="mt-1 text-sm text-gray-400">Declared: {(l.classes || []).join(', ') || '—'}{l.expiresOn ? ` · valid till ${l.expiresOn}` : ''} · submitted {when(l.submittedAt)}</p>
        {l.rejectionReason && <p className="mt-1 text-sm text-red-300">Rejected: {l.rejectionReason}</p>}
        <fieldset className="mt-4">
          <legend className="text-xs font-bold uppercase tracking-wider text-gray-400">Classes printed on the card</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {LICENCE_CLASSES.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={classes.includes(c)} onChange={(e) => setClasses((cur) => (e.target.checked ? [...cur, c] : cur.filter((x) => x !== c)))} />{c}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {state !== 'VERIFIED' && <button type="button" disabled={busy} onClick={() => act('verify')} className="bg-emerald-600 px-4 py-2 text-sm font-bold hover:bg-emerald-500 disabled:opacity-50">Verify</button>}
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Reason to reject" className="min-w-[220px] flex-1 border border-white/10 bg-[#111318] p-2 text-sm text-white" />
          <button type="button" disabled={busy} onClick={() => act('reject')} className="border border-red-400/40 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-50">Reject</button>
        </div>
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
      </div>
    </article>
  );
}

// ── Bookings ──────────────────────────────────────────────────────────────
function BookingsTab({ tick }: { tick: number }) {
  const [status, setStatus] = useState('OPEN');
  const [search, setSearch] = useState('');
  const { rows, loading, error, reload } = useLoader<AdminBooking>(`/api/admin/rentals/bookings${status ? `?status=${status}` : ''}`, tick, (d) => d.bookings || []);
  const q = search.trim().toLowerCase();
  const list = rows.filter((b) => !q || [b.id, b.vehicleTitle, b.registration, b.owner.name, b.owner.phone, b.renter.name, b.renter.phone].some((v) => String(v || '').toLowerCase().includes(q)));
  return (
    <section className="space-y-4" aria-label="Bookings">
      <div className="flex flex-wrap items-center gap-4 border border-white/10 bg-white/[0.02] p-4">
        <Select name="Status" value={status} onChange={setStatus} options={BOOKING_STATUSES} />
        <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Search
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, plate, ID" className="ml-2 border border-white/10 bg-[#111318] p-2 text-sm font-normal text-white" />
        </label>
        <span className="text-sm text-gray-500">{list.length} of {rows.length}</span>
      </div>
      {error && <ErrorBox text={error} retry={reload} />}
      {loading ? <div role="status" className="border border-white/10 p-8 text-sm text-gray-400">Loading bookings…</div>
        : list.length === 0 ? <Empty text="No bookings match." /> : (
          <div className="overflow-x-auto border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-gray-400">
                <tr><th className="p-3">Vehicle</th><th className="p-3">Owner → renter</th><th className="p-3">When</th><th className="p-3">Cash</th><th className="p-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {list.map((b) => (
                  <tr key={b.id} className="align-top">
                    <td className="p-3"><p className="font-bold">{b.vehicleTitle}</p><p className="font-mono text-xs text-gray-400">{b.registration || ''}</p><p className="text-xs text-gray-500">#{b.id.slice(-8).toUpperCase()}</p></td>
                    <td className="p-3"><p>{b.owner.name || b.owner.id} <span className="text-gray-500">{b.owner.phone || ''}</span></p><p className="text-gray-300">→ {b.renter.name || b.renter.id} <span className="text-gray-500">{b.renter.phone || ''}</span></p>{b.renterNote && <p className="mt-1 text-xs text-gray-500">“{b.renterNote}”</p>}</td>
                    <td className="p-3 text-xs"><p>{when(b.startAt)}</p><p className="text-gray-400">→ {when(b.endAt)}</p><p className="text-gray-500">{b.billableHours} h billed</p></td>
                    <td className="p-3 text-xs"><p>Rent {inr(b.rentAmount)}</p><p className="text-gray-400">Deposit {inr(b.depositAmount)}</p>{b.extraCharges > 0 && <p className="text-amber-300">Extras {inr(b.extraCharges)}</p>}{b.finalAmount != null && <p className="font-bold">Final {inr(b.finalAmount)}</p>}</td>
                    <td className="p-3"><Pill s={b.status} />{(b.cancelReason || b.declineReason) && <p className="mt-1 max-w-[220px] text-xs text-gray-400">{b.cancelledBy ? `${label(b.cancelledBy)}: ` : ''}{b.cancelReason || b.declineReason}</p>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
}

// ── Reports ───────────────────────────────────────────────────────────────
function ReportsTab({ tick, onChanged }: { tick: number; onChanged: () => void }) {
  const [status, setStatus] = useState('ACTIVE');
  const { rows, loading, error, reload } = useLoader<AdminReport>(`/api/admin/rentals/reports?status=${status}`, tick, (d) => d.reports || []);
  return (
    <section className="space-y-4" aria-label="Reports">
      <div className="flex flex-wrap items-center gap-4 border border-white/10 bg-white/[0.02] p-4">
        <Select name="Status" value={status} onChange={setStatus} options={REPORT_STATUSES} />
        <span className="text-sm text-gray-500">Damage, no-shows, late returns and safety issues reported by owners and renters.</span>
      </div>
      {error && <ErrorBox text={error} retry={reload} />}
      {loading ? <div role="status" className="border border-white/10 p-8 text-sm text-gray-400">Loading reports…</div>
        : rows.length === 0 ? <Empty text="No reports here." /> : rows.map((r) => <ReportCard key={`${r.id}-${r.status}`} r={r} onChanged={onChanged} />)}
    </section>
  );
}

function ReportCard({ r, onChanged }: { r: AdminReport; onChanged: () => void }) {
  const [next, setNext] = useState(r.status === 'OPEN' ? 'REVIEWING' : r.status);
  const [note, setNote] = useState(r.adminNote || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await adminRequest(`/api/admin/rentals/reports/${r.id}/status`, { method: 'POST', body: JSON.stringify({ status: next, note: note.trim() || undefined }) });
      setMsg({ ok: true, text: ['RESOLVED', 'DISMISSED'].includes(next) ? 'Closed. The reporter was notified.' : 'Updated.' });
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: errText(e, 'Could not update the report.') });
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="border border-white/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{label(r.category)}</h2><Pill s={r.status} /><span className="text-xs text-gray-500">{when(r.createdAt)}</span></div>
          <p className="mt-1 text-sm text-gray-400">{r.booking ? `${r.booking.vehicleTitle || 'Vehicle'} · ${when(r.booking.startAt)} → ${when(r.booking.endAt)} · booking ${label(r.booking.status)}` : `Booking ${r.bookingId}`}</p>
        </div>
        <div className="text-right text-sm">
          <p>By <b>{r.reporter.name || r.reporter.id}</b> ({label(r.reporterRole || '')}) {r.reporter.phone || ''}</p>
          {r.against && <p className="text-gray-400">About {r.against.name || r.against.id} {r.against.phone || ''}</p>}
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-gray-200">{r.description}</p>
      {r.photos?.length > 0 && <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{r.photos.map((u, i) => <Doc key={u} url={u} name={`Photo ${i + 1}`} />)}</div>}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
        <select value={next} onChange={(e) => setNext(e.target.value)} className="border border-white/10 bg-[#111318] p-2 text-sm text-white" aria-label="Report status">
          {['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Note (shown to the reporter when closed)" className="min-w-[260px] flex-1 border border-white/10 bg-[#111318] p-2 text-sm text-white" />
        <button type="button" disabled={busy} onClick={save} className="bg-sky-600 px-4 py-2 text-sm font-bold hover:bg-sky-500 disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
      </div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
    </article>
  );
}
