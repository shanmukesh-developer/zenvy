"use client";

// Zenvy Campus Events admin (Others → Campus Events in the customer app).
// Backend: /api/admin/campus-events/* (backend/modules/campusEvents, protect + admin; works while the feature is
// off). Live via admin:changed 'campus_event_admin' and the public data:changed 'campus_event'.
// The gate scanner lives at /campus-events/scan.
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAdminAuth } from '@/utils/useAdminAuth';
import { useLiveSync } from '@/lib/useLiveSync';
import { BUCKETS, campusEventsApi, type BucketKey, type Summary } from '@/lib/campusEventsApi';
import { ErrorBox, StatCard, errText } from '@/components/campusEvents/shared';
import ReviewTab from '@/components/campusEvents/ReviewTab';
import EventsTab from '@/components/campusEvents/EventsTab';
import RegistrationsTab from '@/components/campusEvents/RegistrationsTab';
import OrganizersTab from '@/components/campusEvents/OrganizersTab';
import StaffTab from '@/components/campusEvents/StaffTab';
import ReportsTab from '@/components/campusEvents/ReportsTab';
import SettingsTab from '@/components/campusEvents/SettingsTab';
import AuditTab from '@/components/campusEvents/AuditTab';

type Tab = 'overview' | 'review' | 'events' | 'registrations' | 'organizers' | 'staff' | 'reports' | 'settings' | 'audit';
const TAB_KEYS: Tab[] = ['overview', 'review', 'events', 'registrations', 'organizers', 'staff', 'reports', 'settings', 'audit'];
const LIVE_TYPES = ['campus_event_admin', 'campus_event'];

export default function CampusEventsAdminPage() {
  const { isAuthed } = useAdminAuth();
  const [tab, setTabState] = useState<Tab>('overview');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [tick, setTick] = useState(0);
  const [bucket, setBucket] = useState<BucketKey | ''>('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const h = window.location.hash.replace('#', '') as Tab;
    if (TAB_KEYS.includes(h)) setTabState(h);
  }, []);
  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    try { window.history.replaceState(null, '', `#${t}`); } catch { /* ignore */ }
  }, []);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bump = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => { timer.current = null; setTick((t) => t + 1); }, 600);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useLiveSync(LIVE_TYPES, (events) => {
    if (events.some((e) => e.type === 'campus_event_admin' && e.action === 'created')) setToast('An event was submitted for review');
    bump();
  }, { enabled: isAuthed });
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);

  useEffect(() => {
    if (!isAuthed) return;
    let alive = true;
    campusEventsApi.summary()
      .then((s) => { if (alive) { setSummary(s); setSummaryError(''); } })
      .catch((e) => { if (alive) setSummaryError(errText(e, 'Could not load the Campus Events summary.')); });
    return () => { alive = false; };
  }, [isAuthed, tick]);

  const openBucket = useCallback((b: BucketKey) => { setBucket(b); setTab('events'); }, [setTab]);

  if (!isAuthed) return <div className="p-10 text-center text-sm text-gray-400" role="status">Checking your admin session…</div>;

  const b = summary?.buckets;
  const reviewCount = b ? b.pending_approval + b.changes_pending : undefined;
  const tabs: { key: Tab; label: string; count?: number; alert?: boolean }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'review', label: 'Review queue', count: reviewCount, alert: true },
    { key: 'events', label: 'Events' },
    { key: 'registrations', label: 'Registrations & payments', count: b?.refunds_pending, alert: true },
    { key: 'organizers', label: 'Organizers', count: b?.organizers_pending },
    { key: 'staff', label: 'Check-in staff' },
    { key: 'reports', label: 'Reports' },
    { key: 'settings', label: 'Settings' },
    { key: 'audit', label: 'Audit' },
  ];
  const sw = summary?.switches;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 text-white md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sky-400">Campus Life</p>
          <h1 className="mt-1 text-2xl font-black">🎟️ Zenvy Campus Events</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">Review club and organizer events before students see them, manage registrations, payments and refunds, grant organizer and check-in access, and verify tickets at the gate.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/campus-events/scan" className="bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-500">📷 Check-in scanner</Link>
          {sw && (
            <button type="button" onClick={() => setTab('settings')} className={`border px-4 py-2 text-sm font-bold ${sw.enabled ? 'border-emerald-400/30 text-emerald-300' : 'border-red-400/30 text-red-300'}`}>
              {sw.enabled ? 'Campus Events ON' : 'Campus Events OFF'} · {sw.ticketsReady ? 'tickets ready' : 'tickets NOT configured'}
            </button>
          )}
        </div>
      </header>

      {summaryError && !summary && <div role="alert" className="border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{summaryError} Counts are unavailable until it loads.</div>}
      {toast && <div role="status" className="border border-sky-400/30 bg-sky-400/10 p-3 text-sm text-sky-200">{toast} · <button type="button" className="font-bold underline" onClick={() => setTab('review')}>Open review queue</button></div>}

      <nav className="flex flex-wrap gap-2" aria-label="Campus Events sections">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} aria-pressed={tab === t.key}
            className={`border px-4 py-2 text-sm font-bold ${tab === t.key ? 'border-sky-400 bg-sky-400/10 text-white' : 'border-white/10 text-gray-400 hover:text-white'}`}>
            {t.label}{t.count ? <span className={`ml-2 px-1.5 text-xs text-white ${t.alert ? 'bg-red-500' : 'bg-sky-600'}`}>{t.count}</span> : null}
          </button>
        ))}
      </nav>

      {tab === 'overview' && <Overview summary={summary} error={summaryError} retry={bump} go={setTab} openBucket={openBucket} />}
      {tab === 'review' && <ReviewTab tick={tick} onChanged={bump} />}
      {tab === 'events' && <EventsTab tick={tick} onChanged={bump} bucket={bucket} setBucket={setBucket} />}
      {tab === 'registrations' && <RegistrationsTab tick={tick} onChanged={bump} />}
      {tab === 'organizers' && <OrganizersTab tick={tick} onChanged={bump} />}
      {tab === 'staff' && <StaffTab tick={tick} onChanged={bump} />}
      {tab === 'reports' && <ReportsTab tick={tick} />}
      {tab === 'settings' && <SettingsTab tick={tick} onChanged={bump} />}
      {tab === 'audit' && <AuditTab tick={tick} />}
    </div>
  );
}

function Overview({ summary: s, error, retry, go, openBucket }: { summary: Summary | null; error: string; retry: () => void; go: (t: Tab) => void; openBucket: (b: BucketKey) => void }) {
  if (!s) return error ? <ErrorBox text={error} retry={retry} /> : <div role="status" className="border border-white/10 p-8 text-sm text-gray-400">Loading live counts…</div>;
  const b = s.buckets;
  return (
    <section className="space-y-6" aria-label="Overview">
      {!s.switches.enabled && (
        <div className="border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
          Campus Events is OFF for students (browse, register, teams and organizer submit are closed). Admin tools, check-in and students&apos; own tickets keep working. <button type="button" className="font-bold underline" onClick={() => go('settings')}>Settings</button>
        </div>
      )}
      {!s.switches.ticketsReady && (
        <div role="alert" className="border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">
          CAMPUS_EVENTS_TICKET_SECRET is not set on the server: no tickets can be issued or checked. Set it on Render (32+ random characters) before turning the feature on.
        </div>
      )}
      <div>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Events by stage</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {BUCKETS.map((x) => (
            <button key={x.key} type="button" onClick={() => openBucket(x.key)} className="text-left hover:opacity-90" title={`Open ${x.label}`}>
              <StatCard name={x.label} value={b[x.key]} hint={x.hint} tone={x.key === 'pending_approval' && b[x.key] ? 'warn' : x.key === 'cancelled' && b[x.key] ? 'bad' : 'plain'} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Needs action</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { n: b.pending_approval, t: 'events waiting for approval', tab: 'review' as Tab },
            { n: b.changes_pending, t: 'live events with changes to review', tab: 'review' as Tab },
            { n: b.organizers_pending, t: 'organizer applications', tab: 'organizers' as Tab },
            { n: b.refunds_pending, t: 'refunds pending', tab: 'registrations' as Tab },
            { n: b.venue_due, t: 'confirmed registrations with a fee due at the venue', tab: 'registrations' as Tab },
          ].map((x) => (
            <button key={x.t} type="button" onClick={() => go(x.tab)} className={`border p-4 text-left hover:bg-white/[0.03] ${x.n ? 'border-amber-400/40' : 'border-white/10'}`}>
              <span className={`text-2xl font-black tabular-nums ${x.n ? 'text-amber-300' : 'text-gray-400'}`}>{x.n}</span>
              <span className="ml-2 text-sm text-gray-300">{x.t}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
        <span>Payments: wallet {s.switches.walletEnabled ? 'ON' : 'off'} · online {s.switches.onlinePayEnabled ? (s.switches.razorpayKeysPresent ? 'ON' : 'on but Razorpay keys missing') : 'off'} · pay at venue always available to organizers</span>
      </div>
      <p className="text-xs text-gray-500">All numbers are counted live from the database and refresh when anything changes.</p>
    </section>
  );
}
